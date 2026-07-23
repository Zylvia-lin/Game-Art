/**
 * Generation Service
 * Executes AI generation tasks (called by task queue)
 */

import { getSystemPrompt, getDefaultModelConfig } from './store';

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
  
  onProgress?.(90);
  
  return {
    outputUrls,
    enhancedPrompt,
  };
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
  if (context.resolution) {
    finalPrompt += `\n分辨率：${context.resolution}`;
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
 * Generate image using image model
 */
async function generateImage(
  prompt: string,
  model: { api_base_url: string; api_key: string; model_name: string; provider: string },
  inputParams: Record<string, unknown>
): Promise<string[]> {
  const resolution = (inputParams.resolution as string) || '1024x1024';
  const [width, height] = resolution.split('x').map(Number);
  
  try {
    // Call image generation API (Volcano Seeddream compatible)
    const response = await fetch(model.api_base_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.api_key}`,
      },
      body: JSON.stringify({
        model: model.model_name,
        prompt: prompt,
        width: width || 1024,
        height: height || 1024,
        n: 1,
      }),
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
