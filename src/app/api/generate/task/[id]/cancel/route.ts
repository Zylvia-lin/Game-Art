import { NextRequest, NextResponse } from 'next/server';
import { cancelTask } from '@/lib/task-queue';

/**
 * POST /api/generate/task/[id]/cancel
 * Cancel a pending/processing task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await cancelTask(parseInt(id));

    if (!task) {
      return NextResponse.json({ error: 'Task not found or already completed' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error cancelling task:', error);
    return NextResponse.json({ error: 'Failed to cancel task' }, { status: 500 });
  }
}
