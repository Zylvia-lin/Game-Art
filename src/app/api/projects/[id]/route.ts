import { NextRequest, NextResponse } from 'next/server';
import { getProject, updateProject, deleteProject, getGenerations, getAssets } from '@/lib/store';

// GET /api/projects/[id] - Get project details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(parseInt(id));
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json(project);
}

// PUT /api/projects/[id] - Update project
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const project = updateProject(parseInt(id), body);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteProject(parseInt(id));
  if (!deleted) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

// GET /api/projects/[id]/generations - Get project generations
export async function GET_GENERATIONS(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const generations = getGenerations(parseInt(id));
  return NextResponse.json(generations);
}

// GET /api/projects/[id]/assets - Get project assets
export async function GET_ASSETS(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const type = new URL(request.url).searchParams.get('type') || undefined;
  const assetList = getAssets(parseInt(id), type);
  return NextResponse.json(assetList);
}
