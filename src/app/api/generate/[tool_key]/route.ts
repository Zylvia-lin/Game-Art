import { NextRequest, NextResponse } from 'next/server';
import { getModelConfig, getDefaultModelConfig, getSystemPrompt, createGeneration } from '@/lib/store';

// Generic generate handler for all tools
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool_key: string }> }
) {
  try {
    const { tool_key } = await params;
    const body = await request.json();
    const { prompt, image_url, mask_url, model_id, project_id, ...extra } = body;

    // Get model config
    let modelConfig;
    if (model_id) {
      modelConfig = await getModelConfig(model_id);
    } else {
      modelConfig = await getDefaultModelConfig('text');
    }
    
    if (!modelConfig) {
      return NextResponse.json(
        { error: '未找到模型配置，请先在模型配置页面添加模型' },
        { status: 400 }
      );
    }

    // Get system prompt
    const systemPrompt = await getSystemPrompt(tool_key);
    if (!systemPrompt) {
      return NextResponse.json(
        { error: `未找到工具 ${tool_key} 的系统提示词` },
        { status: 400 }
      );
    }

    // Step 1: Enhance prompt with LLM
    let enhancedPrompt = prompt;
    try {
      const llmResponse = await callLLM(modelConfig, systemPrompt.prompt_content, prompt);
      if (llmResponse) {
        enhancedPrompt = llmResponse;
      }
    } catch (err) {
      console.warn('LLM prompt enhancement failed, using original prompt:', err);
    }

    // Step 2: Generate image with image model
    const imageModelConfig = await getDefaultModelConfig('image');
    if (!imageModelConfig) {
      // If no image model configured, return the enhanced prompt as a placeholder
      // Still save the generation record
      if (project_id) {
        await createGeneration({
          project_id,
          tool_key,
          input_params: { prompt, ...extra },
          output_urls: [],
          status: 'completed',
        });
      }
      return NextResponse.json({
        success: true,
        data: {
          urls: [],
          enhanced_prompt: enhancedPrompt,
          message: '图片模型未配置，仅返回增强后的提示词。请在模型配置页面添加图片模型。'
        }
      });
    }

    const imageUrls = await callImageModel(imageModelConfig, enhancedPrompt, {
      image_url,
      mask_url,
      ...extra
    });

    // Save generation record
    if (project_id) {
      await createGeneration({
        project_id,
        tool_key,
        input_params: { prompt, ...extra },
        output_urls: imageUrls,
        status: 'completed',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        urls: imageUrls,
        enhanced_prompt: enhancedPrompt
      }
    });
  } catch (error: unknown) {
    console.error('Generate error:', error);
    const message = error instanceof Error ? error.message : '生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Call LLM to enhance prompt
async function callLLM(modelConfig: { api_base_url: string; api_key: string; model_name: string }, systemPrompt: string, userPrompt: string): Promise<string> {
  const baseUrl = modelConfig.api_base_url.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${modelConfig.api_key}`,
    },
    body: JSON.stringify({
      model: modelConfig.model_name,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || userPrompt;
}

// Call image model to generate image
async function callImageModel(
  modelConfig: { api_base_url: string; api_key: string; model_name: string },
  prompt: string,
  options: { image_url?: string; mask_url?: string; [key: string]: unknown }
): Promise<string[]> {
  const url = modelConfig.api_base_url;

  const body: Record<string, unknown> = {
    model: modelConfig.model_name,
    prompt,
  };

  if (options.image_url) body.image = options.image_url;
  if (options.mask_url) body.mask = options.mask_url;
  if (options.size) body.size = options.size;
  if (options.n) body.n = options.n;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${modelConfig.api_key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Image model API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.data?.map((item: { url?: string; b64_json?: string }) => item.url || `data:image/png;base64,${item.b64_json}`) || [];
}
