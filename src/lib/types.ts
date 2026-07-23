export interface ModelConfig {
  id: number;
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
  id: number;
  tool_key: string;
  tool_name: string;
  description: string | null;
  prompt_content: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  cover_url: string | null;
  style: string;
  created_at: string;
  updated_at: string;
}

export interface Generation {
  id: number;
  project_id: number;
  tool_key: string;
  input_params: Record<string, unknown> | null;
  output_urls: string[] | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface Asset {
  id: number;
  project_id: number;
  generation_id: number | null;
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
  id: number;
  project_id: number;
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
  project_id: number;
  prompt: string;
  model_id?: number;
  [key: string]: unknown;
}

export interface GenerateResponse {
  status: string;
  task_id: number;
  message: string;
}

export const ART_STYLES = [
  { value: 'anime', label: '二次元' },
  { value: 'pixel', label: '像素风' },
  { value: 'realistic', label: '写实' },
  { value: 'cyberpunk', label: '赛博朋克' },
  { value: 'fantasy', label: '奇幻' },
  { value: 'sci_fi', label: '科幻' },
  { value: 'cartoon', label: '卡通' },
  { value: 'watercolor', label: '水彩' },
  { value: '8bit', label: '8-bit 复古' },
  { value: '16bit', label: '16-bit 复古' },
] as const;

export const IMAGE_RATIOS = [
  { value: '1:1', label: '1:1', width: 1024, height: 1024 },
  { value: '16:9', label: '16:9', width: 1920, height: 1080 },
  { value: '9:16', label: '9:16', width: 1080, height: 1920 },
  { value: '4:3', label: '4:3', width: 1365, height: 1024 },
  { value: '3:4', label: '3:4', width: 1024, height: 1365 },
] as const;

export interface ResolutionOption {
  value: string;
  label: string;
  width: number;
  height: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';
}

export const RESOLUTION_MAP: Record<string, ResolutionOption[]> = {
  '1:1': [
    { value: '512x512', label: '512 × 512', width: 512, height: 512, quality: 'low' },
    { value: '768x768', label: '768 × 768', width: 768, height: 768, quality: 'medium' },
    { value: '1024x1024', label: '1024 × 1024', width: 1024, height: 1024, quality: 'high' },
    { value: '1536x1536', label: '1536 × 1536', width: 1536, height: 1536, quality: 'high' },
    { value: '2048x2048', label: '2048 × 2048', width: 2048, height: 2048, quality: 'ultra' },
  ],
  '16:9': [
    { value: '640x360', label: '640 × 360', width: 640, height: 360, quality: 'low' },
    { value: '854x480', label: '854 × 480', width: 854, height: 480, quality: 'low' },
    { value: '1280x720', label: '1280 × 720 (HD)', width: 1280, height: 720, quality: 'medium' },
    { value: '1920x1080', label: '1920 × 1080 (FHD)', width: 1920, height: 1080, quality: 'high' },
    { value: '2560x1440', label: '2560 × 1440 (2K)', width: 2560, height: 1440, quality: 'ultra' },
  ],
  '9:16': [
    { value: '360x640', label: '360 × 640', width: 360, height: 640, quality: 'low' },
    { value: '480x854', label: '480 × 854', width: 480, height: 854, quality: 'low' },
    { value: '720x1280', label: '720 × 1280 (HD)', width: 720, height: 1280, quality: 'medium' },
    { value: '1080x1920', label: '1080 × 1920 (FHD)', width: 1080, height: 1920, quality: 'high' },
    { value: '1440x2560', label: '1440 × 2560 (2K)', width: 1440, height: 2560, quality: 'ultra' },
  ],
  '4:3': [
    { value: '640x480', label: '640 × 480', width: 640, height: 480, quality: 'low' },
    { value: '960x720', label: '960 × 720', width: 960, height: 720, quality: 'low' },
    { value: '1024x768', label: '1024 × 768', width: 1024, height: 768, quality: 'medium' },
    { value: '1365x1024', label: '1365 × 1024', width: 1365, height: 1024, quality: 'high' },
    { value: '2048x1536', label: '2048 × 1536', width: 2048, height: 1536, quality: 'ultra' },
  ],
  '3:4': [
    { value: '480x640', label: '480 × 640', width: 480, height: 640, quality: 'low' },
    { value: '720x960', label: '720 × 960', width: 720, height: 960, quality: 'low' },
    { value: '768x1024', label: '768 × 1024', width: 768, height: 1024, quality: 'medium' },
    { value: '1024x1365', label: '1024 × 1365', width: 1024, height: 1365, quality: 'high' },
    { value: '1536x2048', label: '1536 × 2048', width: 1536, height: 2048, quality: 'ultra' },
  ],
};

export function getDefaultResolution(ratio: string): string {
  const options = RESOLUTION_MAP[ratio];
  if (!options || options.length === 0) return '1024x1024';
  // Default to medium quality, or middle option
  const medium = options.find(o => o.quality === 'medium');
  return medium ? medium.value : options[Math.floor(options.length / 2)].value;
}

export function getResolutionOptions(ratio: string): ResolutionOption[] {
  return RESOLUTION_MAP[ratio] || RESOLUTION_MAP['1:1'];
}

export const TOOLBOX_ITEMS = [
  { key: 'text2img', label: '文生图', href: '/text2img', icon: 'Image' },
  { key: 'img2img', label: '图生图', href: '/img2img', icon: 'ImagePlus' },
  { key: 'inpaint', label: '局部重绘', href: '/inpaint', icon: 'Paintbrush' },
] as const;

export const CREATION_ITEMS = [
  { key: 'character', label: '角色生成', href: '/character', icon: 'User' },
  { key: 'animation', label: '动画生成', href: '/animation', icon: 'Film' },
  { key: 'prop', label: '道具生成', href: '/prop', icon: 'Sword' },
  { key: 'ui', label: 'UI生成', href: '/ui', icon: 'Layout' },
  { key: 'scene', label: '场景生成', href: '/scene', icon: 'Map' },
] as const;

export const TOOL_NAV_ITEMS = [
  ...TOOLBOX_ITEMS,
  ...CREATION_ITEMS,
  { key: 'assets', label: '资产库', href: '/assets', icon: 'FolderOpen' },
] as const;

export const TOOL_KEY_MAP: Record<string, string> = {
  text2img: 'text_to_image',
  img2img: 'image_to_image',
  inpaint: 'inpaint',
  character_tpose: 'character_tpose',
  character_directions: 'character_directions',
  character_three_view: 'character_three_view',
  character_part_split: 'character_part_split',
  animation_text: 'animation_text',
  animation_frame_extract: 'animation_frame_extract',
  prop_generate: 'prop_generate',
  prop_variant: 'prop_variant',
  ui_layout_generate: 'ui_layout_generate',
  ui_component_place: 'ui_component_place',
  ui_component_split: 'ui_component_split',
  scene_map_generate: 'scene_map_generate',
  scene_map_split: 'scene_map_split',
};
