import { NextRequest, NextResponse } from 'next/server';
import { getPromptByToolKey, updatePrompt } from '@/lib/store';

// GET /api/prompts/[tool_key] - Get a specific system prompt
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool_key: string }> }
) {
  const { tool_key } = await params;
  const prompt = getPromptByToolKey(tool_key);
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
  }
  return NextResponse.json(prompt);
}

// PUT /api/prompts/[tool_key] - Update a specific system prompt
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tool_key: string }> }
) {
  try {
    const { tool_key } = await params;
    const body = await request.json();
    const updated = updatePrompt(tool_key, body.prompt_content);
    if (!updated) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
