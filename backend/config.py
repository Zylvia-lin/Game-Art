from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/game_art_ai"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/game_art_ai"

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024

    class Config:
        env_file = ".env"


settings = Settings()
