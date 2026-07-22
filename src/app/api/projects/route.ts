import { NextRequest, NextResponse } from 'next/server';
import { getProjects, createProject } from '@/lib/store';

// GET /api/projects - List all projects
export async function GET() {
  const list = getProjects();
  return NextResponse.json(list);
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
    }
    const project = createProject(body);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
