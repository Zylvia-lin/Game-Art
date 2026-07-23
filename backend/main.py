"""
GameArt AI Backend - Python FastAPI
Independent backend service for AI game art generation.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from database import init_db, close_pool
from seed_data import seed_system_prompts
from services.task_queue import start_processing, stop_processing

from routers.models import router as models_router
from routers.prompts import router as prompts_router
from routers.projects import router as projects_router
from routers.generate import router as generate_router
from routers.assets import router as assets_router
from routers.upload import router as upload_router
from routers.tools import router as tools_router


UPLOAD_DIR = settings.UPLOAD_DIR


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await seed_system_prompts()
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    start_processing()
    print(f"GameArt AI Backend started on port {settings.BACKEND_PORT}")
    yield
    # Shutdown
    stop_processing()
    await close_pool()
    print("GameArt AI Backend stopped.")


app = FastAPI(
    title="GameArt AI API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow frontend to call this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(models_router)
app.include_router(prompts_router)
app.include_router(projects_router)
app.include_router(generate_router)
app.include_router(assets_router)
app.include_router(upload_router)
app.include_router(tools_router)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "gameart-backend"}
