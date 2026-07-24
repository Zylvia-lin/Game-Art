'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Download, Eye, Trash2, AlertTriangle, Pencil, Check, X } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector, RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { PromptInput } from '@/components/tools/prompt-input';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { projectsApi, generateApi, resolveImageUrl, downloadImage, type Task } from '@/lib/api';
import { computeSize, estimateCost, formatCostDisplay } from '@/lib/types';

interface ImageItem {
  id: string;
  url: string;
  taskId: string;
  taskIndex: number;
  name: string;
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
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renaming, setRenaming] = useState(false);

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
        const names = t.output_names || [];
        for (let i = 0; i < t.output_urls!.length; i++) {
          const url = t.output_urls![i];
          items.push({
            id: `${t.id}-${i}`,
            url: resolveImageUrl(url),
            taskId: t.id,
            taskIndex: i,
            name: names[i] || `text2img_${t.created_at.slice(0, 10).replace(/-/g, '')}_${i + 1}`,
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

  const handleConfirmDelete = async () => {
    if (deleteIdx === null) return;
    const img = images[deleteIdx];
    setDeleting(true);
    try {
      await generateApi.deleteTask(img.taskId);
      setImages((prev) => prev.filter((_, i) => i !== deleteIdx));
      setPreviewIdx(null);
      setDeleteIdx(null);
    } catch {
      setError('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  const handleStartRename = (idx: number) => {
    setEditingIdx(idx);
    setEditingName(images[idx].name);
  };

  const handleCancelRename = () => {
    setEditingIdx(null);
    setEditingName('');
  };

  const handleConfirmRename = async () => {
    if (editingIdx === null) return;
    const img = images[editingIdx];
    const newName = editingName.trim();
    if (!newName || newName === img.name) {
      setEditingIdx(null);
      setEditingName('');
      return;
    }
    setRenaming(true);
    try {
      await generateApi.renameOutput(img.taskId, img.taskIndex, newName);
      setImages((prev) =>
        prev.map((item, i) => (i === editingIdx ? { ...item, name: newName } : item))
      );
      setEditingIdx(null);
      setEditingName('');
    } catch {
      setError('重命名失败，请重试');
    } finally {
      setRenaming(false);
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
              ≈{formatCostDisplay(estimateCost(resolution, 1, 0))}
            </span>
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
                    {/* Name badge - top left */}
                    {editingIdx === idx ? (
                      <div className="absolute inset-x-0 top-0 flex items-center gap-1 bg-black/80 px-2 py-1.5 backdrop-blur-sm">
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmRename();
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                          disabled={renaming}
                          className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
                          placeholder="输入名称"
                        />
                        <button
                          onClick={handleConfirmRename}
                          disabled={renaming}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-white hover:bg-primary/90"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={handleCancelRename}
                          disabled={renaming}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-white hover:bg-muted/80"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="absolute inset-x-0 top-0 flex items-center gap-1 bg-gradient-to-b from-black/70 to-transparent px-2 py-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="flex-1 truncate text-xs text-white drop-shadow">{img.name}</span>
                        <button
                          onClick={() => handleStartRename(idx)}
                          className="flex h-4 w-4 shrink-0 items-center justify-center text-white/70 hover:text-white"
                          title="编辑名称"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
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
                        onClick={() => handleDownload(img.url, `${img.name}.png`)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/90 text-foreground hover:bg-background"
                        title="下载"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteIdx(idx)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/90 text-white hover:bg-destructive"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
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
                        `${images[previewIdx].name}.png`
                      )
                    }
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-4 w-4" />
                    下载图片
                  </button>
                  <button
                    onClick={() => setDeleteIdx(previewIdx)}
                    className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirmation dialog */}
          {deleteIdx !== null && images[deleteIdx] && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
              onClick={() => !deleting && setDeleteIdx(null)}
            >
              <div
                className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">确认删除</h3>
                    <p className="text-xs text-muted-foreground">此操作不可撤销</p>
                  </div>
                </div>
                <p className="mb-5 text-sm text-muted-foreground">
                  删除后图片将永久消失，<span className="font-medium text-foreground">无法恢复</span>。
                  请确认您已下载到本地。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteIdx(null)}
                    disabled={deleting}
                    className="flex-1 rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={deleting}
                    className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
                  >
                    {deleting ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        删除中...
                      </span>
                    ) : (
                      '确认删除'
                    )}
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
