from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models.system_prompt import SystemPrompt

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


class PromptUpdate(BaseModel):
    prompt_content: str
    description: Optional[str] = None


class PromptResponse(BaseModel):
    id: int
    tool_key: str
    tool_name: str
    category: str
    prompt_content: str
    description: Optional[str]

    class Config:
        from_attributes = True


@router.get("", response_model=list[PromptResponse])
async def list_prompts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemPrompt).order_by(SystemPrompt.category, SystemPrompt.tool_key))
    return result.scalars().all()


@router.get("/{tool_key}", response_model=PromptResponse)
async def get_prompt(tool_key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemPrompt).where(SystemPrompt.tool_key == tool_key))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


@router.put("/{tool_key}", response_model=PromptResponse)
async def update_prompt(tool_key: str, data: PromptUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemPrompt).where(SystemPrompt.tool_key == tool_key))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    prompt.prompt_content = data.prompt_content
    if data.description is not None:
        prompt.description = data.description
    await db.flush()
    await db.refresh(prompt)
    return prompt
