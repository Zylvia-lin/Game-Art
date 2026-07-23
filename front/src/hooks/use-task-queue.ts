import { useState, useCallback, useRef, useEffect } from 'react';
import { generateApi } from '@/lib/api';
import type { Task, TaskStatus } from '@/lib/types';

interface UseTaskQueueOptions {
  projectId: string;
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
  cancelTask: (taskId: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  isLoading: boolean;
  submitting: boolean;
}

export function useTaskQueue({ projectId, onTaskComplete, onTaskError }: UseTaskQueueOptions): UseTaskQueueReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use refs to avoid re-triggering the polling effect when callbacks change
  const onCompleteRef = useRef(onTaskComplete);
  const onErrorRef = useRef(onTaskError);
  useEffect(() => { onCompleteRef.current = onTaskComplete; }, [onTaskComplete]);
  useEffect(() => { onErrorRef.current = onTaskError; }, [onTaskError]);

  // Initial load: fetch existing tasks for this project
  const refreshTasks = useCallback(async () => {
    if (!projectId) return;
    try {
      const fetched = await generateApi.getProjectTasks(projectId);
      setTasks(fetched);
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    }
  }, [projectId]);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  // Poll for task status updates — stable interval, not dependent on `tasks`
  useEffect(() => {
    if (!projectId) return;

    const pollTaskStatus = async () => {
      try {
        const updatedTasks = await generateApi.getProjectTasks(projectId);
        setTasks(prev => {
          const taskMap = new Map(updatedTasks.map(t => [t.id, t]));
          const merged = prev.map(t => {
            const updated = taskMap.get(t.id);
            if (!updated) return t;
            // Check for status transitions
            if (prev.find(pt => pt.id === t.id)?.status !== updated.status) {
              if (updated.status === 'completed') {
                onCompleteRef.current?.(updated);
              } else if (updated.status === 'failed') {
                onErrorRef.current?.(updated);
              }
            }
            return updated;
          });

          // Add any new tasks from server that we don't have locally
          for (const t of updatedTasks) {
            if (!merged.find(m => m.id === t.id)) merged.push(t);
          }

          return merged;
        });
      } catch (error) {
        console.error('Failed to poll task status:', error);
      }
    };

    pollingRef.current = setInterval(pollTaskStatus, 1500);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [projectId]);

  const submitTask = useCallback(async (toolKey: string, params: Record<string, unknown>): Promise<Task> => {
    if (!projectId) {
      throw new Error('Invalid project ID');
    }
    setIsLoading(true);
    try {
      const result = await generateApi.submit(toolKey, { project_id: projectId, ...params });
      // The API returns { status, task_id, message }, fetch the full task
      const task = await generateApi.getTask(result.task_id);
      // Immediately insert into local state so the queue updates instantly
      setTasks(prev => {
        // Avoid duplicates
        if (prev.find(t => t.id === task.id)) return prev;
        return [task, ...prev];
      });
      return task;
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const cancelTask = useCallback(async (taskId: string) => {
    try {
      await generateApi.cancelTask(taskId);
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'failed' as TaskStatus, error_message: 'Cancelled by user' } : t
      ));
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  }, []);

  const clearCompleted = useCallback(async () => {
    try {
      await generateApi.deleteTasks(projectId);
      setTasks(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'failed'));
    } catch (error) {
      console.error('Failed to clear completed tasks:', error);
    }
  }, [projectId]);

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
    refreshTasks,
    isLoading,
    submitting: isLoading,
  };
}
