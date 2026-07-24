"""
Image generation service.
Calls image generation APIs (Seedream, DALL-E, etc.) to generate images.
"""
import os
import io
import math
import httpx
import base64
from PIL import Image
from urllib.parse import urlparse


# 分辨率档位 → 目标总像素
_TIER_PIXELS = {
    "720p": 921600,
    "1080p": 2073600,
    "2K": 3686400,
    "4K": 8294400,
}

_MIN_PIXELS = 921600
_MAX_PIXELS = 16777216

# 本地文件上传目录（与 image_processor.py 保持一致）
_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

# 文件扩展名 → MIME type 映射
_EXT_MIME = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
}


def _resolve_local_path(url: str) -> str | None:
    """将 /uploads/xxx 相对路径解析为本地文件系统绝对路径。
    返回 None 表示不是本地路径。
    """
    if url.startswith("/uploads/"):
        return os.path.join(_UPLOAD_DIR, url[len("/uploads/"):])
    if os.path.isabs(url) and os.path.isfile(url):
        return url
    # 相对路径兜底
    candidate = os.path.join(_UPLOAD_DIR, url)
    if os.path.isfile(candidate):
        return candidate
    return None


def _to_base64_uri(file_path: str) -> str:
    """读取本地图片文件并转换为 base64 data URI。"""
    ext = os.path.splitext(file_path)[1].lower()
    mime = _EXT_MIME.get(ext, "image/png")
    with open(file_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def resolve_image_input(image_url: str) -> str:
    """将 image_url 转换为火山引擎 API 可接受的格式。

    - http/https URL → 原样返回（公网可访问）
    - data: URI → 原样返回（已是 base64）
    - 本地路径（/uploads/xxx）→ 读取文件转为 base64 data URI
    - localhost URL（http://localhost:8000/uploads/xxx）→ 提取本地路径转 base64
    """
    if not image_url:
        return image_url

    # base64 data URI，直接使用
    if image_url.startswith("data:"):
        return image_url

    # localhost URL → 提取路径部分，转本地文件
    if image_url.startswith("http://localhost") or image_url.startswith("http://127.0.0.1"):
        parsed = urlparse(image_url)
        local_path = _resolve_local_path(parsed.path)
        if local_path and os.path.isfile(local_path):
            print(f"[Image API] Converting localhost URL to base64: {image_url} -> {local_path}")
            return _to_base64_uri(local_path)
        raise FileNotFoundError(f"图片文件不存在: {image_url} (resolved: {local_path})")

    # 公网 URL（非 localhost），直接使用
    if image_url.startswith(("http://", "https://")):
        return image_url

    # 本地文件路径（/uploads/xxx 或相对路径）→ 转 base64
    local_path = _resolve_local_path(image_url)
    if local_path and os.path.isfile(local_path):
        print(f"[Image API] Converting local file to base64: {image_url} -> {local_path}")
        return _to_base64_uri(local_path)

    # 文件不存在 → 抛出异常，避免把无效 URL 传给 API
    raise FileNotFoundError(
        f"图片文件不存在: {image_url} (resolved: {local_path}), "
        f"upload_dir={_UPLOAD_DIR}, exists={os.path.isdir(_UPLOAD_DIR)}"
    )


def _get_image_dimensions(image_url: str) -> tuple[int, int] | None:
    """读取图片的实际宽高，用于图生图时保持输出分辨率与原图一致。
    支持 data: URI、本地路径、localhost URL。
    公网 URL 无法读取时返回 None。
    """
    if not image_url:
        return None

    try:
        # data: URI → 解码后用 PIL 读取
        if image_url.startswith("data:"):
            _, b64data = image_url.split(",", 1)
            raw = base64.b64decode(b64data)
            img = Image.open(io.BytesIO(raw))
            return img.size  # (width, height)

        # localhost URL → 提取本地路径
        if image_url.startswith("http://localhost") or image_url.startswith("http://127.0.0.1"):
            parsed = urlparse(image_url)
            local_path = _resolve_local_path(parsed.path)
            if local_path and os.path.isfile(local_path):
                img = Image.open(local_path)
                return img.size
            return None

        # 公网 URL → 无法本地读取
        if image_url.startswith(("http://", "https://")):
            return None

        # 本地文件路径
        local_path = _resolve_local_path(image_url)
        if local_path and os.path.isfile(local_path):
            img = Image.open(local_path)
            return img.size
    except Exception as e:
        print(f"[Image API] Failed to read image dimensions: {e}")

    return None


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
    Model IDs use dashes, e.g. doubao-seedream-5-0-pro-260628
    - seedream-5.0-pro:  [921600, 4194304]   (1280x720 ~ 2048x2048)
    - seedream-5.0-lite: [3686400, 16777216] (2560x1440 ~ 4096x4096)
    - seedream-4.5:      [3686400, 16777216] (2560x1440 ~ 4096x4096)
    - seedream-4.0:      [921600, 16777216]  (1280x720 ~ 4096x4096)
    """
    name = (model_name or "").lower()
    # Check 5.0 Pro first (must precede generic 5.0 check)
    if "5-0-pro" in name or "5.0-pro" in name:
        return 921600, 4194304
    # 5.0 Lite
    if "5-0" in name or "5.0" in name:
        return 3686400, 16777216
    # 4.5
    if "4-5" in name or "4.5" in name:
        return 3686400, 16777216
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
    # Add reference image for img2img / inpaint
    # 本地文件需转换为 base64 data URI，API 无法访问 localhost 路径
    image_url = input_params.get("image_url")
    mask_url = input_params.get("mask_url")

    body: dict = {
        "model": model["model_name"],
        "prompt": prompt,
        "watermark": False,
    }

    # 有参考图时：
    # - img2img（无 mask）：用前端传入的 ratio/resolution 计算输出尺寸
    # - inpaint（有 mask）：读取原图尺寸作为输出 size，使生成图片分辨率与原图一致
    has_ref_image = bool(image_url)
    has_mask = bool(mask_url)
    if has_ref_image and not has_mask:
        size = resolve_size(input_params, model.get("model_name", ""))
        body["size"] = size
    elif has_ref_image and has_mask:
        orig_dims = _get_image_dimensions(image_url)
        if orig_dims:
            cw, ch = _clamp_dimensions(orig_dims[0], orig_dims[1], model.get("model_name", ""))
            body["size"] = f"{cw}x{ch}"
        # 读取失败时不传 size，让 API 用默认值
    else:
        size = resolve_size(input_params, model.get("model_name", ""))
        body["size"] = size

    if image_url:
        body["image"] = resolve_image_input(image_url)
    if mask_url:
        body["mask"] = resolve_image_input(mask_url)

    url = model["api_base_url"].rstrip("/")
    headers = {
        "Authorization": f"Bearer {model['api_key']}",
        "Content-Type": "application/json",
    }

    # 日志：记录图片输入类型（base64 / url / 无）
    img_type = "none"
    if body.get("image"):
        img_type = "base64" if body["image"].startswith("data:") else "url"
    mask_type = "none"
    if body.get("mask"):
        mask_type = "base64" if body["mask"].startswith("data:") else "url"
    print(f"[Image API] Request: model={model['model_name']}, size={body.get('size', 'auto')}, "
          f"image_type={img_type}, mask_type={mask_type}")

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
