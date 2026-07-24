'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Sparkles, Loader2, Undo2, Redo2, Eraser, Paintbrush,
  Wand2, Download, Eye, Check,
} from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { PromptInput } from '@/components/tools/prompt-input';
import { resolveImageUrl, toolsApi, downloadImage } from '@/lib/api';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { computeSize, estimateCost, formatCostDisplay, deriveRatio, findClosestTier } from '@/lib/types';
import { toast } from 'sonner';

type TabKey = 'inpaint' | 'remove-bg';

export default function ImageEditPage() {
  const params = useParams();
  const projectId = params.id as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(20);
  const [ratio, setRatio] = useState('original');
  const [resolution, setResolution] = useState('original');
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<TabKey>('inpaint');
  const [originalDimensions, setOriginalDimensions] = useState<{ w: number; h: number } | null>(null);

  // Remove-bg tab state
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [resultUrl, setResultUrl] = useState('');
  const [processing, setProcessing] = useState(false);

  const { submitting, submitTask } = useTaskQueue({ projectId });

  if (!params.id) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check for pre-selected image from sessionStorage
  useEffect(() => {
    const sourceImage = sessionStorage.getItem('inpaint_source_image');
    if (sourceImage) {
      setImageUrl(sourceImage);
      sessionStorage.removeItem('inpaint_source_image');
    }
  }, []);

  const loadImage = useCallback((url: string) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setOriginalDimensions({ w: img.naturalWidth, h: img.naturalHeight });
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!canvas || !maskCanvas) return;

      const maxW = 600;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = maskCanvas.width = img.width * scale;
      canvas.height = maskCanvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const maskCtx = maskCanvas.getContext('2d');
      maskCtx?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      setHistory([]);
      setHistoryIndex(-1);
    };
    img.src = url;
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/upload`, {
        method: 'POST',
        body: (() => { const fd = new FormData(); fd.append('file', file); return fd; })(),
      });
      const data = await res.json();
      setImageUrl(data.url);
      loadImage(data.url);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const saveToHistory = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(data);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    const pos = getCanvasPos(e);
    // Inpaint: red brush (mark to replace)
    // Remove-bg: green brush (mark to keep)
    ctx.fillStyle = activeTab === 'inpaint' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
    }
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    ctx?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    saveToHistory();
  };

  const getMaskUrl = (): Promise<string> => {
    return new Promise((resolve) => {
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) { resolve(''); return; }
      resolve(maskCanvas.toDataURL('image/png'));
    });
  };

  // Inpaint submit
  const handleInpaint = async () => {
    if (!imageUrl || !prompt.trim()) return;
    try {
      const maskUrl = await getMaskUrl();
      // Resolve ratio: 'original' → derive from source image dimensions
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
      await submitTask('inpaint', {
        image_url: imageUrl,
        mask_url: maskUrl,
        prompt,
        ratio: actualRatio,
        resolution: actualResolution,
      });
      toast.success('局部重绘任务已提交');
    } catch (err) {
      console.error('Inpaint failed:', err);
      toast.error('提交失败，请重试');
    }
  };

  // Remove background (local processing)
  const handleRemoveBg = async () => {
    if (!imageUrl) return;
    setProcessing(true);
    setResultUrl('');
    try {
      const maskUrl = await getMaskUrl();
      const res = await toolsApi.removeBgMask({
        image_url: imageUrl,
        mask_url: maskUrl,
        bg_color: bgColor,
      });
      setResultUrl(res.url);
      toast.success('背景去除完成');
    } catch (err) {
      console.error('Remove bg failed:', err);
      toast.error('处理失败，请重试');
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (imageUrl) loadImage(imageUrl);
    else setOriginalDimensions(null);
  }, [imageUrl, loadImage]);

  // Reset mask when switching tabs
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    clearMask();
    setResultUrl('');
  };

  const brushCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${brushSize * 2}' height='${brushSize * 2}'%3E%3Ccircle cx='${brushSize}' cy='${brushSize}' r='${brushSize - 1}' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E") ${brushSize} ${brushSize}, crosshair`;

  const paramsPanel = (
    <>
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => handleTabChange('inpaint')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            activeTab === 'inpaint'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Paintbrush className="h-3.5 w-3.5" />
          局部重绘
        </button>
        <button
          onClick={() => handleTabChange('remove-bg')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            activeTab === 'remove-bg'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Eraser className="h-3.5 w-3.5" />
          去除背景
        </button>
      </div>

      {/* Image source (shared) */}
      <ImageSourceSelector
        projectId={projectId}
        imageUrl={imageUrl || null}
        onImageChange={(url) => {
          setImageUrl(url || '');
          if (url) loadImage(url);
        }}
        label="原始图片"
      />

      {/* Brush size (shared) */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          画笔大小: {brushSize}px
        </label>
        <input
          type="range"
          min="5"
          max="50"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* Brush actions (shared) */}
      <div className="flex gap-2">
        <button
          onClick={clearMask}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
        >
          <Eraser className="h-3 w-3" />
          清除涂抹
        </button>
        <button
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 transition-all"
        >
          <Undo2 className="h-3 w-3" />
          撤销
        </button>
        <button
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 transition-all"
        >
          <Redo2 className="h-3 w-3" />
          重做
        </button>
      </div>

      {/* Inpaint-specific: prompt + ratio + resolution */}
      {activeTab === 'inpaint' && (
        <>
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            toolKey="inpaint"
            label="替换描述"
            placeholder="描述遮罩区域要替换成什么，如：替换为金色皇冠..."
            rows={3}
          />
          <RatioSelector value={ratio} onChange={setRatio} showOriginal originalLabel={originalDimensions ? `${originalDimensions.w}:${originalDimensions.h}` : undefined} />
          <ResolutionSelector ratio={ratio} value={resolution} onChange={setResolution} showOriginal originalLabel={originalDimensions ? `${originalDimensions.w}×${originalDimensions.h}` : undefined} />
          <button
            onClick={handleInpaint}
            disabled={submitting || !imageUrl || !prompt.trim()}
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
                局部重绘
                <span className="ml-1 text-xs opacity-80">≈{formatCostDisplay(resolution === 'original' && originalDimensions ? estimateCost(findClosestTier(originalDimensions.w * originalDimensions.h), 1, 1) : estimateCost(resolution, 1, 1))}</span>
              </>
            )}
          </button>
        </>
      )}

      {/* Remove-bg-specific: color picker + process button */}
      {activeTab === 'remove-bg' && (
        <>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs text-muted-foreground">
              用画笔涂抹要<strong className="text-foreground">保留</strong>的区域，
              未涂抹区域将替换为背景色。
            </p>
            <label className="mb-2 block text-sm font-medium text-foreground">
              背景颜色
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded-lg border border-border bg-background"
              />
              <div className="flex gap-1.5">
                {['#FFFFFF', '#000000', '#00FF00', '#FF0000', '#0000FF'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setBgColor(c)}
                    className="h-8 w-8 rounded-lg border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: bgColor === c ? 'var(--primary)' : 'var(--border)',
                    }}
                  >
                    {bgColor === c && <Check className="h-4 w-4 mx-auto text-primary-foreground mix-blend-difference" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={handleRemoveBg}
            disabled={processing || !imageUrl}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                去除背景
              </>
            )}
          </button>
        </>
      )}
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col items-center justify-center">
      {imageUrl ? (
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="rounded-lg border border-border" />
          <canvas
            ref={maskCanvasRef}
            className="absolute left-0 top-0 cursor-crosshair rounded-lg"
            style={{ cursor: brushCursor }}
            onMouseDown={handleMouseDown}
            onMouseMove={draw}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          {/* Instruction overlay */}
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white">
            {activeTab === 'inpaint'
              ? '涂抹要替换的区域'
              : '涂抹要保留的区域'}
          </div>
        </div>
      ) : resultUrl ? (
        /* Remove-bg result display */
        <div className="flex w-full max-w-2xl flex-col items-center gap-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveImageUrl(resultUrl)}
              alt="处理结果"
              className="max-h-[500px] w-full object-contain"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => downloadImage(resultUrl, `bg-removed-${Date.now()}.png`)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              下载图片
            </button>
            <button
              onClick={() => {
                setResultUrl('');
                clearMask();
              }}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Paintbrush className="h-4 w-4" />
              继续编辑
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
            {activeTab === 'inpaint' ? (
              <Paintbrush className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Eraser className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <h3 className="mb-1 text-sm font-medium text-foreground">
            {activeTab === 'inpaint' ? '局部重绘' : '去除背景'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {activeTab === 'inpaint'
              ? '上传图片，用画笔涂抹要修改的区域'
              : '上传图片，用画笔涂抹要保留的区域'}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="图片编辑"
      description="局部重绘 / 去除背景"
      params={paramsPanel}
      canvas={canvas}
    />
  );
}
