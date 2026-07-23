"""
LLM service for on-demand prompt optimization.
Uses LangChain to call text generation models (DeepSeek, OpenAI, etc.).
"""
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage


async def optimize_prompt(
    user_prompt: str,
    model: dict,
    tool_key: str | None = None,
) -> str:
    """
    Optimize a user prompt using an LLM via LangChain.
    This is called on-demand when the user clicks the optimize button.

    Args:
        user_prompt: The user's raw prompt text
        model: Model config dict with model_name, api_key, api_base_url
        tool_key: Optional tool key for context-aware optimization
    """
    try:
        # Build system instruction based on tool type
        if tool_key:
            system_content = (
                f"你是专业的游戏美术提示词工程师，擅长为{tool_key}场景优化提示词。"
                "请根据用户输入的提示词，补充细节、丰富描述、增强画面感。"
                "直接输出优化后的提示词，不要解释，不要添加多余标记。"
            )
        else:
            system_content = (
                "你是专业的游戏美术提示词工程师。"
                "请根据用户输入的提示词，补充细节、丰富描述、增强画面感。"
                "直接输出优化后的提示词，不要解释，不要添加多余标记。"
            )

        llm = ChatOpenAI(
            model=model["model_name"],
            openai_api_key=model["api_key"],
            openai_api_base=model["api_base_url"].rstrip("/"),
            temperature=0.7,
            max_tokens=800,
        )

        messages = [
            SystemMessage(content=system_content),
            HumanMessage(content=user_prompt),
        ]

        response = await llm.ainvoke(messages)
        content = response.content
        # LangChain may return content as a list of blocks or an object
        if isinstance(content, list):
            content = "".join(
                block.get("text", "") if isinstance(block, dict)
                else str(block)
                for block in content
            )
        elif not isinstance(content, str):
            content = str(content)
        return content.strip()
    except Exception as e:
        err_msg = str(e) if str(e) else repr(e)
        print(f"Prompt optimization failed: {err_msg}")
        raise Exception(f"提示词优化失败: {err_msg}")
