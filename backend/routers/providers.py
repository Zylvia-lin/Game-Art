"""Provider credential configuration endpoints."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import fetch_one, get_pool

router = APIRouter(prefix="/api/providers", tags=["providers"])


class ProviderConfigUpdate(BaseModel):
    api_key: str = Field(min_length=1)


def _mask(value: str) -> str:
    return value[:4] + "****" + value[-4:] if len(value) > 8 else "****"


@router.get("/{provider}")
async def get_provider(provider: str):
    row = await fetch_one("SELECT provider, api_key, updated_at FROM provider_configs WHERE provider = $1", provider)
    return {"provider": provider, "api_key": _mask(row["api_key"]) if row else "", "configured": bool(row)}


@router.put("/{provider}")
async def update_provider(provider: str, data: ProviderConfigUpdate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO provider_configs (provider, api_key) VALUES ($1, $2)
               ON CONFLICT (provider) DO UPDATE SET api_key = EXCLUDED.api_key, updated_at = NOW()""",
            provider, data.api_key,
        )
    return {"provider": provider, "configured": True}