'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Undo2, Redo2, Eraser, Paintbrush } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { PromptInput } from '@/components/tools/prompt-input';
import { ResultImageCard } from '@/components/tools/result-image-card';
import { generateApi } from '@/lib/api';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { computeSize } from '@/lib/types';

export default function InpaintPage() {
  const params = useParams();
  const projectId = params.id;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(20);
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2K');
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { submitting, submitTask, completedTasks, refreshTasks } = useTaskQueue({ projectId });

  // 从已完成的任务中派生结果图片
  const completedResults = useMemo(() => {
    return completedTasks
      .filter(t => t.tool_key === 'inpaint')
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

  // Check for pre-selected image from sessionStorage (navigated from another tool)
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
      const res = await generateApi.upload(file);
      setImageUrl(res.url);
      loadImage(res.url);
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
    ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
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

  const handleGenerate = async () => {
    if (!imageUrl || !prompt.trim()) return;
    try {
      const maskUrl = await getMaskUrl();
      await submitTask('inpaint', {
        image_url: imageUrl,
        mask_url: maskUrl,
        prompt,
        ratio,
        resolution: computeSize(ratio, resolution),
      });
    } catch (err) {
      console.error('Inpaint failed:', err);
    }
  };

  useEffect(() => {
    if (imageUrl) loadImage(imageUrl);
  }, [imageUrl, loadImage]);

  // Wait for params to load
  if (!params.id) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const paramsPanel = (
    <>
      <ImageSourceSelector
        projectId={String(projectId)}
        imageUrl={imageUrl || null}
        onImageChange={(url) => {
          setImageUrl(url || '');
          if (url) loadImage(url);
        }}
        label="原始图片"
      />
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">画笔大小: {brushSize}px</label>
        <input
          type="range"
          min="5"
          max="50"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={clearMask}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
        >
          <Eraser className="h-3 w-3" />
          清除遮罩
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
      <PromptInput value={prompt} onChange={setPrompt} toolKey="inpaint" label="替换描述" placeholder="描述遮罩区域要替换成什么，如：替换为金色皇冠..." rows={3} />
      <RatioSelector value={ratio} onChange={setRatio} />
      <ResolutionSelector ratio={ratio} value={resolution} onChange={setResolution} />
      <button
        onClick={handleGenerate}
        disabled={submitting || !imageUrl || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />提交中...</> : <><Sparkles className="h-4 w-4" />局部重绘</>}
      </button>
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
            style={{ cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${brushSize * 2}' height='${brushSize * 2}'%3E%3Ccircle cx='${brushSize}' cy='${brushSize}' r='${brushSize - 1}' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E") ${brushSize} ${brushSize}, crosshair` }}
            onMouseDown={handleMouseDown}
            onMouseMove={draw}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      ) : completedResults.length > 0 ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="columns-1 gap-3 sm:columns-3 lg:columns-5">
            {completedResults.map((r, i) => (
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
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
            <Paintbrush className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">上传图片，用画笔涂抹要修改的区域</p>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="局部重绘"
      description="涂抹区域并描述替换内容"
      toolKey="inpaint"
      toolName="局部重绘"
      params={paramsPanel}
      canvas={canvas}
    />
  );
}
