export interface ModelConfig {
  id: string;
  type: 'text' | 'image' | 'video' | 'tool';
  name: string;
  provider: string;
  api_base_url: string;
  api_key: string;
  model_name: string;
  is_default: boolean;
  input_price: number;
  output_price: number;
  output_price_high: number;
  pixel_threshold: number;
  price_unit: 'per_image' | 'per_1M_tokens' | 'per_1k_calls';
  created_at?: string;
  updated_at?: string;
}

export interface ModelConfigCreate {
  type: 'text' | 'image' | 'video' | 'tool';
  name: string;
  provider: string;
  api_base_url: string;
  api_key: string;
  model_name: string;
  is_default: boolean;
  input_price?: number;
  output_price?: number;
  output_price_high?: number;
  pixel_threshold?: number;
  price_unit?: string;
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
  type: 'character' | 'prop' | 'ui' | 'scene' | 'animation_frame' | 'image' | string;
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
  output_names?: string[];
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

// Seedream 4.0/4.5 支持的宽高比
export const RATIO_OPTIONS = [
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '21:9', label: '21:9' },
] as const;

// 分辨率档位（总像素目标值）
// API 约束: 总像素 [921600, 4194304], 宽高比 [1/16, 16]
export const RESOLUTION_TIERS = [
  { value: '720p', label: '720p', targetPixels: 921600 },
  { value: '1080p', label: '1080p', targetPixels: 2073600 },
  { value: '2K', label: '2K', targetPixels: 3686400 },
  { value: '4K', label: '4K', targetPixels: 4194304 },
] as const;

export type ResolutionTier = typeof RESOLUTION_TIERS[number]['value'];

const MIN_PIXELS = 921600;
const MAX_PIXELS = 4194304;

/**
 * 根据宽高比和分辨率档位，计算实际的宽x高像素值。
 * 使用 target_pixels / aspect_ratio 开方得到高度，再乘以比例得到宽度。
 * 结果四舍五入到最近的 8 的倍数，并确保总像素在 API 允许范围内。
 */
export function computeSize(ratio: string, tier: string): string {
  const tierConfig = RESOLUTION_TIERS.find((t) => t.value === tier);
  const targetPixels = tierConfig?.targetPixels ?? 3686400;

  const parts = ratio.split(':').map(Number);
  if (parts.length !== 2 || parts[0] <= 0 || parts[1] <= 0) {
    return '2048x2048';
  }
  const aspectRatio = parts[0] / parts[1];

  let height = Math.round(Math.sqrt(targetPixels / aspectRatio));
  let width = Math.round(height * aspectRatio);

  // 四舍五入到最近的 8 的倍数
  height = Math.round(height / 8) * 8;
  width = Math.round(width / 8) * 8;

  // 确保宽高比在 [1/16, 16] 范围内
  const actualRatio = width / height;
  if (actualRatio > 16) {
    height = Math.round(width / 16 / 8) * 8;
  } else if (actualRatio < 1 / 16) {
    width = Math.round(height / 16 / 8) * 8;
  }

  // 确保总像素在 [MIN_PIXELS, MAX_PIXELS] 范围内
  let totalPixels = width * height;
  if (totalPixels < MIN_PIXELS) {
    const scale = Math.sqrt(MIN_PIXELS / totalPixels);
    height = Math.round((height * scale) / 8) * 8;
    width = Math.round((height * aspectRatio) / 8) * 8;
  } else if (totalPixels > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / totalPixels);
    height = Math.round((height * scale) / 8) * 8;
    width = Math.round((height * aspectRatio) / 8) * 8;
  }

  return `${width}x${height}`;
}

// 侧边栏 - 创作工具
export const CREATION_ITEMS = [
  { key: 'character', label: '角色生成', href: '/character', icon: 'User' },
  { key: 'animation', label: '动画生成', href: '/animation', icon: 'Film' },
  { key: 'prop', label: '道具生成', href: '/prop', icon: 'Sword' },
  { key: 'ui', label: 'UI生成', href: '/ui', icon: 'Layout' },
  { key: 'scene', label: '场景生成', href: '/scene', icon: 'Map' },
] as const;

// 侧边栏 - 基础工具
export const BASIC_TOOLS_ITEMS = [
  { key: 'text2img', label: '文生图', href: '/text2img', icon: 'Image' },
  { key: 'img2img', label: '图生图', href: '/img2img', icon: 'ImagePlus' },
] as const;

// 侧边栏 - 工具箱
export const TOOLBOX_ITEMS = [
  { key: 'image-edit', label: '图片编辑', href: '/image-edit', icon: 'Paintbrush' },
  { key: 'remove-bg', label: '去除背景', href: '/remove-bg', icon: 'Eraser' },
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
  { label: '图片编辑', href: '/image-edit' },
  { label: '去除背景', href: '/remove-bg' },
] as const;

// 兼容别名
export const IMAGE_RATIOS = RATIO_OPTIONS;

// 获取分辨率档位列表
export function getResolutionOptions(_ratio: string) {
  return RESOLUTION_TIERS;
}

// 获取默认分辨率档位
export function getDefaultResolution(_ratio: string) {
  return '2K';
}

// ── 定价计算 ──────────────────────────────────
// Seedream 官方定价：
//   输入图：0.02 元/张
//   输出图 ≤ 236万像素：0.30 元/张
//   输出图 > 236万像素：0.60 元/张
const PIXEL_THRESHOLD = 2_360_000;
const INPUT_PRICE = 0.02;
const OUTPUT_PRICE_LOW = 0.30;
const OUTPUT_PRICE_HIGH = 0.60;

/**
 * 根据分辨率档位计算输出图单价
 */
export function getOutputPrice(tier: string): number {
  const tierConfig = RESOLUTION_TIERS.find((t) => t.value === tier);
  const pixels = tierConfig?.targetPixels ?? 3686400;
  return pixels <= PIXEL_THRESHOLD ? OUTPUT_PRICE_LOW : OUTPUT_PRICE_HIGH;
}

/**
 * 计算单次生成的预估费用
 * @param tier 分辨率档位
 * @param outputCount 输出图数量（默认 1）
 * @param inputCount 输入图数量（默认 0）
 */
export function estimateCost(tier: string, outputCount = 1, inputCount = 0): number {
  const outputPrice = getOutputPrice(tier);
  return round(inputCount * INPUT_PRICE + outputCount * outputPrice);
}

/**
 * 根据分辨率字符串（如 "1920x1080"）计算预估费用
 */
export function estimateCostFromResolution(resolution: string, outputCount = 1, inputCount = 0): number {
  const outputPrice = getOutputPriceFromResolution(resolution);
  return round(inputCount * INPUT_PRICE + outputCount * outputPrice);
}

/**
 * 格式化费用为显示字符串
 */
export function formatCostDisplay(cost: number): string {
  return `¥${cost.toFixed(2)}`;
}

/**
 * 根据分辨率字符串（如 "1920x1080"）计算输出图单价
 */
export function getOutputPriceFromResolution(resolution: string): number {
  if (!resolution || !resolution.includes('x')) return OUTPUT_PRICE_HIGH;
  const parts = resolution.toLowerCase().split('x');
  const pixels = parseInt(parts[0]) * parseInt(parts[1]);
  return pixels <= PIXEL_THRESHOLD ? OUTPUT_PRICE_LOW : OUTPUT_PRICE_HIGH;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── 模型驱动定价（新）──────────────────────────────────

/**
 * 基于模型配置计算预估费用。
 * 对 image 模型使用 per_image 定价，对 text 模型使用 per_1M_tokens。
 * 当 model 为 null 或价格为 0 时，回退到旧的硬编码定价。
 */
export function estimateCostFromModel(
  model: ModelConfig | null,
  resolution: string,
  outputCount: number = 1,
  inputCount: number = 0,
): number {
  // Fallback to old hardcoded pricing when no model at all
  if (!model) {
    return estimateCost(resolution, outputCount, inputCount);
  }

  // Use model pricing directly; 0 means free / not configured
  const inputPrice = model.input_price ?? 0;
  let outputPrice = model.output_price ?? 0;
  if (model.output_price_high > 0 && model.pixel_threshold > 0) {
    const tierConfig = RESOLUTION_TIERS.find((t) => t.value === resolution);
    const pixels = tierConfig?.targetPixels ?? 0;
    // Also handle WxH format
    if (resolution.includes('x')) {
      const parts = resolution.split('x').map(Number);
      const px = parts[0] * parts[1];
      if (px > model.pixel_threshold) {
        outputPrice = model.output_price_high;
      }
    } else if (pixels > model.pixel_threshold) {
      outputPrice = model.output_price_high;
    }
  }

  return round(inputCount * inputPrice + outputCount * outputPrice);
}

/**
 * 基于模型配置 + 像素数计算预估费用。
 * 用于 image-edit 等已知像素数的场景。
 */
export function estimateCostFromModelWithPixels(
  model: ModelConfig | null,
  totalPixels: number,
  outputCount: number = 1,
  inputCount: number = 0,
): number {
  if (!model) {
    return estimateCostFromPixels(totalPixels, outputCount, inputCount);
  }

  const inputPrice = model.input_price ?? 0;
  let outputPrice = model.output_price ?? 0;

  return round(inputCount * inputPrice + outputCount * outputPrice);
}


// ── 图生图"使用原图"相关辅助 ────────────────────

/**
 * 从图片宽高推导最简比例字符串，并匹配到最接近的预设比例
 * 如果原图比例与所有预设比例差异都很大，则返回最接近的那个
 */
export function deriveRatio(w: number, h: number): string {
  const actual = w / h;
  let best: typeof RATIO_OPTIONS[number] = RATIO_OPTIONS[0];
  let bestDiff = Infinity;
  for (const opt of RATIO_OPTIONS) {
    const [ow, oh] = opt.value.split(':').map(Number);
    const optRatio = ow / oh;
    const diff = Math.abs(actual - optRatio);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = opt;
    }
  }
  return best.value;
}

/**
 * 将宽高 clamp 到 API 允许范围 [921600, 4194304] 像素，宽高比 [1/16, 16]，
 * 并四舍五入到 8 的倍数
 */
export function clampDimensions(w: number, h: number): { w: number; h: number } {
  let rw = Math.round(w / 8) * 8;
  let rh = Math.round(h / 8) * 8;
  if (rw <= 0) rw = 8;
  if (rh <= 0) rh = 8;

  // 限制宽高比在 [1/16, 16] 范围内
  const aspectRatio = rw / rh;
  if (aspectRatio > 16) {
    rh = Math.round(rw / 16 / 8) * 8;
  } else if (aspectRatio < 1 / 16) {
    rw = Math.round(rh / 16 / 8) * 8;
  }

  // 限制总像素在 [MIN_PIXELS, MAX_PIXELS] 范围内
  const total = rw * rh;
  if (total < MIN_PIXELS) {
    const scale = Math.sqrt(MIN_PIXELS / total);
    rh = Math.round((rh * scale) / 8) * 8;
    rw = Math.round((rh * (w / h)) / 8) * 8;
  } else if (total > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / total);
    rh = Math.round((rh * scale) / 8) * 8;
    rw = Math.round((rh * (w / h)) / 8) * 8;
  }

  return { w: rw, h: rh };
}

/**
 * 根据总像素数计算预估费用
 */
export function estimateCostFromPixels(totalPixels: number, outputCount = 1, inputCount = 0): number {
  const outputPrice = totalPixels <= PIXEL_THRESHOLD ? OUTPUT_PRICE_LOW : OUTPUT_PRICE_HIGH;
  return round(inputCount * INPUT_PRICE + outputCount * outputPrice);
}

/**
 * 找到最接近给定像素数的预设分辨率档位
 * 用于"默认分辨率"模式：将原图像素匹配到最接近的标准档位
 */
export function findClosestTier(targetPixels: number): ResolutionTier {
  let best: ResolutionTier = '1080p';
  let bestDiff = Infinity;
  for (const tier of RESOLUTION_TIERS) {
    const tierPixels = tier.targetPixels;
    const diff = Math.abs(tierPixels - targetPixels);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = tier.value;
    }
  }
  return best;
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
