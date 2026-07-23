/**
 * Generation Service
 * Executes AI generation tasks (called by task queue)
 */

import { getSystemPrompt, getDefaultModelConfig } from './store';
import { removeGreenBackground, ensureUploadDir } from './image-processor';
import path from 'path';
import fs from 'fs';

export interface GenerationResult {
  outputUrls: string[];
  enhancedPrompt?: string;
}

/**
 * Execute a generation task
 */
export async function executeGeneration(
  toolKey: string,
  inputParams: Record<string, unknown>,
  onProgress?: (progress: number) => void
): Promise<GenerationResult> {
  onProgress?.(10);

  // Get system prompt for this tool
  const systemPrompt = await getSystemPrompt(toolKey);
  if (!systemPrompt) {
    throw new Error(`No system prompt found for tool: ${toolKey}`);
  }

  onProgress?.(20);

  // Get default text model for prompt enhancement
  const textModel = await getDefaultModelConfig('text');
  if (!textModel) {
    throw new Error('No text model configured. Please add a text model in settings.');
  }

  onProgress?.(30);

  // Get user prompt from input params
  const userPrompt = (inputParams.prompt as string) || '';
  if (!userPrompt) {
    throw new Error('No prompt provided');
  }

  // Enhance prompt using LLM
  const enhancedPrompt = await enhancePrompt(
    systemPrompt.prompt_content,
    userPrompt,
    textModel,
    inputParams
  );

  onProgress?.(50);

  // Get image model for generation
  const imageModel = await getDefaultModelConfig('image');
  if (!imageModel) {
    throw new Error('No image model configured. Please add an image model in settings.');
  }

  onProgress?.(60);

  // Generate image using the image model
  const outputUrls = await generateImage(
    enhancedPrompt,
    imageModel,
    inputParams
  );

  onProgress?.(80);

  // Post-process: download images and remove green background
  const processedUrls = await postProcessImages(outputUrls);

  onProgress?.(90);

  return {
    outputUrls: processedUrls,
    enhancedPrompt,
  };
}

/**
 * Download generated images and remove green background
 */
async function postProcessImages(urls: string[]): Promise<string[]> {
  ensureUploadDir();
  const processed: string[] = [];

  for (const url of urls) {
    try {
      // Download image to local if it's a remote URL
      const localPath = await downloadImage(url);
      // Remove green background
      const transparentUrl = await removeGreenBackground(localPath);
      processed.push(transparentUrl);
    } catch (error) {
      console.error('Post-processing failed for image:', url, error);
      // Fall back to original URL if processing fails
      processed.push(url);
    }
  }

  return processed;
}

/**
 * Download a remote image to local uploads directory
 */
async function downloadImage(url: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');

  // If already a local path, return as-is
  if (url.startsWith('/uploads/')) {
    return url;
  }

  // Handle base64 data URLs
  if (url.startsWith('data:image/')) {
    const base64Data = url.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
  }

  // Download remote URL
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${filename}`;
}

/**
 * Enhance user prompt using LLM
 */
async function enhancePrompt(
  systemPromptContent: string,
  userPrompt: string,
  model: { api_base_url: string; api_key: string; model_name: string },
  context: Record<string, unknown>
): Promise<string> {
  // Replace placeholders in system prompt
  let finalPrompt = systemPromptContent.replace(/\{user_prompt\}/g, userPrompt);

  // Add context info
  if (context.style) {
    finalPrompt += `\n风格要求：${context.style}`;
  }
  if (context.ratio) {
    finalPrompt += `\n图片比例：${context.ratio}`;
  }
  if (context.resolution) {
    finalPrompt += `\n分辨率：${context.resolution}`;
  }
  if (context.pose) {
    finalPrompt += `\n角色姿势：${context.pose}`;
  }

  try {
    const response = await fetch(`${model.api_base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.api_key}`,
      },
      body: JSON.stringify({
        model: model.model_name,
        messages: [
          { role: 'system', content: '你是专业的游戏美术提示词工程师。请根据用户描述生成详细的图片生成提示词。直接输出提示词，不要解释。' },
          { role: 'user', content: finalPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || userPrompt;
  } catch (error) {
    console.error('Prompt enhancement failed:', error);
    // Fall back to original prompt
    return userPrompt;
  }
}

/**
 * Resolve width/height from ratio + resolution params
 */
function resolveDimensions(inputParams: Record<string, unknown>): { width: number; height: number } {
  const resolution = (inputParams.resolution as string) || '1024x1024';
  const ratio = (inputParams.ratio as string) || '1:1';

  // Parse resolution for the base size
  const [resW, resH] = resolution.split('x').map(Number);
  const baseSize = Math.max(resW || 1024, resH || 1024);

  // Parse ratio
  const [ratioW, ratioH] = ratio.split(':').map(Number);
  if (!ratioW || !ratioH) {
    return { width: resW || 1024, height: resH || 1024 };
  }

  // Calculate dimensions based on ratio and base size
  if (ratioW >= ratioH) {
    return { width: baseSize, height: Math.round(baseSize * ratioH / ratioW) };
  } else {
    return { width: Math.round(baseSize * ratioW / ratioH), height: baseSize };
  }
}

/**
 * Generate image using image model
 * Supports text-to-image, image-to-image, and inpainting
 */
async function generateImage(
  prompt: string,
  model: { api_base_url: string; api_key: string; model_name: string; provider: string },
  inputParams: Record<string, unknown>
): Promise<string[]> {
  const { width, height } = resolveDimensions(inputParams);

  // Build request body based on whether we have an input image
  const imageUrl = inputParams.image_url as string | undefined;
  const maskUrl = inputParams.mask_url as string | undefined;

  const body: Record<string, unknown> = {
    model: model.model_name,
    prompt: prompt,
    width,
    height,
    n: 1,
  };

  // Add image for img2img / inpaint workflows
  if (imageUrl) {
    body.image = imageUrl;
  }
  if (maskUrl) {
    body.mask = maskUrl;
  }

  try {
    const response = await fetch(model.api_base_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.api_key}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract image URLs from response
    // Different providers may have different response formats
    const images = data.images || data.data || [];
    const urls = images.map((img: { url?: string; b64_json?: string }) => {
      if (img.url) return img.url;
      if (img.b64_json) return `data:image/png;base64,${img.b64_json}`;
      return null;
    }).filter(Boolean) as string[];

    if (urls.length === 0) {
      throw new Error('No images returned from API');
    }

    return urls;
  } catch (error) {
    console.error('Image generation failed:', error);
    throw error;
  }
}
