import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/store';

/**
 * GET /api/projects/[id]/assets
 * List assets for a project, optionally filtered by type
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const assetType = searchParams.get('asset_type') || undefined;

    const assets = await getAssets(parseInt(id), assetType);
    return NextResponse.json(assets);
  } catch (error) {
    console.error('Error fetching project assets:', error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}
