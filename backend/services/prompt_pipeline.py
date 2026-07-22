from typing import Optional
from models.model_config import ModelConfig
from services.llm_service import call_llm, get_text_model
from sqlalchemy.ext.asyncio import AsyncSession


async def enhance_prompt(
    system_prompt: str,
    user_prompt: str,
    context: dict = None,
    model: ModelConfig = None,
    db: AsyncSession = None
) -> str:
    if not system_prompt:
        return user_prompt

    user_message = user_prompt
    if context:
        context_str = ", ".join(f"{k}: {v}" for k, v in context.items() if v is not None)
        if context_str:
            user_message = f"{user_prompt}\n\nAdditional context: {context_str}"

    if model is None and db is not None:
        model = await get_text_model(db)

    if model is None:
        return user_prompt

    try:
        enhanced = await call_llm(system_prompt, user_message, model)
        return enhanced
    except Exception:
        return user_prompt
