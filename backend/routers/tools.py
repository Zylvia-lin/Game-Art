"""
Local tool endpoints.
Frame extraction, background removal (local + AI), and mask-based background fill.
"""
import os
import uuid
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import settings
from services.image_processor import extract_frames, remove_background, apply_background_mask
from database import fetch_one
from routers.storage import get_storage_config_raw

router = APIRouter(prefix="/api/tools", tags=["tools"])


class ExtractFramesRequest(BaseModel):
    image_url: str
    rows: int
    cols: int


class RemoveBgRequest(BaseModel):
    image_url: str


class RemoveBgMaskRequest(BaseModel):
    image_url: str
    mask_url: str  # base64 data URL
    bg_color: str = "#FFFFFF"


@router.post("/extract-frames")
async def extract_frames_endpoint(data: ExtractFramesRequest):
    """Cut a sprite sheet into individual frames."""
    if data.rows < 1 or data.cols < 1:
        raise HTTPException(status_code=400, detail="rows and cols must be >= 1")
    if data.rows > 20 or data.cols > 20:
        raise HTTPException(status_code=400, detail="rows and cols must be <= 20")

    try:
        frames = extract_frames(data.image_url, data.rows, data.cols)
        return {"frames": frames}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Frame extraction failed: {e}")


@router.post("/remove-bg")
async def remove_bg_endpoint(data: RemoveBgRequest):
    """Remove white background from an image (flood fill from borders)."""
    try:
        url = remove_background(data.image_url)
        return {"url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Background removal failed: {e}")


@router.post("/remove-bg-mask")
async def remove_bg_mask_endpoint(data: RemoveBgMaskRequest):
    """
    Remove background using user-brushed mask.
    Brushed areas are kept, non-brushed areas are filled with bg_color.
    """
    try:
        url = apply_background_mask(data.image_url, data.mask_url, data.bg_color)
        return {"url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mask background removal failed: {e}")


class AIRemoveBgRequest(BaseModel):
    image_url: str
    scene: str = "general"  # general / human / product


def _upload_to_tos(local_path: str, storage_cfg: dict) -> str:
    """
    Upload a local file to TOS using the official TOS Python SDK.
    Returns a tos:// URL for MediaKit consumption.
    """
    import tos

    # Normalize endpoint: TOS SDK expects native endpoint (tos-cn-xxx),
    # not the S3-compatible one (tos-s3-cn-xxx)
    raw_endpoint = storage_cfg["endpoint"]
    if raw_endpoint.startswith("tos-s3-"):
        endpoint = "tos-" + raw_endpoint[len("tos-s3-"):]
    else:
        endpoint = raw_endpoint

    bucket = storage_cfg["bucket"]
    region = storage_cfg["region"]
    ak = storage_cfg["access_key"]
    sk = storage_cfg["secret_key"]
    key = f"gameart/{uuid.uuid4().hex[:12]}_{os.path.basename(local_path)}"

    # Determine content type
    ext = os.path.splitext(local_path)[1].lower()
    content_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext, "application/octet-stream")

    try:
        client = tos.TosClientV2(ak, sk, endpoint, region)
        client.put_object_from_file(
            bucket, key, local_path,
            content_type=content_type,
        )
    except tos.exceptions.TosClientError as e:
        raise RuntimeError(f"TOS 客户端错误: {e.message}, cause: {e.cause}")
    except tos.exceptions.TosServerError as e:
        raise RuntimeError(
            f"TOS 服务端错误: code={e.code}, message={e.message}, "
            f"http_code={e.status_code}, ec={e.ec}"
        )
    except Exception as e:
        raise RuntimeError(f"TOS 上传失败: {str(e)}")

    # Return tos:// URL for MediaKit
    return f"tos://{bucket}/{key}"


@router.post("/ai-remove-bg")
async def ai_remove_bg_endpoint(data: AIRemoveBgRequest):
    """
    AI-powered background removal using Volcengine MediaKit.
    Uploads image to TOS first, then passes tos:// URL to MediaKit.
    Returns transparent PNG URL.
    """
    # Load API key from model_configs (type = 'tool')
    config = await fetch_one(
        "SELECT * FROM model_configs WHERE type = 'tool' AND is_default = true LIMIT 1"
    )
    if not config:
        config = await fetch_one(
            "SELECT * FROM model_configs WHERE type = 'tool' LIMIT 1"
        )
    if not config:
        raise HTTPException(
            status_code=400,
            detail="未找到工具模型配置。请在系统设置中添加一个 type=tool 的配置，填入火山引擎 API Key。"
        )

    api_key = config.get("api_key", "")
    api_base = config.get("api_base_url", "") or "https://mediakit.cn-beijing.volces.com"
    if "visual.volcengineapi.com" in api_base:
        api_base = "https://mediakit.cn-beijing.volces.com"
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="工具模型配置缺少 api_key。请在系统设置中配置火山引擎 API Key。"
        )

    # Load storage config
    storage_cfg = await get_storage_config_raw()
    if not storage_cfg or not storage_cfg.get("access_key"):
        raise HTTPException(
            status_code=400,
            detail="未配置对象存储。请在系统设置中配置火山引擎 TOS 对象存储。"
        )

    # Resolve local file path
    image_url = data.image_url
    if image_url.startswith("/uploads/"):
        local_path = os.path.join(settings.UPLOAD_DIR, image_url.replace("/uploads/", ""))
    elif image_url.startswith("http"):
        raise HTTPException(
            status_code=400,
            detail="暂不支持远程图片 URL，请先上传图片。"
        )
    else:
        local_path = image_url

    if not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail=f"图片文件不存在: {local_path}")

    # Upload to TOS
    try:
        tos_url = _upload_to_tos(local_path, storage_cfg)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"上传图片到对象存储失败: {str(e)}"
        )

    scene = data.scene if data.scene in ("general", "human", "product") else "general"

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{api_base}/api/v1/tools-sync/remove-image-background",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "image_url": tos_url,
                    "scene": scene,
                    "output_format": "png",
                },
            )
            resp_data = resp.json()

        if not resp_data.get("success"):
            error_info = resp_data.get("error", {})
            raise HTTPException(
                status_code=502,
                detail=f"Volcengine bg removal failed: {error_info.get('message', 'Unknown error')}"
            )

        result = resp_data.get("result", {})
        result_url = result.get("image_url", "")
        if not result_url:
            raise HTTPException(status_code=502, detail="Volcengine returned empty result URL")

        # Download the result image and save locally
        async with httpx.AsyncClient(timeout=60) as client:
            img_resp = await client.get(result_url)
            img_resp.raise_for_status()
            img_bytes = img_resp.content

        # Save locally
        upload_dir = settings.UPLOAD_DIR
        os.makedirs(upload_dir, exist_ok=True)
        filename = f"bg_removed_{uuid.uuid4().hex[:12]}.png"
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, "wb") as f:
            f.write(img_bytes)

        return {
            "url": f"/uploads/{filename}",
            "width": result.get("image_width"),
            "height": result.get("image_height"),
        }

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Volcengine bg removal timed out")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI background removal failed: {str(e)}")
