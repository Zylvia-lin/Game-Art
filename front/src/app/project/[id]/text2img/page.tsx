'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector, RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { PromptInput } from '@/components/tools/prompt-input';
import { ResultImageCard } from '@/components/tools/result-image-card';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { projectsApi } from '@/lib/api';
import { computeSize, estimateCost, formatCostDisplay } from '@/lib/types';

export default function TextToImagePage() {
  const params = useParams();
  const projectId = params.id as string;
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('pixel');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2K');
  const [error, setError] = useState<string | null>(null);

  const { submitting, submitTask, completedTasks } = useTaskQueue({
    projectId,
    onTaskComplete: () => {},
  });

  // Load project style as default
  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).then((project) => {
      if (project.style) setStyle(project.style);
    }).catch(() => {});
  }, [projectId]);

  // 从已完成的任务中派生结果图片（刷新页面后也能恢复）
  const results = useMemo(() => {
    return completedTasks
      .filter(t => t.tool_key === 'text_to_image')
      .sort((a, b) => {
        const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return tb - ta;
      })
      .flatMap(t => {
        const urls = t.output_urls || [];
        const names = t.output_names || [];
        return urls.map((url, i) => ({
          url,
          taskId: t.id,
          taskIndex: i,
          name: names[i] || '',
        }));
      });
  }, [completedTasks]);

  if (!params.id) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setError(null);
    try {
      await submitTask('text_to_image', {
        prompt,
        style,
        ratio,
        resolution: computeSize(ratio, resolution),
      });
      toast.success('任务提交成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试');
      toast.error(err instanceof Error ? err.message : '生成失败，请重试');
    }
  };

  const paramsPanel = (
    <>
      <PromptInput value={prompt} onChange={setPrompt} toolKey="text_to_image" />
      <StyleSelector value={style} onChange={setStyle} />
      <RatioSelector value={ratio} onChange={setRatio} />
      <ResolutionSelector ratio={ratio} value={resolution} onChange={setResolution} />
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <button
        onClick={handleGenerate}
        disabled={submitting || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {submitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            提交中...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            生成
            <span className="ml-1 text-xs opacity-80">
              {formatCostDisplay(estimateCost(resolution, 1, 0))}
            </span>
          </>
        )}
      </button>
    </>
  );

  return (
    <ToolLayout
      title="文生图"
      description="通过文字描述生成游戏美术资产"
      toolKey="text_to_image"
      toolName="文生图"
      params={paramsPanel}
      canvas={
        <div className="flex h-full flex-col">
          {/* Header bar */}
          <div className="flex items-center justify-between px-1 pb-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              生成结果 {results.length > 0 && <span className="text-foreground">({results.length})</span>}
            </h3>
          </div>

          {/* Image grid or empty state */}
          {results.length === 0 ? (
            <div className="flex-1 rounded-xl border border-border bg-muted/30 p-8">
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">文生图</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  输入描述，选择风格和比例，AI 将为你生成对应的游戏美术资产。
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((r, i) => (
                  <ResultImageCard
                    key={`${r.taskId}-${r.taskIndex}`}
                    url={r.url}
                    projectId={String(projectId)}
                    index={i}
                    name={r.name}
                    taskId={r.taskId}
                    taskIndex={r.taskIndex}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
