import { NextRequest, NextResponse } from 'next/server';
import { createTask, getTask, getProjectTasks, getQueueStats } from '@/lib/task-queue';
import { getDefaultModelConfig } from '@/lib/store';

/**
 * POST /api/generate/[tool_key]
 * Create a new generation task (async)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool_key: string }> }
) {
  try {
    const { tool_key } = await params;
    const body = await request.json();
    
    const { project_id, ...inputParams } = body;
    
    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    // Check if required models are configured before submitting task
    const needsImageModel = !['animation_frame_extract', 'ui_component_place', 'ui_component_split', 'scene_map_split'].includes(tool_key);
    const needsTextModel = !['animation_frame_extract', 'ui_component_place', 'ui_component_split', 'scene_map_split'].includes(tool_key);
    
    if (needsImageModel) {
      const imageModel = await getDefaultModelConfig('image');
      if (!imageModel) {
        return NextResponse.json(
          { error: '未配置图片模型，请先在「模型配置」页面添加图片模型API密钥' },
          { status: 400 }
        );
      }
    }
    
    if (needsTextModel) {
      const textModel = await getDefaultModelConfig('text');
      if (!textModel) {
        return NextResponse.json(
          { error: '未配置文本模型，请先在「模型配置」页面添加文本模型（如DeepSeek）API密钥' },
          { status: 400 }
        );
      }
    }
    
    // Create task in queue
    const task = await createTask(project_id, tool_key, inputParams);
    
    return NextResponse.json({
      status: 'queued',
      task_id: task.id,
      message: 'Task added to queue',
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/generate/[tool_key]
 * Get task status or list tasks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool_key: string }> }
) {
  try {
    const { tool_key } = await params;
    const { searchParams } = new URL(request.url);
    
    const taskId = searchParams.get('task_id');
    const projectId = searchParams.get('project_id');
    const status = searchParams.get('status');
    const stats = searchParams.get('stats');
    
    // Get queue stats
    if (stats === 'true') {
      const projectIdNum = projectId ? parseInt(projectId) : undefined;
      const queueStats = await getQueueStats(projectIdNum);
      return NextResponse.json(queueStats);
    }
    
    // Get single task
    if (taskId) {
      const task = await getTask(parseInt(taskId));
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json(task);
    }
    
    // List tasks for project
    if (projectId) {
      const tasks = await getProjectTasks(
        parseInt(projectId),
        status as 'pending' | 'processing' | 'completed' | 'failed' | undefined
      );
      return NextResponse.json(tasks);
    }
    
    return NextResponse.json({ error: 'task_id or project_id required' }, { status: 400 });
    
  } catch (error) {
    console.error('Error getting task:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get task' },
      { status: 500 }
    );
  }
}
