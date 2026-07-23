'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, Loader2, Clock, Trash2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { generateApi } from '@/lib/api';
import type { Task } from '@/lib/types';

interface TaskQueuePanelProps {
  projectId: number;
  onTaskComplete?: (task: Task) => void;
}

export function TaskQueuePanel({ projectId, onTaskComplete }: TaskQueuePanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expanded, setExpanded] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTasksRef = useRef<Map<number, Task>>(new Map());

  const fetchTasks = useCallback(async () => {
    try {
      const data = await generateApi.getProjectTasks(projectId);
      setTasks(data);

      // Check for newly completed/failed tasks
      data.forEach((task: Task) => {
        const prev = prevTasksRef.current.get(task.id);
        if (prev && prev.status !== task.status) {
          if (task.status === 'completed') {
            onTaskComplete?.(task);
          }
        }
      });
      prevTasksRef.current = new Map(data.map((t: Task) => [t.id, t]));
    } catch {
      // silently ignore
    }
  }, [projectId, onTaskComplete]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Poll when there are active tasks
  useEffect(() => {
    const hasActive = tasks.some(t => t.status === 'pending' || t.status === 'processing');
    if (hasActive && !pollingRef.current) {
      pollingRef.current = setInterval(fetchTasks, 2000);
    } else if (!hasActive && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tasks, fetchTasks]);

  const handleCancel = async (taskId: number) => {
    try {
      await generateApi.cancelTask(taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'failed' as const } : t));
    } catch {
      // ignore
    }
  };

  const handleClearCompleted = () => {
    setTasks(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'failed'));
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const processingTasks = tasks.filter(t => t.status === 'processing');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => t.status === 'failed');
  const hasActiveTasks = pendingTasks.length > 0 || processingTasks.length > 0;
  const hasFinishedTasks = completedTasks.length > 0 || failedTasks.length > 0;

  if (tasks.length === 0) return null;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400 shrink-0" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
      default:
        return null;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '排队中';
      case 'processing': return '处理中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      default: return status;
    }
  };

  const toolLabel = (key: string) => {
    const map: Record<string, string> = {
      text_to_image: '文生图',
      image_to_image: '图生图',
      inpaint: '局部重绘',
      character_tpose: '角色T-pose',
      character_directions: '多方向',
      character_three_view: '三视图',
      character_part_split: '部件拆分',
      animation_text: '动作生成',
      animation_frame_extract: '帧提取',
      prop_generate: '道具生成',
      prop_variant: '变体衍生',
      ui_layout_generate: 'UI布局',
      ui_component_place: '组件摆放',
      ui_component_split: 'UI拆分',
      scene_map_generate: '地图生成',
      scene_map_split: '地图拆分',
    };
    return map[key] || key;
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">任务队列</span>
          {hasActiveTasks && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              {pendingTasks.length + processingTasks.length} 进行中
            </span>
          )}
          {completedTasks.length > 0 && (
            <span className="text-xs text-green-400">{completedTasks.length} 完成</span>
          )}
          {failedTasks.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" />
              {failedTasks.length} 失败
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Task List */}
      {expanded && (
        <div className="border-t border-border">
          {/* Active tasks */}
          {(pendingTasks.length > 0 || processingTasks.length > 0) && (
            <div className="p-3 space-y-2">
              {[...processingTasks, ...pendingTasks].map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {statusIcon(task.status)}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-foreground truncate">
                        {toolLabel(task.tool_key)}
                        {task.input_params?.prompt != null && (
                          <span className="text-muted-foreground ml-1">
                            - {String(task.input_params.prompt).slice(0, 30)}
                            {String(task.input_params.prompt).length > 30 ? '...' : ''}
                          </span>
                        )}
                      </div>
                      {task.status === 'processing' && task.progress !== undefined && task.progress > 0 && (
                        <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{statusLabel(task.status)}</span>
                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleCancel(task.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        取消
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed / Failed tasks */}
          {hasFinishedTasks && (
            <div className="border-t border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">已完成</span>
                <button
                  onClick={handleClearCompleted}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  清除
                </button>
              </div>
              {[...completedTasks, ...failedTasks].map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {statusIcon(task.status)}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-foreground truncate">
                        {toolLabel(task.tool_key)}
                        {task.input_params?.prompt != null && (
                          <span className="text-muted-foreground ml-1">
                            - {String(task.input_params.prompt).slice(0, 30)}
                            {String(task.input_params.prompt).length > 30 ? '...' : ''}
                          </span>
                        )}
                      </div>
                      {task.error_message && (
                        <div className="text-xs text-red-400 mt-0.5">{task.error_message}</div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{statusLabel(task.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
