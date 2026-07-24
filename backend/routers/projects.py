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
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "tool_key": row["tool_key"],
        "input_params": row.get("input_params"),
        "output_urls": row.get("output_urls"),
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

    # 2. Load generated images from generations table (completed tasks with output_urls)
    gen_rows = await fetch_all(
        """SELECT * FROM generations
           WHERE project_id = $1 AND status = 'completed'
           AND output_urls IS NOT NULL AND output_urls != '[]'::jsonb
           ORDER BY created_at DESC""",
        project_id,
    )
    for g in gen_rows:
        output_urls = g.get("output_urls") or []
        output_names = g.get("output_names") or []
        for i, url in enumerate(output_urls):
            if not isinstance(url, str):
                continue
            # Only include local file paths (uploaded images), skip external/base64 URLs
            if not url.startswith("/uploads/"):
                continue
            name = output_names[i] if i < len(output_names) and output_names[i] else f"{g['tool_key']}_{i+1}"
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
