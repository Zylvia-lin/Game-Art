"""
Generation orchestration service.
Pipeline: system prompt injection (no LLM) -> image generation -> post-processing.
LLM-based prompt optimization is available via a separate on-demand API.
"""
import os
import time
import random
import string
import base64
import httpx
from database import fetch_one
from services.image_service import generate_image
from services.image_processor import remove_background, ensure_upload_dir, UPLOAD_DIR

# Tool keys that require background removal (white bg → transparent)
# Only creation tools (character/animation/prop/scene/ui) get post-processed.
# Toolbox tools (text_to_image, image_to_image, inpaint) skip this step.
_BG_REMOVAL_TOOLS = frozenset({
    "character_tpose",
    "character_three_view",
    "character_directions",
    "character_part_split",
    "animation_action",
    "prop_original",
    "prop_variant",
    "ui_layout_generate",
    "ui_component_place",
    "ui_component_split",
    "scene_map_generate",
    "scene_map_split",
})


async def execute_generation(
    tool_key: str,
    input_params: dict,
    on_progress=None,
    model_config: dict | None = None,
) -> dict:
    """
    Execute a generation task.
    System prompt is directly injected into user prompt (no LLM call).
    Accepts optional model_config from caller; falls back to default image model.
    Returns {"output_urls": [...], "final_prompt": "..."}
    """
    async def report(pct: int):
        if on_progress:
            await on_progress(pct)

    await report(10)

    # Load system prompt from DB
    prompt_row = await fetch_one(
        "SELECT * FROM system_prompts WHERE tool_key = $1", tool_key
    )
    system_prompt = prompt_row["prompt_content"] if prompt_row else ""

    await report(20)

    # Get user prompt
    user_prompt = input_params.get("prompt", "")
    if not user_prompt:
        raise Exception("No prompt provided")

    # Directly inject system prompt (no LLM enhancement)
    final_prompt = _build_final_prompt(system_prompt, user_prompt, input_params)

    await report(30)

    # Use provided model config or fall back to default image model
    image_model = model_config
    if not image_model:
        image_model = await fetch_one(
            "SELECT * FROM model_configs WHERE type = 'image' AND is_default = true LIMIT 1"
        )
    if not image_model:
        raise Exception("No image model configured. Please add an image model in settings.")

    await report(40)

    # Generate image
    output_urls = await generate_image(final_prompt, image_model, input_params)

    await report(70)

    # Download generated images to local storage (no auto background removal)
    processed_urls = await _download_images_only(output_urls)

    await report(90)

    return {
        "output_urls": processed_urls,
        "final_prompt": final_prompt,
    }


def _build_final_prompt(system_prompt: str, user_prompt: str, input_params: dict) -> str:
    """
    Build the final prompt by injecting system prompt + context into user prompt.
    System prompt may contain {user_prompt} placeholder.
    """
    # Collect context info
    context_parts = []

    style = input_params.get("style")
    if style and style != "none":
        context_parts.append(f"Style: {style}")

    ratio = input_params.get("ratio")
    if ratio:
        context_parts.append(f"Aspect ratio: {ratio}")

    resolution = input_params.get("resolution")
    if resolution:
        context_parts.append(f"Resolution: {resolution}")

    pose = input_params.get("pose")
    directions = input_params.get("directions")

    context_str = ", ".join(context_parts) if context_parts else ""

    # Build the final prompt with placeholder replacement
    # Support {user_prompt} and {pose} placeholders in system prompts
    if "{user_prompt}" in system_prompt:
        if context_str:
            final = system_prompt.replace("{user_prompt}", f"{user_prompt}\n\n[{context_str}]")
        else:
            final = system_prompt.replace("{user_prompt}", user_prompt)
    else:
        if context_str:
            final = f"{system_prompt}\n\n{user_prompt}\n\n[{context_str}]"
        else:
            final = f"{system_prompt}\n\n{user_prompt}" if system_prompt else user_prompt

    # Replace {pose} with actual pose description (strong injection)
    if pose:
        final = final.replace("{pose}", pose)
    else:
        final = final.replace("{pose}", "标准站立姿势，双臂自然张开呈T字形")

    # Replace {directions} if present
    if directions:
        final = final.replace("{directions}", f"{directions}方向")

    return final.strip()


async def _post_process_images(urls: list[str]) -> list[str]:
    """Download generated images and remove white background (creation tools only)."""
    ensure_upload_dir()
    processed = []

    for url in urls:
        try:
            local_path = await _download_image(url)
            try:
                transparent_url = remove_background(local_path)
                processed.append(transparent_url)
            except Exception as e:
                print(f"Background removal failed for {local_path}: {e}")
                # Image is already downloaded locally, use it as-is
                processed.append(local_path)
        except Exception as e:
            print(f"Download failed for image {url}: {e}")
            # Last resort: use original URL (may expire)
            processed.append(url)

    return processed


async def _download_images_only(urls: list[str]) -> list[str]:
    """Download images to local storage without background removal (toolbox tools)."""
    ensure_upload_dir()
    processed = []

    for url in urls:
        try:
            local_path = await _download_image(url)
            processed.append(local_path)
        except Exception as e:
            print(f"Download failed for image {url}: {e}")
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
