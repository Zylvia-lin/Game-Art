'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Eraser, Paintbrush, Sparkles, Loader2, Undo2, Redo2, X, Check, Wand2, ZoomIn, ZoomOut, Maximize, Brush } from 'lucide-react';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { useButtonCooldown } from '@/hooks/use-button-cooldown';
import { resolveImageUrl, generateApi } from '@/lib/api';
import { clampDimensions, estimateCostFromPixels, formatCostDisplay } from '@/lib/types';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { PromptInput } from '@/components/tools/prompt-input';
import { ResultImageCard } from '@/components/tools/result-image-card';
import { ColorPickerBgRemoval } from '@/components/tools/color-picker-bg-removal';
import { toast } from 'sonner';
import { ToolLayout } from '@/components/tools/tool-layout';

type TabKey = 'inpaint' | 'remove-bg';

export default function ImageEditPage() {
  const params = useParams();
  const projectId = String(params.id || '');
  const { submitting, submitTask, completedTasks, refreshTasks } = useTaskQueue({ projectId });
  const { isCoolingDown: genCooldown, triggerCooldown: genTrigger } = useButtonCooldown();

  // --- State ---
  const [activeTab, setActiveTab] = useState<TabKey>('inpaint');
  const [imageUrl, setImageUrl] = useState('');
  const [originalDimensions, setOriginalDimensions] = useState<{ w: number; h: number } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Mask modal state
  const [showMaskModal, setShowMaskModal] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [zoom, setZoom] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasMask, setHasMask] = useState(false);
  const [modalReady, setModalReady] = useState(false);
  const [savedMaskUrl, setSavedMaskUrl] = useState('');

  // Refs
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalMaskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageNaturalSize = useRef<{ w: number; h: number } | null>(null);

  // --- Derived state: inpaint results from completed tasks ---
  const results = useMemo(() => {
    return completedTasks
      .filter((t) => t.tool_key === 'inpaint' || t.tool_key === 'remove_bg')
      .sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())
      .flatMap((t) => {
        const urls = Array.isArray(t.output_urls) ? t.output_urls : [];
        const names = t.output_names || [];
        return urls.map((url, i) => ({ url, taskId: t.id, taskIndex: i, name: names[i] || '' }));
      });
  }, [completedTasks]);

  const handleDeleteResult = async (taskId: string, taskIndex: number) => {
    await generateApi.deleteOutput(taskId, taskIndex);
    refreshTasks();
  };

  // --- Image loading into modal canvas ---
  const loadModalImage = useCallback(async () => {
    if (!imageUrl) return;
    const fullUrl = resolveImageUrl(imageUrl);

    const drawToCanvas = (img: HTMLImageElement, nat: { w: number; h: number }) => {
      const canvas = modalCanvasRef.current;
      const maskCanvas = modalMaskCanvasRef.current;
      if (!canvas || !maskCanvas) return;
      canvas.width = nat.w;
      canvas.height = nat.h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      maskCanvas.width = nat.w;
      maskCanvas.height = nat.h;
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      setHistory([]);
      setHistoryIndex(-1);
      setHasMask(false);
      setSavedMaskUrl('');
      setModalReady(true);
    };

    // For data:/blob: URIs, load directly (no fetch needed)
    if (fullUrl.startsWith('data:') || fullUrl.startsWith('blob:')) {
      const img = new window.Image();
      img.onload = () => {
        const nat = { w: img.naturalWidth || 512, h: img.naturalHeight || 512 };
        imageNaturalSize.current = nat;
        drawToCanvas(img, nat);
      };
      img.onerror = () => {
        toast.error('图片加载失败');
        setModalReady(false);
      };
      img.src = fullUrl;
      return;
    }

    // For HTTP URLs: try fetch+blob first (avoids CORS taint on canvas)
    try {
      const resp = await fetch(fullUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const img = new window.Image();
      img.onload = () => {
        const nat = { w: img.naturalWidth || 512, h: img.naturalHeight || 512 };
        imageNaturalSize.current = nat;
        drawToCanvas(img, nat);
        URL.revokeObjectURL(blobUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        // Fallback: direct load without crossOrigin
        const img2 = new window.Image();
        img2.onload = () => {
          const nat = { w: img2.naturalWidth || 512, h: img2.naturalHeight || 512 };
          imageNaturalSize.current = nat;
          drawToCanvas(img2, nat);
        };
        img2.onerror = () => {
          toast.error('图片加载失败');
          setModalReady(false);
        };
        img2.src = fullUrl;
      };
      img.src = blobUrl;
    } catch {
      // Fallback: direct load without fetch
      const img = new window.Image();
      img.onload = () => {
        const nat = { w: img.naturalWidth || 512, h: img.naturalHeight || 512 };
        imageNaturalSize.current = nat;
        drawToCanvas(img, nat);
      };
      img.onerror = () => {
        toast.error('图片加载失败');
        setModalReady(false);
      };
      img.src = fullUrl;
    }
  }, [imageUrl]);

  // Load image when mask modal opens (waits for DOM to be ready)
  useEffect(() => {
    if (!showMaskModal || !imageUrl) return;
    // Use requestAnimationFrame to ensure canvas refs are mounted
    const raf = requestAnimationFrame(() => {
      loadModalImage();
    });
    return () => cancelAnimationFrame(raf);
  }, [showMaskModal, imageUrl, loadModalImage]);

  // Read original dimensions when image changes
  useEffect(() => {
    if (!imageUrl) { setOriginalDimensions(null); return; }
    const img = new window.Image();
    img.onload = () => setOriginalDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setOriginalDimensions(null);
    img.src = resolveImageUrl(imageUrl);
  }, [imageUrl]);

  // --- Mask modal operations ---
  const openMaskModal = () => {
    if (!imageUrl) {
      toast.error('请先选择原始图片');
      return;
    }
    setModalReady(false);
    setShowMaskModal(true);
  };

  const confirmMask = () => {
    // Save mask data URL while canvas is still mounted (modal closes after this)
    const maskCanvas = modalMaskCanvasRef.current;
    if (maskCanvas) {
      const nat = imageNaturalSize.current;
      if (nat && (nat.w !== maskCanvas.width || nat.h !== maskCanvas.height)) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = nat.w;
        tempCanvas.height = nat.h;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(maskCanvas, 0, 0, maskCanvas.width, maskCanvas.height, 0, 0, nat.w, nat.h);
          setSavedMaskUrl(tempCanvas.toDataURL('image/png'));
        } else {
          setSavedMaskUrl(maskCanvas.toDataURL('image/png'));
        }
      } else {
        setSavedMaskUrl(maskCanvas.toDataURL('image/png'));
      }
    }
    setHasMask(true);
    setShowMaskModal(false);
    toast.success('遮罩已保存');
  };

  const cancelMask = () => {
    setShowMaskModal(false);
    setHistory([]);
    setHistoryIndex(-1);
    setHasMask(false);
    setSavedMaskUrl('');
    setModalReady(false);
  };

  // --- Canvas drawing ---
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = modalMaskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const maskCanvas = modalMaskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    const pos = getCanvasPos(e);
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

  const saveToHistory = () => {
    const maskCanvas = modalMaskCanvasRef.current;
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
    const maskCanvas = modalMaskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const maskCanvas = modalMaskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const clearMask = () => {
    const maskCanvas = modalMaskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    ctx?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setHasMask(false);
    setSavedMaskUrl('');
    setHistory([]);
    setHistoryIndex(-1);
    // Save the cleared state as first history entry
    if (ctx) {
      const data = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      setHistory([data]);
      setHistoryIndex(0);
    }
  };

  const getMaskUrl = async (): Promise<string> => {
    const maskCanvas = modalMaskCanvasRef.current;
    if (!maskCanvas) return '';
    const nat = imageNaturalSize.current;
    if (nat && (nat.w !== maskCanvas.width || nat.h !== maskCanvas.height)) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = nat.w;
      tempCanvas.height = nat.h;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(maskCanvas, 0, 0, maskCanvas.width, maskCanvas.height, 0, 0, nat.w, nat.h);
        return tempCanvas.toDataURL('image/png');
      }
    }
    return maskCanvas.toDataURL('image/png');
  };

  // --- Submit handlers ---
  const handleInpaint = async () => {
    if (!imageUrl || !prompt.trim()) return;
    if (!hasMask || !savedMaskUrl) {
      toast.error('请先涂抹要修改的区域');
      return;
    }
    genTrigger();
    try {
      const nat = originalDimensions || imageNaturalSize.current;
      await submitTask('inpaint', {
        image_url: imageUrl,
        mask_url: savedMaskUrl,
        prompt,
        original_width: nat?.w,
        original_height: nat?.h,
      });
      toast.success('局部重绘任务已提交');
    } catch (err) {
      console.error('Inpaint failed:', err);
      toast.error('提交失败，请重试');
    }
  };

  const handleRemoveBg = () => {
    if (!imageUrl) return;
    setShowColorPicker(true);
  };

  const handleColorPickerComplete = (resultUrl: string) => {
    setShowColorPicker(false);
    // Set the result as the new image for further editing
    setImageUrl(resultUrl);
    toast.success('背景去除完成');
  };

  const handleSaveToResults = async (resultBlob: Blob) => {
    try {
      // 1. Upload the processed image to backend
      const file = new File([resultBlob], `bg-removed-${Date.now()}.png`, { type: 'image/png' });
      const uploadRes = await generateApi.upload(file);

      // 2. Create a completed task referencing the uploaded image
      await generateApi.createCompletedTask({
        project_id: projectId,
        tool_key: 'remove_bg',
        output_url: uploadRes.url,
        output_name: '去除背景',
      });

      // 3. Refresh task list to show the new result
      await refreshTasks();
      toast.success('已保存到生成结果');
    } catch (err) {
      toast.error('保存失败: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // --- Tab switching ---
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setHasMask(false);
    setSavedMaskUrl('');
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(0.2, Math.min(5, prev + delta)));
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    // Prevent browser zoom (Ctrl+wheel changes page zoom)
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.2, Math.min(5, Math.round((prev + delta) * 100) / 100)));
  };

  const brushCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${brushSize * 2}' height='${brushSize * 2}'%3E%3Ccircle cx='${brushSize}' cy='${brushSize}' r='${brushSize - 1}' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E") ${brushSize} ${brushSize}, crosshair`;

  const costDisplay = originalDimensions
    ? formatCostDisplay(estimateCostFromPixels(
        clampDimensions(originalDimensions.w, originalDimensions.h).w *
        clampDimensions(originalDimensions.w, originalDimensions.h).h,
        1, 1
      ))
    : formatCostDisplay(estimateCostFromPixels(4194304, 1, 1));

  // --- Params panel ---
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

      {/* Image source */}
      <ImageSourceSelector
        projectId={projectId}
        imageUrl={imageUrl || null}
        onImageChange={(url) => {
          setImageUrl(url || '');
          setHasMask(false);
          setSavedMaskUrl('');
        }}
        label="原始图片"
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

      {/* Mask button - opens modal */}
      <button
        onClick={openMaskModal}
        disabled={!imageUrl}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <Brush className="h-4 w-4" />
        {hasMask ? '编辑遮罩' : '涂抹遮罩'}
        {hasMask && (
          <span className="ml-1 flex items-center gap-1 text-xs text-green-500">
            <Check className="h-3 w-3" /> 已设置
          </span>
        )}
      </button>

      {/* Inpaint-specific */}
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
          <button
            onClick={handleInpaint}
            disabled={submitting || genCooldown || !imageUrl || !prompt.trim() || !hasMask}
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
                <span className="ml-1 text-xs opacity-80">{costDisplay}</span>
              </>
            )}
          </button>
        </>
      )}

      {/* Remove-bg-specific */}
      {activeTab === 'remove-bg' && (
        <>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              点击"去除背景"后，在弹出的面板中点击图片上的背景区域拾取颜色，可多次拾取不同颜色。拖动容差滑块控制匹配范围，实时预览透明效果。
            </p>
          </div>
          <button
            onClick={handleRemoveBg}
            disabled={genCooldown || !imageUrl}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
          >
            <Wand2 className="h-4 w-4" />
            去除背景
          </button>
        </>
      )}
    </>
  );

  // --- Canvas area: results only (no original image preview) ---
  const canvas = (
    <div className="flex h-full flex-col">
      {results.length > 0 ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="columns-1 gap-3 sm:columns-3 lg:columns-5">
            {results.map((r, i) => (
              <ResultImageCard
                key={`${r.taskId}-${r.taskIndex}`}
                url={r.url}
                projectId={projectId}
                index={i}
                name={r.name}
                taskId={r.taskId}
                taskIndex={r.taskIndex}
                onDelete={() => handleDeleteResult(r.taskId, r.taskIndex)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
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
                ? '上传图片，点击"涂抹遮罩"选择要修改的区域'
                : '上传图片，涂抹可指定保留区域'}
            </p>
          </div>
        </div>
      )}

      {/* Color picker background removal modal */}
      {showColorPicker && imageUrl && (
        <ColorPickerBgRemoval
          imageUrl={imageUrl}
          onClose={() => setShowColorPicker(false)}
          onComplete={handleColorPickerComplete}
          onSave={handleSaveToResults}
        />
      )}

      {/* Mask painting modal */}
      {showMaskModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
          {/* Modal header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-foreground">涂抹遮罩</h3>
              <span className="text-xs text-muted-foreground">
                {activeTab === 'inpaint' ? '涂抹要替换的区域' : '涂抹要保留的区域'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Brush size */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-muted">
                <span className="text-xs text-muted-foreground">画笔</span>
                <input
                  type="range"
                  min="5"
                  max="80"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-24 accent-primary"
                />
                <span className="text-xs text-foreground w-8">{brushSize}px</span>
              </div>
              {/* Undo/Redo */}
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-all"
                title="撤销"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-all"
                title="重做"
              >
                <Redo2 className="h-4 w-4" />
              </button>
              <button
                onClick={clearMask}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                title="清除涂抹"
              >
                <Eraser className="h-4 w-4" />
              </button>
              {/* Zoom */}
              <div className="flex items-center gap-1 px-2">
                <button
                  onClick={() => handleZoom(-0.2)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => handleZoom(0.2)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                  title="重置缩放"
                >
                  <Maximize className="h-4 w-4" />
                </button>
              </div>
              {/* Cancel */}
              <button
                onClick={cancelMask}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="h-4 w-4" />
                取消
              </button>
              {/* Confirm */}
              <button
                onClick={confirmMask}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all"
              >
                <Check className="h-4 w-4" />
                确认
              </button>
            </div>
          </div>

          {/* Canvas area */}
          <div
            className="relative flex flex-1 items-center justify-center overflow-auto p-4"
            onWheel={handleWheelZoom}
          >
            {/* Canvas container: always rendered so refs are available */}
            <div
              className="relative inline-block shadow-2xl"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            >
              <canvas ref={modalCanvasRef} className="block" />
              <canvas
                ref={modalMaskCanvasRef}
                className="absolute left-0 top-0"
                style={{ cursor: brushCursor }}
                onMouseDown={handleMouseDown}
                onMouseMove={draw}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>
            {/* Loading overlay: shown on top of canvas while loading */}
            {!modalReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">加载图片中...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="图片编辑"
      description="局部重绘 / 去除背景"
      paramsPanel={paramsPanel}
      canvas={canvas}
    />
  );
}
