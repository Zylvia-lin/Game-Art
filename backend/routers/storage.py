"""
对象存储配置管理。
支持 GET / PUT，单条活跃配置。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import fetch_one, execute

router = APIRouter(prefix="/api/storage", tags=["storage"])


class StorageConfig(BaseModel):
    provider: str = "volcengine"
    access_key: str = ""
    secret_key: str = ""
    bucket: str = ""
    endpoint: str = ""
    region: str = "cn-beijing"
    is_active: bool = True


class StorageConfigUpdate(BaseModel):
    provider: str = "volcengine"
    access_key: str = ""
    secret_key: str = ""
    bucket: str = ""
    endpoint: str = ""
    region: str = "cn-beijing"


@router.get("/config")
async def get_storage_config():
    """获取当前对象存储配置（密钥脱敏）"""
    row = await fetch_one(
        "SELECT * FROM storage_configs WHERE is_active = true LIMIT 1"
    )
    if not row:
        return {
            "provider": "volcengine",
            "access_key": "",
            "secret_key": "",
            "bucket": "",
            "endpoint": "",
            "region": "cn-beijing",
            "is_active": True,
            "configured": False,
        }
    return {
        "provider": row["provider"],
        "access_key": row["access_key"][:4] + "****" if row["access_key"] else "",
        "secret_key": row["secret_key"][:4] + "****" if row["secret_key"] else "",
        "bucket": row["bucket"],
        "endpoint": row["endpoint"],
        "region": row["region"],
        "is_active": row["is_active"],
        "configured": True,
    }


@router.put("/config")
async def update_storage_config(data: StorageConfigUpdate):
    """更新或创建对象存储配置（upsert）"""
    existing = await fetch_one(
        "SELECT id FROM storage_configs WHERE is_active = true LIMIT 1"
    )
    if existing:
        await execute(
            """UPDATE storage_configs SET
                provider = $1, access_key = $2, secret_key = $3,
                bucket = $4, endpoint = $5, region = $6, updated_at = NOW()
            WHERE id = $7""",
            data.provider, data.access_key, data.secret_key,
            data.bucket, data.endpoint, data.region, existing["id"]
        )
    else:
        await execute(
            """INSERT INTO storage_configs (provider, access_key, secret_key, bucket, endpoint, region, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, true)""",
            data.provider, data.access_key, data.secret_key,
            data.bucket, data.endpoint, data.region
        )
    return {"success": True, "message": "对象存储配置已保存"}


async def get_storage_config_raw():
    """供后端内部使用，返回完整配置（不脱敏）"""
    row = await fetch_one(
        "SELECT * FROM storage_configs WHERE is_active = true LIMIT 1"
    )
    if not row:
        return None
    return {
        "provider": row["provider"],
        "access_key": row["access_key"],
        "secret_key": row["secret_key"],
        "bucket": row["bucket"],
        "endpoint": row["endpoint"],
        "region": row["region"],
    }
