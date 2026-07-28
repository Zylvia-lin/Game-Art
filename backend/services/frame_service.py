"""Local video persistence and deterministic FFmpeg frame exports."""
from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import json
import socket
import shutil
import subprocess
import zipfile
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import HTTPException

from config import settings

EXTRACTION_FPS = 24
MAX_VIDEO_BYTES = 500 * 1024 * 1024


def media_root() -> Path:
    root = Path(settings.UPLOAD_DIR).resolve() / "animation"
    root.mkdir(parents=True, exist_ok=True)
    return root


def public_url(path: Path) -> str:
    relative = path.resolve().relative_to(Path(settings.UPLOAD_DIR).resolve())
    return "/uploads/" + relative.as_posix()


async def _validate_public_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise HTTPException(status_code=502, detail="供应商视频必须使用 HTTPS")
    try:
        addresses = await asyncio.to_thread(socket.getaddrinfo, parsed.hostname, parsed.port or 443)
    except socket.gaierror as exc:
        raise HTTPException(status_code=502, detail="无法解析供应商视频地址") from exc
    for address in addresses:
        if not ipaddress.ip_address(address[4][0]).is_global:
            raise HTTPException(status_code=502, detail="拒绝访问非公网视频地址")


async def persist_remote_video(url: str, task_id: str) -> Path:
    target_dir = media_root() / "videos"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{task_id}.mp4"
    if target.exists():
        return target
    temporary = target.with_suffix(".part")
    async with httpx.AsyncClient(timeout=120, follow_redirects=False) as client:
        current = url
        for _ in range(6):
            await _validate_public_url(current)
            async with client.stream("GET", current) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        raise HTTPException(status_code=502, detail="视频转存遇到无效重定向")
                    current = urljoin(current, location)
                    continue
                response.raise_for_status()
                declared = int(response.headers.get("content-length") or 0)
                if declared > MAX_VIDEO_BYTES:
                    raise HTTPException(status_code=413, detail="供应商视频超过 500MB")
                written = 0
                try:
                    with temporary.open("wb") as output:
                        async for chunk in response.aiter_bytes():
                            written += len(chunk)
                            if written > MAX_VIDEO_BYTES:
                                raise HTTPException(status_code=413, detail="供应商视频超过 500MB")
                            output.write(chunk)
                    temporary.replace(target)
                    return target
                except Exception:
                    temporary.unlink(missing_ok=True)
                    raise
        raise HTTPException(status_code=502, detail="供应商视频重定向次数过多")

def _run(args: list[str]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(args, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="服务器未安装 FFmpeg/ffprobe") from exc
    except subprocess.CalledProcessError as exc:
        raise HTTPException(status_code=500, detail=(exc.stderr or "媒体处理失败")[-1000:]) from exc


def probe_video(path: Path) -> dict:
    result = _run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,duration",
        "-show_entries", "format=duration", "-of", "json", str(path),
    ])
    payload = json.loads(result.stdout)
    stream = (payload.get("streams") or [{}])[0]
    duration = float(stream.get("duration") or payload.get("format", {}).get("duration") or 0)
    rate = str(stream.get("r_frame_rate") or "0/1").split("/")
    fps = float(rate[0]) / float(rate[1]) if len(rate) == 2 and float(rate[1]) else 0
    return {"width": int(stream.get("width") or 0), "height": int(stream.get("height") or 0), "duration": duration, "fps": fps}


async def extract_frames(video: Path, extraction_id: str) -> tuple[list[dict], dict]:
    def work() -> tuple[list[dict], dict]:
        directory = media_root() / "frames" / extraction_id
        originals = directory / "originals"
        thumbs = directory / "thumbs"
        originals.mkdir(parents=True, exist_ok=True)
        thumbs.mkdir(parents=True, exist_ok=True)
        _run(["ffmpeg", "-y", "-i", str(video), "-vf", f"fps={EXTRACTION_FPS}", "-vsync", "0", str(originals / "%06d.png")])
        _run(["ffmpeg", "-y", "-i", str(video), "-vf", f"fps={EXTRACTION_FPS},scale=240:-2", "-q:v", "4", str(thumbs / "%06d.jpg")])
        frames = [
            {"number": index, "url": public_url(path), "thumbnail_url": public_url(thumbs / f"{index:06d}.jpg")}
            for index, path in enumerate(sorted(originals.glob("*.png")), start=1)
        ]
        return frames, probe_video(video)
    return await asyncio.to_thread(work)


def normalize_selection(selected: list[int], total: int) -> list[int]:
    values = sorted(set(selected))
    if any(value < 1 or value > total for value in values):
        raise HTTPException(status_code=422, detail="选中帧序号超出范围")
    return values


async def export_video(extraction_id: str, frames: list[dict], selected: list[int], fps: float) -> Path:
    if not 1 <= fps <= 60:
        raise HTTPException(status_code=422, detail="导出帧率必须在 1–60 fps")
    def work() -> Path:
        directory = media_root() / "frames" / extraction_id
        concat = directory / "selected.txt"
        duration = 1 / fps
        lines = []
        for number in selected:
            source = Path(settings.UPLOAD_DIR).resolve() / frames[number - 1]["url"].removeprefix("/uploads/")
            escaped = str(source).replace("'", "'\\''")
            lines.extend([f"file '{escaped}'", f"duration {duration:.9f}"])
        if selected:
            lines.append(lines[-2])
        concat.write_text("\n".join(lines), encoding="utf-8")
        target = directory / f"export-{fps:g}.mp4"
        _run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-an", "-r", str(fps), "-pix_fmt", "yuv420p", str(target)])
        return target
    return await asyncio.to_thread(work)


async def prepare_sequence(extraction_id: str, frames: list[dict], selected: list[int]) -> Path:
    def work() -> Path:
        directory = media_root() / "frames" / extraction_id / "sequence"
        if directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True)
        for index, number in enumerate(selected, start=1):
            source = Path(settings.UPLOAD_DIR).resolve() / frames[number - 1]["url"].removeprefix("/uploads/")
            shutil.copy2(source, directory / f"{index:03d}.png")
        return directory
    return await asyncio.to_thread(work)


def selection_hash(selected: list[int]) -> str:
    return hashlib.sha256(",".join(map(str, selected)).encode()).hexdigest()


async def create_zip(sequence_dir: Path, extraction_id: str, cache_key: str) -> Path:
    def work() -> Path:
        target = media_root() / "frames" / extraction_id / f"sequence-{cache_key[:12]}.zip"
        if not target.exists():
            with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
                for frame in sorted(sequence_dir.glob("*.png")):
                    archive.write(frame, frame.name)
        return target
    return await asyncio.to_thread(work)
