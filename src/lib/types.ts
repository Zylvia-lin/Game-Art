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
  type: 'character' | 'prop' | 'ui' | 'scene' | 'animation_frame' | 'image';
  url: string;
  metadata_: Record<string, unknown> | null;
  finalized: boolean;
  created_at: string;
}

export interface GenerateRequest {
  project_id: number;
  prompt: string;
  model_id?: number;
  [key: string]: unknown;
}

export interface GenerateResponse {
  status: string;
  generation_id: number;
  output_urls: string[];
  enhanced_prompt?: string;
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

export const RESOLUTIONS = [
  { value: '512x512', label: '512 x 512' },
  { value: '1024x1024', label: '1024 x 1024' },
  { value: '1920x1080', label: '1920 x 1080' },
  { value: '2048x2048', label: '2048 x 2048' },
] as const;

export const TOOL_NAV_ITEMS = [
  { key: 'text2img', label: '文生图', href: '/text2img', icon: 'Image' },
  { key: 'img2img', label: '图生图', href: '/img2img', icon: 'ImagePlus' },
  { key: 'inpaint', label: '局部重绘', href: '/inpaint', icon: 'Paintbrush' },
  { key: 'character', label: '角色生成', href: '/character', icon: 'User' },
  { key: 'animation', label: '动画生成', href: '/animation', icon: 'Film' },
  { key: 'prop', label: '道具生成', href: '/prop', icon: 'Sword' },
  { key: 'ui', label: 'UI生成', href: '/ui', icon: 'Layout' },
  { key: 'scene', label: '场景生成', href: '/scene', icon: 'Map' },
  { key: 'assets', label: '资产库', href: '/assets', icon: 'FolderOpen' },
] as const;

export const TOOL_KEY_MAP: Record<string, string> = {
  text2img: 'text_to_image',
  img2img: 'image_to_image',
  inpaint: 'inpaint',
  character_tpose: 'character_tpose',
  character_directions: 'character_directions',
  character_part_split: 'character_part_split',
  animation_text: 'animation_text',
  animation_skeleton: 'animation_skeleton',
  animation_frame_extract: 'animation_frame_extract',
  prop_generate: 'prop_generate',
  prop_variant: 'prop_variant',
  ui_layout_generate: 'ui_layout_generate',
  ui_component_place: 'ui_component_place',
  ui_component_split: 'ui_component_split',
  scene_map_generate: 'scene_map_generate',
  scene_map_split: 'scene_map_split',
};
