import httpx
from typing import Optional
from models.model_config import ModelConfig


async def _call_image_api(model: ModelConfig, payload: dict) -> list[str]:
    url = model.api_base_url.rstrip("/")
    if "/images" not in url:
        url = url + "/images/generations"

    headers = {
        "Authorization": f"Bearer {model.api_key}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    urls = []
    for item in data.get("data", []):
        if "url" in item:
            urls.append(item["url"])
        elif "b64_json" in item:
            import base64
            urls.append(f"data:image/png;base64,{item['b64_json']}")
    return urls


async def generate_image(
    prompt: str,
    style: Optional[str] = None,
    ratio: Optional[str] = "1:1",
    resolution: Optional[str] = "1024x1024",
    model: ModelConfig = None
) -> list[str]:
    if model is None:
        raise ValueError("No image model configured")

    width, height = 1024, 1024
    if resolution and "x" in resolution:
        parts = resolution.split("x")
        width, height = int(parts[0]), int(parts[1])

    payload = {
        "model": model.model_name,
        "prompt": prompt,
        "size": f"{width}x{height}",
        "n": 1
    }

    if style:
        payload["prompt"] = f"{prompt}, {style} style"

    return await _call_image_api(model, payload)


async def edit_image(
    image_url: str,
    prompt: str,
    strength: float = 0.7,
    model: ModelConfig = None
) -> list[str]:
    if model is None:
        raise ValueError("No image model configured")

    payload = {
        "model": model.model_name,
        "prompt": prompt,
        "image": image_url,
        "strength": strength,
        "n": 1
    }
    return await _call_image_api(model, payload)


async def inpaint_image(
    image_url: str,
    mask_url: str,
    prompt: str,
    model: ModelConfig = None
) -> list[str]:
    if model is None:
        raise ValueError("No image model configured")

    payload = {
        "model": model.model_name,
        "prompt": prompt,
        "image": image_url,
        "mask": mask_url,
        "n": 1
    }
    return await _call_image_api(model, payload)
