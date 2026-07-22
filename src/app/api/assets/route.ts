import { NextRequest, NextResponse } from 'next/server';
import { getAssets, createAsset } from '@/lib/store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const type = searchParams.get('type');
  
  const assets = await getAssets(
    projectId ? parseInt(projectId) : undefined,
    type || undefined
  );
  return NextResponse.json(assets);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const asset = await createAsset(body);
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 });
  }
}
