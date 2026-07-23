"""
Image processing service using Pillow.
Handles white background removal (flood fill from borders) and mask-based background fill.
"""
import os
import io
import time
import base64
import random
import string
import numpy as np
from PIL import Image, ImageDraw

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


def ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def _resolve_path(path: str) -> str:
    """Resolve a URL path like /uploads/xxx.png to absolute filesystem path."""
    if path.startswith("/uploads/"):
        return os.path.join(UPLOAD_DIR, path[len("/uploads/"):])
    if os.path.isabs(path):
        return path
    return os.path.join(UPLOAD_DIR, path)


def remove_background(input_path: str, tolerance: int = 15) -> str:
    """
    Remove white/near-white background from image using flood fill from borders.
    Only removes white pixels that are CONNECTED to the image border —
    interior white areas (e.g. white clothing, white eyes) are preserved.
    Output is a transparent PNG.
    """
    abs_input = _resolve_path(input_path)
    if not os.path.exists(abs_input):
        raise FileNotFoundError(f"Input file not found: {abs_input}")

    ensure_upload_dir()

    img = Image.open(abs_input).convert("RGBA")
    arr = np.array(img, dtype=np.uint8)

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # White mask: all channels close to 255
    white_mask = (
        (r >= 255 - tolerance)
        & (g >= 255 - tolerance)
        & (b >= 255 - tolerance)
    ).astype(bool)

    # Flood fill from all border white pixels
    # Start with border pixels that are white
    bg = np.zeros_like(white_mask, dtype=bool)
    bg[0, :] = white_mask[0, :]
    bg[-1, :] = white_mask[-1, :]
    bg[:, 0] = white_mask[:, 0]
    bg[:, -1] = white_mask[:, -1]

    # Iteratively expand background region through white pixels
    while True:
        new_bg = bg.copy()
        new_bg[1:, :] |= bg[:-1, :] & white_mask[1:, :]
        new_bg[:-1, :] |= bg[1:, :] & white_mask[:-1, :]
        new_bg[:, 1:] |= bg[:, :-1] & white_mask[:, 1:]
        new_bg[:, :-1] |= bg[:, 1:] & white_mask[:, :-1]
        if np.array_equal(new_bg, bg):
            break
        bg = new_bg

    # Set background pixels to transparent
    arr[bg, 3] = 0

    # Edge feathering: semi-transparent pixels at the boundary
    # Find boundary pixels (opaque but adjacent to transparent)
    alpha = arr[:, :, 3]
    transparent = alpha == 0
    # Dilate transparent mask by 1px
    neighbor_transparent = np.zeros_like(transparent)
    neighbor_transparent[1:, :] |= transparent[:-1, :]
    neighbor_transparent[:-1, :] |= transparent[1:, :]
    neighbor_transparent[:, 1:] |= transparent[:, :-1]
    neighbor_transparent[:, :-1] |= transparent[:, 1:]
    # Pixels that are opaque but next to transparent = boundary
    boundary = (~transparent) & neighbor_transparent
    arr[boundary, 3] = 128

    result = Image.fromarray(arr, mode="RGBA")

    base = os.path.splitext(os.path.basename(abs_input))[0]
    output_name = f"{base}_transparent.png"
    abs_output = os.path.join(UPLOAD_DIR, output_name)
    result.save(abs_output, "PNG")

    return f"/uploads/{output_name}"


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert hex color string to (R, G, B) tuple."""
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))


def apply_background_mask(
    input_path: str,
    mask_data_url: str,
    bg_color: str = "#FFFFFF",
) -> str:
    """
    Apply user-brushed mask to remove background.
    Brushed (non-transparent) areas in the mask are KEPT from the original image.
    Non-brushed areas are filled with the specified solid background color.

    Args:
        input_path: Path or /uploads/ URL of the original image
        mask_data_url: Base64 data URL of the mask canvas (RGBA, brushed = alpha > 0)
        bg_color: Hex color string for the fill background (default white)
    Returns:
        /uploads/ relative URL of the processed image
    """
    abs_input = _resolve_path(input_path)
    if not os.path.exists(abs_input):
        raise FileNotFoundError(f"Input file not found: {abs_input}")

    ensure_upload_dir()

    # Load original image
    img = Image.open(abs_input).convert("RGBA")
    orig_arr = np.array(img, dtype=np.uint8)
    height, width = orig_arr.shape[:2]

    # Decode mask from data URL
    if mask_data_url.startswith("data:image/"):
        b64_data = mask_data_url.split(",", 1)[1]
        mask_bytes = base64.b64decode(b64_data)
        mask_img = Image.open(io.BytesIO(mask_bytes)).convert("RGBA")
    else:
        # Treat as file path
        mask_img = Image.open(_resolve_path(mask_data_url)).convert("RGBA")

    # Resize mask to match original image
    if mask_img.size != (width, height):
        mask_img = mask_img.resize((width, height), Image.LANCZOS)

    mask_arr = np.array(mask_img, dtype=np.uint8)
    mask_alpha = mask_arr[:, :, 3]  # Brushed areas have alpha > 0

    # Build result: keep original where mask is brushed, fill bg_color elsewhere
    fill_rgb = _hex_to_rgb(bg_color)
    result_arr = orig_arr.copy()
    # Non-brushed pixels: fill with bg color, fully opaque
    non_brushed = mask_alpha == 0
    result_arr[non_brushed, 0] = fill_rgb[0]
    result_arr[non_brushed, 1] = fill_rgb[1]
    result_arr[non_brushed, 2] = fill_rgb[2]
    result_arr[non_brushed, 3] = 255
    # Brushed pixels: keep original (alpha 255)
    result_arr[mask_alpha > 0, 3] = 255

    result = Image.fromarray(result_arr, mode="RGBA")

    unique = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    output_name = f"bgremoved_{int(time.time())}_{unique}.png"
    abs_output = os.path.join(UPLOAD_DIR, output_name)
    result.save(abs_output, "PNG")

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
