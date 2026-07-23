import { useState, useCallback, useRef, useEffect } from 'react';
import { generateApi } from '@/lib/api';
import type { Task, TaskStatus } from '@/lib/types';

interface UseTaskQueueOptions {
  projectId: number;
  onTaskComplete?: (task: Task) => void;
  onTaskError?: (task: Task) => void;
}

interface UseTaskQueueReturn {
  tasks: Task[];
  pendingTasks: Task[];
  processingTasks: Task[];
  completedTasks: Task[];
  failedTasks: Task[];
  submitTask: (toolKey: string, params: Record<string, unknown>) => Promise<Task>;
  cancelTask: (taskId: number) => Promise<void>;
  clearCompleted: () => void;
  isLoading: boolean;
  submitting: boolean;
}

export function useTaskQueue({ projectId, onTaskComplete, onTaskError }: UseTaskQueueOptions): UseTaskQueueReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for task status updates
  useEffect(() => {
    const pollTaskStatus = async () => {
      const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'processing');
      if (activeTasks.length === 0) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        return;
      }

      try {
        const updatedTasks = await generateApi.getProjectTasks(projectId);
        setTasks(prev => {
          const taskMap = new Map(updatedTasks.map(t => [t.id, t]));
          const merged = prev.map(t => taskMap.get(t.id) || t);

          // Check for newly completed/failed tasks
          merged.forEach(task => {
            const prevTask = prev.find(t => t.id === task.id);
            if (prevTask && prevTask.status !== task.status) {
              if (task.status === 'completed') {
                onTaskComplete?.(task);
              } else if (task.status === 'failed') {
                onTaskError?.(task);
              }
            }
          });

          return merged;
        });
      } catch (error) {
        console.error('Failed to poll task status:', error);
      }
    };

    // Start polling if there are active tasks
    const hasActiveTasks = tasks.some(t => t.status === 'pending' || t.status === 'processing');
    if (hasActiveTasks && !pollingRef.current) {
      pollingRef.current = setInterval(pollTaskStatus, 1000);
    } else if (!hasActiveTasks && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tasks, projectId, onTaskComplete, onTaskError]);

  const submitTask = useCallback(async (toolKey: string, params: Record<string, unknown>): Promise<Task> => {
    setIsLoading(true);
    try {
      const result = await generateApi.submit(toolKey, { project_id: projectId, ...params });
      // The API returns { status, task_id, message }, fetch the full task
      const task = await generateApi.getTask(result.task_id);
      setTasks(prev => [...prev, task]);
      return task;
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const cancelTask = useCallback(async (taskId: number) => {
    try {
      await generateApi.cancelTask(taskId);
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'failed' as TaskStatus, error_message: 'Cancelled by user' } : t
      ));
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'failed'));
  }, []);

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const processingTasks = tasks.filter(t => t.status === 'processing');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => t.status === 'failed');

  return {
    tasks,
    pendingTasks,
    processingTasks,
    completedTasks,
    failedTasks,
    submitTask,
    cancelTask,
    clearCompleted,
    isLoading,
    submitting: isLoading,
  };
}
