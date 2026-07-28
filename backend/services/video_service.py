"""Volcengine Ark Seedance 2.0 video generation and TOS reference storage."""
from __future__ import annotations

import mimetypes
import os
import uuid
from urllib.parse import urlparse

import httpx
import tos
from fastapi import HTTPException, UploadFile
from tos import HttpMethodType

from routers.storage import get_storage_config_raw
from services.provider_service import get_provider_api_key

MAX_REFERENCE_SIZE = 100 * 1024 * 1024
VIDEO_MODELS = {
    "doubao-seedance-2-0": {"id": "doubao-seedance-2-0-260128", "resolutions": {"480p", "720p", "1080p", "4k"}, "text_image_price": 46, "video_reference_price": 28},
    "doubao-seedance-2-0-fast": {"id": "doubao-seedance-2-0-fast-260128", "resolutions": {"480p", "720p"}, "text_image_price": 37, "video_reference_price": 22},
    "doubao-seedance-2-0-mini": {"id": "doubao-seedance-2-0-mini-260615", "resolutions": {"480p", "720p"}, "text_image_price": 23, "video_reference_price": 14},
}


def resolve_model_name(model_name: str) -> str:
    return VIDEO_MODELS.get(model_name, {}).get("id", model_name)


def validate_video_options(model_name: str, resolution: str, duration: int) -> None:
    if not 4 <= duration <= 15:
        raise HTTPException(status_code=422, detail="视频时长必须为 4 至 15 秒")
    base_model = next((key for key, value in VIDEO_MODELS.items() if model_name in {key, value["id"]}), None)
    if base_model and resolution not in VIDEO_MODELS[base_model]["resolutions"]:
        raise HTTPException(status_code=422, detail=f"{base_model} 仅支持 {', '.join(sorted(VIDEO_MODELS[base_model]['resolutions']))}")


async def _storage_client() -> tuple[tos.TosClientV2, dict]:
    config = await get_storage_config_raw()
    if not config or not all(config.get(key) for key in ("access_key", "secret_key", "bucket", "endpoint")):
        raise HTTPException(status_code=400, detail="请先在系统配置中完成火山引擎 TOS 对象存储配置")
    return tos.TosClientV2(config["access_key"], config["secret_key"], config["endpoint"], config["region"]), config


def _signed_url(client: tos.TosClientV2, config: dict, key: str) -> str:
    return client.pre_signed_url(HttpMethodType.Http_Method_Get, config["bucket"], key, expires=24 * 3600).signed_url


async def upload_reference_bytes(content: bytes, filename: str, content_type: str | None = None) -> dict:
    if not content:
        raise HTTPException(status_code=422, detail="参考素材不能为空")
    if len(content) > MAX_REFERENCE_SIZE:
        raise HTTPException(status_code=413, detail="参考素材不能超过 100MB")
    client, config = await _storage_client()
    suffix = os.path.splitext(filename)[1].lower() or mimetypes.guess_extension(content_type or "") or ""
    key = f"video-references/{uuid.uuid4().hex}{suffix}"
    try:
        client.put_object(config["bucket"], key, content=content, content_type=content_type)
        return {"key": key, "url": _signed_url(client, config, key)}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"上传参考素材到对象存储失败: {exc}") from exc


async def upload_reference_file(file: UploadFile) -> dict:
    content_type = file.content_type or ""
    if not content_type.startswith(("image/", "video/", "audio/")):
        raise HTTPException(status_code=422, detail="参考素材仅支持图片、视频或音频文件")
    content = await file.read(MAX_REFERENCE_SIZE + 1)
    result = await upload_reference_bytes(content, file.filename or "reference", content_type)
    result["media_type"] = content_type.split("/", 1)[0]
    return result


async def ensure_tos_reference(url: str) -> str:
    """Copy every reference URL to the configured TOS bucket before provider submission."""
    if not url:
        raise HTTPException(status_code=422, detail="参考素材 URL 不能为空")
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=422, detail="参考素材必须是可下载的 HTTP(S) URL 或通过上传接口上传")
    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            content = response.content
            content_type = response.headers.get("content-type", "").split(";", 1)[0]
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=422, detail=f"无法下载参考素材: {exc}") from exc
    filename = os.path.basename(parsed.path) or "reference"
    return (await upload_reference_bytes(content, filename, content_type))["url"]


def _endpoint(base_url: str, task_id: str | None = None) -> str:
    endpoint = base_url.rstrip("/")
    return f"{endpoint}/{task_id}" if task_id else endpoint


async def create_provider_task(model: dict, payload: dict) -> dict:
    api_key = await get_provider_api_key(model.get("provider", ""), model.get("api_key", ""))
    if not api_key:
        raise HTTPException(status_code=400, detail=f"未配置 {model.get('provider', '当前服务商')} API Key")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(_endpoint(model["api_base_url"]), headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"火山视频任务创建失败: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"火山视频服务不可用: {exc}") from exc


async def query_provider_task(model: dict, provider_task_id: str) -> dict:
    api_key = await get_provider_api_key(model.get("provider", ""), model.get("api_key", ""))
    if not api_key:
        raise HTTPException(status_code=400, detail=f"未配置 {model.get('provider', '当前服务商')} API Key")
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(_endpoint(model["api_base_url"], provider_task_id), headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"火山视频任务查询失败: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"火山视频服务不可用: {exc}") from exc


async def cancel_provider_task(model: dict, provider_task_id: str) -> dict:
    api_key = await get_provider_api_key(model.get("provider", ""), model.get("api_key", ""))
    if not api_key:
        raise HTTPException(status_code=400, detail=f"未配置 {model.get('provider', '当前服务商')} API Key")
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.delete(_endpoint(model["api_base_url"], provider_task_id), headers=headers)
            response.raise_for_status()
            return response.json() if response.content else {}
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"火山视频任务取消失败: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"火山视频服务不可用: {exc}") from exc


def provider_task_id(response: dict) -> str:
    return response.get("id") or response.get("task_id") or response.get("data", {}).get("id") or ""


def provider_status(response: dict) -> str:
    return (response.get("status") or response.get("data", {}).get("status") or "submitted").lower()


def provider_video_url(response: dict) -> str | None:
    content = response.get("content") or response.get("data", {}).get("content") or {}
    return content.get("video_url") or response.get("video_url") or response.get("data", {}).get("video_url")


def provider_usage(response: dict) -> tuple[float, float]:
    usage = response.get("usage") or response.get("data", {}).get("usage") or {}
    return float(usage.get("prompt_tokens", usage.get("input_tokens", 0)) or 0), float(usage.get("completion_tokens", usage.get("output_tokens", usage.get("total_tokens", 0))) or 0)