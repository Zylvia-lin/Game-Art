'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Check, ArrowLeft, Wand2, RefreshCw } from 'lucide-react';
import { toolsApi, resolveImageUrl } from '@/lib/api';

interface ColorPickerBgRemovalProps {
  imageUrl: string;
  onClose: () => void;
  onComplete: (url: string) => void;
  onSave?: (blob: Blob) => void;
}

type Scene = 'general' | 'human' | 'product';

export function ColorPickerBgRemoval({ imageUrl, onClose, onComplete, onSave }: ColorPickerBgRemovalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultDims, setResultDims] = useState<{ width: number; height: number } | null>(null);
  const [scene, setScene] = useState<Scene>('general');
  const [saved, setSaved] = useState(false);

  const resolvedUrl = resolveImageUrl(imageUrl);

  const handleRemoveBg = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResultUrl(null);
    setSaved(false);
    try {
      const res = await toolsApi.removeBackgroundAI({
        image_url: resolvedUrl,
        scene,
      });
      setResultUrl(res.url);
      setResultDims({ width: res.width, height: res.height });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '处理失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [resolvedUrl, scene]);

  const handleDownload = useCallback(async () => {
    if (!resultUrl) return;
    try {
      const resp = await fetch(resultUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `removed-bg-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError('下载失败');
    }
  }, [resultUrl]);

  const handleSave = useCallback(async () => {
    if (!resultUrl || !onSave) return;
    try {
      const resp = await fetch(resultUrl);
      const blob = await resp.blob();
      await onSave(blob);
      setSaved(true);
    } catch {
      setError('保存失败');
    }
  }, [resultUrl, onSave]);

  const handleApplyAndContinue = useCallback(() => {
    if (resultUrl) {
      onComplete(resultUrl);
    }
  }, [resultUrl, onComplete]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-zinc-200">AI 去除背景</h2>
        {resultDims && (
          <span className="text-xs text-zinc-500 ml-auto">
            {resultDims.width} x {resultDims.height}px
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Scene selector */}
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">抠图场景</label>
            <div className="flex gap-2">
              {([
                { value: 'general', label: '通用' },
                { value: 'human', label: '人像' },
                { value: 'product', label: '商品' },
              ] as { value: Scene; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScene(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    scene === opt.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-600">
              通用场景适合不确定主体类型的图片；人像场景专抠人物；商品场景专抠物品。
            </p>
          </div>

          {/* Image comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Original */}
            <div className="space-y-2">
              <div className="text-sm text-zinc-400">原图</div>
              <div
                className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #1a1a22 25%, transparent 25%), linear-gradient(-45deg, #1a1a22 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a22 75%), linear-gradient(-45deg, transparent 75%, #1a1a22 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              >
                <img
                  src={resolvedUrl}
                  alt="原图"
                  className="w-full h-auto max-h-[500px] object-contain"
                />
              </div>
            </div>

            {/* Result */}
            <div className="space-y-2">
              <div className="text-sm text-zinc-400">结果</div>
              <div
                className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 flex items-center justify-center min-h-[200px]"
                style={{
                  backgroundImage: resultUrl
                    ? 'linear-gradient(45deg, #1a1a22 25%, transparent 25%), linear-gradient(-45deg, #1a1a22 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a22 75%), linear-gradient(-45deg, transparent 75%, #1a1a22 75%)'
                    : undefined,
                  backgroundSize: resultUrl ? '16px 16px' : undefined,
                  backgroundPosition: resultUrl ? '0 0, 0 8px, 8px -8px, -8px 0px' : undefined,
                }}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    <span className="text-sm text-zinc-500">AI 正在处理中...</span>
                  </div>
                ) : resultUrl ? (
                  <img
                    src={resultUrl}
                    alt="去背景结果"
                    className="w-full h-auto max-h-[500px] object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-12 text-zinc-600">
                    <Wand2 className="h-8 w-8" />
                    <span className="text-sm">点击下方按钮开始处理</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleRemoveBg}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : resultUrl ? (
                <RefreshCw className="h-4 w-4 mr-2" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              {resultUrl ? '重新处理' : '开始去除背景'}
            </Button>

            {resultUrl && !loading && (
              <>
                <Button variant="outline" onClick={handleDownload} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Download className="h-4 w-4 mr-2" />
                  下载
                </Button>
                {onSave && (
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={saved}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    {saved ? (
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                    ) : null}
                    {saved ? '已保存' : '保存到生成结果'}
                  </Button>
                )}
                <Button variant="outline" onClick={handleApplyAndContinue} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  确认并继续编辑
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
