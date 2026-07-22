'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Download } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector, RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { GenerationResultActions } from '@/components/tools/generation-result-actions';
import { generateApi } from '@/lib/api';

export default function TextToImagePage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('anime');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1024x1024');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await generateApi.textToImage({
        project_id: projectId,
        prompt,
        style,
        ratio,
        resolution,
      });
      setResults(res.output_urls);
      if (res.enhanced_prompt) setEnhancedPrompt(res.enhanced_prompt);
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const paramsPanel = (
    <>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">提示词</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="描述你想要生成的游戏美术资产..."
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
        />
      </div>
      <StyleSelector value={style} onChange={setStyle} />
      <RatioSelector value={ratio} onChange={setRatio} />
      <ResolutionSelector value={resolution} onChange={setResolution} />
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            生成图片
          </>
        )}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {enhancedPrompt && (
        <div className="mb-4 rounded-lg border border-border bg-card/50 p-3">
          <p className="text-xs text-muted-foreground mb-1">增强后的提示词：</p>
          <p className="text-sm text-foreground">{enhancedPrompt}</p>
        </div>
      )}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">AI 正在创作中...</p>
          </div>
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {results.map((url, i) => (
            <div key={i} className="group relative overflow-hidden rounded-xl border border-border bg-card">
              <img
                src={url}
                alt={`Generated ${i + 1}`}
                className="w-full object-contain"
              />
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={url}
                  download
                  target="_blank"
                  className="rounded-lg bg-card/80 p-2 text-foreground backdrop-blur-sm hover:bg-card transition-colors"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
              <div className="p-3 border-t border-border">
                <GenerationResultActions projectId={String(projectId)} imageUrl={url} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">输入描述，点击生成开始创作</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="文生图"
      description="通过文字描述生成游戏美术资产"
      toolKey="text_to_image"
      toolName="文生图"
      params={paramsPanel}
      canvas={canvas}
    />
  );
}
