'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector, RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { PromptEditor } from '@/components/tools/prompt-editor';
import { TaskQueuePanel } from '@/components/tools/task-queue-panel';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { generateApi } from '@/lib/api';

export default function TextToImagePage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('anime');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1024x1024');
  const { submitting, submitTask } = useTaskQueue({ projectId });

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    await submitTask('text_to_image', {
      prompt,
      style,
      ratio,
      resolution,
    });
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
        disabled={submitting || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {submitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            提交中...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            生成
          </>
        )}
      </button>
      <PromptEditor toolKey="text_to_image" toolName="文生图" />
    </>
  );

  return (
    <ToolLayout
      title="文生图"
      description="通过文字描述生成游戏美术资产"
      toolKey="text_to_image"
      toolName="文生图"
      params={paramsPanel}
      canvas={
        <div className="flex h-full flex-col">
          <div className="flex-1 rounded-xl border border-border bg-muted/30 p-8">
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">文生图</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                输入描述，选择风格和比例，AI 将为你生成对应的游戏美术资产。
              </p>
            </div>
          </div>
          <TaskQueuePanel projectId={projectId} />
        </div>
      }
    />
  );
}
