import { NextRequest, NextResponse } from 'next/server';
import { getModelConfigs, createModelConfig } from '@/lib/store';

export async function GET() {
  const configs = await getModelConfigs();
  return NextResponse.json(configs);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = await createModelConfig(body);
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create model config' }, { status: 500 });
  }
}
