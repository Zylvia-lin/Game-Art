"""
Database connection using asyncpg with raw SQL.
Provides a connection pool and helper functions.
Auto-creates tables on startup.
"""
import json
import asyncpg
from config import settings

_pool: asyncpg.Pool | None = None

# SQL schema - all tables created automatically on startup
SCHEMA_SQL = """
-- 模型配置
CREATE TABLE IF NOT EXISTS model_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('text', 'image')),
    provider VARCHAR(100),
    api_base_url TEXT,
    api_key TEXT,
    model_name VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 系统提示词
CREATE TABLE IF NOT EXISTS system_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_key VARCHAR(100) UNIQUE NOT NULL,
    tool_name VARCHAR(255) NOT NULL,
    description TEXT,
    prompt_content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 项目
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cover_url TEXT,
    style VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 资产
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    url TEXT NOT NULL,
    finalized BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 生成记录
CREATE TABLE IF NOT EXISTS generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tool_key VARCHAR(100) NOT NULL,
    input_params JSONB DEFAULT '{}',
    output_urls JSONB DEFAULT '[]',
    output_names JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    task_id UUID
);

-- 任务队列
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tool_key VARCHAR(100) NOT NULL,
    input_params JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    output_urls JSONB DEFAULT '[]',
    error_message TEXT,
    progress FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 账单记录（独立于 tasks，删除图片不影响账单）
CREATE TABLE IF NOT EXISTS billing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID,
    tool_key VARCHAR(100) NOT NULL,
    tool_name VARCHAR(255),
    image_count INTEGER NOT NULL DEFAULT 1,
    resolution VARCHAR(50),
    total_pixels BIGINT,
    input_cost NUMERIC(10,4) DEFAULT 0,
    output_cost NUMERIC(10,4) DEFAULT 0,
    total_cost NUMERIC(10,4) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_generations_project_id ON generations(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_billing_project_id ON billing_records(project_id);
CREATE INDEX IF NOT EXISTS idx_billing_created_at ON billing_records(created_at);
"""


async def _init_connection(conn):
    """Set up JSONB codec for each connection so JSONB columns are returned as Python dicts."""
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )
    await conn.set_type_codec(
        "json",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
            min_size=2,
            max_size=10,
            init=_init_connection,
        )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def ensure_database_exists():
    """Check if database exists, create it if not."""
    # Connect to default 'postgres' database to check/create our database
    conn = await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database="postgres",
    )
    try:
        db_exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            settings.DB_NAME
        )
        if not db_exists:
            await conn.execute(f'CREATE DATABASE {settings.DB_NAME}')
            print(f"[DB] Database '{settings.DB_NAME}' created")
        return True
    finally:
        await conn.close()


async def init_db():
    """Create database if needed, then create all tables. Called on startup."""
    # First ensure the database exists
    await ensure_database_exists()
    
    # Now connect to our database and create tables
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)
        # Migration: add output_names column to existing generations table
        await conn.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'generations' AND column_name = 'output_names'
                ) THEN
                    ALTER TABLE generations ADD COLUMN output_names JSONB DEFAULT '[]';
                END IF;
            END $$;
        """)
        # Migration: add output_names column to existing tasks table
        await conn.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'tasks' AND column_name = 'output_names'
                ) THEN
                    ALTER TABLE tasks ADD COLUMN output_names JSONB DEFAULT '[]';
                END IF;
            END $$;
        """)
    print("[DB] Tables initialized")


async def fetch_all(query: str, *args) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *args)
        return [dict(r) for r in rows]


async def fetch_one(query: str, *args) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *args)
        return dict(row) if row else None


async def execute(query: str, *args) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)
