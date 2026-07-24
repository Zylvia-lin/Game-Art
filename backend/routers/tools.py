"""
Local tool endpoints.
Frame extraction, background removal (local + AI), and mask-based background fill.
"""
import os
import base64
import uuid
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import settings
from services.image_processor import extract_frames, remove_background, apply_background_mask
from database import fetch_one

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


@router.post("/ai-remove-bg")
async def ai_remove_bg_endpoint(data: AIRemoveBgRequest):
    """
    AI-powered background removal using Volcengine MediaKit.
    Returns transparent PNG URL.
    """
    # Load API key from model_configs (type = 'tool' - 火山工具模型)
    config = await fetch_one(
        "SELECT * FROM model_configs WHERE type = 'tool' AND is_default = true LIMIT 1"
    )
    if not config:
        # Fallback: any tool config
        config = await fetch_one(
            "SELECT * FROM model_configs WHERE type = 'tool' LIMIT 1"
        )
    if not config:
        raise HTTPException(
            status_code=400,
            detail="未找到工具模型配置。请在模型设置中添加一个 type=tool 的配置，填入火山引擎 API Key。"
        )

    api_key = config.get("api_key", "")
    api_base = config.get("api_base_url", "") or "https://mediakit.cn-beijing.volces.com"
    # MediaKit API base is different from general volcengine API base
    # If user configured visual.volcengineapi.com, use MediaKit endpoint instead
    if "visual.volcengineapi.com" in api_base:
        api_base = "https://mediakit.cn-beijing.volces.com"
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="工具模型配置缺少 api_key。请在模型设置中配置火山引擎 API Key。"
        )

    # Resolve image URL to absolute if relative
    image_url = data.image_url
    if image_url.startswith("/uploads/"):
        # Need a publicly accessible URL for Volcengine to fetch
        backend_base = f"http://127.0.0.1:{settings.backend_port}"
        image_url = f"{backend_base}{image_url}"

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
                    "image_url": image_url,
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
        import os
        import uuid
        from config import settings
        upload_dir = settings.upload_dir
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
