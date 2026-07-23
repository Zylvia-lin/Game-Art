"""
Image generation service.
Calls image generation APIs (Seedream, DALL-E, etc.) to generate images.
"""
import httpx
import base64


def resolve_size(input_params: dict) -> str:
    """Resolve size string from input params. Expects WxH format."""
    resolution = input_params.get("resolution", "1024x1024")
    parts = str(resolution).split("x")
    if len(parts) == 2:
        try:
            w, h = int(parts[0]), int(parts[1])
            if w > 0 and h > 0:
                return f"{w}x{h}"
        except ValueError:
            pass
    return "1024x1024"


async def generate_image(
    prompt: str,
    model: dict,
    input_params: dict,
) -> list[str]:
    """
    Generate image using the configured image model.
    Supports text-to-image, image-to-image (image_url), and inpainting (mask_url).
    Returns list of image URLs or base64 data URLs.
    """
    size = resolve_size(input_params)

    body = {
        "model": model["model_name"],
        "prompt": prompt,
        "size": size,
        "n": 1,
    }

    # Add reference image for img2img / inpaint
    image_url = input_params.get("image_url")
    mask_url = input_params.get("mask_url")
    if image_url:
        body["image"] = image_url
    if mask_url:
        body["mask"] = mask_url

    url = model["api_base_url"].rstrip("/")
    headers = {
        "Authorization": f"Bearer {model['api_key']}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=body, headers=headers)
        if response.status_code != 200:
            error_text = response.text
            raise Exception(f"Image API error: {response.status_code} - {error_text}")

        data = response.json()

    # Extract image URLs from response
    images = data.get("images") or data.get("data") or []
    urls = []
    for img in images:
        if isinstance(img, dict):
            if img.get("url"):
                urls.append(img["url"])
            elif img.get("b64_json"):
                urls.append(f"data:image/png;base64,{img['b64_json']}")

    if not urls:
        raise Exception("No images returned from API")

    return urls
