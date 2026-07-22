// Shared in-memory data store for all API routes
import type { ModelConfig, SystemPrompt, Project, Generation, Asset } from '@/lib/types';

// ============ Model Configs ============
const modelConfigs: Map<number, ModelConfig> = new Map();
let modelConfigIdCounter = 1;

export function getModelConfigs(): ModelConfig[] {
  return Array.from(modelConfigs.values());
}

export function getModelConfig(id?: number, type?: string): ModelConfig | undefined {
  if (id) return modelConfigs.get(id);
  // Find default model of given type
  return Array.from(modelConfigs.values()).find(
    (m) => m.is_default && (!type || m.type === type)
  );
}

export function addModelConfig(data: Omit<ModelConfig, 'id' | 'created_at' | 'updated_at'>): ModelConfig {
  const now = new Date().toISOString();
  const config: ModelConfig = {
    ...data,
    id: modelConfigIdCounter++,
    created_at: now,
    updated_at: now,
  };
  modelConfigs.set(config.id, config);
  return config;
}

export function updateModelConfig(id: number, data: Partial<ModelConfig>): ModelConfig | undefined {
  const existing = modelConfigs.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
  modelConfigs.set(id, updated);
  return updated;
}

export function deleteModelConfig(id: number): boolean {
  return modelConfigs.delete(id);
}

// ============ System Prompts ============
const defaultPrompts: SystemPrompt[] = [
  { id: 1, tool_key: 'text_to_image', tool_name: '文生图', description: '将用户描述转化为专业的图片生成提示词', prompt_content: '你是游戏美术提示词工程师。将用户的简短描述转化为专业的图片生成提示词。要求：1) 补充细节描述（光影、材质、构图）2) 保持风格一致性 3) 纯色背景，保留主体大小20%的空白边缘 4) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, tool_key: 'image_to_image', tool_name: '图生图', description: '分析编辑意图，生成保持整体风格的修改提示词', prompt_content: '你是游戏美术编辑专家。分析用户的编辑意图，生成精确的图片修改提示词。要求：1) 保持原图整体风格和色调 2) 只修改用户指定的部分 3) 纯色背景，保留主体大小20%的空白边缘 4) 输出中文提示词。用户编辑需求：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, tool_key: 'inpaint', tool_name: '局部重绘', description: '根据遮罩区域和描述，生成仅影响该区域的提示词', prompt_content: '你是局部重绘专家。根据用户指定的遮罩区域和描述，生成仅影响该区域的精确提示词。要求：1) 确保与周围像素风格融合 2) 保持整体色调一致 3) 纯色背景，保留主体大小20%的空白边缘 4) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, tool_key: 'character_tpose', tool_name: 'T-pose角色生成', description: '生成标准T-pose站姿角色的提示词', prompt_content: '你是游戏角色设计师。根据用户描述生成T-pose标准站姿角色。要求：1) 角色正面朝向 2) 双臂平伸呈T字形 3) 包含详细的装备、服饰、配色描述 4) 适合后续制作动画 5) 纯色背景，保留主体大小20%的空白边缘 6) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 5, tool_key: 'character_directions', tool_name: '多方向角色生成', description: '基于单张角色图生成多方向视图', prompt_content: '你是游戏角色设计师。基于提供的角色图，生成{directions}方向视图。要求：1) 保持角色特征、装备、配色完全一致 2) 各角度比例协调 3) 适合游戏sprite使用 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 6, tool_key: 'character_part_split', tool_name: '角色部件拆分', description: '将角色拆分为独立部件层', prompt_content: '你是游戏角色设计师。将角色拆分为独立部件层（如：头部、身体、衣服、裤子、鞋子、武器、配饰等）。要求：1) 每个部件独立可替换 2) 保持风格一致 3) 部件边界清晰 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 7, tool_key: 'animation_text', tool_name: '文字描述动画', description: '根据角色图和动作描述生成动画帧', prompt_content: '你是游戏动画师。根据角色图和动作描述，生成动画帧序列。要求：1) 保持角色在各帧间的一致性 2) 动作流畅自然 3) 帧数：{frame_count}帧 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 8, tool_key: 'animation_skeleton', tool_name: '骨骼动画', description: '根据骨骼控制点生成动画帧', prompt_content: '你是游戏动画师。根据骨骼控制点生成动画帧。要求：1) 遵循骨骼约束 2) 动作自然 3) 保持角色一致性 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 9, tool_key: 'animation_frame_extract', tool_name: '帧提取', description: '从宫格图中提取并排列动画帧序列', prompt_content: '你是游戏动画师。从宫格图中按顺序提取动画帧。要求：1) 按行列顺序提取 2) 帧数：{frame_count}帧 3) 保持帧间连贯性 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 10, tool_key: 'prop_generate', tool_name: '道具生成', description: '根据描述生成游戏道具', prompt_content: '你是游戏道具设计师。根据描述生成游戏道具。要求：1) 包含材质、光影、尺寸比例等细节 2) 风格与游戏一致 3) 适合游戏内使用 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 11, tool_key: 'prop_variant', tool_name: '道具变体衍生', description: '基于已有道具生成变体', prompt_content: '你是游戏道具设计师。基于已有道具生成变体（如不同颜色、材质、品质）。要求：1) 保持道具基本形态 2) 变体间有明显区分 3) 风格一致 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 12, tool_key: 'ui_layout_generate', tool_name: 'UI布局生成', description: '根据描述生成完整UI布局', prompt_content: '你是游戏UI设计师。根据描述生成完整的游戏UI布局。要求：1) 组件层次清晰 2) 视觉引导合理 3) 可读性强 4) 风格与游戏一致 5) 纯色背景，保留主体大小20%的空白边缘 6) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 13, tool_key: 'ui_component_place', tool_name: 'UI组件摆放', description: '调整/自定义UI组件位置与样式', prompt_content: '你是游戏UI设计师。调整UI组件的位置和样式。要求：1) 布局合理 2) 视觉平衡 3) 交互友好 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 14, tool_key: 'ui_component_split', tool_name: 'UI组件拆分', description: '将完整UI拆分为独立组件素材', prompt_content: '你是游戏UI设计师。将完整UI拆分为独立组件（按钮、面板、图标等）。要求：1) 每个组件独立可用 2) 保持风格一致 3) 边界清晰 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 15, tool_key: 'scene_map_generate', tool_name: '场景地图生成', description: '根据描述生成游戏地图', prompt_content: '你是游戏场景设计师。根据描述生成游戏地图。要求：1) 透视关系正确 2) 可tileable（可平铺）3) 元素分布合理 4) 适合游戏实机使用 5) 纯色背景，保留主体大小20%的空白边缘 6) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 16, tool_key: 'scene_map_split', tool_name: '地图组件拆分', description: '将地图拆分为tileset组件', prompt_content: '你是游戏场景设计师。将地图拆分为可复用的tileset组件（地形、建筑、装饰等）。要求：1) 每个组件独立可用 2) 可无缝拼接 3) 风格一致 4) 纯色背景，保留主体大小20%的空白边缘 5) 输出中文提示词。用户描述：{user_prompt}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const prompts: Map<string, SystemPrompt> = new Map();
defaultPrompts.forEach((p) => prompts.set(p.tool_key, p));

export function getAllPrompts(): SystemPrompt[] {
  return Array.from(prompts.values());
}

export function getPromptByToolKey(toolKey: string): SystemPrompt | undefined {
  return prompts.get(toolKey);
}

export function updatePrompt(toolKey: string, content: string): SystemPrompt | undefined {
  const existing = prompts.get(toolKey);
  if (!existing) return undefined;
  const updated = { ...existing, prompt_content: content, updated_at: new Date().toISOString() };
  prompts.set(toolKey, updated);
  return updated;
}

// ============ Projects ============
const projects: Map<number, Project> = new Map();
let projectIdCounter = 1;

export function getProjects(): Project[] {
  return Array.from(projects.values()).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getProject(id: number): Project | undefined {
  return projects.get(id);
}

export function createProject(data: { name: string; description?: string }): Project {
  const now = new Date().toISOString();
  const project: Project = {
    id: projectIdCounter++,
    name: data.name,
    description: data.description || null,
    cover_url: null,
    created_at: now,
    updated_at: now,
  };
  projects.set(project.id, project);
  return project;
}

export function updateProject(id: number, data: Partial<Project>): Project | undefined {
  const existing = projects.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
  projects.set(id, updated);
  return updated;
}

export function deleteProject(id: number): boolean {
  // Also delete related generations and assets
  generations.forEach((g, key) => { if (g.project_id === id) generations.delete(key); });
  assets.forEach((a, key) => { if (a.project_id === id) assets.delete(key); });
  return projects.delete(id);
}

// ============ Generations ============
const generations: Map<number, Generation> = new Map();
let generationIdCounter = 1;

export function getGenerations(projectId?: number): Generation[] {
  let list = Array.from(generations.values());
  if (projectId) list = list.filter((g) => g.project_id === projectId);
  return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function createGeneration(data: Omit<Generation, 'id' | 'created_at'>): Generation {
  const gen: Generation = {
    ...data,
    id: generationIdCounter++,
    created_at: new Date().toISOString(),
  };
  generations.set(gen.id, gen);
  // Update project updated_at
  const project = projects.get(data.project_id);
  if (project) {
    project.updated_at = new Date().toISOString();
  }
  return gen;
}

export function updateGeneration(id: number, data: Partial<Generation>): Generation | undefined {
  const existing = generations.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...data };
  generations.set(id, updated);
  return updated;
}

// ============ Assets ============
const assets: Map<number, Asset> = new Map();
let assetIdCounter = 1;

export function getAssets(projectId?: number, type?: string): Asset[] {
  let list = Array.from(assets.values());
  if (projectId) list = list.filter((a) => a.project_id === projectId);
  if (type) list = list.filter((a) => a.type === type);
  return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function createAsset(data: Omit<Asset, 'id' | 'created_at'>): Asset {
  const asset: Asset = {
    ...data,
    id: assetIdCounter++,
    created_at: new Date().toISOString(),
  };
  assets.set(asset.id, asset);
  return asset;
}

export function updateAsset(id: number, data: Partial<Asset>): Asset | undefined {
  const existing = assets.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...data };
  assets.set(id, updated);
  return updated;
}

export function deleteAsset(id: number): boolean {
  return assets.delete(id);
}
