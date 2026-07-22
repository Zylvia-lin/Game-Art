from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models.project import Project
from models.generation import Generation
from models.asset import Asset

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    cover_url: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class GenerationResponse(BaseModel):
    id: int
    project_id: int
    tool_key: str
    input_params: Optional[dict]
    output_urls: Optional[list]
    status: str
    error_message: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


class AssetResponse(BaseModel):
    id: int
    project_id: int
    generation_id: Optional[int]
    name: str
    type: str
    url: str
    metadata_: Optional[dict]
    created_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.updated_at.desc()))
    projects = result.scalars().all()
    return [
        ProjectResponse(
            id=p.id, name=p.name, description=p.description,
            cover_url=p.cover_url,
            created_at=p.created_at.isoformat() if p.created_at else "",
            updated_at=p.updated_at.isoformat() if p.updated_at else ""
        )
        for p in projects
    ]


@router.post("", response_model=ProjectResponse)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(name=data.name, description=data.description)
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        cover_url=project.cover_url,
        created_at=project.created_at.isoformat() if project.created_at else "",
        updated_at=project.updated_at.isoformat() if project.updated_at else ""
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        cover_url=project.cover_url,
        created_at=project.created_at.isoformat() if project.created_at else "",
        updated_at=project.updated_at.isoformat() if project.updated_at else ""
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: int, data: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    await db.flush()
    await db.refresh(project)
    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        cover_url=project.cover_url,
        created_at=project.created_at.isoformat() if project.created_at else "",
        updated_at=project.updated_at.isoformat() if project.updated_at else ""
    )


@router.delete("/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    return {"message": "Deleted"}


@router.get("/{project_id}/generations", response_model=list[GenerationResponse])
async def list_generations(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Generation)
        .where(Generation.project_id == project_id)
        .order_by(Generation.created_at.desc())
    )
    gens = result.scalars().all()
    return [
        GenerationResponse(
            id=g.id, project_id=g.project_id, tool_key=g.tool_key,
            input_params=g.input_params, output_urls=g.output_urls,
            status=g.status, error_message=g.error_message,
            created_at=g.created_at.isoformat() if g.created_at else ""
        )
        for g in gens
    ]


@router.get("/{project_id}/assets", response_model=list[AssetResponse])
async def list_assets(project_id: int, asset_type: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = select(Asset).where(Asset.project_id == project_id)
    if asset_type:
        query = query.where(Asset.type == asset_type)
    query = query.order_by(Asset.created_at.desc())
    result = await db.execute(query)
    assets = result.scalars().all()
    return [
        AssetResponse(
            id=a.id, project_id=a.project_id, generation_id=a.generation_id,
            name=a.name, type=a.type, url=a.url,
            metadata_=a.metadata_,
            created_at=a.created_at.isoformat() if a.created_at else ""
        )
        for a in assets
    ]


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.delete(asset)
    return {"message": "Deleted"}
