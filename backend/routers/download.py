"""
Download proxy endpoint.
Serves files from the uploads directory with Content-Disposition: attachment
to force browser download instead of opening in a new tab.
"""
import os
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from config import settings

router = APIRouter(prefix="/api", tags=["download"])

UPLOAD_DIR = settings.UPLOAD_DIR


@router.get("/download")
async def download_file(
    path: str = Query(..., description="File path relative to uploads, e.g. /uploads/xxx.png"),
):
    """Download a file from the uploads directory with forced download headers."""
    # Normalize the path
    clean_path = path.lstrip("/")
    if clean_path.startswith("uploads/"):
        clean_path = clean_path[len("uploads/"):]

    # Security: prevent path traversal
    clean_path = os.path.basename(clean_path)
    if not clean_path:
        raise HTTPException(status_code=400, detail="Invalid file path")

    abs_path = os.path.join(UPLOAD_DIR, clean_path)
    if not os.path.exists(abs_path) or not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        abs_path,
        media_type="application/octet-stream",
        filename=clean_path,
        headers={"Content-Disposition": f'attachment; filename="{clean_path}"'},
    )
