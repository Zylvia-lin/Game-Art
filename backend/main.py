from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from database import init_db
from routers.models import router as models_router
from routers.prompts import router as prompts_router
from routers.projects import router as projects_router
from routers.generate import router as generate_router
from seed_data import seed_system_prompts
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_system_prompts()
    os.makedirs("uploads", exist_ok=True)
    yield


app = FastAPI(title="GameArtAI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(models_router)
app.include_router(prompts_router)
app.include_router(projects_router)
app.include_router(generate_router)

if os.path.exists("uploads"):
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
