# GameArt AI 开发文档

> AI 游戏美术资产生成平台，前后端分离架构。
> 本文档面向后续接手开发的人员，涵盖项目架构、数据库设计、完整 API 接口、前端页面与组件、核心业务流程等内容。

## 目录

- [1. 项目概览](#1-项目概览)
- [2. 技术栈](#2-技术栈)
- [3. 目录结构](#3-目录结构)
- [4. 环境配置与启动](#4-环境配置与启动)
- [5. 数据库设计](#5-数据库设计)
- [6. 后端 API 接口](#6-后端-api-接口)
- [7. 后端服务层](#7-后端服务层)
- [8. 前端页面路由](#8-前端页面路由)
- [9. 前端组件](#9-前端组件)
- [10. 前端 Hooks 与工具函数](#10-前端-hooks-与工具函数)
- [11. 核心业务流程](#11-核心业务流程)
- [12. 关键技术决策](#12-关键技术决策)
- [13. 开发注意事项](#13-开发注意事项)

---

## 1. 项目概览

GameArt AI 是一个面向独立游戏开发者和游戏美术设计师的 AI 创作平台，支持以下核心功能：

| 功能模块 | 说明 |
|---------|------|
| 文生图 | 根据提示词生成游戏美术图片，支持 LLM 提示词增强 |
| 图生图 | 基于参考图 + 提示词生成新图片 |
| 局部重绘 | 遮罩区域局部修改，不影响其他区域 |
| 图片编辑 | 基于参考图的编辑模式 |
| 去除背景 | 调用火山引擎 MediaKit API，智能移除图片背景，输出透明 PNG |
| 角色生成 | T 姿势角色、多方向视图角色生成 |
| 场景生成 | 游戏场景图生成 |
| 道具生成 | 武器、道具等游戏资产生成 |
| UI 生成 | 游戏 UI 界面生成 |
| 动画生成 | 动画帧序列生成 |
| 资产管理 | 项目内资产库管理、收藏、下载 |
| 系统配置 | 模型配置（文本/图片/工具）、对象存储配置、系统提示词管理 |
| 账单统计 | 生成记录、费用统计 |

## 2. 技术栈

### 前端

| 技术 | 版本 | 说明 |
|------|------|------|
| Next.js | 16 (App Router) | React 全栈框架，仅用前端渲染 |
| React | 19 | UI 库 |
| TypeScript | 5 | 类型安全 |
| shadcn/ui | - | 基于 Radix UI 的组件库 |
| Tailwind CSS | 4 | 原子化 CSS |
| pnpm | - | 包管理器 |

### 后端

| 技术 | 版本 | 说明 |
|------|------|------|
| Python | 3.12+ | 运行时 |
| FastAPI | - | Web 框架（端口 8000） |
| asyncpg | - | PostgreSQL 异步驱动 |
| LangChain | - | LLM 调用（langchain-openai） |
| httpx | - | HTTP 客户端（调用图片模型 API） |
| Pillow | - | 图像处理（白底移除等） |
| tos (ve-tos) | 2.6+ | 火山引擎 TOS 官方 Python SDK |
| uv | - | 包管理器 |

### 基础设施

| 技术 | 说明 |
|------|------|
| PostgreSQL 16 | 数据库 |
| 火山引擎 Seedream | 图片生成模型 |
| 火山引擎 MediaKit | 图片背景移除 API |
| DeepSeek / OpenAI | 文本模型（提示词增强） |
| 火山引擎 TOS | 对象存储（去除背景功能依赖） |

## 3. 目录结构

```
.
├── front/                      # Next.js 前端
│   ├── src/
│   │   ├── app/                # 页面路由（纯前端，无 API routes）
│   │   │   ├── page.tsx               # 首页（项目列表）
│   │   │   ├── project/
│   │   │   │   ├── new/page.tsx      # 新建项目
│   │   │   │   └── [id]/
│   │   │   │       ├── layout.tsx    # 项目布局（含侧边栏）
│   │   │   │       ├── page.tsx      # 项目概览
│   │   │   │       ├── text2img/     # 文生图
│   │   │   │       ├── img2img/      # 图生图
│   │   │   │       ├── image-edit/   # 图片编辑
│   │   │   │       ├── inpaint/      # 局部重绘
│   │   │   │       ├── remove-bg/    # 去除背景
│   │   │   │       ├── character/    # 角色生成
│   │   │   │       ├── scene/        # 场景生成
│   │   │   │       ├── prop/         # 道具生成
│   │   │   │       ├── ui/           # UI 生成
│   │   │   │       ├── animation/    # 动画生成
│   │   │   │       └── assets/       # 资产库
│   │   │   └── settings/
│   │   │       ├── models/page.tsx   # 系统配置（模型+存储）
│   │   │       ├── prompts/page.tsx # 系统提示词管理
│   │   │       └── billing/page.tsx # 账单统计
│   │   ├── components/
│   │   │   ├── layout/               # 布局组件（sidebar, breadcrumb）
│   │   │   ├── tools/                # 工具页面组件
│   │   │   └── ui/                   # shadcn/ui 组件库
│   │   ├── hooks/                    # React hooks
│   │   └── lib/
│   │       ├── api.ts                # API 客户端
│   │       ├── types.ts              # TypeScript 类型定义
│   │       └── utils.ts              # 工具函数
│   ├── public/
│   ├── package.json
│   └── next.config.ts
│
├── backend/                    # Python FastAPI 后端
│   ├── main.py                # FastAPI 入口
│   ├── config.py              # Pydantic Settings 配置
│   ├── database.py            # asyncpg 连接池 + DDL
│   ├── seed_data.py           # 系统提示词初始化
│   ├── pyproject.toml         # uv 依赖
│   ├── routers/               # API 路由
│   │   ├── assets.py           # 资产管理 CRUD
│   │   ├── generate.py         # 生成任务（提交/查询/取消）
│   │   ├── models.py          # 模型配置 CRUD
│   │   ├── prompts.py         # 系统提示词 CRUD
│   │   ├── projects.py        # 项目 CRUD
│   │   ├── tools.py           # 工具（去除背景 AI）
│   │   ├── upload.py          # 文件上传
│   │   ├── download.py        # 文件下载代理
│   │   ├── storage.py         # 对象存储配置 CRUD
│   │   └── billing.py         # 账单统计
│   └── services/              # 业务服务
│       ├── generate_service.py   # 生成全流程编排
│       ├── image_processor.py    # 图像处理（Pillow 白底移除）
│       ├── image_service.py      # 图片模型 API 调用
│       ├── llm_service.py        # LLM 提示词增强
│       └── task_queue.py         # 异步任务队列
│
├── docs/                      # 文档
├── AGENTS.md
├── DESIGN.md
└── .gitignore
```

## 4. 环境配置与启动

### 4.1 后端环境变量 (`backend/.env`)

```ini
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=gameart
DB_PASSWORD=gameart123
DB_NAME=game_art_ai
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=10485760
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:5000
```

### 4.2 前端环境变量 (`front/.env`)

```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4.3 启动顺序

```bash
# 1. 确保 PostgreSQL 运行，创建数据库用户和数据库
createdb game_art_ai  # 或让后端自动创建

# 2. 启动后端
cd backend
cp .env.example .env   # 编辑配置
uv sync                # 安装依赖
uv run python main.py  # 端口 8000

# 3. 启动前端
cd front
cp .env.example .env   # 编辑后端 API 地址
pnpm install
pnpm dev                # 端口 3000
```

> 数据库表会在后端启动时自动创建（`init_db()`），无需手动建表。

## 5. 数据库设计

### 5.1 表结构总览

| 表名 | 说明 | 主键 |
|------|------|------|
| `model_configs` | 模型配置（文本/图片/工具） | UUID |
| `system_prompts` | 系统提示词 | UUID |
| `projects` | 项目 | UUID |
| `assets` | 资产（关联项目） | UUID |
| `generations` | 生成记录 | UUID |
| `tasks` | 异步任务队列 | UUID |
| `billing_records` | 账单记录 | UUID |
| `storage_configs` | 对象存储配置 | UUID |

### 5.2 表结构详情

#### model_configs（模型配置）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| name | VARCHAR(255) | 配置名称 |
| type | VARCHAR(50) | 类型：`text` / `image` / `tool` |
| provider | VARCHAR(100) | 提供商（如 volcengine、deepseek） |
| api_base_url | TEXT | API 地址 |
| api_key | TEXT | API 密钥 |
| model_name | VARCHAR(255) | 模型名称（tool 类型可空） |
| is_default | BOOLEAN | 是否默认配置 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

**CHECK 约束**: `type IN ('text', 'image', 'tool')`

#### system_prompts（系统提示词）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| tool_key | VARCHAR(100) UNIQUE | 工具标识（如 text_to_image） |
| tool_name | VARCHAR(255) | 工具名称 |
| description | TEXT | 描述 |
| prompt_content | TEXT | 提示词内容 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### projects（项目）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| name | VARCHAR(255) | 项目名称 |
| description | TEXT | 项目描述 |
| cover_url | TEXT | 封面图 URL |
| style | VARCHAR(100) | 美术风格 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### assets（资产）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| project_id | UUID FK → projects(id) | 所属项目 |
| name | VARCHAR(255) | 资产名称 |
| type | VARCHAR(50) | 类型 |
| url | TEXT | 文件 URL |
| finalized | BOOLEAN | 是否已定稿 |
| metadata | JSONB | 元数据 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### generations（生成记录）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| project_id | UUID FK → projects(id) | 所属项目 |
| tool_key | VARCHAR(100) | 工具标识 |
| input_params | JSONB | 输入参数 |
| output_urls | JSONB | 输出图片 URL 列表 |
| output_names | JSONB | 输出图片名称列表 |
| status | VARCHAR(50) | 状态 |
| error_message | TEXT | 错误信息 |
| task_id | UUID | 关联任务 ID |
| created_at | TIMESTAMPTZ | 创建时间 |

#### tasks（任务队列）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| project_id | UUID FK → projects(id) | 所属项目 |
| tool_key | VARCHAR(100) | 工具标识 |
| input_params | JSONB | 输入参数 |
| status | VARCHAR(50) | pending / processing / completed / failed |
| output_urls | JSONB | 输出图片 URL 列表 |
| output_names | JSONB | 输出图片名称列表 |
| error_message | TEXT | 错误信息 |
| progress | FLOAT | 进度 0-100 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |
| started_at | TIMESTAMPTZ | 开始处理时间 |
| completed_at | TIMESTAMPTZ | 完成时间 |

#### billing_records（账单记录）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| project_id | UUID FK → projects(id) | 所属项目 |
| task_id | UUID | 关联任务 ID |
| tool_key | VARCHAR(100) | 工具标识 |
| tool_name | VARCHAR(255) | 工具名称 |
| image_count | INTEGER | 生成图片数量 |
| resolution | VARCHAR(50) | 分辨率 |
| total_pixels | BIGINT | 总像素数 |
| input_cost | NUMERIC(10,4) | 输入费用 |
| output_cost | NUMERIC(10,4) | 输出费用 |
| total_cost | NUMERIC(10,4) | 总费用 |
| status | VARCHAR(50) | 状态 |
| created_at | TIMESTAMPTZ | 创建时间 |

#### storage_configs（对象存储配置）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| provider | VARCHAR(100) | 提供商（默认 volcengine） |
| access_key | TEXT | Access Key |
| secret_key | TEXT | Secret Key |
| bucket | TEXT | 存储桶名称 |
| endpoint | TEXT | Endpoint（如 tos-cn-guangzhou.volces.com） |
| region | TEXT | 地域（如 cn-guangzhou） |
| is_active | BOOLEAN | 是否启用 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

## 6. 后端 API 接口

### 6.1 接口总览

所有接口前缀为 `/api`，共 10 个路由模块：

| 模块 | 前缀 | 说明 |
|------|------|------|
| health | /api | 健康检查 |
| models | /api/models | 模型配置 |
| prompts | /api/prompts | 系统提示词 |
| projects | /api/projects | 项目管理 |
| generate | /api/generate | 生成任务 |
| assets | /api/assets | 资产管理 |
| upload | /api/upload | 文件上传 |
| download | /api/download | 文件下载 |
| tools | /api/tools | 工具（去除背景） |
| storage | /api/storage | 对象存储配置 |
| billing | /api/billing | 账单统计 |

---

### 6.2 健康检查

| 方法 | 路径 | 说明 | 参数 | 返回 |
|------|------|------|------|------|
| GET | `/api/health` | 健康检查 | 无 | `{ status, service }` |

---

### 6.3 模型配置 (`/api/models`)

| 方法 | 路径 | 说明 | 请求参数 | 返回 |
|------|------|------|---------|------|
| GET | `/api/models` | 获取模型列表 | query: `type` (可选, text/image/tool) | `ModelConfig[]` |
| GET | `/api/models/{id}` | 获取单个模型 | path: `id` | `ModelConfig` |
| POST | `/api/models` | 创建模型配置 | body: `ModelConfigCreate` | `ModelConfig` |
| PUT | `/api/models/{id}` | 更新模型配置 | path: `id`, body: `ModelConfigCreate` | `ModelConfig` |
| DELETE | `/api/models/{id}` | 删除模型配置 | path: `id` | `{ success }` |

**ModelConfigCreate:**
```json
{
  "name": "Seedream 图片模型",
  "type": "image",
  "provider": "volcengine",
  "api_base_url": "https://ark.cn-beijing.volces.com/api/v3",
  "api_key": "xxx",
  "model_name": "doubao-seedream-3-0-t2i",
  "is_default": true
}
```

**type 取值:**
- `text` - 文本模型（DeepSeek/OpenAI，用于提示词增强）
- `image` - 图片模型（火山引擎 Seedream，用于图片生成）
- `tool` - 工具模型（火山引擎 MediaKit，用于去除背景，model_name 可空）

---

### 6.4 系统提示词 (`/api/prompts`)

| 方法 | 路径 | 说明 | 请求参数 | 返回 |
|------|------|------|---------|------|
| GET | `/api/prompts` | 获取全部提示词 | 无 | `SystemPrompt[]` |
| GET | `/api/prompts/{tool_key}` | 获取指定工具提示词 | path: `tool_key` | `SystemPrompt` |
| PUT | `/api/prompts/{tool_key}` | 更新提示词 | path: `tool_key`, body: `{ tool_name, description, prompt_content }` | `SystemPrompt` |

> 系统提示词在 `seed_data.py` 中预置，启动时自动插入。预置的 tool_key 包括：text_to_image、image_to_image、inpaint、character_tpose、character_directions、scene、prop、ui、animation。

---

### 6.5 项目管理 (`/api/projects`)

| 方法 | 路径 | 说明 | 请求参数 | 返回 |
|------|------|------|---------|------|
| GET | `/api/projects` | 获取项目列表 | 无 | `Project[]` |
| GET | `/api/projects/{id}` | 获取项目详情 | path: `id` | `Project` |
| POST | `/api/projects` | 创建项目 | body: `{ name, description, style }` | `Project` |
| PUT | `/api/projects/{id}` | 更新项目 | path: `id`, body: `{ name?, description?, style?, cover_url? }` | `Project` |
| DELETE | `/api/projects/{id}` | 删除项目（级联删除资产和任务） | path: `id` | `{ success }` |

---

### 6.6 生成任务 (`/api/generate`)

| 方法 | 路径 | 说明 | 请求参数 | 返回 |
|------|------|------|---------|------|
| POST | `/api/generate/task` | 提交生成任务 | body: `{ project_id, tool_key, params }` | `Task` |
| GET | `/api/generate/task` | 获取项目任务列表 | query: `project_id`, `status?`, `tool_key?` | `Task[]` |
| GET | `/api/generate/task/{id}` | 获取单个任务 | path: `id` | `Task` |
| POST | `/api/generate/task/{id}/cancel` | 取消任务 | path: `id` | `Task` |
| DELETE | `/api/generate/tasks` | 删除已完成/失败任务 | query: `project_id`, `status?` | `{ deleted }` |
| GET | `/api/generate/queue-stats` | 获取队列统计 | query: `project_id?` | `{ pending, processing, completed, failed }` |
| POST | `/api/generate/optimize-prompt` | LLM 提示词优化 | body: `{ prompt, model_id, tool_key? }` | `{ optimized_prompt }` |

**Task 对象:**
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "tool_key": "text_to_image",
  "input_params": { "prompt": "...", "resolution": "1080p", "count": 4 },
  "status": "pending",
  "output_urls": ["/uploads/xxx.png"],
  "output_names": ["图片1.png"],
  "error_message": null,
  "progress": 0,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "...",
  "started_at": null,
  "completed_at": null
}
```

**tool_key 取值:**

| tool_key | 说明 | 前端页面 |
|----------|------|---------|
| text_to_image | 文生图 | /project/[id]/text2img |
| image_to_image | 图生图 | /project/[id]/img2img |
| image_edit | 图片编辑 | /project/[id]/image-edit |
| inpaint | 局部重绘 | /project/[id]/inpaint |
| character_tpose | 基础角色生成 | /project/[id]/character |
| character_directions | 多方向角色生成 | /project/[id]/character |
| scene | 场景生成 | /project/[id]/scene |
| prop | 道具生成 | /project/[id]/prop |
| ui | UI 生成 | /project/[id]/ui |
| animation | 动画生成 | /project/[id]/animation |

---

### 6.7 资产管理 (`/api/assets`)

| 方法 | 路径 | 说明 | 请求参数 | 返回 |
|------|------|------|---------|------|
| GET | `/api/assets` | 获取资产列表 | query: `project_id` | `Asset[]` |
| GET | `/api/assets/{id}` | 获取单个资产 | path: `id` | `Asset` |
| POST | `/api/assets` | 创建资产 | body: `{ project_id, name, type, url, metadata? }` | `Asset` |
| PUT | `/api/assets/{id}` | 更新资产 | path: `id`, body: `{ name?, type?, url?, finalized?, metadata? }` | `Asset` |
| DELETE | `/api/assets/{id}` | 删除资产 | path: `id` | `{ success }` |

---

### 6.8 文件上传 (`/api/upload`)

| 方法 | 路径 | 说明 | 请求参数 | 返回 |
|------|------|------|---------|------|
| POST | `/api/upload` | 上传图片 | multipart: `file` | `{ url, filename, size }` |

> 上传的文件存储在 `backend/uploads/` 目录，返回的 URL 格式为 `/uploads/xxx.png`。

---

### 6.9 文件下载 (`/api/download`)

| 方法 | 路径 | 说明 | 请求参数 | 返回 |
|------|------|------|---------|------|
| GET | `/api/download` | 下载文件 | query: `path` | File (attachment) |

> 用于强制浏览器下载（而非在新标签打开图片）。防止了跨域 `download` 属性被忽略的问题。

---

### 6.10 工具 - 去除背景 (`/api/tools`)

| 方法 | 路径 | 说明 | 请求参数 | 返回 |
|------|------|------|---------|------|
| POST | `/api/tools/ai-remove-bg` | AI 去除背景 | body: `{ image_url }` | `{ result_url, message }` |

**请求参数:**
```json
{
  "image_url": "/uploads/gen_xxx.png"
}
```

**注意:** `image_url` 必须是后端相对路径（`/uploads/xxx.png`），不能是 `http://localhost:8000/...` 绝对 URL。

**返回:**
```json
{
  "result_url": "/uploads/rmbg_xxx.png",
  "message": "Background removed successfully"
}
```

**处理流程:**
1. 从 `image_url` 解析本地文件路径
2. 从 `storage_configs` 表读取 TOS 配置
3. 使用 TOS SDK 上传图片到对象存储
4. 生成预签名 URL（有效期 1 小时）
5. 调用火山引擎 MediaKit API 移除背景
6. 下载处理结果保存到本地 uploads 目录
7. 返回本地相对路径

---

### 6.11 对象存储配置 (`/api/storage`)

| 方法 | 路径 | 说明 | 请求参数 | 返回 |
|------|------|------|---------|------|
| GET | `/api/storage/config` | 获取存储配置 | 无 | `StorageConfig` (密钥脱敏) |
| PUT | `/api/storage/config` | 保存存储配置 | body: `StorageConfigUpdate` | `StorageConfig` |

**StorageConfigUpdate:**
```json
{
  "provider": "volcengine",
  "access_key": "AKxxx",
  "secret_key": "SKxxx",
  "bucket": "gameart-temp",
  "endpoint": "tos-cn-guangzhou.volces.com",
  "region": "cn-guangzhou"
}
```

> 存储配置通过 UPSERT 单行记录管理。GET 接口返回时密钥会脱敏显示（仅显示前 4 位 + ****）。
> Endpoint 会自动规范化：如果填入 `tos-s3-cn-xxx.volces.com`，会自动转为 `tos-cn-xxx.volces.com`（TOS 原生 endpoint）。

---

### 6.12 账单统计 (`/api/billing`)

| 方法 | 路径 | 说明 | 请求参数 | 返回 |
|------|------|------|---------|------|
| GET | `/api/billing/summary` | 账单汇总 | 无 | `{ total_images, total_cost, ... }` |
| GET | `/api/billing/stats` | 统计图表数据 | query: `period` (daily/monthly), `days` (1-365) | `{ period, days, data }` |
| GET | `/api/billing/records` | 账单记录列表 | query: `limit` (1-200), `offset` | `{ records, limit, offset }` |

---

## 7. 后端服务层

### 7.1 generate_service.py（生成服务）

核心生成流程编排，被 `task_queue.py` 调用。

**主要函数:**
- `execute_generation(task)` - 执行生成任务的主入口
  - 从 DB 加载系统提示词
  - 调用 LLM 增强提示词
  - 调用图片模型 API 生成图片
  - 下载远程图片到本地
  - 白底移除后处理（Pillow flood fill）
  - 记录账单
  - 更新任务状态

### 7.2 image_service.py（图片模型 API 调用）

调用火山引擎 Seedream 图片生成 API。

**主要函数:**
- `resolve_image_input(image_url)` - 将图片 URL 转为 API 可接受格式
  - `data:` URI → 原样返回
  - `http://localhost` → 提取本地文件转 base64
  - 公网 HTTP URL → 原样返回
  - `/uploads/xxx` → 读取本地文件转 base64

**分辨率档位:**
| 档位 | 目标像素 | 说明 |
|------|---------|------|
| 720p | 921,600 | 标准分辨率 |
| 1080p | 2,073,600 | 高清分辨率 |
| 2K | 3,686,400 | 2K 分辨率 |
| 4K | 8,294,400 | 4K 分辨率 |

### 7.3 llm_service.py（LLM 提示词增强）

使用 LangChain 调用文本模型（DeepSeek/OpenAI）增强提示词。

- `optimize_prompt(user_prompt, model, tool_key)` - 按工具类型构建系统指令，调用 LLM 优化用户提示词

### 7.4 image_processor.py（图像处理）

使用 Pillow + NumPy 实现白底移除。

- `remove_background(input_path, tolerance)` - 从图像边框开始 flood fill，移除与边框连通的白色区域，保留内部白色区域，输出透明 PNG
- `fill_background(input_path, color)` - 用指定颜色填充透明区域

### 7.5 task_queue.py（异步任务队列）

基于 asyncio 的内存任务队列，无需 Celery/Redis。

**核心机制:**
- `create_task(project_id, tool_key, input_params)` - 创建任务并启动后台处理
- `start_processing()` - 启动后台 asyncio Task 轮询 pending 任务
- 单线程串行处理（一次只处理一个任务）
- 轮询间隔 2 秒
- 处理完成后调用 `update_task_status()` 更新状态
- 前端通过轮询 `GET /api/generate/task?project_id=xxx` 获取状态更新

## 8. 前端页面路由

### 8.1 路由结构

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | 项目列表，新建项目入口 |
| `/project/new` | 新建项目 | 创建新项目表单 |
| `/project/[id]` | 项目概览 | 项目信息、最近资产 |
| `/project/[id]/text2img` | 文生图 | 提示词生成图片 |
| `/project/[id]/img2img` | 图生图 | 参考图+提示词生成图片 |
| `/project/[id]/image-edit` | 图片编辑 | 图片编辑模式 |
| `/project/[id]/inpaint` | 局部重绘 | 遮罩+提示词局部修改 |
| `/project/[id]/remove-bg` | 去除背景 | AI 智能移除背景 |
| `/project/[id]/character` | 角色生成 | T姿势/多方向角色 |
| `/project/[id]/scene` | 场景生成 | 游戏场景图 |
| `/project/[id]/prop` | 道具生成 | 武器/道具 |
| `/project/[id]/ui` | UI 生成 | 游戏 UI 界面 |
| `/project/[id]/animation` | 动画生成 | 动画帧序列 |
| `/project/[id]/assets` | 资产库 | 项目资产浏览管理 |
| `/settings/models` | 系统配置 | 模型配置+对象存储配置 |
| `/settings/prompts` | 提示词管理 | 系统提示词 CRUD |
| `/settings/billing` | 账单统计 | 费用统计与记录 |

### 8.2 侧边栏导航分组

侧边栏分为三组：

| 分组 | 导航项 | 对应 types.ts 常量 |
|------|--------|-------------------|
| 基础工具 | 文生图、图生图 | `BASIC_TOOLS_ITEMS` |
| 创作工具 | 角色、场景、道具、UI、动画 | `CREATION_ITEMS` |
| 工具箱 | 图片编辑、去除背景 | `TOOLBOX_ITEMS` |
| 资产 | 资产库 | 独立 Link |

设置页面的导航项（非项目内）：
| 分组 | 导航项 |
|------|--------|
| 设置 | 系统配置、提示词管理、账单统计 |

## 9. 前端组件

### 9.1 布局组件 (`components/layout/`)

| 组件 | 说明 |
|------|------|
| `Sidebar` | 侧边栏导航，可折叠（240px ↔ 60px），根据 projectId 渲染不同导航 |
| `Breadcrumb` | 面包屑导航 |

### 9.2 工具组件 (`components/tools/`)

| 组件 | 说明 |
|------|------|
| `ToolLayout` | 工具页面通用布局，三栏布局（左参数面板 320px / 中间画布 / 右侧历史 280px），可选传 `toolKey` 加载系统提示词编辑器 |
| `PromptEditor` | 提示词编辑器，包含优化按钮 |
| `PromptInput` | 提示词输入框 |
| `ImageSourceSelector` | 图片来源选择器（上传/项目资产选择） |
| `ProjectAssetSelector` | 项目资产选择弹窗 |
| `ResultImageCard` | 生成结果图片卡片，含下载、收藏、设为封面等操作 |
| `GenerationResultActions` | 生成结果操作栏 |
| `TaskQueuePanel` | 任务队列面板，显示任务状态和进度 |
| `ColorPickerBgRemoval` | 背景色移除颜色选择器 |
| `Selectors` | 通用选择器组件（分辨率、数量等） |

### 9.3 UI 组件 (`components/ui/`)

完整 shadcn/ui 组件库，包括：accordion, alert, alert-dialog, avatar, badge, button, button-group, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, empty, field, form, hover-card, input, input-group, input-otp, item, kbd, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip 等。

## 10. 前端 Hooks 与工具函数

### 10.1 Hooks (`hooks/`)

| Hook | 说明 |
|------|------|
| `useTaskQueue` | 任务队列管理：提交任务、轮询状态、取消任务、清理已完成任务。内部自动轮询（3秒间隔），状态变化时触发回调 |
| `useButtonCooldown` | 按钮冷却防抖（防止重复提交） |
| `useMobile` | 移动端检测 |

### 10.2 API 客户端 (`lib/api.ts`)

统一管理所有后端 API 调用，通过 `NEXT_PUBLIC_API_URL` 环境变量配置后端地址。

| API 对象 | 说明 |
|----------|------|
| `modelApi` | 模型配置 CRUD |
| `promptApi` | 系统提示词 |
| `projectApi` | 项目 CRUD |
| `generateApi` | 生成任务（提交/查询/取消/优化提示词） |
| `assetApi` | 资产 CRUD |
| `uploadApi` | 文件上传 |
| `toolsApi` | 工具（去除背景） |
| `storageApi` | 对象存储配置 |
| `billingApi` | 账单统计 |

**重要函数:**
- `resolveImageUrl(url)` - 将后端返回的 `/uploads/xxx.png` 相对路径转为完整 URL（`http://localhost:8000/uploads/xxx.png`），用于前端 `<img>` 显示

### 10.3 类型定义 (`lib/types.ts`)

定义了所有 TypeScript 类型，包括：
- `ModelConfig`, `ModelConfigCreate` - 模型配置
- `SystemPrompt` - 系统提示词
- `Project`, `ProjectCreate` - 项目
- `Asset` - 资产
- `Task`, `TaskStatus` - 任务
- `BASIC_TOOLS_ITEMS`, `CREATION_ITEMS`, `TOOLBOX_ITEMS` - 侧边栏导航项配置

## 11. 核心业务流程

### 11.1 图片生成流程（文生图/图生图/局部重绘等）

```
用户输入提示词
    ↓
[可选] 点击优化 → POST /api/generate/optimize-prompt
    → 后端加载系统提示词（DB）
    → LangChain 调用文本模型增强提示词
    → 返回优化后的提示词
    ↓
用户点击生成 → POST /api/generate/task
    → 创建 task 记录（status=pending）
    → 启动后台处理
    ↓
后台处理（generate_service.execute_generation）
    1. 加载系统提示词（DB）
    2. LangChain LLM 增强提示词
    3. 图片 URL 预处理（base64 转换等）
    4. 调用火山引擎 Seedream API 生成图片
    5. 下载远程图片到本地 uploads/
    6. [可选] 白底移除后处理（Pillow）
    7. 记录账单（billing_records）
    8. 更新 task 状态为 completed
    ↓
前端轮询 GET /api/generate/task?project_id=xxx
    → 3秒间隔自动轮询
    → 检测到 status=completed → 触发 onTaskComplete 回调
    → 渲染生成结果图片
```

### 11.2 去除背景流程

```
用户选择图片（来自生成结果或上传）
    ↓
点击去除背景 → POST /api/tools/ai-remove-bg
    body: { image_url: "/uploads/xxx.png" }
    ↓
后端处理
    1. 解析本地文件路径
    2. 从 storage_configs 表读取 TOS 配置
    3. 使用 TOS SDK 上传图片到对象存储
    4. 生成预签名 URL（有效期 1 小时）
    5. 调用火山引擎 MediaKit API 移除背景
    6. 下载处理结果到本地 uploads/
    7. 返回 { result_url: "/uploads/rmbg_xxx.png" }
    ↓
前端显示去除背景后的图片
```

> **注意:** 去除背景功能不走任务队列，是同步请求。它需要系统配置中配置好对象存储（TOS）。

### 11.3 任务队列机制

```
前端                              后端
  │                                 │
  ├─ POST /generate/task ──────────→│ 创建 task（pending）
  │                                 │ start_processing() 启动轮询
  │                                 │
  │←────── 返回 Task ──────────────┤
  │                                 │ 后台轮询 pending 任务
  │                                 │ → status=processing
  │                                 │ → execute_generation()
  │                                 │ → status=completed/failed
  │                                 │
  ├─ GET /generate/task ───────────→│ 返回最新 task 列表
  │   (3秒轮询)                     │
  │←──── 返回 Task[] ──────────────┤
  │                                 │
  └─ 检测 status 变化               │
     → 渲染结果/报错                │
```

## 12. 关键技术决策

### 12.1 前后端分离

- 前端纯渲染，无 API Routes
- 后端独立 FastAPI 服务（端口 8000）
- 前端通过 `NEXT_PUBLIC_API_URL` 环境变量指定后端地址
- 图片 URL 通过 `resolveImageUrl()` 解析

### 12.2 TOS 对象存储集成

- 使用火山引擎官方 TOS Python SDK（`tos` 包），不使用 boto3
- Endpoint 自动规范化：`tos-s3-xxx` → `tos-xxx`（TOS 原生 endpoint）
- 上传后生成预签名 URL（`pre_signed_url`），有效期 1 小时
- 不使用 `tos://` 协议（需要 IAM 服务角色，配置复杂）
- 存储配置存储在数据库 `storage_configs` 表，通过系统配置 UI 管理

### 12.3 图片 URL 处理

后端返回的图片 URL 是相对路径（`/uploads/xxx.png`）：
- 前端显示：通过 `resolveImageUrl()` 转为完整 URL
- 传给后端 API（如去除背景）：直接传相对路径，后端自行解析
- 火山引擎 API 调用：`image_service.resolve_image_input()` 自动将本地路径转为 base64 data URI

### 12.4 异步任务队列

- 基于 asyncio 的内存任务队列，无需 Celery/Redis
- 单线程串行处理（一次只处理一个任务）
- 前端通过轮询获取状态更新（3秒间隔）
- 任务状态：pending → processing → completed / failed

### 12.5 数据库自动初始化

- `database.py` 中的 `SCHEMA_SQL` 在启动时执行
- 使用 `CREATE TABLE IF NOT EXISTS` 保证幂等
- 包含迁移逻辑（如添加 `output_names` 列）
- JSONB 列通过 asyncpg 的 codec 自动序列化/反序列化

## 13. 开发注意事项

### 13.1 添加新工具页面

1. 在 `types.ts` 的 `BASIC_TOOLS_ITEMS` / `CREATION_ITEMS` / `TOOLBOX_ITEMS` 中添加导航项
2. 在 `seed_data.py` 中添加对应的系统提示词
3. 创建前端页面 `front/src/app/project/[id]/xxx/page.tsx`
4. 使用 `ToolLayout` 组件构建页面（传入 `toolKey` 自动加载提示词编辑器）
5. 如果工具需要特殊后端处理，在 `routers/` 下添加路由

### 13.2 模型配置类型

- `text` - 文本模型，用于提示词增强，必须有 `model_name`
- `image` - 图片模型，用于图片生成，必须有 `model_name`
- `tool` - 工具模型，用于去除背景等工具功能，`model_name` 可空（保存按钮对此类型不校验 model_name）

### 13.3 图片文件存储

- 所有图片存储在 `backend/uploads/` 目录
- 前端引用格式：`/uploads/xxx.png`
- 上传接口：`POST /api/upload`（multipart/form-data）
- 下载接口：`GET /api/download?path=/uploads/xxx.png`（强制下载）
- 后端通过 `StaticFiles` 挂载 `/uploads` 路径提供静态访问

### 13.4 TOS 对象存储配置

- 在系统配置页面（`/settings/models`）底部配置
- 需要提供：Access Key、Secret Key、Bucket、Endpoint、Region
- Endpoint 填入 `tos-cn-guangzhou.volces.com` 或 `tos-s3-cn-guangzhou.volces.com` 均可（自动规范化）
- Region 格式：`cn-guangzhou`（非 `华南1（广州）`）
- 桶不需要设置为公开（使用预签名 URL 访问）

### 13.5 Pydantic Settings 属性大小写

后端 `config.py` 使用 Pydantic Settings，属性名是**大写**的（如 `UPLOAD_DIR`），不能用小写 `upload_dir` 访问，否则会抛出 `AttributeError`。

### 13.6 前端图片下载

跨域下载必须使用 `fetch + blob` 模式，不能直接用 `<a>` 标签的 `download` 属性（浏览器会忽略跨域资源的 `download` 属性）：

```typescript
const downloadFile = async (url: string, filename: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(blobUrl);
};
```
