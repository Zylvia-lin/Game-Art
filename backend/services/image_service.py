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


def _get_model_pixel_limits(model_name: str) -> tuple[int, int]:
    """Get min/max pixel limits based on model version.
    - seedream-4.0: [921600, 16777216]   (1280x720 ~ 4096x4096)
    - seedream-4.5 / 5.0-lite: [3686400, 4194304]  (2560x1440 ~ 2048x2048)
    """
    name = (model_name or "").lower()
    if "5.0" in name or "4.5" in name:
        return 3686400, 4194304
    # Default to 4.0 limits (most permissive)
    return 921600, 16777216


def _clamp_dimensions(w: int, h: int, model_name: str = "") -> tuple[int, int]:
    """Clamp dimensions to Volcano Engine Seedream API limits.
    - Total pixels: model-dependent [MIN, MAX]
    - Aspect ratio: [1/16, 16]
    - Rounded to multiples of 8
    """
    rw = max(8, round(w / 8) * 8)
    rh = max(8, round(h / 8) * 8)

    # Clamp aspect ratio to [1/16, 16]
    ar = rw / rh
    if ar > 16:
        rh = max(8, round(rw / 16 / 8) * 8)
    elif ar < 1 / 16:
        rw = max(8, round(rh / 16 / 8) * 8)

    # Clamp total pixels based on model version
    MIN_PX, MAX_PX = _get_model_pixel_limits(model_name)
    total = rw * rh
    if total < MIN_PX:
        scale = (MIN_PX / total) ** 0.5
        rh = max(8, round(rh * scale / 8) * 8)
        rw = max(8, round(rh * (w / h) / 8) * 8)
    elif total > MAX_PX:
        scale = (MAX_PX / total) ** 0.5
        rh = max(8, round(rh * scale / 8) * 8)
        rw = max(8, round(rh * (w / h) / 8) * 8)

    return rw, rh


def resolve_size(input_params: dict, model_name: str = "") -> str:
    """
    Resolve size string from input params.
    Accepts either:
    - WxH format (e.g. "2048x1024") → clamped to API limits
    - Tier label (e.g. "2K", "1080p") → computed from ratio
    """
    resolution = str(input_params.get("resolution", "2K"))

    # Already WxH format → validate and clamp
    parts = resolution.split("x")
    if len(parts) == 2:
        try:
            w, h = int(parts[0]), int(parts[1])
            if w > 0 and h > 0:
                cw, ch = _clamp_dimensions(w, h, model_name)
                return f"{cw}x{ch}"
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
    size = resolve_size(input_params, model.get("model_name", ""))

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

    print(f"[Image API] Request: model={model['model_name']}, size={size}, "
          f"has_image={bool(image_url)}, has_mask={bool(mask_url)}")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=body, headers=headers)
        if response.status_code != 200:
            error_text = response.text
            print(f"[Image API] Error {response.status_code}: {error_text}")
            print(f"[Image API] Request body: size={body.get('size')}, has_image={bool(body.get('image'))}")
            # Try to extract a human-readable message from the API error
            try:
                error_json = response.json()
                if isinstance(error_json, dict):
                    err = error_json.get("error", error_json)
                    if isinstance(err, dict):
                        msg = err.get("message") or err.get("code") or str(err)
                    else:
                        msg = str(err)
                else:
                    msg = error_text
            except Exception:
                msg = error_text[:300]
            raise Exception(f"Image API error {response.status_code}: {msg}")

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
