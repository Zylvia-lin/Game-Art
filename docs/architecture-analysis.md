# GameArt AI 项目架构与数据库分析

> 分析日期：2026-07-24 | 版本：v1.0.0

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈详情](#2-技术栈详情)
3. [项目目录结构](#3-项目目录结构)
4. [数据库 Schema 分析](#4-数据库-schema-分析)
5. [API 路由架构](#5-api-路由架构)
6. [核心业务流程](#6-核心业务流程)
7. [前端架构](#7-前端架构)
8. [数据流与通信](#8-数据流与通信)
9. [当前架构评估](#9-当前架构评估)

---

## 1. 项目概览

**GameArt AI** 是一个 **AI 游戏美术资产生成平台**，面向独立游戏开发者和游戏美术设计师。用户通过输入自然语言提示词，借助 AI 模型生成游戏角色、道具、UI、场景、动画帧等美术资产。

### 产品定位

- 深色主题的专业创作工具（灵感来源：Figma / Linear / Vercel Dashboard）
- 8 大创作工具：角色、动画、道具、UI、场景、文生图、图生图、图片编辑
- 支持提示词增强、绿幕背景移除、帧提取等后处理

### 架构模式

- **前后端完全分离**：Next.js 16 前端 ↔ FastAPI 后端
- **单体后端**：单进程 Python 服务，无微服务拆分
- **直连数据库**：后端通过 asyncpg 直接操作 PostgreSQL，无 ORM 层

---

## 2. 技术栈详情

### 2.1 前端 (`front/`)

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.1.1 (App Router) | 前端框架，纯前端无 API Routes |
| React | 19.2.3 | UI 库 |
| TypeScript | 5.x | 类型系统 |
| Tailwind CSS | 4.x | 原子化 CSS |
| shadcn/ui | latest | UI 组件库（基于 Radix UI） |
| Radix UI | 各组件独立版本 | 无障碍原语组件 |
| react-hook-form | 7.71.1 | 表单管理 |
| zod | 4.3.5 | Schema 校验 |
| recharts | 2.15.4 | 计费图表 |
| lucide-react | 0.468.0 | 图标库 |
| sonner | 2.0.7 | Toast 通知 |
| cmdk | 1.1.1 | 命令面板 |
| pnpm | 9.0.0 | 包管理器 |

### 2.2 后端 (`backend/`)

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.14 | 运行时 |
| FastAPI | latest | Web 框架 |
| asyncpg | latest | 异步 PostgreSQL 驱动 |
| LangChain | latest | LLM 集成（提示词优化） |
| langchain-openai | latest | OpenAI 兼容 LLM 调用 |
| Pillow | latest | 图像处理（背景移除/帧提取） |
| numpy | latest | 图像数组处理 |
| httpx | latest | 异步 HTTP 客户端 |
| pydantic-settings | latest | 配置管理 |
| uv | latest | 包管理器 |

### 2.3 基础设施

| 组件 | 说明 |
|------|------|
| PostgreSQL 16 | 主数据库 |
| 本地文件系统 (`./uploads`) | 图片存储 |
| 内存 asyncio 循环 | 异步任务队列 |
| 火山引擎 Seedream API | 图片生成模型 |
| DeepSeek/OpenAI API | 文本模型（提示词优化） |

---

## 3. 项目目录结构

```
game-art/
├── front/                          # Next.js 16 前端
│   ├── src/
│   │   ├── app/                    # App Router 页面路由
│   │   │   ├── layout.tsx          # 根布局（侧边栏 + 主题）
│   │   │   ├── page.tsx            # 首页 / 项目列表
│   │   │   ├── project/
│   │   │   │   ├── new/page.tsx    # 新建项目
│   │   │   │   └── [id]/
│   │   │   │       ├── layout.tsx  # 项目布局（工具导航）
│   │   │   │       ├── page.tsx    # 项目首页
│   │   │   │       ├── assets/page.tsx     # 资产库
│   │   │   │       ├── character/page.tsx  # 角色生成
│   │   │   │       ├── animation/page.tsx  # 动画生成
│   │   │   │       ├── prop/page.tsx       # 道具生成
│   │   │   │       ├── ui/page.tsx         # UI生成
│   │   │   │       ├── scene/page.tsx      # 场景生成
│   │   │   │       ├── text2img/page.tsx   # 文生图
│   │   │   │       ├── img2img/page.tsx    # 图生图
│   │   │   │       └── image-edit/page.tsx # 图片编辑
│   │   │   └── settings/
│   │   │       ├── models/page.tsx  # 模型配置
│   │   │       ├── prompts/page.tsx # 系统提示词
│   │   │       └── billing/page.tsx # 计费统计
│   │   ├── components/
│   │   │   ├── ui/                # shadcn/ui 组件 (50+ 文件)
│   │   │   ├── layout/            # 布局组件（侧边栏/面包屑）
│   │   │   └── tools/             # 工具组件（参数面板/结果展示）
│   │   ├── hooks/                 # 自定义 Hooks
│   │   │   ├── use-mobile.ts
│   │   │   ├── use-task-queue.ts
│   │   │   └── use-button-cooldown.ts
│   │   └── lib/
│   │       ├── api.ts             # 后端 API 客户端（410 行）
│   │       ├── types.ts           # 类型定义 + 业务常量（400 行）
│   │       └── utils.ts           # 工具函数
│   ├── public/                    # 静态资源
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   ├── stylelint.config.mjs
│   └── components.json           # shadcn/ui 配置
│
├── backend/                        # Python FastAPI 后端
│   ├── main.py                    # FastAPI 入口 + 路由注册
│   ├── config.py                  # 配置管理（pydantic-settings）
│   ├── database.py                # 数据库连接池 + Schema DDL + 查询助手
│   ├── seed_data.py               # 系统提示词初始化种子数据
│   ├── init_db.py                 # 独立数据库初始化脚本
│   ├── routers/                   # API 路由层
│   │   ├── __init__.py
│   │   ├── projects.py            # 项目管理 CRUD + 嵌套资产/生成历史
│   │   ├── assets.py              # 资产管理 CRUD
│   │   ├── models.py              # 模型配置 CRUD
│   │   ├── prompts.py             # 系统提示词 CRUD
│   │   ├── generate.py            # 生成任务提交 + 管理 + 提示词优化
│   │   ├── upload.py              # 文件上传
│   │   ├── download.py            # 文件下载代理
│   │   ├── tools.py               # 本地工具（帧提取/背景移除）
│   │   └── billing.py             # 计费统计
│   └── services/                  # 业务服务层
│       ├── __init__.py
│       ├── generate_service.py    # 生成全流程编排（提示词注入→生成→后处理）
│       ├── image_service.py       # 图片模型 API 调用（火山引擎 Seedream）
│       ├── image_processor.py     # 图像处理（Pillow 背景移除/帧提取）
│       ├── llm_service.py         # LLM 提示词增强（LangChain）
│       └── task_queue.py          # 异步任务队列 + 计费记录
│
├── assets/                        # 临时/错误日志文件（非项目资产）
├── AGENTS.md                      # AI 代理配置文档
├── DESIGN.md                      # 设计规范文档
└── .gitignore
```

---

## 4. 数据库 Schema 分析

### 4.1 概览

数据库：**PostgreSQL 16**（数据库名：`game_art_ai`）  
Schema 管理：**无迁移系统**，DDL 以字符串形式写在 `database.py` 中，启动时自动执行 `CREATE TABLE IF NOT EXISTS`  
ORM：**无**，全项目使用 raw SQL via `asyncpg`

### 4.2 表结构详解

#### 表 1：`model_configs` — AI 模型配置

```sql
CREATE TABLE model_configs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(50) NOT NULL CHECK (type IN ('text', 'image')),
    provider    VARCHAR(100),
    api_base_url TEXT,
    api_key     TEXT,              -- ⚠️ API Key 明文存储
    model_name  VARCHAR(255),
    is_default  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**用途**：存储文本模型（LLM）和图片模型（Seedream）的 API 配置。通过 `is_default` 标记当前使用的模型。

**问题**：
- `api_key` 明文存储在数据库中，存在安全风险
- 无 `is_active` 字段，无法软禁用模型
- 无使用统计/配额限制

#### 表 2：`system_prompts` — 系统提示词

```sql
CREATE TABLE system_prompts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_key       VARCHAR(100) UNIQUE NOT NULL,
    tool_name      VARCHAR(255) NOT NULL,
    description    TEXT,
    prompt_content TEXT NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);
```

**用途**：每个 AI 工具的预设系统提示词模板。生成时系统提示词被注入到用户提示词之前。

**数据流**：`seed_data.py` 在启动时检查并插入默认提示词（约 15 个工具），包含角色 T-Pose、三视图、多方向、道具、UI、场景等。

#### 表 3：`projects` — 项目

```sql
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    cover_url   TEXT,
    style       VARCHAR(100),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**用途**：用户创建的项目容器，所有资产和生成记录都归属于项目。

**问题**：
- 无 `user_id`，无法多用户隔离
- `style` 字段为自由文本，无枚举约束
- `cover_url` 无外键约束，可能指向不存在的文件

#### 表 4：`assets` — 资产存档

```sql
CREATE TABLE assets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(50) NOT NULL,
    url         TEXT NOT NULL,
    finalized   BOOLEAN DEFAULT FALSE,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**用途**：用户手动存档的资产（用户主动保存到资产库的图片）。

**索引**：`idx_assets_project_id` ON (project_id)

#### 表 5：`generations` — 生成记录

```sql
CREATE TABLE generations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tool_key     VARCHAR(100) NOT NULL,
    input_params JSONB DEFAULT '{}',
    output_urls  JSONB DEFAULT '[]',
    output_names JSONB DEFAULT '[]',
    status       VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    task_id      UUID
);
```

**用途**：每次 AI 生成的完整记录，作为生成历史存档。

**索引**：`idx_generations_project_id` ON (project_id)

**注意**：该表与 `tasks` 表存在功能重叠。`tasks` 是生成的主数据源，`generations` 在任务完成后被同步写入。

#### 表 6：`tasks` — 任务队列

```sql
CREATE TABLE tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tool_key     VARCHAR(100) NOT NULL,
    input_params JSONB DEFAULT '{}',
    status       VARCHAR(50) DEFAULT 'pending', -- pending/processing/completed/failed
    output_urls  JSONB DEFAULT '[]',
    output_names JSONB DEFAULT '[]',
    error_message TEXT,
    progress     FLOAT DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
```

**用途**：异步任务队列的核心表，所有生成请求先写入此表，后台 worker 轮询处理。

**索引**：
- `idx_tasks_project_id` ON (project_id)
- `idx_tasks_status` ON (status)

**状态机**：`pending → processing → completed | failed`

#### 表 7：`billing_records` — 计费记录

```sql
CREATE TABLE billing_records (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
    task_id      UUID,
    tool_key     VARCHAR(100) NOT NULL,
    tool_name    VARCHAR(255),
    image_count  INTEGER NOT NULL DEFAULT 1,
    resolution   VARCHAR(50),
    total_pixels BIGINT,
    input_cost   NUMERIC(10,4) DEFAULT 0,
    output_cost  NUMERIC(10,4) DEFAULT 0,
    total_cost   NUMERIC(10,4) DEFAULT 0,
    status       VARCHAR(50) DEFAULT 'completed',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**用途**：独立于 tasks 的成本记录，删除图片不影响账单。目前计费逻辑基于火山引擎 Seedream 定价硬编码。

**索引**：
- `idx_billing_project_id` ON (project_id)
- `idx_billing_created_at` ON (created_at)

### 4.3 ER 关系图

```
┌──────────────┐
│   projects   │
│  (主表)       │
└──┬───┬───┬───┘
   │   │   │
   │   │   └──────────────────────┐
   │   │                          │
   ▼   ▼                          ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│  assets  │  │  tasks   │  │ generations  │
│ (存档)    │  │ (任务队列) │  │ (生成历史)    │
└──────────┘  └────┬─────┘  └──────────────┘
                   │
                   ▼
            ┌──────────────┐
            │   billing    │
            │   _records   │
            └──────────────┘

独立配置表（不与 project 关联）:
┌──────────────┐  ┌─────────────────┐
│ model_configs│  │ system_prompts  │
└──────────────┘  └─────────────────┘
```

### 4.4 Schema 设计评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 表结构清晰度 | ★★★★☆ | 表职责明确，命名规范 |
| 关系完整性 | ★★★☆☆ | 有外键但 `task_id` 在 generations 表中未设 FK |
| 索引策略 | ★★★☆☆ | 基本索引存在，但缺少复合索引和 JSONB GIN 索引 |
| 扩展性 | ★★☆☆☆ | 无用户表、无团队/组织、无权限模型 |
| 数据安全 | ★★☆☆☆ | API Key 明文存储、无审计日志、无软删除 |
| 迁移管理 | ★☆☆☆☆ | 无版本化迁移，DDL 写在代码里，难以回滚 |

---

## 5. API 路由架构

### 5.1 路由总览

| 路由前缀 | 文件 | 主要功能 |
|----------|------|---------|
| `/api/projects` | `routers/projects.py` | 项目 CRUD + 嵌套资产/生成历史 |
| `/api/models` | `routers/models.py` | 模型配置 CRUD |
| `/api/prompts` | `routers/prompts.py` | 系统提示词 CRUD |
| `/api/generate/{tool_key}` | `routers/generate.py` | 生成任务提交 + 任务管理 + 提示词优化 |
| `/api/assets` | `routers/assets.py` | 资产 CRUD |
| `/api/upload` | `routers/upload.py` | 文件上传 |
| `/api/download` | `routers/download.py` | 文件下载代理 |
| `/api/tools` | `routers/tools.py` | 本地工具（帧提取/背景移除） |
| `/api/billing` | `routers/billing.py` | 计费统计 |
| `/api/health` | `main.py` | 健康检查 |

### 5.2 API 设计评估

| 维度 | 评分 | 说明 |
|------|------|------|
| RESTful 规范 | ★★★☆☆ | 基本遵循但缺少 API 版本前缀 |
| 错误处理 | ★★★☆☆ | 有 HTTPException，但错误格式不统一 |
| 输入校验 | ★★★★☆ | Pydantic 模型校验，类型安全 |
| 分页支持 | ★★☆☆☆ | 仅 billing 接口有分页，其他列表接口无 |
| 幂等性 | ★★☆☆☆ | 创建操作无幂等键 |
| 文档 | ★★★★☆ | FastAPI 自动生成 OpenAPI 文档 |

### 5.3 端点完整列表

```
GET    /api/health                          # 健康检查
GET    /api/projects                        # 项目列表
POST   /api/projects                        # 创建项目
GET    /api/projects/{id}                   # 获取项目
PUT    /api/projects/{id}                   # 更新项目
DELETE /api/projects/{id}                   # 删除项目
GET    /api/projects/{id}/assets            # 项目资产（含生成图片）
GET    /api/projects/{id}/generations       # 项目生成历史
GET    /api/models                          # 模型列表
POST   /api/models                          # 添加模型
GET    /api/models/{id}                     # 获取模型
PUT    /api/models/{id}                     # 更新模型
DELETE /api/models/{id}                     # 删除模型
PUT    /api/models/{id}/default             # 设为默认模型
GET    /api/prompts                         # 提示词列表
GET    /api/prompts/{tool_key}              # 获取提示词
PUT    /api/prompts/{tool_key}              # 更新提示词
POST   /api/generate/optimize-prompt        # 提示词优化（LLM）
POST   /api/generate/{tool_key}             # 提交生成任务
GET    /api/generate/task                   # 查询任务（多模式）
POST   /api/generate/task/{id}/cancel       # 取消任务
DELETE /api/generate/task                   # 批量删除任务
DELETE /api/generate/task/{id}              # 删除单个任务
PATCH  /api/generate/task/{id}/rename       # 重命名输出
DELETE /api/generate/task/{id}/output/{n}   # 删除单个输出
POST   /api/assets                          # 创建资产
GET    /api/assets/{id}                     # 获取资产
PUT    /api/assets/{id}                     # 更新资产
DELETE /api/assets/{id}                     # 删除资产
POST   /api/assets/check-batch              # 批量检查 URL
POST   /api/upload                          # 上传文件
GET    /api/download                        # 下载文件
POST   /api/tools/extract-frames            # 帧提取
POST   /api/tools/remove-bg                 # 背景移除
POST   /api/tools/remove-bg-mask            # 蒙版背景移除
GET    /api/billing/summary                 # 计费汇总
GET    /api/billing/stats                   # 计费统计
GET    /api/billing/records                 # 计费记录
```

---

## 6. 核心业务流程

### 6.1 图片生成全链路

```
用户输入提示词
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 1. 前端 POST /api/generate/{tool_key}                │
│    传入 project_id + prompt + style + ratio + ...     │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 2. Backend Router 层                                 │
│    - 校验 project 存在                                │
│    - 检查模型配置（text + image 默认模型）             │
│    - 创建 task (status=pending)                       │
│    - 返回 { task_id, status: "queued" }              │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 3. 后台 asyncio Task 轮询                            │
│    task_queue._process_queue() 每 2 秒取一个 pending  │
│    使用 FOR UPDATE SKIP LOCKED 防止并发              │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 4. execute_generation() 全流程                       │
│    a. 从 DB 加载 system_prompt                       │
│    b. 直接注入到 user_prompt（默认不调用 LLM）        │
│    c. 调用 Seedream API 生成图片                      │
│    d. 下载图片到本地 ./uploads/                       │
│    e. 创作工具：移除白色背景 → 透明 PNG               │
│    f. 工具箱工具：仅下载，不去背景                     │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 5. 完成                                              │
│    - task status → completed                         │
│    - 写入 generations 记录                            │
│    - 写入 billing_record                             │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 6. 前端轮询 GET /api/generate/task?task_id=xxx       │
│    状态变为 completed 后展示结果                      │
└──────────────────────────────────────────────────────┘
```

### 6.2 提示词优化（按需）

用户点击「优化提示词」按钮时，调用 LangChain → DeepSeek/OpenAI API 增强提示词。这是同步请求，不走任务队列。

### 6.3 资产存档流程

用户在生成结果中点击「保存到资产库」→ POST `/api/assets` → 写入 `assets` 表。资产列表 API 同时查询 `assets` 表 + `tasks` 表（生成结果）。

---

## 7. 前端架构

### 7.1 路由结构

```
/                               → 首页（项目列表）
/project/new                    → 创建项目
/project/[id]                   → 项目首页
/project/[id]/assets            → 资产库
/project/[id]/character         → 角色生成
/project/[id]/animation         → 动画生成
/project/[id]/prop              → 道具生成
/project/[id]/ui                → UI 生成
/project/[id]/scene             → 场景生成
/project/[id]/text2img          → 文生图
/project/[id]/img2img           → 图生图
/project/[id]/image-edit        → 图片编辑
/settings/models                → 模型配置
/settings/prompts               → 系统提示词
/settings/billing               → 计费统计
```

### 7.2 组件分层

| 层级 | 目录 | 说明 |
|------|------|------|
| UI 基础层 | `components/ui/` | 50+ shadcn/ui 组件，封装 Radix UI |
| 布局层 | `components/layout/` | 侧边栏、面包屑导航 |
| 工具层 | `components/tools/` | 参数面板、提示词编辑器、任务队列、结果展示 |
| 页面层 | `app/**/page.tsx` | Next.js App Router 页面 |

### 7.3 状态管理

目前没有引入全局状态管理库。状态通过以下方式管理：
- **URL 参数**：工具页面状态（tool key 等）
- **React 本地状态**：组件内部状态
- **轮询**：任务队列通过 `use-task-queue.ts` hook 轮询后端

---

## 8. 数据流与通信

```
┌─────────────────────┐         HTTP/REST          ┌─────────────────────┐
│  Next.js 16 前端     │ ◄──────────────────────► │  FastAPI 后端        │
│  (端口 3000)         │   JSON + FormData         │  (端口 8000)         │
│                      │                           │                      │
│  lib/api.ts          │                           │  routers/*.py        │
│  (统一 API 客户端)    │                           │  services/*.py       │
└─────────────────────┘                           └──────┬──────────────┘
                                                          │
                                                          │ asyncpg (raw SQL)
                                                          │
                                                          ▼
                                                  ┌─────────────────────┐
                                                  │  PostgreSQL 16       │
                                                  │  7 张表              │
                                                  └─────────────────────┘
                                                          │
                                                          │ httpx
                                                          │
                                                          ▼
                                                  ┌─────────────────────┐
                                                  │  外部 AI API         │
                                                  │  - 火山引擎 Seedream  │
                                                  │  - DeepSeek/OpenAI   │
                                                  └─────────────────────┘
```

**图片存储**：生成的图片从 API URL 下载到本地 `./uploads/` 目录，通过 FastAPI `StaticFiles` 挂载对外暴露。

---

## 9. 当前架构评估

### 9.1 优势

| 方面 | 说明 |
|------|------|
| **架构简洁** | 前后端分离清晰，容易理解和上手 |
| **类型安全** | 前端 TypeScript + 后端 Pydantic，类型覆盖好 |
| **异步处理** | asyncpg + asyncio 全异步，资源利用效率好 |
| **设计规范** | 有 DESIGN.md 定义完整的设计令牌和交互规范 |
| **可工作 MVP** | 当前状态是一个功能完整的 MVP，8 个工具均可使用 |

### 9.2 技术债务与风险

| 类别 | 问题 | 严重程度 |
|------|------|----------|
| **安全** | 无用户认证/授权 | 🔴 CRITICAL |
| **安全** | API Key 明文存储在 DB | 🔴 CRITICAL |
| **数据** | 无数据库迁移系统 | 🔴 CRITICAL |
| **数据** | generations 与 tasks 表功能重叠 | 🟡 MEDIUM |
| **运维** | 本地文件存储，不可扩展 | 🔴 CRITICAL |
| **运维** | 内存任务队列，重启丢失 | 🟠 HIGH |
| **代码** | 全项目 raw SQL，无 Repository 模式 | 🟠 HIGH |
| **代码** | 无测试覆盖 | 🟠 HIGH |
| **代码** | JSONB 解析逻辑重复（至少 6 处） | 🟡 MEDIUM |
| **代码** | `print()` 代替日志系统 | 🟡 MEDIUM |
| **架构** | 无 API 版本化 | 🟡 MEDIUM |
| **架构** | 无速率限制 | 🟠 HIGH |
| **架构** | 模型定价硬编码 | 🟡 MEDIUM |
| **架构** | 前端类型在两处重复定义 | 🟡 MEDIUM |
| **部署** | 无 Docker 容器化 | 🟡 MEDIUM |
| **部署** | 数据库密码写在 .env 中 | 🟡 MEDIUM |
