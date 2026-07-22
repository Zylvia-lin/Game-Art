'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Sword, Copy } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector } from '@/components/tools/selectors';
import { generateApi } from '@/lib/api';

export default function PropPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [subTool, setSubTool] = useState<string>('generate');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('fantasy');
  const [variantCount, setVariantCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const toolKeyMap: Record<string, string> = {
    generate: 'prop_generate',
    variant: 'prop_variant',
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await generateApi.prop({
        project_id: projectId,
        prompt,
        sub_tool: subTool,
        variant_count: variantCount,
        style,
      });
      setResults(res.output_urls);
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeriveVariants = () => {
    setSubTool('variant');
    setPrompt((prev) => prev + ' (生成变体：不同颜色、材质、品质等级)');
  };

  const paramsPanel = (
    <>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">功能</label>
        <div className="flex gap-2">
          <button
            onClick={() => setSubTool('generate')}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
              subTool === 'generate'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            生成道具
          </button>
          <button
            onClick={() => setSubTool('variant')}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
              subTool === 'variant'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            衍生变体
          </button>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">道具描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={subTool === 'variant' ? '基于现有结果描述变体方向...' : '描述你想要的道具，如：一把燃烧着火焰的传说之剑...'}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
        />
      </div>
      <StyleSelector value={style} onChange={setStyle} />
      {subTool === 'variant' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">变体数量: {variantCount}</label>
          <input
            type="range"
            min="2"
            max="8"
            value={variantCount}
            onChange={(e) => setVariantCount(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      )}
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />生成中...</> : <><Sparkles className="h-4 w-4" />{subTool === 'variant' ? '衍生变体' : '生成道具'}</>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">AI 正在设计道具...</p>
          </div>
        </div>
      ) : results.length > 0 ? (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              {subTool === 'variant' ? '变体结果' : '生成结果'}
            </h3>
            {subTool === 'generate' && (
              <button
                onClick={handleDeriveVariants}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
              >
                <Copy className="h-3 w-3" />
                衍生变体
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {results.map((url, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
                <img src={url} alt={`Prop ${i + 1}`} className="w-full aspect-square object-contain p-2" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Sword className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">描述你想要的道具开始生成</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="道具生成"
      description="生成游戏道具及变体"
      toolKey={toolKeyMap[subTool]}
      toolName={subTool === 'variant' ? '道具变体衍生' : '道具生成'}
      params={paramsPanel}
      canvas={canvas}
    />
  );
}
