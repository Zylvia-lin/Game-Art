import { NextRequest, NextResponse } from 'next/server';
import { updateAsset, deleteAsset, getAssets } from '@/lib/store';

// PUT /api/assets/[id] - Update asset (e.g., toggle finalized)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = updateAsset(parseInt(id), body);
    if (!updated) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// DELETE /api/assets/[id] - Delete asset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteAsset(parseInt(id));
  if (!deleted) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
