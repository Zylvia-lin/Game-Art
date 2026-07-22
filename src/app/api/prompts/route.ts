import { NextRequest, NextResponse } from 'next/server';
import { getAllPrompts, updatePrompt } from '@/lib/store';

// GET /api/prompts - List all system prompts
export async function GET() {
  const list = getAllPrompts();
  return NextResponse.json(list);
}

// PUT /api/prompts - Batch update prompts
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const results = [];
    for (const item of body) {
      const updated = updatePrompt(item.tool_key, item.prompt_content);
      if (updated) results.push(updated);
    }
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
