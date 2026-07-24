# GameArt AI 商业化优化与重构路线图

> 分析日期：2026-07-24 | 目标：从 MVP 到商业化 SaaS 产品

---

## 目录

1. [总览与优先级矩阵](#1-总览与优先级矩阵)
2. [第一阶段：安全与稳定性地基（1-2周）](#2-第一阶段安全与稳定性地基1-2周)
3. [第二阶段：多租户与商业化基础（2-4周）](#3-第二阶段多租户与商业化基础2-4周)
4. [第三阶段：架构升级与可扩展性（4-8周）](#4-第三阶段架构升级与可扩展性4-8周)
5. [第四阶段：商业化功能与增长（持续迭代）](#5-第四阶段商业化功能与增长持续迭代)
6. [重构建议：如果从零开始](#6-重构建议如果从零开始)
7. [技术选型建议](#7-技术选型建议)

---

## 1. 总览与优先级矩阵

### 风险矩阵

```
影响程度
  ▲
  │  🔴 用户认证      🔴 数据库迁移
  │  🔴 密钥管理      🔴 任务队列持久化
  │  🟠 API 密钥泄露   🟠 测试覆盖
  │  🟠 速率限制      🟡 代码重复
  │  🟡 API 版本化    🟡 日志系统
  │
  └──────────────────────────────► 实现难度
```

### 实施优先级总览

| 阶段 | 主题 | 时间 | 核心目标 |
|------|------|------|----------|
| P0 | 安全与稳定性地基 | 1-2周 | 认证、密钥管理、数据库迁移 |
| P1 | 多租户与商业化基础 | 2-4周 | 用户系统、SaaS 定价、权限 |
| P2 | 架构升级与可扩展性 | 4-8周 | Repository 模式、任务队列、存储、缓存 |
| P3 | 商业化功能与增长 | 持续 | 团队协作、API 对外开放、Marketplace |

---

## 2. 第一阶段：安全与稳定性地基（1-2周）

> **核心理念**：先修复可能导致数据丢失、安全漏洞或服务不可用的问题。

### 2.1 用户认证与授权 🔴 CRITICAL

**现状**：整个系统零认证，任何人访问 API 即可操作所有数据。

**方案**：引入 JWT OAuth2 认证

```python
# 推荐实现路径
# 1. 使用 FastAPI 的 OAuth2PasswordBearer
# 2. 引入 python-jose + passlib 实现 JWT
# 3. 新增 users 表
```

**实施步骤**：

1. **新增 `users` 表**：
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'user',  -- user / admin
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

2. **所有现有表添加 `user_id`**：
```sql
ALTER TABLE projects ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE model_configs ADD COLUMN user_id UUID REFERENCES users(id);
-- 所有查询添加 user_id 过滤
```

3. **实现认证中间件**：
```python
# backend/middleware/auth.py
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    # JWT 解码 + 数据库查询
    ...
```

4. **前端添加登录/注册页面**，使用 Next.js Middleware 保护路由。

### 2.2 API Key 安全管理 🔴 CRITICAL

**现状**：`model_configs.api_key` 明文存储。

**方案**：

```python
# 选项 A（推荐）：使用 PostgreSQL pgcrypto 扩展加密存储
# 选项 B：使用环境变量注入，不存储在 DB 中
# 选项 C：使用 Vault/Secrets Manager（生产环境）

# 推荐短期方案：应用层 AES 加密 + 环境变量密钥
from cryptography.fernet import Fernet
import os

_CIPHER = Fernet(os.environ["ENCRYPTION_KEY"].encode())

def encrypt_api_key(plain: str) -> str:
    return _CIPHER.encrypt(plain.encode()).decode()

def decrypt_api_key(encrypted: str) -> str:
    return _CIPHER.decrypt(encrypted.encode()).decode()
```

### 2.3 数据库迁移系统 🔴 CRITICAL

**现状**：DDL 以字符串形式写在 `database.py` 中，无版本控制。

**方案**：引入 **Alembic**（SQLAlchemy 的迁移工具）

```bash
# 安装
uv add alembic

# 初始化
alembic init backend/migrations

# 生成迁移
alembic revision --autogenerate -m "initial schema"

# 执行迁移
alembic upgrade head

# 回滚
alembic downgrade -1
```

**迁移策略**：
- 从当前 `SCHEMA_SQL` 导出基础 schema 作为初始迁移
- 所有后续 DDL 变更通过 Alembic 管理
- CI/CD 中自动运行 `alembic upgrade head`

### 2.4 速率限制 🟠 HIGH

**现状**：无任何速率限制，可能被恶意调用耗尽 API 额度。

**方案**：使用 `slowapi`（FastAPI 兼容的速率限制库）

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/generate/{tool_key}")
@limiter.limit("10/minute")  # 每分钟 10 次生成
async def submit_generation(...):
    ...
```

### 2.5 日志系统 🟡 MEDIUM

**现状**：全项目使用 `print()` 输出，无法分级、无法持久化。

**方案**：使用 Python `logging` 模块

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("logs/app.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# 替换所有 print() 为 logger.info() / logger.error()
```

---

## 3. 第二阶段：多租户与商业化基础（2-4周）

### 3.1 用户系统与工作空间

**数据模型扩展**：

```sql
-- 工作空间（团队/组织）
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    plan VARCHAR(50) DEFAULT 'free',  -- free / pro / enterprise
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 工作空间成员
CREATE TABLE workspace_members (
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',  -- owner / admin / member / viewer
    PRIMARY KEY (workspace_id, user_id)
);

-- 项目归属于工作空间
ALTER TABLE projects ADD COLUMN workspace_id UUID REFERENCES workspaces(id);
```

### 3.2 SaaS 订阅与计费

**定价模型设计**：

| 计划 | 月费 | 生成次数 | 分辨率 | 特性 |
|------|------|----------|--------|------|
| Free | ¥0 | 20次/月 | 最高1080p | 基础工具 |
| Pro | ¥99/月 | 500次/月 | 最高4K | 全部工具 + 优先队列 |
| Team | ¥299/月 | 2000次/月 | 最高4K | 团队协作 + API 访问 |
| Enterprise | 定制 | 无限 | 最高4K | 私有部署 + SSO |

**技术实现**：

```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',  -- active/cancelled/expired
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usage_quotas (
    workspace_id UUID REFERENCES workspaces(id),
    month VARCHAR(7),  -- '2026-07'
    generations_used INTEGER DEFAULT 0,
    storage_bytes_used BIGINT DEFAULT 0,
    PRIMARY KEY (workspace_id, month)
);
```

### 3.3 统一 API 响应格式

**现状**：每个路由返回格式不一致。

**方案**：定义统一响应 envelope

```python
from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    error: str | None = None
    meta: dict | None = None  # 分页信息等

class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    data: list[T]
    meta: dict  # { total, page, page_size, total_pages }
```

### 3.4 API 版本化

**方案**：添加 `/api/v1/` 前缀

```python
# main.py - 保持向后兼容
app.include_router(v1_router, prefix="/api/v1")
# 旧路由保留但标记 deprecated
app.include_router(legacy_router, prefix="/api", deprecated=True)
```

### 3.5 资产存储云化

**现状**：图片存储在本地 `./uploads/` 目录。

**方案**：引入 S3 兼容对象存储（Cloudflare R2 / AWS S3 / MinIO）

```python
# backend/services/storage_service.py
import boto3

class StorageService:
    def __init__(self):
        self.client = boto3.client(
            "s3",
            endpoint_url=os.environ["S3_ENDPOINT"],
            aws_access_key_id=os.environ["S3_ACCESS_KEY"],
            aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        )
    
    async def upload(self, file_path: str, key: str) -> str:
        """上传文件到 S3，返回公开 URL"""
        ...
    
    async def get_presigned_url(self, key: str, expires: int = 3600) -> str:
        """生成预签名 URL（私有资产访问）"""
        ...
```

---

## 4. 第三阶段：架构升级与可扩展性（4-8周）

### 4.1 Repository 模式重构 🟠 HIGH

**现状**：全项目 raw SQL 内嵌在路由中，约 400+ 行重复的 JSONB 解析、错误处理代码。

**方案**：引入 Repository 层

```
backend/
├── repositories/              # 数据访问层
│   ├── __init__.py
│   ├── base.py               # 基础 Repository 类
│   ├── projects.py           # 项目数据访问
│   ├── assets.py             # 资产数据访问
│   ├── tasks.py              # 任务数据访问
│   ├── models.py             # 模型配置数据访问
│   └── billing.py            # 计费数据访问
```

```python
# backend/repositories/base.py
from typing import TypeVar, Generic

T = TypeVar("T")

class BaseRepository(Generic[T]):
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
    
    async def find_by_id(self, id: str) -> T | None: ...
    async def find_all(self, **filters) -> list[T]: ...
    async def create(self, data: dict) -> T: ...
    async def update(self, id: str, data: dict) -> T: ...
    async def delete(self, id: str) -> bool: ...
```

**收益**：SQL 逻辑集中管理、可测试、可缓存、易于切换 ORM。

### 4.2 引入 ORM（可选升级）

**在 Repository 模式建立后**，考虑引入 **SQLAlchemy 2.0**（async 模式）：

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class Project(Base):
    __tablename__ = "projects"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    ...
```

**是否必须引入 ORM？** 不必须。如果团队更习惯 raw SQL，可以只做 Repository 抽象。但 ORM 带来的收益（类型安全、迁移自动生成、关系加载）在项目增长后会越来越明显。

### 4.3 任务队列升级 🟠 HIGH

**现状**：内存 asyncio 循环，单线程串行处理，重启丢失队列。

**方案**：引入 Redis + Celery / ARQ / SAQ

```python
# 推荐：SAQ (Simple Async Queue) — 轻量、异步、Redis 后端
# 或 ARQ — 更适合 FastAPI 生态

# 方案 A: SAQ
from saq import Queue
from saq.redis import Redis

queue = Queue(Redis.from_url("redis://localhost"))

@queue.bind
async def process_generation(task_id: str):
    # 原有 execute_generation 逻辑
    ...

# 提交任务
job = await queue.enqueue("process_generation", task_id=task_id)
```

**收益**：
- 任务持久化，服务重启不丢失
- 多 Worker 并行处理
- 任务重试、延迟队列、优先级队列
- 可视化管理（SAQ Web UI）

### 4.4 缓存层引入

**方案**：Redis 缓存

| 缓存对象 | TTL | 说明 |
|----------|-----|------|
| 系统提示词 | 10分钟 | 几乎不变，高频读取 |
| 模型配置 | 5分钟 | 生成时每次读取 |
| 任务状态（热数据） | 30秒 | 前端高频轮询 |
| 计费统计 | 1小时 | 计算成本较高 |

```python
# backend/services/cache_service.py
import json
from redis.asyncio import Redis

class CacheService:
    def __init__(self, redis: Redis):
        self.redis = redis
    
    async def get_or_set(self, key: str, ttl: int, factory):
        cached = await self.redis.get(key)
        if cached:
            return json.loads(cached)
        value = await factory()
        await self.redis.setex(key, ttl, json.dumps(value, default=str))
        return value
```

### 4.5 测试体系建设 🟠 HIGH

**现状**：零测试覆盖。

**分步计划**：

```bash
# 第一步：后端单元测试（pytest + pytest-asyncio）
backend/
└── tests/
    ├── conftest.py          # Fixtures (测试 DB、client)
    ├── test_projects.py     # 项目 CRUD
    ├── test_assets.py       # 资产 CRUD
    ├── test_generate.py     # 生成流程
    ├── test_tasks.py        # 任务队列
    ├── test_billing.py      # 计费逻辑
    └── test_image_service.py # 图片服务

# 第二步：前端组件测试（Vitest + Testing Library）
front/
└── src/
    └── __tests__/
        ├── components/
        └── hooks/

# 第三步：E2E 测试（Playwright）
tests/
└── e2e/
    ├── project-flow.spec.ts
    └── generation-flow.spec.ts
```

**目标覆盖率**：核心业务逻辑 80%+，UI 组件 60%+。

### 4.6 Docker 容器化

```dockerfile
# backend/Dockerfile
FROM python:3.14-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen
COPY . .
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# front/Dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]
```

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: game_art_ai
      POSTGRES_USER: gameart
      POSTGRES_PASSWORD: ${DB_PASSWORD}
  
  redis:
    image: redis:7-alpine
  
  backend:
    build: ./backend
    ports: ["8000:8000"]
    depends_on: [db, redis]
    env_file: ./backend/.env
  
  frontend:
    build: ./front
    ports: ["3000:3000"]
    depends_on: [backend]

volumes:
  pgdata:
```

### 4.7 多模型 Provider 抽象

**现状**：硬编码火山引擎 Seedream。添加新模型需要修改多处代码。

**方案**：Provider 策略模式

```python
# backend/services/providers/base.py
from abc import ABC, abstractmethod

class ImageProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, params: dict) -> list[str]: ...
    
    @abstractmethod
    def calculate_cost(self, params: dict, outputs: list[str]) -> dict: ...

class SeedreamProvider(ImageProvider):
    async def generate(self, prompt, params): ...
    def calculate_cost(self, params, outputs): ...

class DalleProvider(ImageProvider):
    async def generate(self, prompt, params): ...
    def calculate_cost(self, params, outputs): ...

class StableDiffusionProvider(ImageProvider):
    ...

# 工厂函数
def get_image_provider(model_config: dict) -> ImageProvider:
    providers = {
        "seedream": SeedreamProvider,
        "dalle": DalleProvider,
        "stable-diffusion": StableDiffusionProvider,
    }
    return providers[model_config["provider"]](model_config)
```

---

## 5. 第四阶段：商业化功能与增长（持续迭代）

### 5.1 团队协作功能

- 工作空间内多人协作
- 资产评论与审批流程
- 版本历史与回滚
- 活动日志 (Activity Feed)

### 5.2 开放 API

- 提供 API Key 管理页面
- 开发者文档（OpenAPI + 使用指南）
- Rate Limiting by API Key
- Webhook 回调（任务完成通知）

### 5.3 AI 能力扩展

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 批量生成 | 一次提交多个 prompt，并发生成 | 🟠 HIGH |
| 风格迁移 | 上传参考图，提取风格应用到生成 | 🟡 MEDIUM |
| 视频生成 | 基于文本/图片生成短动画 | 🟡 MEDIUM |
| 3D 模型生成 | 2D 图片 → 3D 模型（未来方向） | 🟢 LOW |
| 智能调参 | AI 自动选择最佳参数组合 | 🟢 LOW |

### 5.4 资产管理与分发

- 公共资产市场（Marketplace）
- 资产打包下载（ZIP 批量导出）
- 直接对接游戏引擎（Unity/Unreal 插件）
- 资产版本管理与 diff

### 5.5 数据分析面板

- 用户使用统计
- 生成趋势分析
- 成本优化建议
- ROI 追踪

---

## 6. 重构建议：如果从零开始

> 如果时间和资源允许，进行一次"大爆炸"式重构，以下是我的架构建议。

### 6.1 目标架构图

```
                               ┌──────────────────┐
                               │   CDN / Edge      │
                               │   (CloudFront)     │
                               └────────┬─────────┘
                                        │
                   ┌────────────────────┼────────────────────┐
                   │                    │                    │
                   ▼                    ▼                    ▼
         ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
         │  静态资源      │   │  Next.js 前端  │   │  FastAPI      │
         │  (S3/R2)      │   │  (Vercel)     │   │  (K8s/ECS)    │
         └──────────────┘   └──────────────┘   └──────┬───────┘
                                                       │
                          ┌────────────────────────────┼─────────────┐
                          │                            │             │
                          ▼                            ▼             ▼
                   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                   │  PostgreSQL   │   │    Redis      │   │  AI API      │
                   │  (RDS/Supabase)│   │  (ElastiCache)│   │  (Seedream)  │
                   └──────────────┘   └──────────────┘   └──────────────┘
```

### 6.2 推荐技术栈升级

| 组件 | 当前 | 推荐 | 理由 |
|------|------|------|------|
| ORM | 无 (raw SQL) | SQLAlchemy 2.0 async | 类型安全、迁移自动生成、关系管理 |
| 迁移 | 无 | Alembic | 版本化、可回滚 |
| 任务队列 | asyncio 内存循环 | SAQ + Redis | 持久化、多 worker、重试 |
| 缓存 | 无 | Redis | 高频读取加速、会话存储 |
| 存储 | 本地文件系统 | S3 (R2/S3) | 可扩展、CDN 分发 |
| 认证 | 无 | JWT + OAuth2 | 安全、标准协议 |
| 支付 | 无 | Stripe / Paddle | 订阅管理、发票 |
| 日志 | print() | structlog + Loki | 结构化日志、集中采集 |
| 监控 | 无 | Sentry + Prometheus | 错误追踪、性能监控 |
| 部署 | 手动 | Docker Compose / K8s | 可重复、可扩展 |
| CI/CD | 无 | GitHub Actions | 自动化测试、部署 |
| API 文档 | FastAPI 自动 | + Scalar/Redoc | 更好的开发体验 |

### 6.3 后端分层架构

```
backend/
├── api/                    # 表现层
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── projects.py
│   │   ├── assets.py
│   │   ├── generations.py
│   │   └── billing.py
│   └── deps.py            # 依赖注入（get_current_user 等）
│
├── core/                   # 核心配置
│   ├── config.py           # 配置
│   ├── security.py         # 认证/JWT
│   └── database.py         # 数据库连接
│
├── models/                 # 数据模型（SQLAlchemy ORM）
│   ├── base.py
│   ├── user.py
│   ├── project.py
│   ├── asset.py
│   └── billing.py
│
├── schemas/                # Pydantic 请求/响应模型
│   ├── project.py
│   ├── asset.py
│   └── generation.py
│
├── repositories/           # 数据访问层
│   ├── base.py
│   ├── project_repo.py
│   └── asset_repo.py
│
├── services/               # 业务逻辑层
│   ├── generation/
│   │   ├── pipeline.py     # 生成管线
│   │   ├── prompt.py       # 提示词处理
│   │   └── postprocess.py  # 后处理
│   ├── providers/          # AI Provider 抽象
│   │   ├── base.py
│   │   ├── seedream.py
│   │   └── openai.py
│   ├── billing_service.py
│   └── storage_service.py
│
├── workers/                # 后台 Worker
│   └── generation_worker.py
│
├── migrations/             # Alembic 迁移
│   └── versions/
│
└── tests/                  # 测试
    ├── unit/
    ├── integration/
    └── e2e/
```

### 6.4 前端架构升级建议

| 组件 | 当前 | 推荐 | 理由 |
|------|------|------|------|
| 状态管理 | 无（本地状态 + 轮询） | Zustand | 轻量、TypeScript 友好 |
| 服务端状态 | fetch + 手动管理 | TanStack Query | 缓存、去重、乐观更新 |
| 实时更新 | 轮询 | WebSocket / SSE | 任务进度实时推送 |
| 表单 | react-hook-form | ✅ 保持 | 已是最佳实践 |
| 类型共享 | 两处重复定义 | 共享 types 包 | DRY |
| 测试 | 无 | Vitest + Playwright | 单元 + E2E |

**前端状态管理建议**（引入 Zustand）：

```typescript
// front/src/stores/project-store.ts
import { create } from 'zustand';

interface ProjectStore {
  currentProject: Project | null;
  tasks: Task[];
  setProject: (project: Project) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  tasks: [],
  setProject: (project) => set({ currentProject: project }),
  addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
  updateTask: (taskId, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
    })),
}));
```

**任务状态实时推送**（替换轮询）：

```python
# backend: SSE 端点
@app.get("/api/tasks/{task_id}/stream")
async def stream_task(task_id: str):
    async def event_stream():
        while True:
            task = await get_task(task_id)
            yield f"data: {json.dumps(task)}\n\n"
            if task["status"] in ("completed", "failed"):
                break
            await asyncio.sleep(2)
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

```typescript
// frontend: EventSource 消费
const eventSource = new EventSource(
  `${API_BASE}/api/tasks/${taskId}/stream`
);
eventSource.onmessage = (event) => {
  const task = JSON.parse(event.data);
  updateTask(taskId, task);
  if (task.status === 'completed' || task.status === 'failed') {
    eventSource.close();
  }
};
```

---

## 7. 技术选型建议

### 7.1 保持 vs 替换

| 技术 | 决策 | 原因 |
|------|------|------|
| FastAPI | ✅ 保持 | 性能好、类型安全、生态成熟 |
| asyncpg | ✅ 保持（+ Repository 包装） | 性能极佳、但需抽象 |
| Raw SQL | ⚠️ 添加 Repository 层 | 保持灵活性，增加可维护性 |
| Next.js 16 | ✅ 保持 | 最新稳定版、App Router 成熟 |
| shadcn/ui + Radix | ✅ 保持 | 设计系统成熟、无障碍好 |
| Tailwind CSS 4 | ✅ 保持 | 生产效率高 |
| 本地存储 | ❌ 迁移到 S3 | 不可扩展 |
| 内存队列 | ❌ 迁移到 Redis | 不可靠 |
| print() 日志 | ❌ 迁移到 logging | 不可维护 |
| .env 密钥 | ❌ 迁移到 Secrets Manager | 不安全 |

### 7.2 新增依赖建议

| 依赖 | 用途 | 是否必须 |
|------|------|----------|
| Alembic | 数据库迁移 | 🔴 必须 |
| SAQ + Redis | 任务队列 | 🔴 必须 |
| python-jose + passlib | JWT 认证 | 🔴 必须 |
| boto3 | S3 存储 | 🟠 推荐 |
| structlog | 结构化日志 | 🟠 推荐 |
| SQLAlchemy 2.0 | ORM（可选） | 🟡 按需 |
| Stripe/Paddle SDK | 支付 | 🟡 按需 |
| Sentry SDK | 错误追踪 | 🟡 按需 |
| slowapi | 速率限制 | 🟠 推荐 |
| pytest + pytest-asyncio | 测试 | 🔴 必须 |
| Vitest + Playwright | 前端测试 | 🟠 推荐 |

---

## 附录：快速实施清单

### 本周可做（最小可行改进）

- [ ] 添加 `users` 表 + 基础注册/登录 API
- [ ] 加密 `model_configs.api_key` 存储
- [ ] 引入 Alembic，导出当前 schema
- [ ] 替换所有 `print()` 为 `logging`
- [ ] 添加 `slowapi` 速率限制
- [ ] 添加 `.env.example` 到 `.gitignore`，创建 `.env.template`

### 本月可做（架构优化）

- [ ] 拆分 Repository 层，集中 SQL 逻辑
- [ ] 引入 Redis + SAQ 任务队列
- [ ] 迁移文件存储到 S3/R2
- [ ] 后端核心模块单元测试覆盖
- [ ] Docker Compose 一键启动
- [ ] 统一 API 响应格式 + 版本化

### 本季度可做（商业化）

- [ ] 工作空间 + 团队协作
- [ ] Stripe/Paddle 订阅集成
- [ ] 开放 API + 开发者文档
- [ ] 多 Provider 支持
- [ ] 前端状态管理重构 (Zustand + TanStack Query)
- [ ] E2E 测试 + CI/CD 管道
