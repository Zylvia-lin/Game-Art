"""
Image processing service using Pillow.
Handles green screen removal and sprite frame extraction.
"""
import os
import time
import random
import string
from PIL import Image

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


def ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def _rgb_to_hsv(r: int, g: int, b: int) -> tuple[float, float, float]:
    """Convert RGB (0-255) to HSV (h: 0-360, s: 0-100, v: 0-100)."""
    rn, gn, bn = r / 255.0, g / 255.0, b / 255.0
    mx = max(rn, gn, bn)
    mn = min(rn, gn, bn)
    diff = mx - mn

    h = 0.0
    if diff != 0:
        if mx == rn:
            h = ((gn - bn) / diff + (6 if gn < bn else 0)) * 60
        elif mx == gn:
            h = ((bn - rn) / diff + 2) * 60
        else:
            h = ((rn - gn) / diff + 4) * 60

    s = 0.0 if mx == 0 else (diff / mx) * 100
    v = mx * 100
    return h, s, v


def _resolve_path(path: str) -> str:
    """Resolve a URL path like /uploads/xxx.png to absolute filesystem path."""
    if path.startswith("/uploads/"):
        return os.path.join(UPLOAD_DIR, path[len("/uploads/"):])
    if os.path.isabs(path):
        return path
    return os.path.join(UPLOAD_DIR, path)


def remove_green_background(input_path: str, tolerance: int = 30) -> str:
    """
    Remove green background from image, output transparent PNG.
    Returns the /uploads/ relative URL.
    """
    abs_input = _resolve_path(input_path)
    if not os.path.exists(abs_input):
        raise FileNotFoundError(f"Input file not found: {abs_input}")

    ensure_upload_dir()

    img = Image.open(abs_input).convert("RGBA")
    pixels = img.load()
    width, height = img.size

    # Green HSV range
    green_min_h, green_max_h = 60, 180
    green_min_s, green_min_v = 40, 20

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            h, s, v = _rgb_to_hsv(r, g, b)

            is_green = (
                green_min_h - tolerance <= h <= green_max_h + tolerance
                and s >= green_min_s
                and v >= green_min_v
            )
            if is_green:
                pixels[x, y] = (r, g, b, 0)

    # Feather edges: soften 1px boundary between opaque and transparent
    for y in range(1, height - 1):
        for x in range(1, width - 1):
            r, g, b, a = pixels[x, y]
            if a == 255:
                has_transparent_neighbor = False
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if pixels[x + dx, y + dy][3] == 0:
                            has_transparent_neighbor = True
                            break
                    if has_transparent_neighbor:
                        break
                if has_transparent_neighbor:
                    pixels[x, y] = (r, g, b, 128)

    # Save output
    base = os.path.splitext(os.path.basename(abs_input))[0]
    output_name = f"{base}_transparent.png"
    abs_output = os.path.join(UPLOAD_DIR, output_name)
    img.save(abs_output, "PNG")

    return f"/uploads/{output_name}"


def extract_frames(input_path: str, rows: int, cols: int, output_prefix: str | None = None) -> list[str]:
    """
    Cut a sprite sheet into individual frames.
    Returns list of /uploads/ relative URLs.
    """
    abs_input = _resolve_path(input_path)
    if not os.path.exists(abs_input):
        raise FileNotFoundError(f"Input file not found: {abs_input}")

    ensure_upload_dir()

    img = Image.open(abs_input)
    img_width, img_height = img.size

    if img_width == 0 or img_height == 0:
        raise ValueError("Invalid image dimensions")

    frame_width = img_width // cols
    frame_height = img_height // rows

    prefix = output_prefix or f"frame_{int(time.time())}"
    frames = []

    for row in range(rows):
        for col in range(cols):
            left = col * frame_width
            top = row * frame_height
            right = left + frame_width
            bottom = top + frame_height

            frame = img.crop((left, top, right, bottom))
            output_name = f"{prefix}_{row}_{col}.png"
            abs_output = os.path.join(UPLOAD_DIR, output_name)
            frame.save(abs_output, "PNG")
            frames.append(f"/uploads/{output_name}")

    return frames


def save_image_from_bytes(data: bytes, prefix: str = "gen") -> str:
    """Save raw image bytes to uploads dir, return /uploads/ relative URL."""
    ensure_upload_dir()
    ext = "png"
    unique = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    filename = f"{prefix}_{int(time.time())}_{unique}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(data)
    return f"/uploads/{filename}"
