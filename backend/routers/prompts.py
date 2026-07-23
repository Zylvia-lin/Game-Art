"""
System prompt CRUD endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import fetch_all, fetch_one, get_pool

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


class PromptUpdate(BaseModel):
    prompt_content: str
    description: Optional[str] = None


def _to_response(row: dict) -> dict:
    return {
        "id": row["id"],
        "tool_key": row["tool_key"],
        "tool_name": row["tool_name"],
        "description": row.get("description"),
        "prompt_content": row["prompt_content"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


@router.get("")
async def list_prompts():
    rows = await fetch_all("SELECT * FROM system_prompts ORDER BY id")
    return [_to_response(r) for r in rows]


@router.get("/{tool_key}")
async def get_prompt(tool_key: str):
    row = await fetch_one("SELECT * FROM system_prompts WHERE tool_key = $1", tool_key)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return _to_response(row)


@router.put("/{tool_key}")
async def update_prompt(tool_key: str, data: PromptUpdate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE system_prompts SET
                 prompt_content = $2,
                 description = COALESCE($3, description),
                 updated_at = NOW()
               WHERE tool_key = $1
               RETURNING *""",
            tool_key, data.prompt_content, data.description,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Prompt not found")
        return _to_response(dict(row))
