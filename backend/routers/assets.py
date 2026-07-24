"""
Asset CRUD endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import fetch_one, fetch_all, execute, get_pool
import json

router = APIRouter(prefix="/api/assets", tags=["assets"])


class AssetCreate(BaseModel):
    project_id: str
    name: str
    type: str
    url: str
    description: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    finalized: Optional[bool] = None


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


@router.post("", status_code=201)
async def create_asset(data: AssetCreate):
    metadata = {}
    if data.description:
        metadata["description"] = data.description

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO assets (project_id, name, type, url, metadata)
               VALUES ($1, $2, $3, $4, $5::jsonb)
               RETURNING *""",
            data.project_id, data.name, data.type, data.url, metadata,
        )
        return _to_asset(dict(row))


@router.get("/{asset_id}")
async def get_asset(asset_id: str):
    try:
        asset_id_int = int(asset_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid asset ID")
    row = await fetch_one("SELECT * FROM assets WHERE id = $1", asset_id_int)
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
    return _to_asset(row)


@router.put("/{asset_id}")
async def update_asset(asset_id: str, data: AssetUpdate):
    try:
        asset_id_int = int(asset_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid asset ID")
    update_data = data.model_dump(exclude_unset=True)

    pool = await get_pool()
    async with pool.acquire() as conn:
        # If updating finalized, also update metadata
        if "finalized" in update_data:
            existing = await conn.fetchrow("SELECT metadata FROM assets WHERE id = $1", asset_id_int)
            if existing:
                metadata = existing["metadata"]
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except (json.JSONDecodeError, TypeError):
                        metadata = {}
                metadata = metadata or {}
                metadata["finalized"] = update_data["finalized"]

                row = await conn.fetchrow(
                    """UPDATE assets SET
                         name = COALESCE($2, name),
                         type = COALESCE($3, type),
                         finalized = COALESCE($4, finalized),
                         metadata = $5::jsonb,
                         updated_at = NOW()
                       WHERE id = $1
                       RETURNING *""",
                    asset_id_int,
                    update_data.get("name"),
                    update_data.get("type"),
                    update_data.get("finalized"),
                    metadata,
                )
            else:
                raise HTTPException(status_code=404, detail="Asset not found")
        else:
            row = await conn.fetchrow(
                """UPDATE assets SET
                     name = COALESCE($2, name),
                     type = COALESCE($3, type),
                     updated_at = NOW()
                   WHERE id = $1
                   RETURNING *""",
                asset_id_int,
                update_data.get("name"),
                update_data.get("type"),
            )

        if not row:
            raise HTTPException(status_code=404, detail="Asset not found")
        return _to_asset(dict(row))


@router.delete("/{asset_id}")
async def delete_asset(asset_id: str):
    try:
        asset_id_int = int(asset_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid asset ID")
    result = await execute("DELETE FROM assets WHERE id = $1", asset_id_int)
    if "DELETE 0" in result:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"success": True}


class CheckBatchRequest(BaseModel):
    project_id: str
    urls: list[str]


@router.post("/check-batch")
async def check_batch(req: CheckBatchRequest):
    """检查一组 URL 是否已添加到资产库，返回 { url: { exists, type, asset_id } }"""
    if not req.urls:
        return {}
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT url, type, id FROM assets WHERE project_id = $1 AND url = ANY($2)",
            req.project_id, req.urls,
        )
    result = {}
    for row in rows:
        result[row["url"]] = {
            "exists": True,
            "type": row["type"],
            "asset_id": str(row["id"]),
        }
    return result
