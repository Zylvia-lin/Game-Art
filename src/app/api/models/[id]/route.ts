import { NextRequest, NextResponse } from 'next/server';
import { getModelConfig, updateModelConfig, deleteModelConfig } from '@/lib/store';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = await getModelConfig(parseInt(id));
  if (!config) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const config = await updateModelConfig(parseInt(id), body);
    if (!config) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update model config' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteModelConfig(parseInt(id));
  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
