"""Project-scoped animation video and frame extraction APIs."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from config import settings
from database import fetch_all, fetch_one, get_pool
from services.frame_service import (
    EXTRACTION_FPS, create_zip, export_video, extract_frames, normalize_selection,
    persist_remote_video, prepare_sequence, probe_video, public_url, selection_hash,
)
from services.video_service import (
    create_provider_task, provider_status, provider_task_id,
    provider_usage, provider_video_url, query_provider_task, resolve_model_name,
    upload_reference_bytes, validate_video_options,
)

router = APIRouter(prefix="/api/video", tags=["animation-video"])
RATIOS = {"16:9", "9:16", "4:3", "3:4", "1:1", "21:9", "adaptive"}


class GenerateRequest(BaseModel):
    project_id: UUID
    model_id: UUID
    prompt: str = Field(min_length=1, max_length=5000)
    asset_ids: list[UUID] = Field(default_factory=list, max_length=9)
    ratio: str = "16:9"
    resolution: Literal["480p", "720p", "1080p", "4k"] = "720p"
    duration: int = Field(default=5, ge=4, le=15)
    generate_audio: bool = False


class EditRequest(BaseModel):
    project_id: UUID
    source_video_task_id: UUID
    model_id: UUID
    prompt: str = Field(min_length=1, max_length=5000)
    generate_audio: bool = False


class SelectionRequest(BaseModel):
    selected_frames: list[int]


class VideoExportRequest(SelectionRequest):
    fps: float = Field(ge=1, le=60)


async def _model(model_id: UUID) -> dict:
    model = await fetch_one("SELECT * FROM model_configs WHERE id=$1 AND type='video'", model_id)
    if not model:
        raise HTTPException(status_code=422, detail="视频模型不存在或类型不正确")
    return model


async def _enhance(prompt: str, key: str) -> str:
    system = await fetch_one("SELECT prompt_content FROM system_prompts WHERE tool_key=$1", key)
    text_model = await fetch_one("SELECT * FROM model_configs WHERE type='text' AND is_default=true LIMIT 1")
    if not system or not text_model:
        return prompt
    try:
        llm = ChatOpenAI(
            model=text_model["model_name"], openai_api_key=text_model["api_key"],
            openai_api_base=text_model["api_base_url"].rstrip("/"), temperature=0.4, max_tokens=1000,
        )
        response = await llm.ainvoke([SystemMessage(content=system["prompt_content"]), HumanMessage(content=prompt)])
        return str(response.content).strip() or prompt
    except Exception:
        return prompt


async def _assets(project_id: UUID, ids: list[UUID]) -> list[dict]:
    if not ids:
        return []
    rows = await fetch_all("SELECT id,name,url FROM assets WHERE project_id=$1 AND id=ANY($2::uuid[])", project_id, ids)
    if len(rows) != len(set(ids)):
        raise HTTPException(status_code=422, detail="引用资产不存在或不属于当前项目")
    by_id = {str(row["id"]): row for row in rows}
    return [by_id[str(asset_id)] for asset_id in ids]


async def _asset_reference(asset: dict) -> str:
    url = asset["url"]
    if url.startswith("/uploads/"):
        root = Path(settings.UPLOAD_DIR).resolve()
        source = (root / url.removeprefix("/uploads/")).resolve()
        if root not in source.parents or not source.is_file():
            raise HTTPException(status_code=422, detail="资产文件不存在")
        return (await upload_reference_bytes(source.read_bytes(), source.name))["url"]
    raise HTTPException(status_code=422, detail="视频引用资产必须是本地项目上传文件")

def _dto(row: dict) -> dict:
    return {
        "id": str(row["id"]), "project_id": str(row["project_id"]), "task_type": row.get("task_type", "generate"),
        "source_video_task_id": str(row["source_video_task_id"]) if row.get("source_video_task_id") else None,
        "model_id": str(row["model_id"]), "status": row["status"], "user_prompt": row.get("user_prompt"),
        "enhanced_prompt": row.get("enhanced_prompt"), "reference_asset_ids": row.get("reference_asset_ids") or [],
        "video_url": public_url(Path(row["local_output_path"])) if row.get("local_output_path") else row.get("output_url"),
        "ratio": row.get("ratio"), "resolution": row.get("resolution"), "duration": float(row["duration"]) if row.get("duration") is not None else None,
        "fps": float(row["fps"]) if row.get("fps") is not None else None, "created_at": row["created_at"], "completed_at": row.get("completed_at"),
    }


async def _submit(data: GenerateRequest | EditRequest, task_type: str) -> dict:
    project = await fetch_one("SELECT id FROM projects WHERE id=$1", data.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    model = await _model(data.model_id)
    if task_type == "generate":
        assets = await _assets(data.project_id, data.asset_ids)
        ratio, resolution, duration = data.ratio, data.resolution, data.duration
        if ratio not in RATIOS:
            raise HTTPException(status_code=422, detail="不支持的视频比例")
        references = [await _asset_reference(asset) for asset in assets]
        key = "animation_video_generate"
    else:
        source = await fetch_one(
            "SELECT * FROM video_tasks WHERE id=$1 AND project_id=$2 AND status='succeeded' AND local_output_path IS NOT NULL",
            data.source_video_task_id, data.project_id,
        )
        if not source:
            raise HTTPException(status_code=422, detail="源视频不存在、未成功或不属于当前项目")
        ratio, resolution, duration = source["ratio"], source["resolution"], int(float(source["duration"]))
        source_path = Path(source["local_output_path"])
        references = [(await upload_reference_bytes(
            source_path.read_bytes(), source_path.name, "video/mp4"
        ))["url"]]
        assets, key = [], "animation_video_edit"
    validate_video_options(model["model_name"], resolution, duration)
    enhanced = await _enhance(data.prompt, key)
    content = [{"type": "text", "text": enhanced}]
    role = "reference_image" if task_type == "generate" else "reference_video"
    media_type = "image_url" if task_type == "generate" else "video_url"
    content.extend({media_type: {"url": url}, "type": media_type, "role": role} for url in references)
    payload = {
        "model": resolve_model_name(model["model_name"]), "content": content, "resolution": resolution,
        "duration": duration, "ratio": ratio, "generate_audio": data.generate_audio,
    }
    response = await create_provider_task(model, payload)
    provider_id = provider_task_id(response)
    if not provider_id:
        raise HTTPException(status_code=502, detail="视频供应商未返回任务 ID")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO video_tasks
               (project_id,model_id,provider_task_id,request_payload,provider_response,status,task_type,
                source_video_task_id,user_prompt,enhanced_prompt,reference_asset_ids,ratio,resolution,duration)
               VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14) RETURNING *""",
            data.project_id, data.model_id, provider_id, json.dumps(payload), json.dumps(response),
            provider_status(response), task_type, getattr(data, "source_video_task_id", None), data.prompt, enhanced,
            json.dumps([str(a["id"]) for a in assets]), ratio, resolution, duration,
        )
    return _dto(dict(row))


@router.get("/projects/{project_id}/tasks")
async def list_tasks(project_id: UUID):
    return [_dto(row) for row in await fetch_all("SELECT * FROM video_tasks WHERE project_id=$1 ORDER BY created_at DESC", project_id)]


@router.post("/projects/generate", status_code=201)
async def generate(data: GenerateRequest):
    return await _submit(data, "generate")


@router.post("/projects/edit", status_code=201)
async def edit(data: EditRequest):
    return await _submit(data, "edit")


@router.get("/projects/tasks/{task_id}")
async def refresh(task_id: UUID):
    task = await fetch_one("SELECT * FROM video_tasks WHERE id=$1", task_id)
    if not task:
        raise HTTPException(status_code=404, detail="视频任务不存在")
    if task["status"] not in {"succeeded", "failed", "cancelled"}:
        model = await _model(task["model_id"])
        response = await query_provider_task(model, task["provider_task_id"])
        status, remote = provider_status(response), provider_video_url(response)
        input_tokens, output_tokens = provider_usage(response)
        local_path, metadata = None, {}
        if status == "succeeded" and remote:
            path = await persist_remote_video(remote, str(task["id"]))
            local_path, metadata = str(path), probe_video(path)
        pool = await get_pool()
        async with pool.acquire() as conn:
            task = dict(await conn.fetchrow(
                """UPDATE video_tasks SET status=$2,provider_response=$3::jsonb,output_url=COALESCE($4,output_url),
                   local_output_path=COALESCE($5,local_output_path),input_tokens=$6,output_tokens=$7,
                   duration=COALESCE($8,duration),fps=COALESCE($9,fps),updated_at=NOW(),
                   completed_at=CASE WHEN $2 IN('succeeded','failed','cancelled') THEN NOW() ELSE completed_at END
                   WHERE id=$1 RETURNING *""",
                task["id"], status, json.dumps(response), remote, local_path, input_tokens, output_tokens,
                metadata.get("duration"), metadata.get("fps"),
            ))
    return _dto(task)


@router.post("/projects/tasks/{task_id}/extract", status_code=201)
async def create_extraction(task_id: UUID):
    task = await fetch_one("SELECT * FROM video_tasks WHERE id=$1 AND status='succeeded' AND local_output_path IS NOT NULL", task_id)
    if not task:
        raise HTTPException(status_code=422, detail="仅可从已成功转存的视频提取帧")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = dict(await conn.fetchrow(
            "INSERT INTO frame_extractions(project_id,source_video_task_id,status) VALUES($1,$2,'processing') RETURNING *",
            task["project_id"], task_id,
        ))
    try:
        frames, _ = await extract_frames(Path(task["local_output_path"]), str(row["id"]))
        async with pool.acquire() as conn:
            row = dict(await conn.fetchrow(
                """UPDATE frame_extractions SET status='succeeded',total_frames=$2,frames=$3::jsonb,
                   updated_at=NOW(),completed_at=NOW() WHERE id=$1 RETURNING *""",
                row["id"], len(frames), json.dumps(frames),
            ))
    except Exception as exc:
        async with pool.acquire() as conn:
            await conn.execute("UPDATE frame_extractions SET status='failed',error_message=$2,updated_at=NOW() WHERE id=$1", row["id"], str(exc))
        raise
    return row


def _extraction_dto(row: dict) -> dict:
    result = dict(row)
    result["export_video_url"] = public_url(Path(row["export_video_path"])) if row.get("export_video_path") else None
    sequence = Path(row["sequence_dir"]) if row.get("sequence_dir") else None
    result["sequence_preview_urls"] = [public_url(path) for path in sorted(sequence.glob("*.png"))] if sequence and sequence.is_dir() else []
    return result

@router.get("/projects/{project_id}/extractions")
async def list_extractions(project_id: UUID):
    return [_extraction_dto(row) for row in await fetch_all("SELECT * FROM frame_extractions WHERE project_id=$1 ORDER BY created_at DESC", project_id)]


@router.put("/extractions/{extraction_id}/selection")
async def save_selection(extraction_id: UUID, data: SelectionRequest):
    row = await fetch_one("SELECT * FROM frame_extractions WHERE id=$1 AND status='succeeded'", extraction_id)
    if not row:
        raise HTTPException(status_code=404, detail="帧提取结果不存在")
    selected = normalize_selection(data.selected_frames, row["total_frames"])
    pool = await get_pool()
    async with pool.acquire() as conn:
        return dict(await conn.fetchrow(
            "UPDATE frame_extractions SET selected_frames=$2::jsonb,sequence_dir=NULL,zip_cache='{}',updated_at=NOW() WHERE id=$1 RETURNING *",
            extraction_id, json.dumps(selected),
        ))


@router.post("/extractions/{extraction_id}/export-video")
async def create_video_export(extraction_id: UUID, data: VideoExportRequest):
    row = await fetch_one("SELECT * FROM frame_extractions WHERE id=$1 AND status='succeeded'", extraction_id)
    if not row:
        raise HTTPException(status_code=404, detail="帧提取结果不存在")
    selected = normalize_selection(data.selected_frames, row["total_frames"])
    if not selected:
        raise HTTPException(status_code=422, detail="请至少选择一帧")
    target = await export_video(str(extraction_id), row["frames"], selected, data.fps)
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE frame_extractions SET selected_frames=$2::jsonb,export_video_path=$3,export_video_fps=$4,updated_at=NOW() WHERE id=$1", extraction_id, json.dumps(selected), str(target), data.fps)
    return {"url": public_url(target), "fps": data.fps}


@router.post("/extractions/{extraction_id}/export-sequence")
async def create_sequence_export(extraction_id: UUID, data: SelectionRequest):
    row = await fetch_one("SELECT * FROM frame_extractions WHERE id=$1 AND status='succeeded'", extraction_id)
    if not row:
        raise HTTPException(status_code=404, detail="帧提取结果不存在")
    selected = normalize_selection(data.selected_frames, row["total_frames"])
    if not selected:
        raise HTTPException(status_code=422, detail="请至少选择一帧")
    directory = await prepare_sequence(str(extraction_id), row["frames"], selected)
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE frame_extractions SET selected_frames=$2::jsonb,sequence_dir=$3,zip_cache='{}',updated_at=NOW() WHERE id=$1", extraction_id, json.dumps(selected), str(directory))
    return {"preview_urls": [public_url(directory / f"{index:03d}.png") for index in range(1, len(selected) + 1)]}


@router.get("/extractions/{extraction_id}/sequence.zip")
async def download_sequence(extraction_id: UUID):
    row = await fetch_one("SELECT * FROM frame_extractions WHERE id=$1 AND sequence_dir IS NOT NULL", extraction_id)
    if not row:
        raise HTTPException(status_code=404, detail="请先导出序列帧")
    key = selection_hash(row["selected_frames"])
    target = await create_zip(Path(row["sequence_dir"]), str(extraction_id), key)
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE frame_extractions SET zip_cache=$2::jsonb,updated_at=NOW() WHERE id=$1", extraction_id, json.dumps({"key": key, "path": str(target)}))
    return FileResponse(target, media_type="application/zip", filename=f"frames-{extraction_id}.zip")
