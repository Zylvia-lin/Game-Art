'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Map } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { generateApi } from '@/lib/api';

const SUB_TOOLS = [
  { key: 'map_generate', label: '地图生成', desc: '根据描述生成游戏地图' },
  { key: 'map_split', label: '组件拆分', desc: '拆分为tileset组件' },
] as const;

const MAP_TYPES = [
  { value: 'top', label: '俯视角' },
  { value: 'side', label: '侧视角' },
] as const;

export default function ScenePage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [subTool, setSubTool] = useState<string>('map_generate');
  const [prompt, setPrompt] = useState('');
  const [mapType, setMapType] = useState('top');
  const [tileSize, setTileSize] = useState(32);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const toolKeyMap: Record<string, string> = {
    map_generate: 'scene_map_generate',
    map_split: 'scene_map_split',
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await generateApi.scene({
        project_id: projectId,
        prompt,
        sub_tool: subTool,
        map_type: mapType,
        tile_size: tileSize,
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
        <label className="mb-1.5 block text-sm font-medium text-foreground">功能</label>
        <div className="space-y-1.5">
          {SUB_TOOLS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSubTool(t.key)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                subTool === t.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              <div className="font-medium">{t.label}</div>
              <div className="text-xs opacity-70">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">场景描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="描述你想要的游戏场景，如：一片神秘的精灵森林，有发光的蘑菇和古老的树木..."
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">视角</label>
        <div className="flex gap-2">
          {MAP_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setMapType(t.value)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                mapType === t.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Tile 尺寸: {tileSize}px</label>
        <input
          type="range"
          min="16"
          max="64"
          step="16"
          value={tileSize}
          onChange={(e) => setTileSize(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />生成中...</> : <><Sparkles className="h-4 w-4" />生成场景</>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">AI 正在构建场景...</p>
          </div>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          {results.map((url, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <img src={url} alt={`Scene ${i + 1}`} className="w-full object-contain" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Map className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">描述你想要的游戏场景开始生成</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="场景生成"
      description="生成游戏场景与地图"
      toolKey={toolKeyMap[subTool]}
      toolName={subTool === 'map_generate' ? '地图生成' : '地图组件拆分'}
      params={paramsPanel}
      canvas={canvas}
    />
  );
}
