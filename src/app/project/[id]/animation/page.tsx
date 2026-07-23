'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Play, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { TaskQueuePanel } from '@/components/tools/task-queue-panel';
import { PromptEditor } from '@/components/tools/prompt-editor';
import type { Task } from '@/lib/types';

const SUB_TOOLS = [
  { key: 'text', label: '文字描述动画', desc: '通过文字描述生成动画' },
  { key: 'skeleton', label: '骨骼动画', desc: '为角色添加骨骼动画' },
  { key: 'frame_extract', label: '帧提取', desc: '从序列帧网格图拆分出独立帧' },
];

const ANIMATION_TYPES = [
  { value: 'walk', label: '行走' },
  { value: 'run', label: '奔跑' },
  { value: 'attack', label: '攻击' },
  { value: 'idle', label: '待机' },
  { value: 'jump', label: '跳跃' },
  { value: 'death', label: '死亡' },
];

const FRAME_COUNTS = [4, 6, 8, 12, 16];

const toolKeyMap: Record<string, string> = {
  text: 'animation_text',
  skeleton: 'animation_skeleton',
  frame_extract: 'animation_frame_extract',
};

export default function AnimationPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const [subTool, setSubTool] = useState('text');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [animType, setAnimType] = useState('walk');
  const [frameCount, setFrameCount] = useState(8);
  const [ratio, setRatio] = useState('16:9');
  const [resolution, setResolution] = useState('1280x720');
  const [error, setError] = useState<string | null>(null);

  const handleTaskComplete = useCallback((_task: Task) => {}, []);
  const { submitting, submitTask } = useTaskQueue({ projectId, onTaskComplete: handleTaskComplete });

  // Check sessionStorage for pre-selected image
  useEffect(() => {
    const saved = sessionStorage.getItem('animation_source_image');
    if (saved) {
      setImageUrl(saved);
      sessionStorage.removeItem('animation_source_image');
    }
  }, []);

  const handleGenerate = async () => {
    setError(null);
    try {
      await submitTask(toolKeyMap[subTool], {
        prompt: prompt || `${animType}动画`,
        image_url: imageUrl || undefined,
        sub_tool: subTool,
        animation_type: animType,
        frame_count: frameCount,
        ratio,
        resolution,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    }
  };

  const paramsPanel = (
    <>
      {/* 子功能切换 */}
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

      <ImageSourceSelector
        label={subTool === 'frame_extract' ? '序列帧网格图' : '角色图片'}
        projectId={String(projectId)}
        imageUrl={imageUrl}
        onImageChange={setImageUrl}
        assetType="character"
      />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">动画描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder={subTool === 'frame_extract' ? '描述网格图布局（如：4行4列）' : '描述你想要的动画效果...'}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
        />
      </div>

      {subTool !== 'frame_extract' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">动画类型</label>
          <div className="grid grid-cols-3 gap-1.5">
            {ANIMATION_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setAnimType(t.value)}
                className={`rounded-lg border px-2 py-1.5 text-xs transition-all ${
                  animType === t.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">帧数</label>
        <div className="flex gap-2">
          {FRAME_COUNTS.map((c) => (
            <button
              key={c}
              onClick={() => setFrameCount(c)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-all ${
                frameCount === c
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <PromptEditor toolKey={toolKeyMap[subTool]} toolName={SUB_TOOLS.find(t => t.key === subTool)?.label || ''} />
      <RatioSelector value={ratio} onChange={setRatio} />
      <ResolutionSelector value={resolution} onChange={setResolution} />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={submitting || !imageUrl}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            已提交任务...
          </>
        ) : (
          <>
            <Play size={18} />
            生成动画
          </>
        )}
      </button>
    </>
  );

  return (
    <ToolLayout
      title="动画生成"
      description="为角色生成各种动画效果"
      paramsPanel={paramsPanel}
      queuePanel={<TaskQueuePanel projectId={projectId} />}
      canvas={
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Play size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">配置参数并点击生成，任务将在队列中处理</p>
            <p className="mt-1 text-xs opacity-60">生成的动画帧将自动添加到项目资产库</p>
          </div>
        </div>
      }
    />
  );
}
