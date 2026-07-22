from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import os
import uuid
import aiofiles
from database import get_db
from models.model_config import ModelConfig
from models.system_prompt import SystemPrompt
from models.generation import Generation
from models.asset import Asset
from services.prompt_pipeline import enhance_prompt
from services.image_service import generate_image, edit_image, inpaint_image
from config import settings

router = APIRouter(prefix="/api/generate", tags=["generate"])


class TextToImageRequest(BaseModel):
    project_id: int
    prompt: str
    style: Optional[str] = None
    ratio: Optional[str] = "1:1"
    resolution: Optional[str] = "1024x1024"
    model_id: Optional[int] = None


class ImageToImageRequest(BaseModel):
    project_id: int
    image_url: str
    prompt: str
    strength: float = 0.7
    model_id: Optional[int] = None


class InpaintRequest(BaseModel):
    project_id: int
    image_url: str
    mask_url: str
    prompt: str
    model_id: Optional[int] = None


class CharacterRequest(BaseModel):
    project_id: int
    prompt: str
    sub_tool: str  # 'tpose', 'directions', 'part_split'
    directions: Optional[int] = 8
    style: Optional[str] = None
    model_id: Optional[int] = None


class AnimationRequest(BaseModel):
    project_id: int
    image_url: str
    action: str
    sub_tool: str = "text"  # 'text', 'skeleton', 'frame_extract'
    frame_count: int = 4
    model_id: Optional[int] = None


class PropRequest(BaseModel):
    project_id: int
    prompt: str
    sub_tool: str = "generate"  # 'generate', 'variant'
    reference_url: Optional[str] = None
    variant_count: int = 4
    style: Optional[str] = None
    model_id: Optional[int] = None


class UILayoutRequest(BaseModel):
    project_id: int
    prompt: str
    sub_tool: str = "layout_generate"  # 'layout_generate', 'component_place', 'component_split'
    layout_type: Optional[str] = None
    components: Optional[list] = None
    model_id: Optional[int] = None


class SceneRequest(BaseModel):
    project_id: int
    prompt: str
    sub_tool: str = "map_generate"  # 'map_generate', 'map_split'
    map_type: Optional[str] = "top"  # 'top', 'side'
    tile_size: Optional[int] = 32
    model_id: Optional[int] = None


async def get_default_model(db: AsyncSession, model_type: str, model_id: Optional[int] = None) -> ModelConfig:
    if model_id:
        result = await db.execute(select(ModelConfig).where(ModelConfig.id == model_id))
        model = result.scalar_one_or_none()
        if model:
            return model
    result = await db.execute(
        select(ModelConfig).where(ModelConfig.type == model_type, ModelConfig.is_default == True)
    )
    model = result.scalar_one_or_none()
    if not model:
        result = await db.execute(select(ModelConfig).where(ModelConfig.type == model_type))
        model = result.scalars().first()
    if not model:
        raise HTTPException(status_code=400, detail=f"No {model_type} model configured. Please add one in Model Settings.")
    return model


async def get_system_prompt(db: AsyncSession, tool_key: str) -> str:
    result = await db.execute(select(SystemPrompt).where(SystemPrompt.tool_key == tool_key))
    prompt = result.scalar_one_or_none()
    if not prompt:
        return ""
    return prompt.prompt_content


async def save_generation(db: AsyncSession, project_id: int, tool_key: str, input_params: dict,
                          output_urls: list, status: str = "completed", error_message: str = None):
    gen = Generation(
        project_id=project_id, tool_key=tool_key,
        input_params=input_params, output_urls=output_urls,
        status=status, error_message=error_message
    )
    db.add(gen)
    await db.flush()
    return gen


async def save_asset(db: AsyncSession, project_id: int, generation_id: int,
                     name: str, asset_type: str, url: str, metadata: dict = None):
    asset = Asset(
        project_id=project_id, generation_id=generation_id,
        name=name, type=asset_type, url=url, metadata_=metadata
    )
    db.add(asset)
    await db.flush()
    return asset


async def save_upload(file: UploadFile) -> str:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)
    return f"/uploads/{filename}"


@router.post("/text-to-image")
async def text_to_image(req: TextToImageRequest, db: AsyncSession = Depends(get_db)):
    model = await get_default_model(db, "image", req.model_id)
    system_prompt = await get_system_prompt(db, "text_to_image")

    try:
        enhanced = await enhance_prompt(system_prompt, req.prompt, model=None, db=db)
        image_urls = await generate_image(enhanced, req.style, req.ratio, req.resolution, model)

        gen = await save_generation(db, req.project_id, "text_to_image",
                                    {"prompt": req.prompt, "enhanced": enhanced,
                                     "style": req.style, "ratio": req.ratio},
                                    image_urls)
        for url in image_urls:
            await save_asset(db, req.project_id, gen.id, f"text2img_{gen.id}", "image", url)
        return {"status": "success", "generation_id": gen.id, "output_urls": image_urls, "enhanced_prompt": enhanced}
    except Exception as e:
        await save_generation(db, req.project_id, "text_to_image",
                              {"prompt": req.prompt}, [], "failed", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image-to-image")
async def image_to_image(req: ImageToImageRequest, db: AsyncSession = Depends(get_db)):
    model = await get_default_model(db, "image", req.model_id)
    system_prompt = await get_system_prompt(db, "image_to_image")

    try:
        enhanced = await enhance_prompt(system_prompt, req.prompt, model=None, db=db)
        image_urls = await edit_image(req.image_url, enhanced, req.strength, model)

        gen = await save_generation(db, req.project_id, "image_to_image",
                                    {"prompt": req.prompt, "image_url": req.image_url,
                                     "strength": req.strength, "enhanced": enhanced},
                                    image_urls)
        for url in image_urls:
            await save_asset(db, req.project_id, gen.id, f"img2img_{gen.id}", "image", url)
        return {"status": "success", "generation_id": gen.id, "output_urls": image_urls}
    except Exception as e:
        await save_generation(db, req.project_id, "image_to_image",
                              {"prompt": req.prompt}, [], "failed", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/inpaint")
async def inpaint(req: InpaintRequest, db: AsyncSession = Depends(get_db)):
    model = await get_default_model(db, "image", req.model_id)
    system_prompt = await get_system_prompt(db, "inpaint")

    try:
        enhanced = await enhance_prompt(system_prompt, req.prompt, model=None, db=db)
        image_urls = await inpaint_image(req.image_url, req.mask_url, enhanced, model)

        gen = await save_generation(db, req.project_id, "inpaint",
                                    {"prompt": req.prompt, "image_url": req.image_url,
                                     "mask_url": req.mask_url, "enhanced": enhanced},
                                    image_urls)
        for url in image_urls:
            await save_asset(db, req.project_id, gen.id, f"inpaint_{gen.id}", "image", url)
        return {"status": "success", "generation_id": gen.id, "output_urls": image_urls}
    except Exception as e:
        await save_generation(db, req.project_id, "inpaint",
                              {"prompt": req.prompt}, [], "failed", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/character")
async def character(req: CharacterRequest, db: AsyncSession = Depends(get_db)):
    model = await get_default_model(db, "image", req.model_id)
    tool_key_map = {
        "tpose": "character_tpose",
        "directions": "character_directions",
        "part_split": "character_part_split"
    }
    tool_key = tool_key_map.get(req.sub_tool, "character_tpose")
    system_prompt = await get_system_prompt(db, tool_key)

    try:
        context = {"sub_tool": req.sub_tool, "directions": req.directions, "style": req.style}
        enhanced = await enhance_prompt(system_prompt, req.prompt, context=context, db=db)
        image_urls = await generate_image(enhanced, req.style, "1:1", "1024x1024", model)

        gen = await save_generation(db, req.project_id, tool_key,
                                    {"prompt": req.prompt, "sub_tool": req.sub_tool,
                                     "directions": req.directions, "enhanced": enhanced},
                                    image_urls)
        for url in image_urls:
            await save_asset(db, req.project_id, gen.id, f"character_{gen.id}", "character", url,
                             {"sub_tool": req.sub_tool, "directions": req.directions})
        return {"status": "success", "generation_id": gen.id, "output_urls": image_urls}
    except Exception as e:
        await save_generation(db, req.project_id, tool_key,
                              {"prompt": req.prompt}, [], "failed", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/animation")
async def animation(req: AnimationRequest, db: AsyncSession = Depends(get_db)):
    model = await get_default_model(db, "image", req.model_id)
    tool_key_map = {
        "text": "animation_text",
        "skeleton": "animation_skeleton",
        "frame_extract": "animation_frame_extract"
    }
    tool_key = tool_key_map.get(req.sub_tool, "animation_text")
    system_prompt = await get_system_prompt(db, tool_key)

    try:
        context = {"action": req.action, "frame_count": req.frame_count}
        enhanced = await enhance_prompt(system_prompt, f"Image: {req.image_url}. Action: {req.action}", context=context, db=db)
        image_urls = await generate_image(enhanced, None, "1:1", "1024x1024", model)

        gen = await save_generation(db, req.project_id, tool_key,
                                    {"image_url": req.image_url, "action": req.action,
                                     "frame_count": req.frame_count, "enhanced": enhanced},
                                    image_urls)
        for url in image_urls:
            await save_asset(db, req.project_id, gen.id, f"animation_{gen.id}", "animation_frame", url,
                             {"frame_count": req.frame_count})
        return {"status": "success", "generation_id": gen.id, "output_urls": image_urls}
    except Exception as e:
        await save_generation(db, req.project_id, tool_key,
                              {"action": req.action}, [], "failed", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/prop")
async def prop(req: PropRequest, db: AsyncSession = Depends(get_db)):
    model = await get_default_model(db, "image", req.model_id)
    tool_key = "prop_variant" if req.sub_tool == "variant" else "prop_generate"
    system_prompt = await get_system_prompt(db, tool_key)

    try:
        context = {"style": req.style, "variant_count": req.variant_count}
        enhanced = await enhance_prompt(system_prompt, req.prompt, context=context, db=db)
        image_urls = await generate_image(enhanced, req.style, "1:1", "1024x1024", model)

        gen = await save_generation(db, req.project_id, tool_key,
                                    {"prompt": req.prompt, "sub_tool": req.sub_tool,
                                     "variant_count": req.variant_count, "enhanced": enhanced},
                                    image_urls)
        for url in image_urls:
            await save_asset(db, req.project_id, gen.id, f"prop_{gen.id}", "prop", url)
        return {"status": "success", "generation_id": gen.id, "output_urls": image_urls}
    except Exception as e:
        await save_generation(db, req.project_id, tool_key,
                              {"prompt": req.prompt}, [], "failed", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ui-layout")
async def ui_layout(req: UILayoutRequest, db: AsyncSession = Depends(get_db)):
    model = await get_default_model(db, "image", req.model_id)
    tool_key_map = {
        "layout_generate": "ui_layout_generate",
        "component_place": "ui_component_place",
        "component_split": "ui_component_split"
    }
    tool_key = tool_key_map.get(req.sub_tool, "ui_layout_generate")
    system_prompt = await get_system_prompt(db, tool_key)

    try:
        context = {"layout_type": req.layout_type, "components": req.components}
        enhanced = await enhance_prompt(system_prompt, req.prompt, context=context, db=db)
        image_urls = await generate_image(enhanced, None, "16:9", "1920x1080", model)

        gen = await save_generation(db, req.project_id, tool_key,
                                    {"prompt": req.prompt, "sub_tool": req.sub_tool,
                                     "layout_type": req.layout_type, "enhanced": enhanced},
                                    image_urls)
        for url in image_urls:
            await save_asset(db, req.project_id, gen.id, f"ui_{gen.id}", "ui", url)
        return {"status": "success", "generation_id": gen.id, "output_urls": image_urls}
    except Exception as e:
        await save_generation(db, req.project_id, tool_key,
                              {"prompt": req.prompt}, [], "failed", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scene")
async def scene(req: SceneRequest, db: AsyncSession = Depends(get_db)):
    model = await get_default_model(db, "image", req.model_id)
    tool_key_map = {
        "map_generate": "scene_map_generate",
        "map_split": "scene_map_split"
    }
    tool_key = tool_key_map.get(req.sub_tool, "scene_map_generate")
    system_prompt = await get_system_prompt(db, tool_key)

    try:
        context = {"map_type": req.map_type, "tile_size": req.tile_size}
        enhanced = await enhance_prompt(system_prompt, req.prompt, context=context, db=db)
        image_urls = await generate_image(enhanced, None, "16:9", "1920x1080", model)

        gen = await save_generation(db, req.project_id, tool_key,
                                    {"prompt": req.prompt, "sub_tool": req.sub_tool,
                                     "map_type": req.map_type, "tile_size": req.tile_size,
                                     "enhanced": enhanced},
                                    image_urls)
        for url in image_urls:
            await save_asset(db, req.project_id, gen.id, f"scene_{gen.id}", "scene", url,
                             {"map_type": req.map_type, "tile_size": req.tile_size})
        return {"status": "success", "generation_id": gen.id, "output_urls": image_urls}
    except Exception as e:
        await save_generation(db, req.project_id, tool_key,
                              {"prompt": req.prompt}, [], "failed", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    url = await save_upload(file)
    return {"url": url}
