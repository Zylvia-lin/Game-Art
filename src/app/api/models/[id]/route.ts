import { NextRequest, NextResponse } from 'next/server';
import { getModelConfigs, updateModelConfig, deleteModelConfig } from '@/lib/store';

// GET /api/models/[id] - Get a specific model config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const configs = getModelConfigs();
  const config = configs.find((c) => c.id === parseInt(id));
  if (!config) {
    return NextResponse.json({ error: 'Model config not found' }, { status: 404 });
  }
  return NextResponse.json(config);
}

// PUT /api/models/[id] - Update a model config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = updateModelConfig(parseInt(id), body);
    if (!updated) {
      return NextResponse.json({ error: 'Model config not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// DELETE /api/models/[id] - Delete a model config
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteModelConfig(parseInt(id));
  if (!deleted) {
    return NextResponse.json({ error: 'Model config not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
