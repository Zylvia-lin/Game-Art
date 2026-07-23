import { NextRequest, NextResponse } from 'next/server';
import { getGenerations } from '@/lib/store';

/**
 * GET /api/projects/[id]/generations
 * List generation history for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const generations = await getGenerations(parseInt(id));
    return NextResponse.json(generations);
  } catch (error) {
    console.error('Error fetching project generations:', error);
    return NextResponse.json({ error: 'Failed to fetch generations' }, { status: 500 });
  }
}
