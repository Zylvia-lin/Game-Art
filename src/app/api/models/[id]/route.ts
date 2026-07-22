import { NextRequest, NextResponse } from 'next/server';

// In-memory storage
const modelConfigs: Map<number, any> = new Map();

// PUT /api/models/[id] - Update model config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const modelId = parseInt(id);
  const config = modelConfigs.get(modelId);
  
  if (!config) {
    return NextResponse.json({ error: 'Model config not found' }, { status: 404 });
  }
  
  try {
    const body = await request.json();
    const updated = {
      ...config,
      ...body,
      updated_at: new Date().toISOString(),
    };
    
    // If this is set as default, unset other defaults of the same type
    if (updated.is_default) {
      modelConfigs.forEach((c) => {
        if (c.type === updated.type && c.id !== modelId) {
          c.is_default = false;
        }
      });
    }
    
    modelConfigs.set(modelId, updated);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// DELETE /api/models/[id] - Delete model config
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const modelId = parseInt(id);
  
  if (!modelConfigs.has(modelId)) {
    return NextResponse.json({ error: 'Model config not found' }, { status: 404 });
  }
  
  modelConfigs.delete(modelId);
  return NextResponse.json({ success: true });
}
