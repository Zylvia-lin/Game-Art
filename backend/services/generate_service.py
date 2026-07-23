"""
Generation orchestration service.
Coordinates: system prompt loading → LLM enhancement → image generation → post-processing.
"""
import os
import time
import random
import string
import base64
import httpx
from database import fetch_one
from services.llm_service import enhance_prompt
from services.image_service import generate_image
from services.image_processor import remove_green_background, ensure_upload_dir, UPLOAD_DIR


async def execute_generation(
    tool_key: str,
    input_params: dict,
    on_progress=None,
) -> dict:
    """
    Execute a generation task.
    Returns {"output_urls": [...], "enhanced_prompt": "..."}
    """
    async def report(pct: int):
        if on_progress:
            await on_progress(pct)

    await report(10)

    # Get system prompt
    prompt_row = await fetch_one(
        "SELECT * FROM system_prompts WHERE tool_key = $1", tool_key
    )
    if not prompt_row:
        raise Exception(f"No system prompt found for tool: {tool_key}")

    await report(20)

    # Get default text model for prompt enhancement
    text_model = await fetch_one(
        "SELECT * FROM model_configs WHERE type = 'text' AND is_default = true LIMIT 1"
    )
    if not text_model:
        raise Exception("No text model configured. Please add a text model in settings.")

    await report(30)

    # Get user prompt
    user_prompt = input_params.get("prompt", "")
    if not user_prompt:
        raise Exception("No prompt provided")

    # Enhance prompt using LLM
    enhanced_prompt = await enhance_prompt(
        prompt_row["prompt_content"],
        user_prompt,
        text_model,
        input_params,
    )

    await report(50)

    # Get default image model
    image_model = await fetch_one(
        "SELECT * FROM model_configs WHERE type = 'image' AND is_default = true LIMIT 1"
    )
    if not image_model:
        raise Exception("No image model configured. Please add an image model in settings.")

    await report(60)

    # Generate image
    output_urls = await generate_image(enhanced_prompt, image_model, input_params)

    await report(80)

    # Post-process: download images and remove green background
    processed_urls = await _post_process_images(output_urls)

    await report(90)

    return {
        "output_urls": processed_urls,
        "enhanced_prompt": enhanced_prompt,
    }


async def _post_process_images(urls: list[str]) -> list[str]:
    """Download generated images and remove green background."""
    ensure_upload_dir()
    processed = []

    for url in urls:
        try:
            local_path = await _download_image(url)
            transparent_url = remove_green_background(local_path)
            processed.append(transparent_url)
        except Exception as e:
            print(f"Post-processing failed for image {url}: {e}")
            processed.append(url)

    return processed


async def _download_image(url: str) -> str:
    """Download a remote image to local uploads directory."""
    # Already local
    if url.startswith("/uploads/"):
        return url

    unique = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    filename = f"gen_{int(time.time())}_{unique}.png"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Handle base64 data URLs
    if url.startswith("data:image/"):
        b64_data = url.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
        with open(filepath, "wb") as f:
            f.write(img_bytes)
        return f"/uploads/{filename}"

    # Download remote URL
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url)
        if response.status_code != 200:
            raise Exception(f"Failed to download image: {response.status_code}")
        with open(filepath, "wb") as f:
            f.write(response.content)

    return f"/uploads/{filename}"
