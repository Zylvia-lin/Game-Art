"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { X, Download, Pipette, Undo2, Check, Loader2, Eraser, Save } from "lucide-react";
import { resolveImageUrl } from "@/lib/api";

interface ColorPickerBgRemovalProps {
  imageUrl: string;
  onClose: () => void;
  onComplete: (resultUrl: string) => void;
  onSave?: (resultBlob: Blob) => Promise<void>;
}

interface PickedColor {
  r: number;
  g: number;
  b: number;
}

export function ColorPickerBgRemoval({ imageUrl, onClose, onComplete, onSave }: ColorPickerBgRemovalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pickedColors, setPickedColors] = useState<PickedColor[]>([]);
  const [tolerance, setTolerance] = useState(30);
  const [feather, setFeather] = useState(2);
  const [isLoading, setIsLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [displayScale, setDisplayScale] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Load image and draw to canvas
  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    const loadImg = (src: string) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        imageRef.current = img;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
        }
        setIsLoading(false);
        setImageLoaded(true);
        // Calculate display scale after canvas is ready
        requestAnimationFrame(() => updateDisplayScale());
      };
      img.onerror = () => {
        if (cancelled) return;
        setIsLoading(false);
      };
      img.src = src;
    };

    // Fetch image as blob to avoid CORS canvas taint.
    // The backend serves images via StaticFiles which may not send
    // proper CORS headers, so we fetch() (covered by CORSMiddleware)
    // and create a same-origin blob URL instead.
    const resolved = resolveImageUrl(imageUrl);
    fetch(resolved)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        loadImg(objectUrl);
      })
      .catch(() => {
        // Fallback: try loading directly (may taint canvas but at least shows image)
        if (!cancelled) loadImg(resolved);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const updateDisplayScale = useCallback(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const maxW = container.clientWidth - 48;
    const maxH = container.clientHeight - 48;
    const scaleW = maxW / img.naturalWidth;
    const scaleH = maxH / img.naturalHeight;
    setDisplayScale(Math.min(scaleW, scaleH, 1));
  }, []);

  useEffect(() => {
    if (!imageLoaded) return;
    const handleResize = () => updateDisplayScale();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [imageLoaded, updateDisplayScale]);

  // Process image: remove background based on picked colors
  const processImage = useCallback(() => {
    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!canvas || !previewCanvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Copy original image to preview canvas
    previewCanvas.width = canvas.width;
    previewCanvas.height = canvas.height;
    const previewCtx = previewCanvas.getContext("2d");
    if (!previewCtx) return;

    previewCtx.drawImage(canvas, 0, 0);
    const imageData = previewCtx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
    const data = imageData.data;

    if (pickedColors.length === 0) {
      // No colors picked, just show original
      previewCtx.putImageData(imageData, 0, 0);
      return;
    }

    const toleranceSq = tolerance * tolerance * 3; // squared distance threshold
    const featherSq = (tolerance + feather * 10) * (tolerance + feather * 10) * 3;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Check if pixel matches any picked color
      let minDistSq = Infinity;
      for (const pc of pickedColors) {
        const dr = r - pc.r;
        const dg = g - pc.g;
        const db = b - pc.b;
        const distSq = dr * dr + dg * dg + db * db;
        if (distSq < minDistSq) minDistSq = distSq;
      }

      if (minDistSq <= toleranceSq) {
        // Fully transparent
        data[i + 3] = 0;
      } else if (minDistSq <= featherSq) {
        // Feather: interpolate alpha based on distance
        const ratio = (minDistSq - toleranceSq) / (featherSq - toleranceSq);
        data[i + 3] = Math.round(ratio * 255);
      }
    }

    previewCtx.putImageData(imageData, 0, 0);
  }, [pickedColors, tolerance, feather]);

  // Re-process whenever colors or tolerance change
  useEffect(() => {
    if (imageLoaded) {
      processImage();
    }
  }, [imageLoaded, pickedColors, tolerance, feather, processImage]);

  // Handle click on canvas to pick color
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const newColor = { r: pixel[0], g: pixel[1], b: pixel[2] };

    // Avoid duplicates (similar colors)
    const isDuplicate = pickedColors.some(
      (c) =>
        Math.abs(c.r - newColor.r) < 5 &&
        Math.abs(c.g - newColor.g) < 5 &&
        Math.abs(c.b - newColor.b) < 5
    );

    if (!isDuplicate) {
      setPickedColors([...pickedColors, newColor]);
    }
  };

  const handleUndoColor = () => {
    setPickedColors(pickedColors.slice(0, -1));
  };

  const handleClearColors = () => {
    setPickedColors([]);
  };

  const handleDownload = async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bg-removed-${Date.now()}.png`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    const canvas = previewCanvasRef.current;
    if (!canvas) {
      setIsProcessing(false);
      return;
    }
    // Convert canvas to blob and create a local URL
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) {
      setIsProcessing(false);
      return;
    }
    const url = URL.createObjectURL(blob);
    setIsProcessing(false);
    onComplete(url);
  };

  const handleSave = async () => {
    if (!onSave) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    setIsSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) return;
      await onSave(blob);
    } finally {
      setIsSaving(false);
    }
  };

  const colorToHex = (c: PickedColor) =>
    `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-card">
        <div className="flex items-center gap-3">
          <Eraser className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">去除背景 — 颜色拾取</h3>
          <span className="text-xs text-muted-foreground">
            点击图片背景区域拾取颜色，可多次拾取
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body: left sidebar + canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: controls */}
        <div className="w-72 shrink-0 overflow-y-auto border-r border-border bg-card p-4 space-y-4">
          {/* Picked colors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">已拾取颜色</label>
              <div className="flex gap-1">
                <button
                  onClick={handleUndoColor}
                  disabled={pickedColors.length === 0}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-all"
                  title="撤销最后一个颜色"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleClearColors}
                  disabled={pickedColors.length === 0}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-all"
                >
                  清空
                </button>
              </div>
            </div>
            {pickedColors.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3">
                <Pipette className="h-4 w-4 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground/70">
                  点击图片拾取背景色
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pickedColors.map((c, i) => (
                  <div
                    key={i}
                    className="group relative h-8 w-8 rounded-lg border-2 border-border"
                    style={{ backgroundColor: colorToHex(c) }}
                    title={`RGB(${c.r}, ${c.g}, ${c.b})`}
                  >
                    <button
                      onClick={() => setPickedColors(pickedColors.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tolerance slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">容差</label>
              <span className="text-xs font-mono text-muted-foreground">{tolerance}</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground/70">
              值越大，匹配的背景颜色范围越广
            </p>
          </div>

          {/* Feather slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">边缘羽化</label>
              <span className="text-xs font-mono text-muted-foreground">{feather}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={feather}
              onChange={(e) => setFeather(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground/70">
              羽化边缘像素，使过渡更自然
            </p>
          </div>

          {/* Preview toggle */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!showOriginal}
                onChange={(e) => setShowOriginal(!e.target.checked)}
                className="accent-primary"
              />
              <span className="text-sm text-foreground">显示透明预览</span>
            </label>
            <p className="mt-1 text-xs text-muted-foreground/70">
              关闭可对比原图效果
            </p>
          </div>

          {/* Checkerboard background indicator */}
          <div className="rounded-lg border border-border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">
              棋盘格区域表示已去除的透明背景
            </p>
          </div>

          {/* Stats */}
          {imageRef.current && (
            <div className="text-xs text-muted-foreground/70 space-y-1">
              <p>图片尺寸: {imageRef.current.naturalWidth} x {imageRef.current.naturalHeight}px</p>
              <p>已拾取: {pickedColors.length} 个颜色</p>
            </div>
          )}
        </div>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-auto p-6"
          style={{
            backgroundColor: "#1a1a22",
            backgroundImage:
              "linear-gradient(45deg, #222228 25%, transparent 25%), linear-gradient(-45deg, #222228 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222228 75%), linear-gradient(-45deg, transparent 75%, #222228 75%)",
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, 10px 0px",
          }}
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">加载图片中...</span>
            </div>
          ) : (
            <div className="relative" style={{ width: "fit-content" }}>
              {/* Hidden source canvas */}
              <canvas ref={canvasRef} className="hidden" />
              {/* Preview canvas (clickable) */}
              <canvas
                ref={previewCanvasRef}
                onClick={handleCanvasClick}
                className="block cursor-crosshair rounded-lg shadow-2xl"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  width: imageRef.current
                    ? `${imageRef.current.naturalWidth * displayScale}px`
                    : "auto",
                  height: imageRef.current
                    ? `${imageRef.current.naturalHeight * displayScale}px`
                    : "auto",
                }}
              />
              {/* Show original image overlay when toggled */}
              {showOriginal && imageRef.current && (
                <img
                  src={resolveImageUrl(imageUrl)}
                  alt="原图"
                  className="absolute inset-0 block rounded-lg shadow-2xl pointer-events-none"
                  style={{
                    width: `${imageRef.current.naturalWidth * displayScale}px`,
                    height: `${imageRef.current.naturalHeight * displayScale}px`,
                  }}
                />
              )}
              {/* Empty state hint */}
              {pickedColors.length === 0 && !showOriginal && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/70 px-4 py-2 backdrop-blur-sm">
                  <p className="text-sm text-white/90 flex items-center gap-2">
                    <Pipette className="h-4 w-4" />
                    点击图片上的背景区域拾取颜色
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer: actions */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>提示: 可多次点击拾取不同背景色</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            disabled={pickedColors.length === 0}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            下载图片
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              disabled={pickedColors.length === 0 || isSaving}
              className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  保存到生成结果
                </>
              )}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={pickedColors.length === 0 || isProcessing}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                确认并继续编辑
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
