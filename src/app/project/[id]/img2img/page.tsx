'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Download, ImageIcon } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { GenerationResultActions } from '@/components/tools/generation-result-actions';
import { TaskQueuePanel } from '@/components/tools/task-queue-panel';
import { generateApi, projectsApi } from '@/lib/api';
import type { Task } from '@/lib/types';

export default function ImageToImagePage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [strength, setStrength] = useState(0.7);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  // Load project style (for potential future use in img2img prompts)
  useEffect(() => {
    projectsApi.get(projectId).catch(() => {});
  }, [projectId]);

  const handleTaskComplete = useCallback((task: Task) => {
    if (task.output_urls && task.output_urls.length > 0) {
      setResults(prev => [...task.output_urls, ...prev]);
    }
  }, []);

  const handleGenerate = async () => {
    if (!imageUrl || !prompt.trim()) return;
    setSubmitting(true);
    try {
      await generateApi.imageToImage({
        project_id: projectId,
        image_url: imageUrl,
        prompt,
        strength,
      });
    } catch (err) {
      console.error('Generation failed:', err);
      setSubmitting(false);
    }
  };

  const paramsPanel = (
    <>
      <ImageSourceSelector
        projectId={String(projectId)}
        imageUrl={imageUrl || null}
        onImageChange={(url) => setImageUrl(url || '')}
        label="参考图片"
      />
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
        disabled={submitting || !imageUrl || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />提交中...</> : <><Sparkles className="h-4 w-4" />开始编辑</>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {results.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {results.map((url, i) => (
            <div key={i} className="group relative overflow-hidden rounded-xl border border-border bg-card">
              <img src={url} alt={`Result ${i + 1}`} className="w-full object-contain" />
              <div className="p-3 border-t border-border">
                <GenerationResultActions projectId={String(projectId)} imageUrl={url} showAddToLibrary />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">上传或选择参考图片并描述修改内容</p>
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
      canvas={
        <div className="flex h-full flex-col">
          <div className="flex-1">{canvas}</div>
          <TaskQueuePanel projectId={projectId} onTaskComplete={handleTaskComplete} />
        </div>
      }
    />
  );
}
