# AGENTS.md - GameArt AI

## 项目概览

AI 游戏美术资产生成平台，前后端完全分离。

## 技术栈

### 前端 (`front/`)
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Package Manager**: pnpm

### 后端 (`backend/`)
- **Framework**: Python FastAPI (独立服务，端口 8000)
- **Database**: PostgreSQL 16 (asyncpg)
- **LLM**: LangChain (langchain-openai)
- **图像处理**: Pillow
- **Package Manager**: uv

## 目录结构

```
.
├── front/                  # Next.js 前端
│   ├── src/
│   │   ├── app/            # 页面路由（纯前端，无 API routes）
│   │   ├── components/     # UI 组件
│   │   ├── hooks/          # React hooks
│   │   └── lib/
│   │       ├── api.ts      # API 客户端（调用 Python 后端）
│   │       ├── types.ts    # TypeScript 类型定义
│   │       └── utils.ts    # 工具函数
│   ├── public/             # 静态资源
│   ├── package.json
│   ├── next.config.ts
│   └── .env.example
│
├── backend/                # Python FastAPI 后端
│   ├── main.py             # FastAPI 入口
│   ├── config.py           # 配置（从 .env 读取）
│   ├── database.py         # asyncpg 数据库连接
│   ├── seed_data.py        # 系统提示词初始化
│   ├── pyproject.toml      # uv 依赖管理
│   ├── .env.example
│   ├── routers/            # API 路由
│   │   ├── assets.py       # 资产管理
│   │   ├── generate.py     # 生成任务
│   │   ├── models.py       # 模型配置
│   │   ├── prompts.py      # 系统提示词
│   │   ├── projects.py     # 项目管理
│   │   ├── tools.py        # 本地工具（帧提取、背景移除）
│   │   └── upload.py       # 文件上传
│   └── services/           # 业务服务
│       ├── generate_service.py   # 生成全流程
│       ├── image_processor.py    # 图像处理（Pillow）
│       ├── image_service.py      # 图片模型 API
│       ├── llm_service.py        # LLM 提示词增强（LangChain）
│       └── task_queue.py         # 异步任务队列
│
├── AGENTS.md
├── DESIGN.md
└── .gitignore
```

## 启动方式

### 后端
```bash
cd backend
cp .env.example .env   # 编辑数据库等配置
uv sync
uv run python main.py  # 端口 8000
```

### 前端
```bash
cd front
cp .env.example .env   # 编辑后端 API 地址
pnpm install
pnpm dev               # 端口 3000
```

## 核心架构

### 前后端通信
- 前端通过 `NEXT_PUBLIC_API_URL` 环境变量指定后端地址
- 前端 API 客户端 (`front/src/lib/api.ts`) 统一调用后端
- 图片 URL 通过 `resolveImageUrl()` 解析后端返回的相对路径

### 数据库
- PostgreSQL，所有数据存储在数据库中
- 表：model_configs, system_prompts, projects, assets, generations, tasks
- 后端通过 asyncpg 直连数据库

### 提示词管线
用户输入 → 加载系统提示词（DB） → LangChain LLM 增强 → 图片模型生成 → 绿幕移除后处理 → 返回透明 PNG

### 模型配置
- 文本模型（DeepSeek/OpenAI）：通过 LangChain ChatOpenAI 调用
- 图片模型（火山引擎 Seedream）：通过 httpx 调用

## 包管理

- 前端：pnpm
- 后端：uv

## 环境变量

### 后端 (`backend/.env`)
```
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

### 前端 (`front/.env`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
