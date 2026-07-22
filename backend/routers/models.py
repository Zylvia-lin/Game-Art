from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models.model_config import ModelConfig

router = APIRouter(prefix="/api/models", tags=["models"])


class ModelConfigCreate(BaseModel):
    type: str  # 'text' or 'image'
    name: str
    provider: str
    api_base_url: str
    api_key: str
    model_name: str
    is_default: bool = False


class ModelConfigUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    api_base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    is_default: Optional[bool] = None


class ModelConfigResponse(BaseModel):
    id: int
    type: str
    name: str
    provider: str
    api_base_url: str
    api_key: str
    model_name: str
    is_default: bool

    class Config:
        from_attributes = True


@router.get("", response_model=list[ModelConfigResponse])
async def list_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelConfig).order_by(ModelConfig.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ModelConfigResponse)
async def create_model(config: ModelConfigCreate, db: AsyncSession = Depends(get_db)):
    if config.is_default:
        # Unset other defaults of same type
        result = await db.execute(
            select(ModelConfig).where(
                ModelConfig.type == config.type, ModelConfig.is_default == True
            )
        )
        for m in result.scalars().all():
            m.is_default = False

    model = ModelConfig(**config.model_dump())
    db.add(model)
    await db.flush()
    await db.refresh(model)
    return model


@router.put("/{model_id}", response_model=ModelConfigResponse)
async def update_model(model_id: int, config: ModelConfigUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelConfig).where(ModelConfig.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    update_data = config.model_dump(exclude_unset=True)
    if update_data.get("is_default"):
        # Unset other defaults of same type
        other_result = await db.execute(
            select(ModelConfig).where(
                ModelConfig.type == model.type, ModelConfig.is_default == True,
                ModelConfig.id != model_id
            )
        )
        for m in other_result.scalars().all():
            m.is_default = False

    for key, value in update_data.items():
        setattr(model, key, value)
    await db.flush()
    await db.refresh(model)
    return model


@router.delete("/{model_id}")
async def delete_model(model_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelConfig).where(ModelConfig.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    await db.delete(model)
    return {"message": "Deleted"}
