import { NextRequest, NextResponse } from 'next/server';
import { getModelConfigs, createModelConfig, toModelConfigSafe } from '@/lib/store';

export async function GET() {
  const configs = await getModelConfigs();
  // Mask API keys in list responses for security
  const safe = configs.map(c => ({
    ...c,
    api_key: c.api_key && c.api_key.length > 8
      ? c.api_key.slice(0, 4) + '****' + c.api_key.slice(-4)
      : c.api_key,
  }));
  return NextResponse.json(safe);
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
