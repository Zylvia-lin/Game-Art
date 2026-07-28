"""Video generation API backed by Volcengine Ark Seedance 2.0."""
from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field, model_validator

from database import fetch_one, get_pool
from services.video_service import (
    VIDEO_MODELS, cancel_provider_task, create_provider_task, ensure_tos_reference,
    provider_status, provider_task_id, provider_usage, provider_video_url,
    query_provider_task, resolve_model_name, upload_reference_file, validate_video_options,
)

router = APIRouter(prefix="/api/video", tags=["video"])


class VideoGenerationRequest(BaseModel):
    project_id: str | None = None
    model_id: str | None = None
    prompt: str = Field(min_length=1, max_length=5000)
    model: str | None = None
    resolution: Literal["480p", "720p", "1080p", "4k"] = "720p"
    duration: int = 5
    ratio: str = "16:9"
    generate_audio: bool = False
    first_frame_url: str | None = None
    last_frame_url: str | None = None
    reference_images: list[str] = Field(default_factory=list, max_length=9)
    reference_videos: list[str] = Field(default_factory=list, max_length=3)
    reference_audios: list[str] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def validate_reference_modes(self):
        has_frames = bool(self.first_frame_url or self.last_frame_url)
        has_multimodal = bool(self.reference_images or self.reference_videos or self.reference_audios)
        if self.last_frame_url and not self.first_frame_url:
            raise ValueError("末帧模式必须同时提供首帧")
        if has_frames and has_multimodal:
            raise ValueError("首帧/首尾帧模式不能与多模态参考素材混用")
        return self


async def _model_config(model_id: str | None) -> dict:
    if model_id:
        model = await fetch_one("SELECT * FROM model_configs WHERE id = $1 AND type = 'video'", model_id)
    else:
        model = await fetch_one("SELECT * FROM model_configs WHERE type = 'video' AND is_default = true LIMIT 1")
    if not model:
        raise HTTPException(status_code=400, detail="请先在系统配置中添加并设定默认视频模型")
    return model


async def _store_task(project_id: str | None, model: dict, provider_id: str, request_payload: dict) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO video_tasks (project_id, model_id, provider_task_id, request_payload, status)
               VALUES ($1, $2, $3, $4::jsonb, 'submitted') RETURNING *""",
            project_id, model["id"], provider_id, json.dumps(request_payload),
        )
    return dict(row)


@router.get("/models")
async def list_supported_models():
    return [{"name": name, "model_name": spec["id"], "resolutions": sorted(spec["resolutions"]), "text_image_price": spec["text_image_price"], "video_reference_price": spec["video_reference_price"]} for name, spec in VIDEO_MODELS.items()]


@router.post("/references", status_code=201)
async def upload_reference(file: UploadFile = File(...)):
    """Upload a video reference to TOS and return a temporary signed URL."""
    return await upload_reference_file(file)


@router.post("/generations", status_code=201)
async def create_video_generation(data: VideoGenerationRequest):
    model = await _model_config(data.model_id)
    selected_model = data.model or model["model_name"]
    validate_video_options(selected_model, data.resolution, data.duration)

    first_frame = await ensure_tos_reference(data.first_frame_url) if data.first_frame_url else None
    last_frame = await ensure_tos_reference(data.last_frame_url) if data.last_frame_url else None
    images = [await ensure_tos_reference(url) for url in data.reference_images]
    videos = [await ensure_tos_reference(url) for url in data.reference_videos]
    audios = [await ensure_tos_reference(url) for url in data.reference_audios]

    content = [{"type": "text", "text": data.prompt}]
    if first_frame:
        content.append({"type": "image_url", "image_url": {"url": first_frame}, "role": "first_frame"})
    if last_frame:
        content.append({"type": "image_url", "image_url": {"url": last_frame}, "role": "last_frame"})
    content.extend({"type": "image_url", "image_url": {"url": url}, "role": "reference_image"} for url in images)
    content.extend({"type": "video_url", "video_url": {"url": url}, "role": "reference_video"} for url in videos)
    content.extend({"type": "audio_url", "audio_url": {"url": url}, "role": "reference_audio"} for url in audios)

    payload = {
        "model": resolve_model_name(selected_model), "content": content,
        "resolution": data.resolution, "duration": data.duration,
        "ratio": data.ratio, "generate_audio": data.generate_audio,
    }
    provider_response = await create_provider_task(model, payload)
    provider_id = provider_task_id(provider_response)
    if not provider_id:
        raise HTTPException(status_code=502, detail="火山视频接口未返回任务 ID")
    task = await _store_task(data.project_id, model, provider_id, payload)
    return {"id": str(task["id"]), "provider_task_id": provider_id, "status": provider_status(provider_response)}


async def _refresh_task(task: dict) -> dict:
    model = await _model_config(str(task["model_id"]))
    provider_response = await query_provider_task(model, task["provider_task_id"])
    status = provider_status(provider_response)
    video_url = provider_video_url(provider_response)
    input_tokens, output_tokens = provider_usage(provider_response)
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE video_tasks SET status = $2, provider_response = $3::jsonb,
                output_url = COALESCE($4, output_url), input_tokens = $5, output_tokens = $6,
                updated_at = NOW(), completed_at = CASE WHEN $2 IN ('succeeded', 'failed', 'cancelled') THEN NOW() ELSE completed_at END
               WHERE id = $1 RETURNING *""",
            task["id"], status, json.dumps(provider_response), video_url, input_tokens, output_tokens,
        )
        refreshed = dict(row)
        if status == "succeeded" and refreshed.get("billed_at") is None:
            claimed = await conn.fetchrow(
                "UPDATE video_tasks SET billed_at = NOW() WHERE id = $1 AND billed_at IS NULL RETURNING id",
                refreshed["id"],
            )
            if claimed:
                input_units = input_tokens / 1_000_000
                output_units = output_tokens / 1_000_000
                has_video_reference = any(item.get("type") == "video_url" for item in refreshed["request_payload"].get("content", []))
                resolution = str(refreshed["request_payload"].get("resolution", "720p")).lower()
                resolution_prices = (model.get("price_config") or {}).get(resolution, {})
                reference_video_price = float(resolution_prices.get("video_reference", model.get("input_price", 0)) or 0)
                text_image_price = float(resolution_prices.get("text_image", model.get("output_price", 0)) or 0)
                output_price = reference_video_price if has_video_reference else text_image_price
                input_price = 0
                input_cost = 0
                output_cost = round(output_units * output_price, 8)
                await conn.execute(
                    """INSERT INTO billing_records
                       (project_id, task_id, tool_key, tool_name, image_count, model_id, model_name,
                        unit_type, input_units, output_units, input_unit_price, output_unit_price,
                        input_cost, output_cost, total_cost, status)
                       VALUES ($1, $2, 'video_generate', '视频生成', 0, $3, $4,
                               'per_1M_tokens', $5, $6, $7, $8, $9, $10, $11, 'completed')""",
                    refreshed["project_id"], refreshed["id"], model["id"], model["name"],
                    input_units, output_units, input_price, output_price,
                    input_cost, output_cost, input_cost + output_cost,
                )
    return refreshed

@router.get("/generations/{task_id}")
async def get_video_generation(task_id: str):
    task = await fetch_one("SELECT * FROM video_tasks WHERE id = $1", task_id)
    if not task:
        raise HTTPException(status_code=404, detail="视频任务不存在")
    refreshed = await _refresh_task(task)
    return {
        "id": str(refreshed["id"]), "provider_task_id": refreshed["provider_task_id"],
        "status": refreshed["status"], "video_url": refreshed["output_url"],
        "input_tokens": float(refreshed["input_tokens"] or 0), "output_tokens": float(refreshed["output_tokens"] or 0),
    }


@router.delete("/generations/{task_id}")
async def cancel_video_generation(task_id: str):
    task = await fetch_one("SELECT * FROM video_tasks WHERE id = $1", task_id)
    if not task:
        raise HTTPException(status_code=404, detail="视频任务不存在")
    if task["status"] in {"succeeded", "failed", "cancelled"}:
        raise HTTPException(status_code=409, detail="视频任务已结束，不能取消")
    model = await _model_config(str(task["model_id"]))
    await cancel_provider_task(model, task["provider_task_id"])
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE video_tasks SET status = 'cancelled', updated_at = NOW(), completed_at = NOW() WHERE id = $1", task_id)
    return {"id": task_id, "status": "cancelled"}