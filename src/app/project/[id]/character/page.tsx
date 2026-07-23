'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, User } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector, RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { GenerationResultActions } from '@/components/tools/generation-result-actions';
import { TaskQueuePanel } from '@/components/tools/task-queue-panel';
import { projectsApi } from '@/lib/api';
import { useTaskQueue } from '@/hooks/use-task-queue';
import type { Task } from '@/lib/types';

const SUB_TOOLS = [
  { key: 'tpose', label: 'T-pose 生成', desc: '生成标准站姿角色' },
  { key: 'three_view', label: '三视图生成', desc: '生成正面/侧面/背面三视图' },
  { key: 'directions', label: '多方向生成', desc: '生成四/八方向视图' },
  { key: 'part_split', label: '部件拆分', desc: '拆分为独立部件层' },
] as const;

const TOOL_KEY_MAP: Record<string, string> = {
  tpose: 'character_tpose',
  three_view: 'character_three_view',
  directions: 'character_directions',
  part_split: 'character_part_split',
};

export default function CharacterPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [projectStyle, setProjectStyle] = useState<string>('pixel');

  // Load project to get default style
  useEffect(() => {
    projectsApi.get(projectId).then(p => {
      if (p?.style) {
        setProjectStyle(p.style);
        setStyle(p.style);
      }
    }).catch(() => {});
  }, [projectId]);

  // Check sessionStorage for pre-selected image
  useEffect(() => {
    const saved = sessionStorage.getItem('preselect_image');
    if (saved) {
      setSourceImage(saved);
      sessionStorage.removeItem('preselect_image');
    }
  }, []);

  const [subTool, setSubTool] = useState<string>('tpose');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(projectStyle);
  const [directions, setDirections] = useState(8);
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1024x1024');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);

  const handleTaskComplete = useCallback((task: Task) => {
    if (task.output_urls && task.output_urls.length > 0) {
      setResults(prev => [...task.output_urls, ...prev]);
    }
  }, []);

  const { submitting, submitTask } = useTaskQueue({
    projectId,
    onTaskComplete: handleTaskComplete,
  });

  const handleGenerate = async () => {
    if (subTool === 'tpose' && !prompt.trim()) return;
    if ((subTool === 'directions' || subTool === 'part_split') && !sourceImage) return;
    if (subTool === 'three_view' && !prompt.trim() && !sourceImage) return;

    try {
      await submitTask(TOOL_KEY_MAP[subTool], {
        prompt: prompt || '基于输入图片生成',
        image_url: sourceImage || undefined,
        directions,
        style,
        ratio,
        resolution,
      });
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  const needsImage = subTool === 'directions' || subTool === 'part_split';
  const optionalImage = subTool === 'three_view';

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

      {(needsImage || optionalImage) && (
        <ImageSourceSelector
          projectId={String(projectId)}
          imageUrl={sourceImage}
          onImageChange={setSourceImage}
          label={needsImage ? '角色图片' : '参考图片（可选）'}
          assetType="character"
        />
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          {needsImage ? '补充描述（可选）' : optionalImage && sourceImage ? '补充描述（可选）' : '角色描述'}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder={needsImage ? '描述需要调整的内容...' : optionalImage && sourceImage ? '描述需要调整的内容...' : '描述角色外观，如：身穿银色铠甲的女骑士，手持长剑...'}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
        />
      </div>
      <StyleSelector value={style} onChange={setStyle} />
      {subTool === 'directions' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">方向数</label>
          <div className="flex gap-2">
            {[4, 8].map((d) => (
              <button
                key={d}
                onClick={() => setDirections(d)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                  directions === d
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {d} 方向
              </button>
            ))}
          </div>
        </div>
      )}
      <RatioSelector value={ratio} onChange={setRatio} />
      <ResolutionSelector value={resolution} onChange={setResolution} />
      <button
        onClick={handleGenerate}
        disabled={submitting || (subTool === 'tpose' ? !prompt.trim() : !sourceImage)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />提交中...</> : <><Sparkles className="h-4 w-4" />生成角色</>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {results.length > 0 ? (
        <div className="space-y-4">
          {results.map((url, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <img src={url} alt={`Character ${i + 1}`} className="w-full object-contain" />
              <GenerationResultActions imageUrl={url} projectId={String(projectId)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <User className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">选择功能并描述角色，开始生成</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="角色生成"
      description="生成游戏角色：T-pose、三视图、多方向、部件拆分"
      paramsPanel={paramsPanel}
      canvas={canvas}
      queuePanel={<TaskQueuePanel projectId={projectId} />}
    />
  );
}
