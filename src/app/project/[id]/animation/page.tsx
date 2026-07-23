'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Play, Loader2, Scissors, Grid3X3 } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { TaskQueuePanel } from '@/components/tools/task-queue-panel';
import { PromptEditor } from '@/components/tools/prompt-editor';
import type { Task } from '@/lib/types';

const SUB_TOOLS = [
  { key: 'text', label: '动作生成', desc: '描述动作，AI生成动画帧序列' },
  { key: 'frame_extract', label: '帧提取', desc: '将Sprite图切割为独立帧（本地处理）' },
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
  frame_extract: 'animation_frame_extract',
};

interface ExtractedFrame {
  url: string;
}

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

  // 帧提取（本地处理）相关状态
  const [extractRows, setExtractRows] = useState(4);
  const [extractCols, setExtractCols] = useState(4);
  const [extracting, setExtracting] = useState(false);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);

  const handleTaskComplete = useCallback((_task: Task) => {}, []);
  const { submitting, submitTask } = useTaskQueue({ projectId, onTaskComplete: handleTaskComplete });

  useEffect(() => {
    const saved = sessionStorage.getItem('animation_source_image');
    if (saved) {
      setImageUrl(saved);
      sessionStorage.removeItem('animation_source_image');
    }
  }, []);

  // AI 动作生成
  const handleGenerate = async () => {
    setError(null);
    try {
      await submitTask(toolKeyMap.text, {
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

  // 帧提取（本地处理，不走 AI）
  const handleExtract = async () => {
    if (!imageUrl) {
      setError('请先选择 Sprite 图');
      return;
    }
    setError(null);
    setExtracting(true);
    setExtractedFrames([]);

    try {
      const response = await fetch('/api/tools/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          rows: extractRows,
          cols: extractCols,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '帧提取失败');
      }

      const data = await response.json();
      const frames = (data.frames as string[]).map((url) => ({ url }));
      setExtractedFrames(frames);
    } catch (err) {
      setError(err instanceof Error ? err.message : '帧提取失败');
    } finally {
      setExtracting(false);
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
        label={subTool === 'frame_extract' ? 'Sprite 网格图' : '角色图片'}
        projectId={String(projectId)}
        imageUrl={imageUrl}
        onImageChange={setImageUrl}
        assetType="character"
      />

      {subTool === 'text' && (
        <>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">动作描述</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="描述角色动作，如：挥剑攻击、跳跃翻转..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
            />
          </div>

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

          <PromptEditor toolKey={toolKeyMap.text} toolName="动作生成" />
          <RatioSelector value={ratio} onChange={setRatio} />
          <ResolutionSelector value={resolution} onChange={setResolution} />
        </>
      )}

      {subTool === 'frame_extract' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">行数</label>
              <input
                type="number"
                min={1}
                max={16}
                value={extractRows}
                onChange={(e) => setExtractRows(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">列数</label>
              <input
                type="number"
                min={1}
                max={16}
                value={extractCols}
                onChange={(e) => setExtractCols(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            根据 Sprite 图的行列数切割出 {extractRows * extractCols} 个独立帧，纯本地处理，不消耗 AI 额度
          </p>
        </>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {subTool === 'text' ? (
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
              生成动画帧
            </>
          )}
        </button>
      ) : (
        <button
          onClick={handleExtract}
          disabled={extracting || !imageUrl}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
        >
          {extracting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              正在切割...
            </>
          ) : (
            <>
              <Scissors size={18} />
              切割提取帧
            </>
          )}
        </button>
      )}
    </>
  );

  const canvasContent = subTool === 'frame_extract' && extractedFrames.length > 0 ? (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          提取结果（{extractedFrames.length} 帧）
        </h3>
        <button
          onClick={() => setExtractedFrames([])}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          清除
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 overflow-auto">
        {extractedFrames.map((frame, i) => (
          <div key={i} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame.url}
              alt={`Frame ${i}`}
              className="h-full w-full rounded-lg border border-border object-cover"
            />
            <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              {i + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="flex h-full items-center justify-center">
      <div className="text-center text-muted-foreground">
        {subTool === 'frame_extract' ? (
          <>
            <Grid3X3 size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">上传 Sprite 图并设置行列数</p>
            <p className="mt-1 text-xs opacity-60">本地切割，无需 AI</p>
          </>
        ) : (
          <>
            <Play size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">配置参数并点击生成，任务将在队列中处理</p>
            <p className="mt-1 text-xs opacity-60">生成的动画帧将自动添加到项目资产库</p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <ToolLayout
      title="动画生成"
      description="为角色生成动画帧序列或切割 Sprite 图"
      paramsPanel={paramsPanel}
      queuePanel={<TaskQueuePanel projectId={projectId} />}
      canvas={canvasContent}
    />
  );
}
