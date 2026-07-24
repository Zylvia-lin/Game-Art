'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Scissors, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ToolLayout } from '@/components/tools/tool-layout';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { ResultImageCard } from '@/components/tools/result-image-card';
import { projectsApi, generateApi, toolsApi } from '@/lib/api';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { useButtonCooldown } from '@/hooks/use-button-cooldown';
import { resolveImageUrl, API_BASE } from '@/lib/api';

const SCENES = [
  { value: 'general', label: '通用', desc: '自动识别主体，适合大多数场景' },
  { value: 'human', label: '人像', desc: '专注抠出人像主体' },
  { value: 'product', label: '商品', desc: '专注抠出商品主体' },
];

export default function RemoveBgPage() {
  const params = useParams();
  const projectId = params.id;
  const [imageUrl, setImageUrl] = useState('');
  const [scene, setScene] = useState('general');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).catch(() => {});
  }, [projectId]);

  const handleTaskComplete = useCallback(() => {}, []);

  const { completedTasks, refreshTasks } = useTaskQueue({
    projectId,
    onTaskComplete: handleTaskComplete,
  });
  const { isCoolingDown: genCooldown, triggerCooldown: genTrigger } = useButtonCooldown(2000);

  const results = useMemo(() => {
    return completedTasks
      .filter(t => t.tool_key === 'remove_bg')
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

  const handleRemoveBg = async () => {
    if (!imageUrl) return;
    genTrigger();
    setProcessing(true);
    setError(null);
    try {
      const result = await toolsApi.removeBackgroundAI({
        image_url: imageUrl,
        scene,
      });

      const resultUrl = resolveImageUrl(result.url);
      await generateApi.createCompletedTask({
        project_id: String(projectId),
        tool_key: 'remove_bg',
        output_url: result.url,
        output_name: '去背景结果',
      });

      toast.success('去背景完成');
      refreshTasks();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '去背景失败，请重试';
      setError(msg);
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const paramsPanel = (
    <>
      <ImageSourceSelector
        projectId={String(projectId)}
        imageUrl={imageUrl || null}
        onImageChange={(url) => setImageUrl(url || '')}
        label="源图片"
      />

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">抠图场景</label>
        <div className="grid gap-2">
          {SCENES.map(s => (
            <button
              key={s.value}
              onClick={() => setScene(s.value)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                scene === s.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-border/80'
              }`}
            >
              <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                scene === s.value ? 'border-primary bg-primary' : 'border-muted-foreground/30'
              }`} />
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        onClick={handleRemoveBg}
        disabled={processing || genCooldown || !imageUrl}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            处理中...
          </>
        ) : (
          <>
            <Scissors className="h-4 w-4" />
            去除背景
          </>
        )}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          处理结果 {results.length > 0 && <span className="text-foreground">({results.length})</span>}
        </h3>
      </div>
      {results.length === 0 ? (
        <div className="flex-1 rounded-xl border border-border bg-muted/30 p-8">
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Scissors className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">AI 去除背景</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              上传图片，选择抠图场景，AI 自动识别并移除背景，生成透明 PNG。
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
      title="去除背景"
      description="AI 智能识别并移除图片背景"
      paramsPanel={paramsPanel}
      canvas={canvas}
    />
  );
}
