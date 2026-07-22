import { NextRequest, NextResponse } from 'next/server';
import { getSystemPrompt, updateSystemPrompt } from '@/lib/store';

export async function GET(request: NextRequest, { params }: { params: Promise<{ tool_key: string }> }) {
  const { tool_key } = await params;
  const prompt = await getSystemPrompt(tool_key);
  if (!prompt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(prompt);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ tool_key: string }> }) {
  try {
    const { tool_key } = await params;
    const body = await request.json();
    const prompt = await updateSystemPrompt(tool_key, body.prompt_content);
    if (!prompt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(prompt);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 });
  }
}
