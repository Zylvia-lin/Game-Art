'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Upload, Sparkles, Loader2, Download } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { generateApi } from '@/lib/api';

export default function ImageToImagePage() {
  const params = useParams();
  const projectId = Number(params.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [strength, setStrength] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await generateApi.upload(file);
      setImageUrl(res.url);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleGenerate = async () => {
    if (!imageUrl || !prompt.trim()) return;
    setLoading(true);
    try {
      const res = await generateApi.imageToImage({
        project_id: projectId,
        image_url: imageUrl,
        prompt,
        strength,
      });
      setResults(res.output_urls);
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const paramsPanel = (
    <>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">参考图片</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        {imageUrl ? (
          <div className="relative overflow-hidden rounded-lg border border-border">
            <img src={imageUrl} alt="Reference" className="w-full object-contain max-h-48" />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-2 right-2 rounded-md bg-card/80 px-2 py-1 text-xs text-foreground backdrop-blur-sm hover:bg-card transition-colors"
            >
              更换
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all"
          >
            <Upload className="h-6 w-6" />
            <span className="text-sm">点击上传参考图片</span>
          </button>
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">编辑描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="描述你想要的修改，如：将颜色改为暖色调..."
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
        />
      </div>
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
        disabled={loading || !imageUrl || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />处理中...</> : <><Sparkles className="h-4 w-4" />开始编辑</>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">AI 正在编辑图片...</p>
          </div>
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {results.map((url, i) => (
            <div key={i} className="group relative overflow-hidden rounded-xl border border-border bg-card">
              <img src={url} alt={`Result ${i + 1}`} className="w-full object-contain" />
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={url} download target="_blank" className="rounded-lg bg-card/80 p-2 text-foreground backdrop-blur-sm hover:bg-card transition-colors">
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Upload className="h-8 w-8 text-muted-foreground" />
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
      description="基于参考图片进行整体编辑"
      toolKey="image_to_image"
      toolName="图生图编辑"
      params={paramsPanel}
      canvas={canvas}
    />
  );
}
