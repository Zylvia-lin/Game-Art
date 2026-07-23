# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Backend**: Python FastAPI (独立服务，端口 8000)
- **Database**: PostgreSQL
- **Package Manager**: pnpm (前端), uv (后端)

## 目录结构

```
.
├── public/                 # 静态资源
├── backend/                # Python FastAPI 后端（独立服务）
│   ├── main.py             # 后端入口
│   ├── config.py           # 配置
│   ├── database.py         # 数据库连接（asyncpg）
│   ├── routers/            # API 路由
│   │   ├── assets.py       # 资产管理
│   │   ├── generate.py     # 生成任务提交与管理
│   │   ├── models.py       # 模型配置
│   │   ├── prompts.py      # 系统提示词管理
│   │   ├── projects.py     # 项目管理
│   │   ├── tools.py        # 本地工具（帧提取、背景移除）
│   │   └── upload.py       # 文件上传
│   ├── services/           # 业务服务
│   │   ├── generate_service.py  # 生成服务（LLM + 图片模型）
│   │   ├── image_processor.py   # 图像处理（绿幕移除、帧切割）
│   │   ├── image_service.py     # 图片模型 API 调用
│   │   ├── llm_service.py       # LLM 提示词增强
│   │   └── task_queue.py        # 异步任务队列
│   ├── seed_data.py        # 初始数据（17个系统提示词）
│   └── pyproject.toml      # Python 依赖（uv 管理）
├── src/
│   ├── app/                # 页面路由与布局
│   │   ├── page.tsx        # 首页（项目列表 Dashboard）
│   │   ├── project/
│   │   │   ├── new/        # 新建项目
│   │   │   └── [id]/       # 项目工作台 + 各工具页
│   │   │       ├── text2img    # 文生图
│   │   │       ├── img2img     # 图生图
│   │   │       ├── inpaint     # 局部重绘（Canvas遮罩）
│   │   │       ├── character   # 角色生成（多姿势/多方向/部件拆分）
│   │   │       ├── animation   # 动画生成（动作生成/帧提取）
│   │   │       ├── prop        # 道具生成（含变体衍生）
│   │   │       ├── ui          # UI生成（含拖拽组件编辑器）
│   │   │       ├── scene       # 场景/地图生成
│   │   │       └── assets      # 项目资产库
│   │   └── settings/
│   │       ├── models/     # 模型配置页
│   │       └── prompts/    # 系统提示词管理页（17个功能）
│   ├── components/
│   │   ├── layout/         # 全局布局（侧边栏、面包屑）
│   │   ├── tools/          # 工具页通用组件（ToolLayout、PromptEditor、Selectors）
│   │   └── ui/             # shadcn/ui 组件库
│   ├── hooks/
│   │   └── use-task-queue.ts  # 任务队列 Hook
│   └── lib/
│       ├── api.ts          # API 客户端（调用 Python FastAPI 后端）
│       ├── types.ts        # TypeScript 类型定义
│       └── utils.ts        # 通用工具函数
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 核心架构

### 前后端分离
- **前端**: Next.js 纯前端应用，通过 `NEXT_PUBLIC_API_URL` 环境变量指定后端地址
- **后端**: Python FastAPI 独立服务，运行在端口 8000
- **通信**: 前端通过 HTTP API 调用后端，所有业务逻辑在后端执行

### 项目驱动工作流
用户必须先创建/选择项目，然后在项目内使用各工具。所有生成结果归属当前项目。

### 提示词管线 (Prompt Pipeline)
每个工具功能有独立的系统提示词（共17个），存储在 PostgreSQL 中。
流程：用户输入 → 加载系统提示词 → LLM 增强 → 图片模型生成
用户可在前端实时编辑每个提示词，保存后立即生效。

### 17个功能提示词 (tool_key)
- 基础: text_to_image, image_to_image, inpaint
- 角色: character_tpose, character_directions, character_three_view, character_part_split
- 动画: animation_text, animation_frame_extract
- 道具: prop_generate, prop_variant
- UI: ui_layout_generate, ui_component_place, ui_component_split
- 场景: scene_map_generate, scene_map_split

### 模型配置
用户自行配置文本模型（DeepSeek/OpenAI）和图片模型（火山引擎 Seedream）的 API 信息。

## 启动方式

### 前端
```bash
pnpm install
pnpm dev
```

### 后端
```bash
cd backend
uv sync
uv run python main.py
```

## 包管理规范

- 前端：仅允许使用 **pnpm** 作为包管理器
- 后端：使用 **uv** 管理 Python 依赖和虚拟环境

## 开发规范

- 默认按 TypeScript strict 模式编写
- 禁止隐式 any，函数参数必须有类型标注
- 使用 'use client' 配合 useEffect + useState 处理客户端动态内容
- API 调用统一通过 src/lib/api.ts 客户端
