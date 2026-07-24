'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ToolLayout } from '@/components/tools/tool-layout';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { PromptInput } from '@/components/tools/prompt-input';
import { ResultImageCard } from '@/components/tools/result-image-card';
import { resolveImageUrl, projectsApi } from '@/lib/api';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { formatCostDisplay, estimateCostFromPixels, clampDimensions } from '@/lib/types';

export default function ImageToImagePage() {
  const params = useParams();
  const projectId = params.id;
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [strength, setStrength] = useState(0.7);
  const [originalDimensions, setOriginalDimensions] = useState<{ w: number; h: number } | null>(null);

  // 当图片变化时读取实际分辨率
  useEffect(() => {
    if (!imageUrl) { setOriginalDimensions(null); return; }
    const img = new window.Image();
    img.onload = () => setOriginalDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setOriginalDimensions(null);
    img.src = resolveImageUrl(imageUrl);
  }, [imageUrl]);

  // Load project style (for potential future use in img2img prompts)
  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).catch(() => {});
  }, [projectId]);

  const handleTaskComplete = useCallback(() => {
    // 结果从 completedTasks 派生，无需手动管理
  }, []);

  const { submitting, submitTask, completedTasks } = useTaskQueue({
    projectId,
    onTaskComplete: handleTaskComplete,
  });

  // 从已完成的任务中派生结果图片（刷新页面后也能恢复）
  const results = useMemo(() => {
    return completedTasks
      .filter(t => t.tool_key === 'image_to_image')
      .sort((a, b) => {
        const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return tb - ta;
      })
      .flatMap(t => t.output_urls || []);
  }, [completedTasks]);

  const handleGenerate = async () => {
    if (!imageUrl || !prompt.trim()) return;
    try {
      await submitTask('image_to_image', {
        image_url: imageUrl,
        prompt,
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
      {originalDimensions && (
        <div className="text-xs text-muted-foreground">
          原图分辨率：{originalDimensions.w} × {originalDimensions.h}px
          {(() => {
            const clamped = clampDimensions(originalDimensions.w, originalDimensions.h);
            const changed = clamped.w !== originalDimensions.w || clamped.h !== originalDimensions.h;
            return changed ? ` → 生成分辨率：${clamped.w} × ${clamped.h}px` : '';
          })()}
        </div>
      )}
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
      <button
        onClick={handleGenerate}
        disabled={submitting || !imageUrl || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />提交中...</> : <><Sparkles className="h-4 w-4" />开始编辑<span className="ml-1 text-xs opacity-80">{formatCostDisplay(originalDimensions ? estimateCostFromPixels(clampDimensions(originalDimensions.w, originalDimensions.h).w * clampDimensions(originalDimensions.w, originalDimensions.h).h, 1, 1) : estimateCostFromPixels(4194304, 1, 1))}</span></>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {results.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {results.map((url, i) => (
            <ResultImageCard key={i} url={url} projectId={String(projectId)} index={i} />
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
