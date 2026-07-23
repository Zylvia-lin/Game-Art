/**
 * Task Queue Service
 * Manages async generation tasks with background processing
 */

import { sql } from './store';
import type { Task, TaskStatus } from '@/lib/types';

// Task queue state
let isProcessing = false;
let processInterval: NodeJS.Timeout | null = null;

// Convert database row to Task type
function toTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as number,
    project_id: row.project_id as number,
    tool_key: row.tool_key as string,
    input_params: (row.input_params as Record<string, unknown>) || {},
    status: row.status as TaskStatus,
    output_urls: (row.output_urls as string[]) || [],
    error_message: row.error_message as string | null,
    progress: row.progress as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    started_at: row.started_at as string | null,
    completed_at: row.completed_at as string | null,
  };
}

/**
 * Create a new task
 */
export async function createTask(
  projectId: number,
  toolKey: string,
  inputParams: Record<string, unknown>
): Promise<Task> {
  const result = await sql`
    INSERT INTO tasks (project_id, tool_key, input_params, status, progress)
    VALUES (${projectId}, ${toolKey}, ${JSON.stringify(inputParams)}::jsonb, 'pending', 0)
    RETURNING *
  `;
  
  const task = toTask(result[0]);
  
  // Start processing if not already running
  startProcessing();
  
  return task;
}

/**
 * Get task by ID
 */
export async function getTask(taskId: number): Promise<Task | null> {
  const result = await sql`
    SELECT * FROM tasks WHERE id = ${taskId}
  `;
  
  if (result.length === 0) return null;
  return toTask(result[0]);
}

/**
 * Get tasks for a project
 */
export async function getProjectTasks(projectId: number, status?: TaskStatus): Promise<Task[]> {
  let result;
  if (status) {
    result = await sql`
      SELECT * FROM tasks 
      WHERE project_id = ${projectId} AND status = ${status}
      ORDER BY created_at DESC
    `;
  } else {
    result = await sql`
      SELECT * FROM tasks 
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `;
  }
  
  return result.map(toTask);
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  taskId: number,
  status: TaskStatus,
  updates: {
    output_urls?: string[];
    error_message?: string;
    progress?: number;
  } = {}
): Promise<Task | null> {
  const now = new Date().toISOString();
  let startedAt: string | null = null;
  let completedAt: string | null = null;
  
  if (status === 'processing') {
    startedAt = now;
  } else if (status === 'completed' || status === 'failed') {
    completedAt = now;
  }
  
  const result = await sql`
    UPDATE tasks SET 
      status = ${status},
      output_urls = ${updates.output_urls ? JSON.stringify(updates.output_urls) : null}::jsonb,
      error_message = ${updates.error_message || null},
      progress = ${updates.progress ?? null},
      started_at = COALESCE(started_at, ${startedAt}),
      completed_at = ${completedAt},
      updated_at = ${now}
    WHERE id = ${taskId}
    RETURNING *
  `;
  
  if (result.length === 0) return null;
  return toTask(result[0]);
}

/**
 * Get next pending task
 */
async function getNextPendingTask(): Promise<Task | null> {
  const result = await sql`
    SELECT * FROM tasks 
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `;
  
  if (result.length === 0) return null;
  return toTask(result[0]);
}

/**
 * Process a single task
 */
async function processTask(task: Task): Promise<void> {
  try {
    // Update status to processing
    await updateTaskStatus(task.id, 'processing', { progress: 10 });
    
    // Import generate service dynamically to avoid circular dependencies
    const { executeGeneration } = await import('./generate-service');
    
    // Execute the generation
    const result = await executeGeneration(
      task.tool_key,
      task.input_params,
      (progress: number) => {
        // Update progress
        updateTaskStatus(task.id, 'processing', { progress });
      }
    );
    
    // Update task with results
    await updateTaskStatus(task.id, 'completed', {
      output_urls: result.outputUrls,
      progress: 100,
    });
    
    // Also save to generations table for history
    await sql`
      INSERT INTO generations (project_id, task_id, tool_key, input_params, output_urls, status)
      VALUES (${task.project_id}, ${task.id}, ${task.tool_key}, ${JSON.stringify(task.input_params)}::jsonb, ${JSON.stringify(result.outputUrls)}::jsonb, 'completed')
    `;
    
  } catch (error) {
    console.error(`Task ${task.id} failed:`, error);
    await updateTaskStatus(task.id, 'failed', {
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Process tasks from the queue
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  
  try {
    const task = await getNextPendingTask();
    if (task) {
      await processTask(task);
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the task processing loop
 */
export function startProcessing(): void {
  if (processInterval) return;
  
  // Process every 2 seconds
  processInterval = setInterval(() => {
    processQueue().catch(console.error);
  }, 2000);
  
  // Also process immediately
  processQueue().catch(console.error);
}

/**
 * Stop the task processing loop
 */
export function stopProcessing(): void {
  if (processInterval) {
    clearInterval(processInterval);
    processInterval = null;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(projectId?: number): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  let result;
  if (projectId) {
    result = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) as total
      FROM tasks
      WHERE project_id = ${projectId}
    `;
  } else {
    result = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) as total
      FROM tasks
    `;
  }
  
  const row = result[0];
  return {
    pending: Number(row.pending),
    processing: Number(row.processing),
    completed: Number(row.completed),
    failed: Number(row.failed),
    total: Number(row.total),
  };
}
