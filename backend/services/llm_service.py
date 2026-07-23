"""
LLM service for prompt enhancement.
Calls text generation models (DeepSeek, OpenAI, etc.) to enhance user prompts.
"""
import httpx


async def enhance_prompt(
    system_prompt_content: str,
    user_prompt: str,
    model: dict,
    context: dict,
) -> str:
    """
    Enhance a user prompt using an LLM.
    Replaces placeholders in system prompt, adds context, calls LLM API.
    """
    # Replace placeholders
    final_prompt = system_prompt_content.replace("{user_prompt}", user_prompt)

    # Add context info
    if context.get("style"):
        final_prompt += f"\n风格要求：{context['style']}"
    if context.get("ratio"):
        final_prompt += f"\n图片比例：{context['ratio']}"
    if context.get("resolution"):
        final_prompt += f"\n分辨率：{context['resolution']}"
    if context.get("pose"):
        final_prompt += f"\n角色姿势：{context['pose']}"

    url = model["api_base_url"].rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {model['api_key']}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model["model_name"],
        "messages": [
            {
                "role": "system",
                "content": "你是专业的游戏美术提示词工程师。请根据用户描述生成详细的图片生成提示词。直接输出提示词，不要解释。",
            },
            {"role": "user", "content": final_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 500,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"Prompt enhancement failed: {e}")
        return user_prompt
