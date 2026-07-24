"""
Project CRUD endpoints + nested assets/generations.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from database import fetch_all, fetch_one, execute, get_pool
import json

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    style: Optional[str] = "pixel"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    style: Optional[str] = None


def _to_project(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row.get("description"),
        "cover_url": row.get("cover_url"),
        "style": row.get("style", "pixel"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _to_asset(row: dict) -> dict:
    metadata = row.get("metadata")
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except (json.JSONDecodeError, TypeError):
            metadata = None
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "generation_id": None,
        "name": row["name"],
        "description": (metadata or {}).get("description", ""),
        "type": row["type"],
        "url": row["url"],
        "finalized": row.get("finalized", False),
        "metadata_": metadata,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


def _to_generation(row: dict) -> dict:
    # Parse output_urls (may be string due to JSONB codec)
    raw_urls = row.get("output_urls")
    if isinstance(raw_urls, str):
        try:
            raw_urls = json.loads(raw_urls)
        except (json.JSONDecodeError, TypeError):
            raw_urls = []
    if not isinstance(raw_urls, list):
        raw_urls = []

    raw_names = row.get("output_names")
    if isinstance(raw_names, str):
        try:
            raw_names = json.loads(raw_names)
        except (json.JSONDecodeError, TypeError):
            raw_names = []
    if not isinstance(raw_names, list):
        raw_names = []

    raw_params = row.get("input_params")
    if isinstance(raw_params, str):
        try:
            raw_params = json.loads(raw_params)
        except (json.JSONDecodeError, TypeError):
            raw_params = {}

    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "tool_key": row["tool_key"],
        "input_params": raw_params,
        "output_urls": raw_urls,
        "output_names": raw_names,
        "status": row.get("status", "completed"),
        "error_message": row.get("error_message"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


@router.get("")
async def list_projects():
    rows = await fetch_all("SELECT * FROM projects ORDER BY updated_at DESC")
    return [_to_project(r) for r in rows]


@router.post("", status_code=201)
async def create_project(data: ProjectCreate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO projects (name, description, style)
               VALUES ($1, $2, $3)
               RETURNING *""",
            data.name, data.description, data.style or "pixel",
        )
        return _to_project(dict(row))


@router.get("/{project_id}")
async def get_project(project_id: str):
    row = await fetch_one("SELECT * FROM projects WHERE id = $1", project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return _to_project(row)


@router.put("/{project_id}")
async def update_project(project_id: str, data: ProjectUpdate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        update_data = data.model_dump(exclude_unset=True)
        row = await conn.fetchrow(
            """UPDATE projects SET
                 name = COALESCE($2, name),
                 description = COALESCE($3, description),
                 cover_url = COALESCE($4, cover_url),
                 style = COALESCE($5, style),
                 updated_at = NOW()
               WHERE id = $1
               RETURNING *""",
            project_id,
            update_data.get("name"),
            update_data.get("description"),
            update_data.get("cover_url"),
            update_data.get("style"),
        )
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        return _to_project(dict(row))


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    result = await execute("DELETE FROM projects WHERE id = $1", project_id)
    if "DELETE 0" in result:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}


# Map asset_type filter to matching tool_key patterns for generated images
_TOOL_KEY_PATTERNS = {
    "image": ["text_to_image", "image_to_image", "inpaint"],
    "character": ["character_tpose", "character_directions", "character_three_view", "character_part_split"],
    "prop": ["prop_generate", "prop_variant"],
    "ui": ["ui_layout_generate", "ui_component_place", "ui_component_split"],
    "scene": ["scene_map_generate", "scene_map_split"],
    "animation_frame": ["animation_text", "animation_frame_extract"],
}


def _build_tool_key_filter(asset_type: str, params: list, param_offset: int) -> tuple[str | None, list]:
    """Build SQL WHERE clause fragment for filtering tool_key by asset_type."""
    patterns = _TOOL_KEY_PATTERNS.get(asset_type)
    if not patterns:
        return None, params
    placeholders = ", ".join(f"${param_offset + i}" for i in range(len(patterns)))
    params.extend(patterns)
    return f"AND tool_key IN ({placeholders})", params


@router.get("/{project_id}/assets")
async def list_project_assets(project_id: str, asset_type: Optional[str] = Query(None)):
    """Return both archived assets and generated images (from generations table)."""
    # 1. Load archived assets
    if asset_type:
        rows = await fetch_all(
            "SELECT * FROM assets WHERE project_id = $1 AND type = $2 ORDER BY created_at DESC",
            project_id, asset_type,
        )
    else:
        rows = await fetch_all(
            "SELECT * FROM assets WHERE project_id = $1 ORDER BY created_at DESC",
            project_id,
        )
    result = [_to_asset(r) for r in rows]

    # 2. Load generated images from tasks table (completed tasks with output_urls)
    #    tasks table is the primary source of truth (same as text2img page uses)
    task_params = [project_id]
    task_tool_filter = ""
    if asset_type:
        task_tool_filter, task_params = _build_tool_key_filter(asset_type, task_params, 2)
        if task_tool_filter:
            task_tool_filter = f" {task_tool_filter}"

    task_rows = await fetch_all(
        f"""SELECT * FROM tasks
           WHERE project_id = $1 AND status = 'completed'
           AND output_urls IS NOT NULL{task_tool_filter}
           ORDER BY created_at DESC""",
        *task_params,
    )
    seen_task_ids = set()
    for t in task_rows:
        # Parse output_urls (may be string due to JSONB codec double-encoding)
        raw_urls = t.get("output_urls")
        if isinstance(raw_urls, str):
            try:
                raw_urls = json.loads(raw_urls)
            except (json.JSONDecodeError, TypeError):
                raw_urls = []
        if not isinstance(raw_urls, list):
            raw_urls = []

        raw_names = t.get("output_names")
        if isinstance(raw_names, str):
            try:
                raw_names = json.loads(raw_names)
            except (json.JSONDecodeError, TypeError):
                raw_names = []
        if not isinstance(raw_names, list):
            raw_names = []

        seen_task_ids.add(str(t["id"]))

        for i, url in enumerate(raw_urls):
            if not isinstance(url, str) or not url:
                continue
            # Skip data: URLs (base64 inline images) — they can't be resolved by the backend
            if url.startswith("data:"):
                continue
            name = raw_names[i] if i < len(raw_names) and raw_names[i] else f"{t['tool_key']}_{i+1}"
            result.append({
                "id": f"gen-{t['id']}-{i}",
                "project_id": t["project_id"],
                "generation_id": t["id"],
                "name": name,
                "description": "",
                "type": t["tool_key"],
                "url": url,
                "finalized": False,
                "metadata_": None,
                "created_at": t["created_at"].isoformat() if t.get("created_at") else None,
            })

    # 3. Also check generations table for any records not in tasks table
    gen_params = [project_id]
    gen_tool_filter = ""
    if asset_type:
        gen_tool_filter, gen_params = _build_tool_key_filter(asset_type, gen_params, 2)
        if gen_tool_filter:
            gen_tool_filter = f" {gen_tool_filter}"

    gen_rows = await fetch_all(
        f"""SELECT * FROM generations
           WHERE project_id = $1 AND status = 'completed'
           AND output_urls IS NOT NULL{gen_tool_filter}
           ORDER BY created_at DESC""",
        *gen_params,
    )
    for g in gen_rows:
        task_id_str = str(g.get("task_id")) if g.get("task_id") else None
        if task_id_str and task_id_str in seen_task_ids:
            continue  # Already covered by tasks table

        raw_urls = g.get("output_urls")
        if isinstance(raw_urls, str):
            try:
                raw_urls = json.loads(raw_urls)
            except (json.JSONDecodeError, TypeError):
                raw_urls = []
        if not isinstance(raw_urls, list):
            raw_urls = []

        raw_names = g.get("output_names")
        if isinstance(raw_names, str):
            try:
                raw_names = json.loads(raw_names)
            except (json.JSONDecodeError, TypeError):
                raw_names = []
        if not isinstance(raw_names, list):
            raw_names = []

        for i, url in enumerate(raw_urls):
            if not isinstance(url, str) or not url:
                continue
            # Skip data: URLs (base64 inline images) — they can't be resolved by the backend
            if url.startswith("data:"):
                continue
            name = raw_names[i] if i < len(raw_names) and raw_names[i] else f"{g['tool_key']}_{i+1}"
            result.append({
                "id": f"gen-{g['id']}-{i}",
                "project_id": g["project_id"],
                "generation_id": g["id"],
                "name": name,
                "description": "",
                "type": g["tool_key"],
                "url": url,
                "finalized": False,
                "metadata_": None,
                "created_at": g["created_at"].isoformat() if g.get("created_at") else None,
            })
    return result


@router.get("/{project_id}/generations")
async def list_project_generations(project_id: str):
    rows = await fetch_all(
        "SELECT * FROM generations WHERE project_id = $1 ORDER BY created_at DESC",
        project_id,
    )
    return [_to_generation(r) for r in rows]
