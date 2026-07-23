'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Download, Eye } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector, RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { PromptInput } from '@/components/tools/prompt-input';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { projectsApi, generateApi, resolveImageUrl, downloadImage, type Task } from '@/lib/api';
import { computeSize } from '@/lib/types';

interface ImageItem {
  id: string;
  url: string;
  taskId: string;
  prompt: string;
  createdAt: string;
}

export default function TextToImagePage() {
  const params = useParams();
  const projectId = params.id as string;
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('pixel');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2K');
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const { submitting, submitTask } = useTaskQueue({
    projectId,
    onTaskComplete: () => {
      setJustCompleted(true);
    },
  });

  // Load completed task results for this tool
  const loadImages = useCallback(async () => {
    if (!projectId) return;
    setLoadingImages(true);
    try {
      const tasks = await generateApi.getTasks(projectId, 'text_to_image');
      const completed = tasks.filter(
        (t) => t.status === 'completed' && t.output_urls && t.output_urls.length > 0
      );
      const items: ImageItem[] = [];
      for (const t of completed) {
        for (const url of t.output_urls!) {
          items.push({
            id: `${t.id}-${url}`,
            url: resolveImageUrl(url),
            taskId: t.id,
            prompt: '',
            createdAt: t.created_at,
          });
        }
      }
      // Newest first
      items.reverse();
      setImages(items);
    } catch {
      // Silently fail
    } finally {
      setLoadingImages(false);
    }
  }, [projectId]);

  // Initial load
  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Reload when a task completes
  useEffect(() => {
    if (justCompleted) {
      loadImages();
      setJustCompleted(false);
    }
  }, [justCompleted, loadImages]);

  // Load project style as default
  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).then((project) => {
      if (project.style) setStyle(project.style);
    }).catch(() => {});
  }, [projectId]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试');
    }
  };

  const handleDownload = (url: string, filename: string) => {
    downloadImage(url, filename);
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
          </>
        )}
      </button>
    </>
  );

  const imageCount = images.length;

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
              生成结果 {imageCount > 0 && <span className="text-foreground">({imageCount})</span>}
            </h3>
            {loadingImages && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                加载中...
              </span>
            )}
          </div>

          {/* Image grid or empty state */}
          {imageCount === 0 ? (
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
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-background"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt="生成结果"
                      className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <button
                        onClick={() => setPreviewIdx(idx)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/90 text-foreground hover:bg-background"
                        title="预览"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(img.url, `text2img-${img.id}.png`)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/90 text-foreground hover:bg-background"
                        title="下载"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full-screen preview */}
          {previewIdx !== null && images[previewIdx] && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
              onClick={() => setPreviewIdx(null)}
            >
              <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[previewIdx].url}
                  alt="预览"
                  className="max-h-[85vh] max-w-full rounded-lg object-contain"
                />
                <button
                  onClick={() => setPreviewIdx(null)}
                  className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-background text-foreground shadow-lg"
                >
                  ✕
                </button>
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    onClick={() =>
                      handleDownload(
                        images[previewIdx].url,
                        `text2img-${images[previewIdx].id}.png`
                      )
                    }
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-4 w-4" />
                    下载图片
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
