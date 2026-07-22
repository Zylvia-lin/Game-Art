import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from models.model_config import ModelConfig


async def get_text_model(db: AsyncSession) -> Optional[ModelConfig]:
    result = await db.execute(
        select(ModelConfig).where(ModelConfig.type == "text", ModelConfig.is_default == True)
    )
    model = result.scalar_one_or_none()
    if not model:
        result = await db.execute(select(ModelConfig).where(ModelConfig.type == "text"))
        model = result.scalars().first()
    return model


async def call_llm(system_prompt: str, user_message: str, model_config: ModelConfig) -> str:
    url = model_config.api_base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {model_config.api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model_config.model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.7,
        "max_tokens": 1024
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
