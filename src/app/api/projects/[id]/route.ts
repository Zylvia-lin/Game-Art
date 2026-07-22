import { NextRequest, NextResponse } from 'next/server';

// In-memory storage
const projects: Map<number, any> = new Map();

// GET /api/projects/[id] - Get project by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id);
  const project = projects.get(projectId);
  
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
  const { id } = await params;
  const projectId = parseInt(id);
  const project = projects.get(projectId);
  
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  
  try {
    const body = await request.json();
    const updated = {
      ...project,
      ...body,
      updated_at: new Date().toISOString(),
    };
    projects.set(projectId, updated);
    return NextResponse.json(updated);
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
  const projectId = parseInt(id);
  
  if (!projects.has(projectId)) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  
  projects.delete(projectId);
  return NextResponse.json({ success: true });
}
