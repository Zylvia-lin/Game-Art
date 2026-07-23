'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Film } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { TaskQueuePanel } from '@/components/tools/task-queue-panel';
import { generateApi } from '@/lib/api';
import type { Task } from '@/lib/types';

const ACTIONS = ['idle', 'walk', 'run', 'attack', 'jump', 'death', 'custom'] as const;
const SUB_TOOLS = [
  { key: 'text', label: '文字描述动画', desc: '通过文字描述动作' },
  { key: 'skeleton', label: '骨骼动画', desc: '通过骨骼控制点' },
  { key: 'frame_extract', label: '帧提取', desc: '从宫格图提取帧' },
] as const;

export default function AnimationPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [subTool, setSubTool] = useState<string>('text');
  const [imageUrl, setImageUrl] = useState('');
  const [action, setAction] = useState('walk');
  const [customAction, setCustomAction] = useState('');
  const [frameCount, setFrameCount] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const toolKeyMap: Record<string, string> = {
    text: 'animation_text',
    skeleton: 'animation_skeleton',
    frame_extract: 'animation_frame_extract',
  };

  // Check for pre-selected image from sessionStorage
  useEffect(() => {
    const sourceImage = sessionStorage.getItem('animation_source_image');
    if (sourceImage) {
      setImageUrl(sourceImage);
      sessionStorage.removeItem('animation_source_image');
    }
  }, []);

  const handleTaskComplete = useCallback((task: Task) => {
    if (task.output_urls && task.output_urls.length > 0) {
      setResults(prev => [...task.output_urls, ...prev]);
    }
  }, []);

  const handleGenerate = async () => {
    const finalAction = action === 'custom' ? customAction : action;
    if (!finalAction) return;
    setSubmitting(true);
    try {
      // Submit task - returns immediately with task info
      await generateApi.animation({
        project_id: projectId,
        image_url: imageUrl,
        action: finalAction,
        sub_tool: subTool,
        frame_count: frameCount,
      });
      // Task is now in queue, TaskQueuePanel will show progress
    } catch (err) {
      console.error('Failed to submit task:', err);
    } finally {
      setSubmitting(false);
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
      <ImageSourceSelector
        projectId={String(projectId)}
        imageUrl={imageUrl || null}
        onImageChange={(url) => setImageUrl(url || '')}
        label="角色图片"
      />
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">动作类型</label>
        <div className="flex flex-wrap gap-1.5">
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setAction(a)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                action === a
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {a === 'custom' ? '自定义' : a}
            </button>
          ))}
        </div>
        {action === 'custom' && (
          <input
            value={customAction}
            onChange={(e) => setCustomAction(e.target.value)}
            placeholder="描述自定义动作..."
            className="mt-2 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">帧数: {frameCount}</label>
        <input
          type="range"
          min="2"
          max="16"
          value={frameCount}
          onChange={(e) => setFrameCount(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
      <button
        onClick={handleGenerate}
        disabled={submitting || !imageUrl}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />提交中...</> : <><Sparkles className="h-4 w-4" />提交生成任务</>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col gap-4">
      <TaskQueuePanel projectId={projectId} />
      {results.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-medium text-foreground">动画帧预览</h3>
          <div className="flex gap-2 overflow-x-auto pb-4">
            {results.map((url, i) => (
              <div key={i} className="shrink-0 overflow-hidden rounded-lg border border-border bg-card">
                <img src={url} alt={`Frame ${i + 1}`} className="h-32 w-32 object-contain" />
                <div className="border-t border-border px-2 py-1 text-center text-xs text-muted-foreground">
                  帧 {i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Film className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">提交生成任务后，任务会在此显示并异步处理</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="动画生成"
      description="为角色生成动画帧序列"
      toolKey={toolKeyMap[subTool]}
      toolName="动画生成"
      params={paramsPanel}
      canvas={canvas}
    />
  );
}
