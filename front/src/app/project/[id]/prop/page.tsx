'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Sword } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector, RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { PromptInput } from '@/components/tools/prompt-input';
import { ResultImageCard } from '@/components/tools/result-image-card';
import { projectsApi, generateApi } from '@/lib/api';
import { useTaskQueue } from '@/hooks/use-task-queue';
import type { Project } from '@/lib/types';
import { estimateCostFromResolution, formatCostDisplay } from '@/lib/types';

export default function PropPage() {
  const params = useParams();
  const projectId = params.id;
  const [subTool, setSubTool] = useState<string>('generate');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('pixel');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1024x1024');
  const [variantCount, setVariantCount] = useState(4);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  const toolKeyMap: Record<string, string> = {
    generate: 'prop_generate',
    variant: 'prop_variant',
  };

  const { submitting, submitTask, completedTasks, refreshTasks } = useTaskQueue({
    projectId,
    onTaskComplete: () => {},
  });

  // 从已完成的任务中派生结果图片
  const results = useMemo(() => {
    const toolKeys = Object.values(toolKeyMap);
    return completedTasks
      .filter(t => toolKeys.includes(t.tool_key))
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

  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).then(setProject).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (project?.style) setStyle(project.style);
  }, [project]);

  // Check sessionStorage for pre-selected image
  useEffect(() => {
    const saved = sessionStorage.getItem('prop_source_image');
    if (saved) {
      setSourceImage(saved);
      sessionStorage.removeItem('prop_source_image');
    }
  }, []);

  // Wait for params to load
  if (!params.id) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const needsImage = subTool === 'variant';

  const handleGenerate = async () => {
    if (subTool === 'generate' && !prompt.trim()) return;
    if (subTool === 'variant' && !sourceImage) return;
    try {
      await submitTask(toolKeyMap[subTool], {
        prompt: prompt || '基于参考图生成变体',
        image_url: sourceImage || undefined,
        variant_count: variantCount,
        style,
        ratio,
        resolution,
      });
      toast.success('任务已提交，请在任务队列中查看进度');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '提交失败');
    }
  };

  const paramsPanel = (
    <>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">功能</label>
        <div className="flex gap-2">
          <button
            onClick={() => setSubTool('generate')}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
              subTool === 'generate'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            生成道具
          </button>
          <button
            onClick={() => setSubTool('variant')}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
              subTool === 'variant'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            衍生变体
          </button>
        </div>
      </div>
      {needsImage && (
        <ImageSourceSelector
          projectId={String(projectId)}
          imageUrl={sourceImage}
          onImageChange={setSourceImage}
          label="参考道具图片"
          assetType="prop"
        />
      )}
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        toolKey="prop"
        label="道具描述"
        placeholder={subTool === 'variant' ? '描述变体方向，如：不同颜色、材质、品质等级...' : '描述你想要的道具，如：一把燃烧着火焰的传说之剑...'}
        rows={4}
      />
      <StyleSelector value={style} onChange={setStyle} />
      {subTool === 'variant' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">变体数量: {variantCount}</label>
          <input
            type="range"
            min="2"
            max="8"
            value={variantCount}
            onChange={(e) => setVariantCount(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      )}
      <RatioSelector value={ratio} onChange={setRatio} />
      <ResolutionSelector ratio={ratio} value={resolution} onChange={setResolution} />
      <button
        onClick={handleGenerate}
        disabled={submitting || (subTool === 'generate' ? !prompt.trim() : !sourceImage)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />提交中...</> : <><Sparkles className="h-4 w-4" />{subTool === 'variant' ? '衍生变体' : '生成道具'}<span className="ml-1 text-xs opacity-80">≈{formatCostDisplay(estimateCostFromResolution(resolution, 1, sourceImage ? 1 : 0))}</span></>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {results.length > 0 ? (
        <div className="flex-1 overflow-y-auto p-4">
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
                onDelete={handleDeleteResult}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Sword className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">描述你想要的道具开始生成</p>
            <p className="mt-2 text-xs text-muted-foreground/60">提交任务后可在下方查看进度和结果</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="道具生成"
      description="生成游戏道具及变体"
      toolKey={toolKeyMap[subTool]}
      toolName={subTool === 'variant' ? '道具变体衍生' : '道具生成'}
      paramsPanel={paramsPanel}
      canvas={
        <div className="flex h-full flex-col">
          {canvas}
        </div>
      }
    />
  );
}
