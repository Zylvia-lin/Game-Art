# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Backend**: Python FastAPI (独立服务，端口 8000)
- **Database**: PostgreSQL

## 目录结构

```
├── public/                 # 静态资源
├── backend/                # Python FastAPI 后端
│   ├── main.py             # 后端入口
│   ├── config.py           # 配置
│   ├── database.py         # 数据库连接
│   ├── models/             # SQLAlchemy 模型
│   ├── routers/            # API 路由
│   ├── services/           # 业务服务（LLM、图片生成、提示词管线）
│   ├── seed_data.py        # 初始数据（17个系统提示词）
│   └── requirements.txt    # Python 依赖
├── scripts/                # 构建与启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   ├── page.tsx        # 首页（项目列表 Dashboard）
│   │   ├── project/
│   │   │   ├── new/        # 新建项目
│   │   │   └── [id]/       # 项目工作台 + 各工具页
│   │   │       ├── text2img    # 文生图
│   │   │       ├── img2img     # 图生图
│   │   │       ├── inpaint     # 局部重绘（Canvas遮罩）
│   │   │       ├── character   # 角色生成（T-pose/多方向/部件拆分）
│   │   │       ├── animation   # 动画生成
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
│   ├── lib/
│   │   ├── api.ts          # API 客户端（调用后端 FastAPI）
│   │   ├── types.ts        # TypeScript 类型定义
│   │   └── utils.ts        # 通用工具函数
│   └── server.ts           # 自定义服务端入口
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 核心架构

### 项目驱动工作流
用户必须先创建/选择项目，然后在项目内使用各工具。所有生成结果归属当前项目。

### 提示词管线 (Prompt Pipeline)
每个工具功能有独立的系统提示词（共17个），存储在 PostgreSQL 中。
流程：用户输入 → 加载系统提示词 → LLM 增强 → 图片模型生成
用户可在前端实时编辑每个提示词，保存后立即生效。

### 17个功能提示词 (tool_key)
- 基础: text_to_image, image_to_image, inpaint
- 角色: character_tpose, character_directions, character_part_split
- 动画: animation_text, animation_skeleton, animation_frame_extract
- 道具: prop_generate, prop_variant
- UI: ui_layout_generate, ui_component_place, ui_component_split
- 场景: scene_map_generate, scene_map_split

### 模型配置
用户自行配置文本模型（DeepSeek/OpenAI）和图片模型（火山引擎 Seeddream）的 API 信息。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器。

## 开发规范

- 默认按 TypeScript strict 模式编写
- 禁止隐式 any，函数参数必须有类型标注
- 使用 'use client' 配合 useEffect + useState 处理客户端动态内容
- API 调用统一通过 src/lib/api.ts 客户端
