import { NextRequest, NextResponse } from 'next/server';
import { getAssets, createAsset } from '@/lib/store';

// GET /api/assets?project_id=X&type=Y - List assets
export async function GET(request: NextRequest) {
  const projectId = parseInt(request.nextUrl.searchParams.get('project_id') || '0');
  const type = request.nextUrl.searchParams.get('type') || undefined;
  const list = getAssets(projectId || undefined, type);
  return NextResponse.json(list);
}

// POST /api/assets - Create an asset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const asset = createAsset({
      project_id: body.project_id,
      generation_id: body.generation_id || null,
      name: body.name || '未命名',
      type: body.type || 'image',
      url: body.url,
      metadata_: body.metadata || null,
      finalized: false,
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
