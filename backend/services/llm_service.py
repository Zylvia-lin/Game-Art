"""
LLM service for on-demand prompt optimization.
Uses LangChain to call text generation models (DeepSeek, OpenAI, etc.).
System prompt is loaded from the database (system_prompts table, tool_key='prompt_optimize').
"""
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from database import fetch_one


async def optimize_prompt(
    user_prompt: str,
    model: dict,
    tool_key: str | None = None,
) -> str:
    """
    Optimize a user prompt using an LLM via LangChain.
    System prompt is loaded from DB (tool_key='prompt_optimize').
    """
    # Load system prompt for optimization from DB
    prompt_row = await fetch_one(
        "SELECT prompt_content FROM system_prompts WHERE tool_key = 'prompt_optimize'"
    )
    system_content = prompt_row["prompt_content"] if prompt_row else ""

    # Fallback if no DB prompt configured
    if not system_content:
        system_content = (
            "你是专业的游戏美术提示词工程师。"
            "请根据用户输入的提示词，补充细节、丰富描述、增强画面感。"
            "始终使用中文输出，直接输出优化后的提示词，不要解释。"
        )

    try:
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
