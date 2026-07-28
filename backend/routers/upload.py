"""
File upload and image proxy endpoint.
"""
import os
import time
import random
import string
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from config import settings

router = APIRouter(prefix="/api", tags=["upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.post("")
@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload an image file."""
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")

    # Validate file type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only image files are allowed (JPG, PNG, WebP, GIF)")

    # Read and validate size
    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File size must be less than 10MB")

    # Generate unique filename
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"
    unique = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    filename = f"{int(time.time())}_{unique}.{ext}"

    # Ensure directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Write file
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/{filename}", "filename": filename}


@router.get("/proxy-image")
async def proxy_image(url: str):
    """Proxy an image file to avoid CORS canvas taint.
    Reads files from the uploads directory and serves them with proper headers.
    """
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")

    # Only allow proxying files from the uploads directory
    if url.startswith("/uploads/"):
        filename = os.path.basename(url)
        filepath = os.path.join(UPLOAD_DIR, filename)
    elif url.startswith("http://") or url.startswith("https://"):
        # For external URLs, redirect (proxy would require httpx)
        raise HTTPException(status_code=400, detail="External URLs not supported")
    else:
        filename = os.path.basename(url)
        filepath = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(filepath)
