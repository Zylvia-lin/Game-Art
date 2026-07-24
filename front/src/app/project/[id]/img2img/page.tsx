'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ToolLayout } from '@/components/tools/tool-layout';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { PromptInput } from '@/components/tools/prompt-input';
import { ResultImageCard } from '@/components/tools/result-image-card';
import { RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { projectsApi, generateApi } from '@/lib/api';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { useButtonCooldown } from '@/hooks/use-button-cooldown';
import { computeSize, estimateCost, formatCostDisplay } from '@/lib/types';

export default function ImageToImagePage() {
  const params = useParams();
  const projectId = params.id;
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2K');
  const [error, setError] = useState<string | null>(null);

  // Load project style (for potential future use in img2img prompts)
  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).catch(() => {});
  }, [projectId]);

  const handleTaskComplete = useCallback(() => {
    // 结果从 completedTasks 派生，无需手动管理
  }, []);

  const { submitting, submitTask, completedTasks, refreshTasks } = useTaskQueue({
    projectId,
    onTaskComplete: handleTaskComplete,
  });
  const { isCoolingDown: genCooldown, triggerCooldown: genTrigger } = useButtonCooldown(2000);

  // 从已完成的任务中派生结果图片（刷新页面后也能恢复）
  const results = useMemo(() => {
    return completedTasks
      .filter(t => t.tool_key === 'image_to_image')
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

  const handleDeleteResult = async (taskId: string, taskIndex: number) => {
    await generateApi.deleteOutput(taskId, taskIndex);
    refreshTasks();
  };

  const handleGenerate = async () => {
    if (!imageUrl || !prompt.trim()) return;
    genTrigger();
    setError(null);
    try {
      await submitTask('image_to_image', {
        image_url: imageUrl,
        prompt,
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
      <ImageSourceSelector
        projectId={String(projectId)}
        imageUrl={imageUrl || null}
        onImageChange={(url) => setImageUrl(url || '')}
        label="参考图片"
      />
      <PromptInput value={prompt} onChange={setPrompt} toolKey="image_to_image" label="生成描述" placeholder="描述你想要的画面，如：赛博朋克风格的城市街道..." rows={3} />
      <RatioSelector value={ratio} onChange={setRatio} />
      <ResolutionSelector ratio={ratio} value={resolution} onChange={setResolution} />
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <button
        onClick={handleGenerate}
        disabled={submitting || genCooldown || !imageUrl || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            提交中...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            生成
            <span className="ml-1 text-xs opacity-80">
              {formatCostDisplay(estimateCost(resolution, 1, 1))}
            </span>
          </>
        )}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          生成结果 {results.length > 0 && <span className="text-foreground">({results.length})</span>}
        </h3>
      </div>
      {results.length === 0 ? (
        <div className="flex-1 rounded-xl border border-border bg-muted/30 p-8">
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">图生图</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              上传参考图片，选择比例和分辨率，AI 将基于参考图生成新的美术资产。
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-muted/30 p-4">
          <div className="columns-1 gap-3 sm:columns-3 lg:columns-5">
            {results.map((r, i) => (
              <ResultImageCard
                key={`${r.taskId}-${r.taskIndex}`}
                url={r.url}
                projectId={String(projectId)}
                index={i}
                name={r.name}
                taskId={r.taskId}
                taskIndex={r.taskIndex}
                onDelete={() => handleDeleteResult(r.taskId, r.taskIndex)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="图生图"
      description="基于参考图片生成新的美术资产"
      toolKey="image_to_image"
      toolName="图生图"
      paramsPanel={paramsPanel}
      canvas={canvas}
    />
  );
}
