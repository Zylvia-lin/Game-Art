"""
LLM service for prompt enhancement.
Uses LangChain to call text generation models (DeepSeek, OpenAI, etc.).
"""
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage


async def enhance_prompt(
    system_prompt_content: str,
    user_prompt: str,
    model: dict,
    context: dict,
) -> str:
    """
    Enhance a user prompt using an LLM via LangChain.
    Replaces placeholders in system prompt, adds context, calls LLM.
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

    try:
        # Initialize LangChain ChatOpenAI (works with any OpenAI-compatible API)
        llm = ChatOpenAI(
            model=model["model_name"],
            openai_api_key=model["api_key"],
            openai_api_base=model["api_base_url"].rstrip("/"),
            temperature=0.7,
            max_tokens=500,
        )

        messages = [
            SystemMessage(content="你是专业的游戏美术提示词工程师。请根据用户描述生成详细的图片生成提示词。直接输出提示词，不要解释。"),
            HumanMessage(content=final_prompt),
        ]

        response = await llm.ainvoke(messages)
        return response.content
    except Exception as e:
        print(f"Prompt enhancement failed: {e}")
        return user_prompt
