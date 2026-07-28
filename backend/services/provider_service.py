"""Shared provider credentials used by multiple model configurations."""
from database import fetch_one


async def get_provider_api_key(provider: str, fallback: str = "") -> str:
    row = await fetch_one("SELECT api_key FROM provider_configs WHERE provider = $1", provider)
    return (row or {}).get("api_key") or fallback