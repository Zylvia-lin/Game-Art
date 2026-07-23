export interface ModelConfig {
  id: string;
  type: 'text' | 'image' | 'video';
  name: string;
  provider: string;
  api_base_url: string;
  api_key: string;
  model_name: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ModelConfigCreate {
  type: 'text' | 'image' | 'video';
  name: string;
  provider: string;
  api_base_url: string;
  api_key: string;
  model_name: string;
  is_default: boolean;
}

export interface SystemPrompt {
  id: string;
  tool_key: string;
  tool_name: string;
  description: string | null;
  prompt_content: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  style: string;
  created_at: string;
  updated_at: string;
}

export interface Generation {
  id: string;
  project_id: string;
  tool_key: string;
  input_params: Record<string, unknown> | null;
  output_urls: string[] | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  project_id: string;
  generation_id: string | null;
  name: string;
  description: string;
  type: 'character' | 'prop' | 'ui' | 'scene' | 'animation_frame' | 'image';
  url: string;
  metadata_: Record<string, unknown> | null;
  finalized: boolean;
  created_at: string;
}

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Task {
  id: string;
  project_id: string;
  tool_key: string;
  input_params: Record<string, unknown>;
  status: TaskStatus;
  output_urls: string[];
  error_message: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface GenerateRequest {
  project_id: string;
  prompt: string;
  model_id?: string;
  [key: string]: unknown;
}

export interface GenerateResponse {
  status: string;
  task_id: string;
  message: string;
}

export const ART_STYLES = [
  { value: 'anime', label: '二次元' },
  { value: 'pixel', label: '像素风' },
  { value: 'realistic', label: '写实' },
  { value: 'oil_painting', label: '油画' },
  { value: 'watercolor', label: '水彩' },
  { value: 'sketch', label: '素描' },
  { value: 'low_poly', label: 'Low Poly' },
  { value: 'cyberpunk', label: '赛博朋克' },
  { value: 'fantasy', label: '奇幻' },
  { value: 'chinese', label: '国风' },
] as const;

// Seedream 5.0 Pro 支持的比例
export const RATIO_OPTIONS = [
  { value: '1:1', label: '1:1', width: 1024, height: 1024 },
  { value: '3:4', label: '3:4', width: 768, height: 1024 },
  { value: '4:3', label: '4:3', width: 1024, height: 768 },
  { value: '9:16', label: '9:16', width: 576, height: 1024 },
  { value: '16:9', label: '16:9', width: 1024, height: 576 },
  { value: '2:3', label: '2:3', width: 682, height: 1024 },
  { value: '3:2', label: '3:2', width: 1024, height: 682 },
] as const;

// Seedream 5.0 Pro 各比例下的分辨率档位
export const RESOLUTION_MAP: Record<string, { value: string; label: string; desc: string }[]> = {
  '1:1': [
    { value: '1024x1024', label: '1K', desc: '1024×1024' },
    { value: '960x960', label: '1K', desc: '960×960' },
    { value: '1280x1280', label: '1.5K', desc: '1280×1280' },
  ],
  '3:4': [
    { value: '768x1024', label: '1K', desc: '768×1024' },
    { value: '864x1152', label: '1K', desc: '864×1152' },
    { value: '960x1280', label: '1.2K', desc: '960×1280' },
  ],
  '4:3': [
    { value: '1024x768', label: '1K', desc: '1024×768' },
    { value: '1152x864', label: '1K', desc: '1152×864' },
    { value: '1280x960', label: '1.2K', desc: '1280×960' },
  ],
  '9:16': [
    { value: '576x1024', label: '1K', desc: '576×1024' },
    { value: '648x1152', label: '1K', desc: '648×1152' },
    { value: '720x1280', label: '1K', desc: '720×1280' },
  ],
  '16:9': [
    { value: '1024x576', label: '1K', desc: '1024×576' },
    { value: '1152x648', label: '1K', desc: '1152×648' },
    { value: '1280x720', label: '1K', desc: '1280×720' },
  ],
  '2:3': [
    { value: '682x1024', label: '1K', desc: '682×1024' },
    { value: '768x1152', label: '1K', desc: '768×1152' },
    { value: '852x1280', label: '1K', desc: '852×1280' },
  ],
  '3:2': [
    { value: '1024x682', label: '1K', desc: '1024×682' },
    { value: '1152x768', label: '1K', desc: '1152×768' },
    { value: '1280x852', label: '1K', desc: '1280×852' },
  ],
};

// 侧边栏 - 创作工具
export const CREATION_ITEMS = [
  { key: 'character', label: '角色生成', href: '/character', icon: 'User' },
  { key: 'animation', label: '动画生成', href: '/animation', icon: 'Film' },
  { key: 'prop', label: '道具生成', href: '/prop', icon: 'Sword' },
  { key: 'ui', label: 'UI生成', href: '/ui', icon: 'Layout' },
  { key: 'scene', label: '场景生成', href: '/scene', icon: 'Map' },
] as const;

// 侧边栏 - 工具箱
export const TOOLBOX_ITEMS = [
  { key: 'text2img', label: '文生图', href: '/text2img', icon: 'Image' },
  { key: 'img2img', label: '图生图', href: '/img2img', icon: 'ImagePlus' },
  { key: 'inpaint', label: '局部重绘', href: '/inpaint', icon: 'Paintbrush' },
  { key: 'animation', label: '帧提取', href: '/animation', icon: 'Film' },
] as const;

// 工具页面 key 映射
export const TOOL_KEY_MAP: Record<string, string> = {
  text2img: 'text2img',
  img2img: 'img2img',
  inpaint: 'inpaint',
  character_tpose: 'character_tpose',
  character_three_view: 'character_three_view',
  character_directions: 'character_directions',
  character_part_split: 'character_part_split',
  prop_original: 'prop_original',
  prop_variant: 'prop_variant',
  component_place: 'component_place',
  component_split: 'component_split',
  scene_map: 'scene_map',
  scene_map_split: 'scene_map_split',
  animation_action: 'animation_action',
};

// 面包屑导航 - 工具项
export const TOOL_NAV_ITEMS = [
  { label: '角色生成', href: '/character' },
  { label: '动画生成', href: '/animation' },
  { label: '道具生成', href: '/prop' },
  { label: 'UI生成', href: '/ui' },
  { label: '场景生成', href: '/scene' },
  { label: '文生图', href: '/text2img' },
  { label: '图生图', href: '/img2img' },
  { label: '局部重绘', href: '/inpaint' },
] as const;

// 兼容别名
export const IMAGE_RATIOS = RATIO_OPTIONS;

// 获取指定比例下的分辨率选项
export function getResolutionOptions(ratio: string) {
  return RESOLUTION_MAP[ratio] || RESOLUTION_MAP['1:1'];
}

// 获取指定比例下的默认分辨率
export function getDefaultResolution(ratio: string) {
  const options = getResolutionOptions(ratio);
  return options[0]?.value || '1024x1024';
}

// 工具名称映射
export const TOOL_NAME_MAP: Record<string, string> = {
  text2img: '文生图',
  img2img: '图生图',
  inpaint: '局部重绘',
  character_tpose: '角色T-Pose',
  character_three_view: '角色三视图',
  character_directions: '角色多方向',
  character_part_split: '角色拆分',
  prop_original: '道具原创',
  prop_variant: '道具变体',
  component_place: 'UI组件放置',
  component_split: 'UI组件拆分',
  scene_map: '场景地图',
  scene_map_split: '场景地图拆分',
  animation_action: '动作生成',
};
