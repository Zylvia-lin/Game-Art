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
    type VARCHAR(50) NOT NULL CHECK (type IN ('text', 'image', 'video', 'tool')),
    provider VARCHAR(100),
    api_base_url TEXT,
    api_key TEXT,
    model_name VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 如果表已存在，更新 CHECK 约束以支持 tool 类型
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'model_configs' AND constraint_name = 'model_configs_type_check') THEN
        ALTER TABLE model_configs DROP CONSTRAINT model_configs_type_check;
        ALTER TABLE model_configs ADD CONSTRAINT model_configs_type_check CHECK (type IN ('text', 'image', 'video', 'tool'));
    END IF;
END $$;

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

-- 服务提供商凭据（同一提供商的模型共享 API Key）
CREATE TABLE IF NOT EXISTS provider_configs (
    provider VARCHAR(100) PRIMARY KEY,
    api_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 对象存储配置
CREATE TABLE IF NOT EXISTS storage_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(100) NOT NULL DEFAULT 'volcengine',
    access_key TEXT NOT NULL,
    secret_key TEXT NOT NULL,
    bucket TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'cn-beijing',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 视频生成任务
CREATE TABLE IF NOT EXISTS video_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    model_id UUID NOT NULL REFERENCES model_configs(id) ON DELETE RESTRICT,
    provider_task_id VARCHAR(255) NOT NULL UNIQUE,
    request_payload JSONB NOT NULL DEFAULT '{}',
    provider_response JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'submitted',
    output_url TEXT,
    input_tokens NUMERIC(16,2) DEFAULT 0,
    output_tokens NUMERIC(16,2) DEFAULT 0,
    billed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS frame_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_video_task_id UUID NOT NULL REFERENCES video_tasks(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    extraction_fps NUMERIC(8,3) NOT NULL DEFAULT 24,
    total_frames INTEGER NOT NULL DEFAULT 0,
    frames JSONB NOT NULL DEFAULT '[]',
    selected_frames JSONB NOT NULL DEFAULT '[]',
    export_video_path TEXT,
    export_video_fps NUMERIC(8,3),
    sequence_dir TEXT,
    zip_cache JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_generations_project_id ON generations(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_billing_project_id ON billing_records(project_id);
CREATE INDEX IF NOT EXISTS idx_billing_created_at ON billing_records(created_at);
CREATE INDEX IF NOT EXISTS idx_video_tasks_project_id ON video_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_video_tasks_status ON video_tasks(status);
CREATE INDEX IF NOT EXISTS idx_frame_extractions_project_id ON frame_extractions(project_id);
CREATE INDEX IF NOT EXISTS idx_frame_extractions_source_video ON frame_extractions(source_video_task_id);
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
        # Migration: add pricing columns to model_configs
        await conn.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'model_configs' AND column_name = 'input_price'
                ) THEN
                    ALTER TABLE model_configs ADD COLUMN input_price NUMERIC(10,6) DEFAULT 0;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'model_configs' AND column_name = 'output_price'
                ) THEN
                    ALTER TABLE model_configs ADD COLUMN output_price NUMERIC(10,6) DEFAULT 0;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'model_configs' AND column_name = 'price_unit'
                ) THEN
                    ALTER TABLE model_configs ADD COLUMN price_unit VARCHAR(50) DEFAULT 'per_image';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'model_configs' AND column_name = 'output_price_high'
                ) THEN
                    ALTER TABLE model_configs ADD COLUMN output_price_high NUMERIC(10,6) DEFAULT 0;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'model_configs' AND column_name = 'pixel_threshold'
                ) THEN
                    ALTER TABLE model_configs ADD COLUMN pixel_threshold BIGINT DEFAULT 2360000;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'model_configs' AND column_name = 'price_config'
                ) THEN
                    ALTER TABLE model_configs ADD COLUMN price_config JSONB DEFAULT '{}';
                END IF;
            END $$;
        """)
        # Migration: add model/billing detail columns to billing_records
        await conn.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'billing_records' AND column_name = 'model_id'
                ) THEN
                    ALTER TABLE billing_records ADD COLUMN model_id UUID;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'billing_records' AND column_name = 'model_name'
                ) THEN
                    ALTER TABLE billing_records ADD COLUMN model_name VARCHAR(255);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'billing_records' AND column_name = 'unit_type'
                ) THEN
                    ALTER TABLE billing_records ADD COLUMN unit_type VARCHAR(50);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'billing_records' AND column_name = 'input_units'
                ) THEN
                    ALTER TABLE billing_records ADD COLUMN input_units NUMERIC(10,2) DEFAULT 0;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'billing_records' AND column_name = 'output_units'
                ) THEN
                    ALTER TABLE billing_records ADD COLUMN output_units NUMERIC(10,2) DEFAULT 0;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'billing_records' AND column_name = 'input_unit_price'
                ) THEN
                    ALTER TABLE billing_records ADD COLUMN input_unit_price NUMERIC(10,6) DEFAULT 0;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'billing_records' AND column_name = 'output_unit_price'
                ) THEN
                    ALTER TABLE billing_records ADD COLUMN output_unit_price NUMERIC(10,6) DEFAULT 0;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'billing_records' AND column_name = 'user_id'
                ) THEN
                    ALTER TABLE billing_records ADD COLUMN user_id UUID;
                END IF;
            END $$;
        """)
        await conn.execute("""
            ALTER TABLE video_tasks
                ADD COLUMN IF NOT EXISTS task_type VARCHAR(20) NOT NULL DEFAULT 'generate',
                ADD COLUMN IF NOT EXISTS source_video_task_id UUID REFERENCES video_tasks(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS user_prompt TEXT,
                ADD COLUMN IF NOT EXISTS enhanced_prompt TEXT,
                ADD COLUMN IF NOT EXISTS reference_asset_ids JSONB NOT NULL DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS local_output_path TEXT,
                ADD COLUMN IF NOT EXISTS ratio VARCHAR(20),
                ADD COLUMN IF NOT EXISTS resolution VARCHAR(20),
                ADD COLUMN IF NOT EXISTS duration NUMERIC(8,3),
                ADD COLUMN IF NOT EXISTS fps NUMERIC(8,3);
            CREATE INDEX IF NOT EXISTS idx_video_tasks_source_video ON video_tasks(source_video_task_id);
        """)
        # Migration: backfill unit_type + model_name for old billing records
        await conn.execute("""
            UPDATE billing_records
               SET unit_type = CASE
                       WHEN tool_key = 'prompt_optimize' THEN 'per_1M_tokens'
                       WHEN tool_key = 'remove_bg' THEN 'per_1k_calls'
                       ELSE 'per_image'
                   END,
                   model_name = COALESCE(model_name, '旧数据(模型未记录)')
             WHERE unit_type IS NULL;
        """)
        # Migration: increase cost precision for text/tool billing (tiny amounts)
        await conn.execute("""
            ALTER TABLE billing_records
                ALTER COLUMN input_cost TYPE NUMERIC(14,8),
                ALTER COLUMN output_cost TYPE NUMERIC(14,8),
                ALTER COLUMN total_cost TYPE NUMERIC(14,8);
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
