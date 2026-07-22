'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Layout, Plus, Trash2, GripHorizontal } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { generateApi } from '@/lib/api';

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
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [components, setComponents] = useState<UIComponent[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const toolKeyMap: Record<string, string> = {
    layout_generate: 'ui_layout_generate',
    component_place: 'ui_component_place',
    component_split: 'ui_component_split',
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await generateApi.uiLayout({
        project_id: projectId,
        prompt,
        sub_tool: subTool,
        components: components.length > 0 ? components : undefined,
      });
      setResults(res.output_urls);
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setLoading(false);
    }
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

  const handleDragStart = (id: string, e: React.MouseEvent) => {
    setDragging(id);
    const comp = components.find((c) => c.id === id);
    if (comp) {
      setDragOffset({ x: e.clientX - comp.x, y: e.clientY - comp.y });
    }
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    updateComponent(dragging, {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    });
  };

  const handleDragEnd = () => {
    setDragging(null);
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
        <label className="mb-1.5 block text-sm font-medium text-foreground">UI描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="描述你想要的UI，如：RPG游戏背包界面，包含物品格子、角色属性面板..."
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
        />
      </div>
      {subTool === 'component_place' && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">自定义组件</label>
            <button
              onClick={addComponent}
              className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-3 w-3" />
              添加
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {components.map((comp) => (
              <div key={comp.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <input
                  type="color"
                  value={comp.color}
                  onChange={(e) => updateComponent(comp.id, { color: e.target.value })}
                  className="h-6 w-6 shrink-0 cursor-pointer rounded border-0"
                />
                <input
                  value={comp.label}
                  onChange={(e) => updateComponent(comp.id, { label: e.target.value })}
                  className="flex-1 bg-transparent text-xs text-foreground outline-none"
                />
                <button onClick={() => removeComponent(comp.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />生成中...</> : <><Sparkles className="h-4 w-4" />生成UI</>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">AI 正在设计UI...</p>
          </div>
        </div>
      ) : subTool === 'component_place' && components.length > 0 ? (
        <div
          className="relative flex-1 rounded-xl border border-border bg-accent/20 overflow-hidden"
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          {components.map((comp) => (
            <div
              key={comp.id}
              className="absolute rounded-lg border-2 border-dashed cursor-move"
              style={{
                left: comp.x,
                top: comp.y,
                width: comp.width,
                height: comp.height,
                backgroundColor: comp.color + '33',
                borderColor: comp.color,
              }}
              onMouseDown={(e) => handleDragStart(comp.id, e)}
            >
              <div className="flex h-full items-center justify-center">
                <GripHorizontal className="h-4 w-4 text-foreground/50" />
              </div>
              <span className="absolute -top-5 left-0 text-xs text-muted-foreground">{comp.label}</span>
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {results.map((url, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <img src={url} alt={`UI Layout ${i + 1}`} className="w-full object-contain" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Layout className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">描述你想要的游戏UI开始生成</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="UI生成"
      description="生成游戏UI布局与组件"
      toolKey={toolKeyMap[subTool]}
      toolName={subTool === 'layout_generate' ? 'UI布局生成' : subTool === 'component_place' ? 'UI组件摆放' : 'UI组件拆分'}
      params={paramsPanel}
      canvas={canvas}
    />
  );
}
