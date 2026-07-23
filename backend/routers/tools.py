"""
Local tool endpoints (no AI required).
Frame extraction, background removal, and mask-based background fill.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.image_processor import extract_frames, remove_background, apply_background_mask

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
