'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Map } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { PromptEditor } from '@/components/tools/prompt-editor';
import type { Task } from '@/lib/types';

const SUB_TOOLS = [
  { key: 'map_generate', label: '地图生成', desc: '根据描述生成游戏地图' },
  { key: 'map_split', label: '组件拆分', desc: '拆分为tileset组件' },
] as const;

const MAP_TYPES = [
  { value: 'top', label: '俯视角' },
  { value: 'side', label: '侧视角' },
] as const;

const toolKeyMap: Record<string, string> = {
  map_generate: 'scene_map_generate',
  map_split: 'scene_map_split',
};

export default function ScenePage() {
  const params = useParams();
  const projectId = params.id;
  const [subTool, setSubTool] = useState<string>('map_generate');
  const [prompt, setPrompt] = useState('');
  const [mapType, setMapType] = useState('top');
  const [tileSize, setTileSize] = useState(32);
  const [ratio, setRatio] = useState('16:9');
  const [resolution, setResolution] = useState('1920x1080');
  const [sourceImage, setSourceImage] = useState<string | null>(null);

  const handleTaskComplete = useCallback((_task: Task) => {}, []);
  const { submitting, submitTask } = useTaskQueue({ projectId, onTaskComplete: handleTaskComplete });

  // Wait for params to load
  if (!params.id) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check sessionStorage for pre-selected image
  useEffect(() => {
    const saved = sessionStorage.getItem('scene_source_image');
    if (saved) {
      setSourceImage(saved);
      sessionStorage.removeItem('scene_source_image');
    }
  }, []);

  const needsImage = subTool === 'map_split';

  const handleGenerate = async () => {
    if (subTool === 'map_generate' && !prompt.trim()) return;
    if (subTool === 'map_split' && !sourceImage) return;
    await submitTask(toolKeyMap[subTool], {
      prompt: prompt || '基于参考图拆分',
      sub_tool: subTool,
      image_url: sourceImage || undefined,
      map_type: mapType,
      tile_size: tileSize,
      ratio,
      resolution,
    });
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
      {needsImage && (
        <ImageSourceSelector
          label="参考地图"
          projectId={String(projectId)}
          imageUrl={sourceImage}
          onImageChange={setSourceImage}
          assetType="scene"
        />
      )}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">场景描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="描述你想要的游戏场景，如：一片神秘的精灵森林，有发光的蘑菇和古老的树木..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">视角</label>
        <div className="flex gap-2">
          {MAP_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setMapType(t.value)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-all ${
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
        <label className="mb-1.5 block text-sm font-medium text-foreground">Tile 尺寸</label>
        <div className="flex gap-2">
          {[16, 32, 64].map((s) => (
            <button
              key={s}
              onClick={() => setTileSize(s)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-all ${
                tileSize === s
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {s}px
            </button>
          ))}
        </div>
      </div>
      <PromptEditor toolKey={toolKeyMap[subTool]} toolName={subTool === 'map_generate' ? '地图生成' : '地图拆分'} />
      <RatioSelector value={ratio} onChange={setRatio} />
      <ResolutionSelector ratio={ratio} value={resolution} onChange={setResolution} />
      <button
        onClick={handleGenerate}
        disabled={submitting || (subTool === 'map_generate' ? !prompt.trim() : !sourceImage)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            已提交任务...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            生成场景
          </>
        )}
      </button>
    </>
  );

  return (
    <ToolLayout
      title="场景生成"
      description="根据描述生成实机地图，支持地图组件拆分"
      toolKey="scene_map_generate"
      toolName="场景地图生成"
      params={paramsPanel}
      canvas={
        <div className="flex h-full flex-col">
          <div className="flex-1">
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-8">
              <Map className="mb-4 h-16 w-16 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-medium text-foreground">场景地图生成</h3>
              <p className="max-w-md text-center text-sm text-muted-foreground">
                根据文字描述生成实机游戏地图，支持俯视角和侧视角，可拆分为 tileset 组件
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
