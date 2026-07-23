import { NextRequest, NextResponse } from 'next/server';
import { getTask, getProjectTasks, getQueueStats } from '@/lib/task-queue';

/**
 * GET /api/generate/task
 * Query task status or list tasks
 */
export async function GET(request: NextRequest) {
  try {
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
