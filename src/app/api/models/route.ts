import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for model configs
const modelConfigs: Map<number, any> = new Map();
let modelIdCounter = 1;

// GET /api/models - List all model configs
export async function GET() {
  const list = Array.from(modelConfigs.values());
  return NextResponse.json(list);
}

// POST /api/models - Create model config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const config = {
      id: modelIdCounter++,
      type: body.type || 'text',
      name: body.name || '',
      provider: body.provider || '',
      api_base_url: body.api_base_url || '',
      api_key: body.api_key || '',
      model_name: body.model_name || '',
      is_default: body.is_default || false,
      created_at: now,
      updated_at: now,
    };
    
    // If this is set as default, unset other defaults of the same type
    if (config.is_default) {
      modelConfigs.forEach((c) => {
        if (c.type === config.type) {
          c.is_default = false;
        }
      });
    }
    
    modelConfigs.set(config.id, config);
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
