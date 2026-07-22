import { NextRequest, NextResponse } from 'next/server';
import { getModelConfigs, addModelConfig } from '@/lib/store';

// GET /api/models - List all model configs
export async function GET() {
  const list = getModelConfigs();
  return NextResponse.json(list);
}

// POST /api/models - Add a new model config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = addModelConfig(body);
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
