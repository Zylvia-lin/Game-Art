"""
Model configuration CRUD endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import fetch_all, fetch_one, execute, get_pool

router = APIRouter(prefix="/api/models", tags=["models"])


class ModelConfigCreate(BaseModel):
    type: str
    name: str
    provider: str
    api_base_url: str
    api_key: str
    model_name: str
    is_default: bool = False


class ModelConfigUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    api_base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    is_default: Optional[bool] = None


def _mask_api_key(config: dict) -> dict:
    """Mask API key for list responses (security)."""
    if config.get("api_key") and len(config["api_key"]) > 8:
        config["api_key"] = config["api_key"][:4] + "****" + config["api_key"][-4:]
    return config


def _to_response(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "provider": row["provider"],
        "api_base_url": row["api_base_url"],
        "api_key": row["api_key"],
        "model_name": row["model_name"],
        "is_default": row["is_default"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


@router.get("")
async def list_models():
    rows = await fetch_all("SELECT * FROM model_configs ORDER BY created_at DESC")
    return [_mask_api_key(_to_response(r)) for r in rows]


@router.post("", status_code=201)
async def create_model(config: ModelConfigCreate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if config.is_default:
            await conn.execute(
                "UPDATE model_configs SET is_default = false WHERE type = $1",
                config.type,
            )
        row = await conn.fetchrow(
            """INSERT INTO model_configs (name, type, provider, api_base_url, api_key, model_name, is_default)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING *""",
            config.name, config.type, config.provider,
            config.api_base_url, config.api_key, config.model_name, config.is_default,
        )
        return _to_response(dict(row))


@router.get("/{model_id}")
async def get_model(model_id: int):
    row = await fetch_one("SELECT * FROM model_configs WHERE id = $1", model_id)
    if not row:
        raise HTTPException(status_code=404, detail="Model not found")
    return _to_response(row)


@router.put("/{model_id}")
async def update_model(model_id: int, config: ModelConfigUpdate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM model_configs WHERE id = $1", model_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Model not found")

        update_data = config.model_dump(exclude_unset=True)
        if update_data.get("is_default"):
            await conn.execute(
                "UPDATE model_configs SET is_default = false WHERE type = $1 AND id != $2",
                existing["type"], model_id,
            )

        row = await conn.fetchrow(
            """UPDATE model_configs SET
                 name = COALESCE($2, name),
                 provider = COALESCE($3, provider),
                 api_base_url = COALESCE($4, api_base_url),
                 api_key = COALESCE($5, api_key),
                 model_name = COALESCE($6, model_name),
                 is_default = COALESCE($7, is_default),
                 updated_at = NOW()
               WHERE id = $1
               RETURNING *""",
            model_id,
            update_data.get("name"),
            update_data.get("provider"),
            update_data.get("api_base_url"),
            update_data.get("api_key"),
            update_data.get("model_name"),
            update_data.get("is_default"),
        )
        return _to_response(dict(row))


@router.delete("/{model_id}")
async def delete_model(model_id: int):
    result = await execute("DELETE FROM model_configs WHERE id = $1", model_id)
    if "DELETE 0" in result:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"message": "Model deleted"}


@router.put("/{model_id}/default")
async def set_default_model(model_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM model_configs WHERE id = $1", model_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Model not found")

        await conn.execute(
            "UPDATE model_configs SET is_default = false, updated_at = NOW() WHERE type = $1",
            existing["type"],
        )
        row = await conn.fetchrow(
            "UPDATE model_configs SET is_default = true, updated_at = NOW() WHERE id = $1 RETURNING *",
            model_id,
        )
        return _to_response(dict(row))
