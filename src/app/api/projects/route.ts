import { NextRequest, NextResponse } from 'next/server';

// In-memory storage (replace with database in production)
const projects: Map<number, any> = new Map();
let projectIdCounter = 1;

// GET /api/projects - List all projects
export async function GET() {
  const list = Array.from(projects.values()).sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  return NextResponse.json(list);
}

// POST /api/projects - Create project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const project = {
      id: projectIdCounter++,
      name: body.name || 'Untitled Project',
      description: body.description || '',
      cover_url: null,
      created_at: now,
      updated_at: now,
    };
    projects.set(project.id, project);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
