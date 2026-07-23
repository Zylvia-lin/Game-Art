'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, XCircle, Loader2, Clock, Trash2,
  ListTodo, X,
} from 'lucide-react';
import { generateApi } from '@/lib/api';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TaskQueuePanelProps {
  projectId: string;
  onTaskComplete?: (task: Task) => void;
}

const TOOL_LABELS: Record<string, string> = {
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

function toolLabel(key: string) {
  return TOOL_LABELS[key] || key;
}

function statusIcon(status: string) {
  switch (status) {
    case 'pending':
      return <Clock className="h-3.5 w-3.5 text-yellow-400 shrink-0" />;
    case 'processing':
      return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />;
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
    default:
      return null;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'pending': return '排队中';
    case 'processing': return '处理中';
    case 'completed': return '已完成';
    case 'failed': return '失败';
    default: return status;
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function TaskQueuePanel({ projectId, onTaskComplete }: TaskQueuePanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTasksRef = useRef<Map<string, Task>>(new Map());

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await generateApi.getProjectTasks(projectId);
      setTasks(data);

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

  // Fetch on mount
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Fetch immediately when panel is opened
  useEffect(() => {
    if (open) {
      fetchTasks();
    }
  }, [open, fetchTasks]);

  // Always poll: 2s when there are active tasks, 5s otherwise
  useEffect(() => {
    const hasActive = tasks.some(t => t.status === 'pending' || t.status === 'processing');
    const interval = hasActive ? 2000 : 5000;
    pollingRef.current = setInterval(fetchTasks, interval);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tasks, fetchTasks]);

  const handleCancel = async (taskId: string) => {
    try {
      await generateApi.cancelTask(taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'failed' as const } : t));
    } catch {
      // ignore
    }
  };

  const handleClearFinished = async () => {
    setClearing(true);
    try {
      await generateApi.deleteTasks(projectId);
      setTasks(prev => prev.filter(t => t.status === 'pending' || t.status === 'processing'));
    } catch {
      // ignore
    } finally {
      setClearing(false);
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const processingTasks = tasks.filter(t => t.status === 'processing');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => t.status === 'failed');
  const activeCount = pendingTasks.length + processingTasks.length;
  const finishedCount = completedTasks.length + failedTasks.length;
  const totalCount = tasks.length;

  const activeTasks = [...processingTasks, ...pendingTasks];
  const finishedTasks = [...completedTasks, ...failedTasks];

  return (
    <>
      {/* Floating toggle button on right edge */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-xl border border-r-0 border-border bg-card px-2 py-4 shadow-lg transition-all duration-300 hover:bg-accent',
          open && 'opacity-0 pointer-events-none'
        )}
      >
        <div className="relative">
          <ListTodo className="h-5 w-5 text-foreground" />
          {activeCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium text-muted-foreground writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>
          任务队列
        </span>
        {totalCount > 0 && (
          <span className="text-[10px] text-muted-foreground">{totalCount}</span>
        )}
      </button>

      {/* Slide-out drawer */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-screen w-[340px] transform border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">任务队列</span>
            {activeCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-400">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {activeCount} 进行中
              </span>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-header with stats + clear button */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {completedTasks.length > 0 && (
                <span className="flex items-center gap-0.5 text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {completedTasks.length}
                </span>
              )}
              {failedTasks.length > 0 && (
                <span className="flex items-center gap-0.5 text-red-400">
                  <XCircle className="h-3 w-3" />
                  {failedTasks.length}
                </span>
              )}
              {pendingTasks.length > 0 && (
                <span className="flex items-center gap-0.5 text-yellow-400">
                  <Clock className="h-3 w-3" />
                  {pendingTasks.length}
                </span>
              )}
            </div>
            {finishedCount > 0 && (
              <button
                onClick={handleClearFinished}
                disabled={clearing}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {clearing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                清除已完成
              </button>
            )}
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-3 py-3" style={{ maxHeight: 'calc(100vh - 110px)' }}>
          {totalCount === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <ListTodo className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">暂无任务</p>
              <p className="mt-1 text-xs text-muted-foreground/60">提交生成任务后将在此显示</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Active tasks */}
              {activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    {statusIcon(task.status)}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground">
                        {toolLabel(task.tool_key)}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {task.input_params?.prompt
                          ? String(task.input_params.prompt).slice(0, 40) + (String(task.input_params.prompt).length > 40 ? '...' : '')
                          : formatTime(task.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{statusLabel(task.status)}</span>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(task.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </div>
                  {task.status === 'processing' && task.progress !== undefined && task.progress > 0 && (
                    <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Finished tasks */}
              {finishedTasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 transition-colors',
                    task.status === 'failed'
                      ? 'border-red-500/10 bg-red-500/5'
                      : 'border-border bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {statusIcon(task.status)}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground">
                        {toolLabel(task.tool_key)}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {task.error_message
                          ? task.error_message.slice(0, 50) + (task.error_message.length > 50 ? '...' : '')
                          : task.input_params?.prompt
                            ? String(task.input_params.prompt).slice(0, 40) + (String(task.input_params.prompt).length > 40 ? '...' : '')
                            : formatTime(task.completed_at || task.created_at)}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {statusLabel(task.status)}
                    </span>
                  </div>
                  {task.status === 'completed' && task.output_urls && task.output_urls.length > 0 && (
                    <div className="mt-2 flex gap-1.5">
                      {task.output_urls.slice(0, 4).map((url, idx) => (
                        <img
                          key={idx}
                          src={url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL}${url.startsWith('/') ? '' : '/'}${url}`}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover border border-border"
                        />
                      ))}
                      {task.output_urls.length > 4 && (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted text-[10px] text-muted-foreground">
                          +{task.output_urls.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {activeCount > 0 && (
          <div className="border-t border-border px-4 py-2">
            <p className="text-[10px] text-muted-foreground/60">
              <Loader2 className="mr-1 inline h-2.5 w-2.5 animate-spin" />
              正在处理 {activeCount} 个任务，每 2 秒自动刷新
            </p>
          </div>
        )}
      </div>

      {/* Backdrop when open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
