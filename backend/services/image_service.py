"""
Image generation service.
Calls image generation APIs (Seedream, DALL-E, etc.) to generate images.
"""
import math
import httpx
import base64


# 分辨率档位 → 目标总像素
_TIER_PIXELS = {
    "720p": 921600,
    "1080p": 2073600,
    "2K": 3686400,
    "4K": 8294400,
}

_MIN_PIXELS = 921600
_MAX_PIXELS = 16777216


def _compute_size(ratio: str, tier: str) -> str:
    """根据宽高比和分辨率档位计算实际宽x高像素值。"""
    target = _TIER_PIXELS.get(tier, 3686400)
    parts = ratio.split(":")
    if len(parts) != 2:
        return "2048x2048"
    try:
        rw, rh = int(parts[0]), int(parts[1])
    except ValueError:
        return "2048x2048"
    if rw <= 0 or rh <= 0:
        return "2048x2048"

    aspect = rw / rh
    height = round(math.sqrt(target / aspect))
    width = round(height * aspect)

    # 四舍五入到最近的 8 的倍数
    height = round(height / 8) * 8
    width = round(width / 8) * 8

    # 确保总像素在允许范围内
    total = width * height
    if total < _MIN_PIXELS:
        scale = math.sqrt(_MIN_PIXELS / total)
        height = round((height * scale) / 8) * 8
        width = round((height * aspect) / 8) * 8
    elif total > _MAX_PIXELS:
        scale = math.sqrt(_MAX_PIXELS / total)
        height = round((height * scale) / 8) * 8
        width = round((height * aspect) / 8) * 8

    return f"{width}x{height}"


def resolve_size(input_params: dict) -> str:
    """
    Resolve size string from input params.
    Accepts either:
    - WxH format (e.g. "2048x1024") → used directly
    - Tier label (e.g. "2K", "1080p") → computed from ratio
    """
    resolution = str(input_params.get("resolution", "2K"))

    # Already WxH format
    parts = resolution.split("x")
    if len(parts) == 2:
        try:
            w, h = int(parts[0]), int(parts[1])
            if w > 0 and h > 0:
                return f"{w}x{h}"
        except ValueError:
            pass

    # Tier label → compute from ratio
    ratio = str(input_params.get("ratio", "1:1"))
    return _compute_size(ratio, resolution)


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
        "watermark": False,
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
