import { NextRequest, NextResponse } from 'next/server';

// In-memory storage (shared with /api/prompts/route.ts via module scope)
const prompts: Map<string, any> = new Map();

// Initialize with defaults (same as /api/prompts/route.ts)
const defaultPrompts = [
  { tool_key: 'text_to_image', tool_name: '文生图', prompt_content: '你是游戏美术提示词工程师。将用户的简短描述转化为专业的图片生成提示词。要求：1) 补充细节描述（光影、材质、构图）2) 保持风格一致性 3) 纯色背景，保留主体大小20%的空白边缘 4) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'image_to_image', tool_name: '图生图', prompt_content: '你是游戏美术编辑专家。分析用户的编辑意图，生成精确的图片修改提示词。要求：1) 保持原图整体风格和色调 2) 只修改用户指定的部分 3) 纯色背景，保留主体大小20%的空白边缘 4) 输出中文提示词。用户编辑需求：{user_prompt}' },
  { tool_key: 'inpaint', tool_name: '局部重绘', prompt_content: '你是局部重绘专家。根据用户指定的遮罩区域和描述，生成仅影响该区域的精确提示词。要求：1) 确保与周围像素风格融合 2) 保持整体色调一致 3) 纯色背景，保留主体大小20%的空白边缘 4) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'character_tpose', tool_name: 'T-pose角色生成', prompt_content: '你是游戏角色设计师。根据用户描述生成T-pose标准站姿角色。要求：1) 角色正面朝向 2) 双臂平伸呈T字形 3) 包含详细的装备、服饰、配色描述 4) 适合后续制作动画 5) 纯色背景，保留主体大小20%的空白边缘 6) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'character_directions', tool_name: '多方向角色生成', prompt_content: '你是游戏角色设计师。基于提供的角色图，生成{directions}方向视图。要求：1) 保持角色特征、装备、配色完全一致 2) 各角度比例协调 3) 适合游戏sprite使用 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'character_part_split', tool_name: '角色部件拆分', prompt_content: '你是游戏角色设计师。将角色拆分为独立部件层（如：头部、身体、衣服、裤子、鞋子、武器、配饰等）。要求：1) 每个部件独立可替换 2) 保持风格一致 3) 部件边界清晰 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'animation_text', tool_name: '文字描述动画', prompt_content: '你是游戏动画师。根据角色图和动作描述，生成动画帧序列。要求：1) 保持角色在各帧间的一致性 2) 动作流畅自然 3) 帧数：{frame_count}帧 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'animation_skeleton', tool_name: '骨骼动画', prompt_content: '你是游戏动画师。根据骨骼控制点生成动画帧。要求：1) 遵循骨骼约束 2) 动作自然 3) 保持角色一致性 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'animation_frame_extract', tool_name: '帧提取', prompt_content: '你是游戏动画师。从宫格图中按顺序提取动画帧。要求：1) 按行列顺序提取 2) 帧数：{frame_count}帧 3) 保持帧间连贯性 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'prop_generate', tool_name: '道具生成', prompt_content: '你是游戏道具设计师。根据描述生成游戏道具。要求：1) 包含材质、光影、尺寸比例等细节 2) 风格与游戏一致 3) 适合游戏内使用 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'prop_variant', tool_name: '道具变体衍生', prompt_content: '你是游戏道具设计师。基于已有道具生成变体（如不同颜色、材质、品质）。要求：1) 保持道具基本形态 2) 变体间有明显区分 3) 风格一致 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'ui_layout_generate', tool_name: 'UI布局生成', prompt_content: '你是游戏UI设计师。根据描述生成完整的游戏UI布局。要求：1) 组件层次清晰 2) 视觉引导合理 3) 可读性强 4) 风格与游戏一致 5) 纯色背景，保留主体大小20%的空白边缘 6) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'ui_component_place', tool_name: 'UI组件摆放', prompt_content: '你是游戏UI设计师。调整UI组件的位置和样式。要求：1) 布局合理 2) 视觉平衡 3) 交互友好 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'ui_component_split', tool_name: 'UI组件拆分', prompt_content: '你是游戏UI设计师。将完整UI拆分为独立组件（按钮、面板、图标等）。要求：1) 每个组件独立可用 2) 保持风格一致 3) 边界清晰 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'scene_map_generate', tool_name: '场景地图生成', prompt_content: '你是游戏场景设计师。根据描述生成游戏地图。要求：1) 透视关系正确 2) 可tileable（可平铺）3) 元素分布合理 4) 适合游戏实机使用 5) 纯色背景，保留主体大小20%的空白边缘 6) 输出中文提示词。用户描述：{user_prompt}' },
  { tool_key: 'scene_map_split', tool_name: '地图组件拆分', prompt_content: '你是游戏场景设计师。将地图拆分为可复用的tileset组件（地形、建筑、装饰等）。要求：1) 每个组件独立可用 2) 可无缝拼接 3) 风格一致 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}' },
];

defaultPrompts.forEach((p) => {
  prompts.set(p.tool_key, {
    id: prompts.size + 1,
    ...p,
    description: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});

// GET /api/prompts/[tool_key] - Get prompt by tool_key
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool_key: string }> }
) {
  const { tool_key } = await params;
  const prompt = prompts.get(tool_key);
  
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
  }
  
  return NextResponse.json(prompt);
}

// PUT /api/prompts/[tool_key] - Update prompt
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tool_key: string }> }
) {
  const { tool_key } = await params;
  const prompt = prompts.get(tool_key);
  
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
  }
  
  try {
    const body = await request.json();
    const updated = {
      ...prompt,
      ...body,
      updated_at: new Date().toISOString(),
    };
    prompts.set(tool_key, updated);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
