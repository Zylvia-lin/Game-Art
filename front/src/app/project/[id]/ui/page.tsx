'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Layout, Plus, Trash2, GripHorizontal } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { TaskQueuePanel } from '@/components/tools/task-queue-panel';
import { useTaskQueue } from '@/hooks/use-task-queue';
import type { Task } from '@/lib/types';

interface UIComponent {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
}

const SUB_TOOLS = [
  { key: 'layout_generate', label: '布局生成', desc: '生成完整UI布局' },
  { key: 'component_place', label: '组件摆放', desc: '自定义调整组件' },
  { key: 'component_split', label: '组件拆分', desc: '拆分为独立素材' },
] as const;

const COLORS = ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];

export default function UIPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [subTool, setSubTool] = useState<string>('layout_generate');
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('16:9');
  const [resolution, setResolution] = useState('1920x1080');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [components, setComponents] = useState<UIComponent[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleTaskComplete = useCallback((_task: Task) => {}, []);
  const { submitting, submitTask } = useTaskQueue({ projectId, onTaskComplete: handleTaskComplete });

  // Check sessionStorage for pre-selected image
  useEffect(() => {
    const saved = sessionStorage.getItem('ui_source_image');
    if (saved) {
      setSourceImage(saved);
      sessionStorage.removeItem('ui_source_image');
    }
  }, []);

  const toolKeyMap: Record<string, string> = {
    layout_generate: 'ui_layout_generate',
    component_place: 'ui_component_place',
    component_split: 'ui_component_split',
  };

  const needsImage = subTool === 'component_split' || subTool === 'component_place';

  const handleGenerate = async () => {
    if (subTool === 'layout_generate' && !prompt.trim()) return;
    if (subTool === 'component_split' && !sourceImage) return;
    if (subTool === 'component_place' && !sourceImage) return;
    await submitTask(toolKeyMap[subTool], {
      prompt: prompt || '基于参考图生成',
      sub_tool: subTool,
      image_url: sourceImage || undefined,
      ratio,
      resolution,
      components: components.length > 0 ? components : undefined,
    });
  };

  const addComponent = () => {
    const newComp: UIComponent = {
      id: `comp_${Date.now()}`,
      x: 50 + Math.random() * 200,
      y: 50 + Math.random() * 200,
      width: 120,
      height: 60,
      color: COLORS[components.length % COLORS.length],
      label: `组件 ${components.length + 1}`,
    };
    setComponents([...components, newComp]);
  };

  const removeComponent = (id: string) => {
    setComponents(components.filter((c) => c.id !== id));
  };

  const updateComponent = (id: string, updates: Partial<UIComponent>) => {
    setComponents(components.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleDragStart = (e: React.MouseEvent, id: string) => {
    setDragging(id);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const container = (e.target as HTMLElement).closest('.ui-canvas');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const x = e.clientX - containerRect.left - dragOffset.x;
    const y = e.clientY - containerRect.top - dragOffset.y;
    updateComponent(dragging, { x, y });
  };

  const handleDragEnd = () => {
    setDragging(null);
  };

  const paramsPanel = (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground">子功能</label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SUB_TOOLS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSubTool(t.key)}
              className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                subTool === t.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {needsImage && (
        <ImageSourceSelector
          projectId={String(projectId)}
          imageUrl={sourceImage}
          onImageChange={setSourceImage}
          label="UI 参考图片"
          assetType="ui"
        />
      )}

      <div>
        <label className="text-sm font-medium text-foreground">描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={subTool === 'layout_generate' ? '描述UI类型，如：RPG游戏背包界面，包含物品格子、金币显示、关闭按钮...' : subTool === 'component_split' ? '描述需要拆分的组件类型...' : '描述组件摆放需求...'}
          className="mt-2 h-24 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <RatioSelector value={ratio} onChange={setRatio} />
      <ResolutionSelector ratio={ratio} value={resolution} onChange={setResolution} />

      <button
        onClick={handleGenerate}
        disabled={submitting || (subTool === 'layout_generate' ? !prompt.trim() : !sourceImage)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {submitting ? '生成中...' : '生成'}
      </button>

      <TaskQueuePanel projectId={projectId} />
    </div>
  );

  const mainContent = (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">UI 画布</h3>
        <button
          onClick={addComponent}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-3 w-3" /> 添加组件
        </button>
      </div>

      <div
        className="ui-canvas relative flex-1 overflow-hidden rounded-lg border border-border bg-secondary/20"
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {components.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Layout className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">输入描述生成 UI 布局</p>
              <p className="text-xs text-muted-foreground/60">或点击「添加组件」手动创建</p>
            </div>
          </div>
        ) : (
          components.map((comp) => (
            <div
              key={comp.id}
              className="absolute cursor-move rounded-lg border-2 border-white/20 shadow-lg transition-shadow hover:shadow-xl"
              style={{
                left: comp.x,
                top: comp.y,
                width: comp.width,
                height: comp.height,
                backgroundColor: comp.color,
              }}
              onMouseDown={(e) => handleDragStart(e, comp.id)}
            >
              <div className="flex h-full items-center justify-between px-2">
                <span className="text-xs font-medium text-white/90">{comp.label}</span>
                <div className="flex gap-1">
                  <GripHorizontal className="h-3 w-3 text-white/50" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeComponent(comp.id);
                    }}
                    className="rounded p-0.5 hover:bg-white/20"
                  >
                    <Trash2 className="h-3 w-3 text-white/70" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <ToolLayout
      title="UI 生成"
      description="生成游戏UI布局，自定义组件摆放与拆分"
      toolKey="ui_layout_generate"
      toolName="UI布局生成"
      params={paramsPanel}
      canvas={mainContent}
    />
  );
}
