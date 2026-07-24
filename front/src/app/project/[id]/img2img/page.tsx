'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ToolLayout } from '@/components/tools/tool-layout';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { PromptInput } from '@/components/tools/prompt-input';
import { GenerationResultActions } from '@/components/tools/generation-result-actions';
import { resolveImageUrl, projectsApi } from '@/lib/api';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { computeSize, estimateCost, formatCostDisplay, deriveRatio, findClosestTier } from '@/lib/types';
import type { Task } from '@/lib/types';

export default function ImageToImagePage() {
  const params = useParams();
  const projectId = params.id;
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [strength, setStrength] = useState(0.7);
  const [ratio, setRatio] = useState('original');
  const [resolution, setResolution] = useState('original');
  const [results, setResults] = useState<string[]>([]);
  const [originalDimensions, setOriginalDimensions] = useState<{ w: number; h: number } | null>(null);

  // If image is removed, reset to 'original' so it will use the next image's dimensions
  useEffect(() => {
    if (!imageUrl) {
      setRatio('original');
      setResolution('original');
    }
  }, [imageUrl]);

  // Load project style (for potential future use in img2img prompts)
  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).catch(() => {});
  }, [projectId]);

  // When image changes, load to get natural dimensions
  useEffect(() => {
    if (!imageUrl) {
      setOriginalDimensions(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      setOriginalDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => setOriginalDimensions(null);
    img.src = resolveImageUrl(imageUrl);
  }, [imageUrl]);

  // Wait for params to load
  if (!params.id) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleTaskComplete = useCallback((task: Task) => {
    if (task.output_urls && task.output_urls.length > 0) {
      setResults(prev => [...task.output_urls, ...prev]);
    }
  }, []);

  const { submitting, submitTask } = useTaskQueue({
    projectId,
    onTaskComplete: handleTaskComplete,
  });

  const handleGenerate = async () => {
    if (!imageUrl || !prompt.trim()) return;
    try {
      // Resolve ratio: 'original' → match to closest preset ratio
      const actualRatio = ratio === 'original' && originalDimensions
        ? deriveRatio(originalDimensions.w, originalDimensions.h)
        : ratio === 'original'
          ? '1:1'
          : ratio;

      // Resolve resolution: 'original' → find the preset tier closest to source image pixel count
      let actualResolution: string;
      if (resolution === 'original' && originalDimensions) {
        const sourcePixels = originalDimensions.w * originalDimensions.h;
        const tier = findClosestTier(sourcePixels);
        actualResolution = computeSize(actualRatio, tier);
      } else if (resolution === 'original') {
        actualResolution = computeSize(actualRatio, '2K');
      } else {
        actualResolution = computeSize(actualRatio, resolution);
      }

      await submitTask('image_to_image', {
        image_url: imageUrl,
        prompt,
        ratio: actualRatio,
        resolution: actualResolution,
        strength,
      });
      toast.success('任务提交成功');
    } catch (err) {
      console.error('Generation failed:', err);
      toast.error('任务提交失败');
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
      <PromptInput value={prompt} onChange={setPrompt} toolKey="image_to_image" label="编辑描述" placeholder="描述你想要的修改，如：将颜色改为暖色调..." rows={3} />
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          编辑强度: {strength.toFixed(2)}
        </label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={strength}
          onChange={(e) => setStrength(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>保持原图</span>
          <span>大幅修改</span>
        </div>
      </div>
      <RatioSelector value={ratio} onChange={setRatio} showOriginal originalLabel={originalDimensions ? `${originalDimensions.w}:${originalDimensions.h}` : undefined} />
      <ResolutionSelector ratio={ratio} value={resolution} onChange={setResolution} showOriginal originalLabel={originalDimensions ? `${originalDimensions.w}×${originalDimensions.h}` : undefined} />
      <button
        onClick={handleGenerate}
        disabled={submitting || !imageUrl || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />提交中...</> : <><Sparkles className="h-4 w-4" />开始编辑<span className="ml-1 text-xs opacity-80">≈{formatCostDisplay(
          resolution === 'original' && originalDimensions
            ? estimateCost(findClosestTier(originalDimensions.w * originalDimensions.h), 1, 1)
            : estimateCost(resolution === 'original' ? '2K' : resolution, 1, 1)
        )}</span></>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {results.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {results.map((url, i) => (
            <div key={i} className="group relative overflow-hidden rounded-xl border border-border bg-card">
              <img src={resolveImageUrl(url)} alt={`Result ${i + 1}`} className="w-full object-contain" />
              <div className="p-3 border-t border-border">
                <GenerationResultActions projectId={String(projectId)} imageUrl={url} showAddToLibrary />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">上传参考图片并描述修改内容</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="图生图"
      description="基于参考图片进行风格转换或内容编辑"
      toolKey="image_to_image"
      toolName="图生图"
      paramsPanel={paramsPanel}
      canvas={canvas}
    />
  );
}
