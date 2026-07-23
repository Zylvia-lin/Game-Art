'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Sword } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector, RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { GenerationResultActions } from '@/components/tools/generation-result-actions';
import { resolveImageUrl, projectsApi } from '@/lib/api';
import { useTaskQueue } from '@/hooks/use-task-queue';
import type { Project, Task } from '@/lib/types';

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
  const [results, setResults] = useState<string[]>([]);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).then(setProject).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (project?.style) setStyle(project.style);
  }, [project]);

  // Wait for params to load
  if (!params.id) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check sessionStorage for pre-selected image
  useEffect(() => {
    const saved = sessionStorage.getItem('prop_source_image');
    if (saved) {
      setSourceImage(saved);
      sessionStorage.removeItem('prop_source_image');
    }
  }, []);

  const toolKeyMap: Record<string, string> = {
    generate: 'prop_generate',
    variant: 'prop_variant',
  };

  const handleTaskComplete = useCallback((task: Task) => {
    if (task.output_urls && task.output_urls.length > 0) {
      setResults(prev => [...task.output_urls, ...prev]);
    }
  }, []);

  const { submitting, submitTask } = useTaskQueue({
    projectId,
    onTaskComplete: handleTaskComplete,
  });

  const needsImage = subTool === 'variant';

  const handleGenerate = async () => {
    if (subTool === 'generate' && !prompt.trim()) return;
    if (subTool === 'variant' && !sourceImage) return;
    submitTask(toolKeyMap[subTool], {
      prompt: prompt || '基于参考图生成变体',
      image_url: sourceImage || undefined,
      variant_count: variantCount,
      style,
      ratio,
      resolution,
    });
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
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">道具描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={subTool === 'variant' ? '描述变体方向，如：不同颜色、材质、品质等级...' : '描述你想要的道具，如：一把燃烧着火焰的传说之剑...'}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
        />
      </div>
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
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />提交中...</> : <><Sparkles className="h-4 w-4" />{subTool === 'variant' ? '衍生变体' : '生成道具'}</>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {results.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {results.map((url, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <img src={resolveImageUrl(url)} alt={`Prop ${i + 1}`} className="w-full object-contain" />
              <div className="p-3 border-t border-border">
                <GenerationResultActions imageUrl={url} projectId={String(projectId)} showAddToLibrary />
              </div>
            </div>
          ))}
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
