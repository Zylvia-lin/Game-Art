'use client';

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useParams } from 'next/navigation';
import {
  Circle, ImagePlus, Layout, Loader2, RectangleHorizontal,
  Save, Sparkles, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ToolLayout } from '@/components/tools/tool-layout';
import { RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { PromptInput } from '@/components/tools/prompt-input';
import { ResultImageCard } from '@/components/tools/result-image-card';
import { ModelSelector } from '@/components/tools/model-selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  assetsApi, generateApi, projectsApi, resolveImageUrl, type Asset,
} from '@/lib/api';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { useButtonCooldown } from '@/hooks/use-button-cooldown';
import type { ModelConfig } from '@/lib/types';

type SubTool = 'layout_generate' | 'component_place' | 'component_split';
type Shape = 'rectangle' | 'circle';

interface UIComponent {
  id: string;
  shape: Shape;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
}

interface LayoutMetadata extends Record<string, unknown> {
  kind: 'ui_component_layout';
  version: 1;
  ratio: string;
  background_url: string | null;
  components: UIComponent[];
}

const SUB_TOOLS: { key: SubTool; label: string; desc: string }[] = [
  { key: 'layout_generate', label: '布局生成', desc: '生成完整 UI 布局' },
  { key: 'component_place', label: '组件摆放', desc: '在比例画框内手动排版' },
  { key: 'component_split', label: '组件拆分', desc: '拆分为独立 UI 素材' },
];
const COLORS = ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];
const EXPORT_WIDTH = 1280;

function parseRatio(value: string) {
  const [width, height] = value.split(':').map(Number);
  return width > 0 && height > 0 ? width / height : 16 / 9;
}

function clampComponent(component: UIComponent, aspect = 1): UIComponent {
  const maxWidth = component.shape === 'circle' ? Math.min(1, 1 / aspect) : 1;
  const width = Math.min(Math.max(component.width, 0.04), maxWidth);
  const height = component.shape === 'circle'
    ? width * aspect
    : Math.min(Math.max(component.height, 0.04), 1);
  return {
    ...component,
    width,
    height,
    x: Math.min(Math.max(component.x, 0), 1 - width),
    y: Math.min(Math.max(component.y, 0), 1 - height),
  };
}

function isLayoutMetadata(value: unknown): value is LayoutMetadata {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as Partial<LayoutMetadata>;
  return metadata.kind === 'ui_component_layout'
    && metadata.version === 1
    && typeof metadata.ratio === 'string'
    && Array.isArray(metadata.components);
}

export default function UIPage() {
  const params = useParams<{ id: string }>();
  const projectId = String(params.id);
  const [subTool, setSubTool] = useState<SubTool>('layout_generate');
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('16:9');
  const [resolution, setResolution] = useState('1920x1080');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [components, setComponents] = useState<UIComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);
  const [savedLayouts, setSavedLayouts] = useState<Asset[]>([]);
  const [savingReference, setSavingReference] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{
    id: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    initial: UIComponent;
  } | null>(null);

  const {
    submitting, submitTask, completedTasks, refreshTasks,
  } = useTaskQueue({ projectId });
  const { isCoolingDown, triggerCooldown } = useButtonCooldown(2000);

  const loadSavedLayouts = useCallback(async () => {
    const assets = await projectsApi.assets(projectId, 'ui');
    setSavedLayouts(assets.filter((asset) => isLayoutMetadata(asset.metadata_)));
  }, [projectId]);

  useEffect(() => {
    loadSavedLayouts().catch(() => toast.error('加载已保存 UI 参考失败'));
  }, [loadSavedLayouts]);

  useEffect(() => {
    const saved = sessionStorage.getItem('ui_source_image');
    if (saved) {
      setSourceImage(saved);
      sessionStorage.removeItem('ui_source_image');
    }
  }, []);

  const activeResultKeys = subTool === 'component_split'
    ? ['ui_component_split']
    : ['ui_layout_generate'];
  const results = useMemo(() => completedTasks
    .filter((task) => activeResultKeys.includes(task.tool_key))
    .sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())
    .flatMap((task) => (task.output_urls || []).map((url, index) => ({
      url,
      taskId: task.id,
      taskIndex: index,
      name: task.output_names?.[index] || '',
    }))), [completedTasks, subTool]);

  const updateComponent = useCallback((id: string, updates: Partial<UIComponent>) => {
    setComponents((current) => current.map((component) => (
      component.id === id ? clampComponent({ ...component, ...updates }, parseRatio(ratio)) : component
    )));
  }, [ratio]);

  const addComponent = (shape: Shape) => {
    const size = shape === 'circle' ? 0.14 : 0.18;
    const component: UIComponent = clampComponent({
      id: crypto.randomUUID(),
      shape,
      x: 0.5 - size / 2,
      y: 0.5 - size / 2,
      width: size,
      height: shape === 'circle' ? size : 0.1,
      color: COLORS[components.length % COLORS.length],
      label: shape === 'circle' ? `圆形 ${components.length + 1}` : `方形 ${components.length + 1}`,
    }, parseRatio(ratio));
    setComponents((current) => [...current, component]);
    setSelectedId(component.id);
  };

  const startInteraction = (
    event: React.PointerEvent,
    component: UIComponent,
    mode: 'move' | 'resize',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      id: component.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      initial: component,
    };
    setSelectedId(component.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveInteraction = (event: React.PointerEvent) => {
    const interaction = interactionRef.current;
    const canvas = canvasRef.current;
    if (!interaction || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const dx = (event.clientX - interaction.startX) / bounds.width;
    const dy = (event.clientY - interaction.startY) / bounds.height;
    if (interaction.mode === 'move') {
      updateComponent(interaction.id, {
        x: interaction.initial.x + dx,
        y: interaction.initial.y + dy,
      });
    } else {
      const nextWidth = interaction.initial.width + dx;
      updateComponent(interaction.id, {
        width: nextWidth,
        height: interaction.initial.shape === 'circle'
          ? nextWidth
          : interaction.initial.height + dy,
      });
    }
  };

  const endInteraction = () => {
    interactionRef.current = null;
  };

  const submitGeneration = async () => {
    if (subTool === 'layout_generate' && !prompt.trim()) return;
    if (subTool === 'component_split' && !sourceImage) return;
    triggerCooldown();
    try {
      await submitTask(
        subTool === 'component_split' ? 'ui_component_split' : 'ui_layout_generate',
        {
          prompt: prompt || '拆分参考图中的 UI 组件',
          image_url: sourceImage || undefined,
          ratio,
          resolution,
          model_id: selectedModelId || undefined,
        },
      );
      toast.success('任务已提交');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '任务提交失败');
    }
  };

  const renderReferenceBlob = async (): Promise<Blob> => {
    const aspect = parseRatio(ratio);
    const width = EXPORT_WIDTH;
    const height = Math.round(width / aspect);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持 Canvas');
    context.fillStyle = '#111827';
    context.fillRect(0, 0, width, height);

    if (sourceImage) {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('参考背景加载失败'));
        image.src = resolveImageUrl(sourceImage);
      });
      context.drawImage(image, 0, 0, width, height);
    }

    for (const component of components) {
      const x = component.x * width;
      const y = component.y * height;
      const componentWidth = component.width * width;
      const componentHeight = component.height * height;
      context.fillStyle = component.color;
      if (component.shape === 'circle') {
        context.beginPath();
        context.arc(
          x + componentWidth / 2,
          y + componentHeight / 2,
          Math.min(componentWidth, componentHeight) / 2,
          0,
          Math.PI * 2,
        );
        context.fill();
      } else {
        context.fillRect(x, y, componentWidth, componentHeight);
      }
      context.fillStyle = '#ffffff';
      context.font = `${Math.max(14, Math.round(height * 0.025))}px sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(component.label, x + componentWidth / 2, y + componentHeight / 2);
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('截图生成失败'))), 'image/png');
    });
  };

  const applyToReference = async () => {
    if (!components.length) return toast.error('请先添加组件');
    setSavingReference(true);
    try {
      const blob = await renderReferenceBlob();
      const file = new File([blob], `ui-layout-${Date.now()}.png`, { type: 'image/png' });
      const uploaded = await generateApi.upload(file);
      const metadata: LayoutMetadata = {
        kind: 'ui_component_layout',
        version: 1,
        ratio,
        background_url: sourceImage,
        components,
      };
      await assetsApi.create({
        project_id: projectId,
        name: `UI 组件布局 ${new Date().toLocaleString()}`,
        type: 'ui',
        url: uploaded.url,
        description: `${ratio} UI 组件摆放参考`,
        metadata,
      });
      setSourceImage(uploaded.url);
      setComponents([]);
      setSelectedId(null);
      await loadSavedLayouts();
      toast.success('已截图并保存为项目参考，可继续生成或再次编辑');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存参考失败');
    } finally {
      setSavingReference(false);
    }
  };

  const restoreLayout = (asset: Asset) => {
    const metadata = asset.metadata_;
    if (!isLayoutMetadata(metadata)) return;
    setRatio(metadata.ratio);
    setComponents(metadata.components.map((component) => clampComponent(component, parseRatio(metadata.ratio))));
    setSourceImage(metadata.background_url || null);
    setSelectedId(null);
    toast.success(`已载入 ${asset.name}`);
  };

  useEffect(() => {
    setComponents((current) => current.map((component) => clampComponent(component, parseRatio(ratio))));
  }, [ratio]);
  const selected = components.find((component) => component.id === selectedId);
  const placementParams = (
    <>
      <RatioSelector value={ratio} onChange={setRatio} />
      <ImageSourceSelector
        projectId={projectId}
        imageUrl={sourceImage}
        onImageChange={setSourceImage}
        label="可选背景参考"
        assetType="ui"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => addComponent('rectangle')}>
          <RectangleHorizontal />添加方形
        </Button>
        <Button type="button" variant="outline" onClick={() => addComponent('circle')}>
          <Circle />添加圆形
        </Button>
      </div>
      {selected && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">选中组件</p>
          <label className="space-y-1 text-xs">
            <span>名称</span>
            <Input value={selected.label} onChange={(event) => updateComponent(selected.id, { label: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs">
            <span>颜色</span>
            <Input type="color" value={selected.color} onChange={(event) => updateComponent(selected.id, { color: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs">
            <span>{selected.shape === 'circle' ? '大小' : '宽度'}：{Math.round(selected.width * 100)}%</span>
            <Input type="range" min={4} max={100} value={selected.width * 100} onChange={(event) => updateComponent(selected.id, { width: Number(event.target.value) / 100 })} />
          </label>
          {selected.shape === 'rectangle' && (
            <label className="space-y-1 text-xs">
              <span>高度：{Math.round(selected.height * 100)}%</span>
              <Input type="range" min={4} max={100} value={selected.height * 100} onChange={(event) => updateComponent(selected.id, { height: Number(event.target.value) / 100 })} />
            </label>
          )}
          <Button type="button" variant="destructive" size="sm" onClick={() => {
            setComponents((current) => current.filter((component) => component.id !== selected.id));
            setSelectedId(null);
          }}>
            <Trash2 />删除组件
          </Button>
        </div>
      )}
      <Button type="button" className="w-full" disabled={savingReference || !components.length} onClick={applyToReference}>
        {savingReference ? <Loader2 className="animate-spin" /> : <Save />}
        应用到参考并保存
      </Button>
      {savedLayouts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">已保存的可编辑参考</p>
          {savedLayouts.map((asset) => (
            <button
              type="button"
              key={asset.id}
              onClick={() => restoreLayout(asset)}
              className="flex w-full items-center gap-2 rounded-lg border p-2 text-left hover:border-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveImageUrl(asset.url)} alt="" className="size-12 rounded object-cover" />
              <span className="min-w-0 truncate text-xs">{asset.name}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );

  const generationParams = (
    <>
      {(subTool === 'component_split' || subTool === 'layout_generate') && (
        <ImageSourceSelector
          projectId={projectId}
          imageUrl={sourceImage}
          onImageChange={setSourceImage}
          label={subTool === 'layout_generate' ? '可选参考图（用户图片或 UI 摆放布局）' : '待拆分 UI 图片'}
          assetType="ui"
        />
      )}
      <ModelSelector
        type="image"
        value={selectedModelId}
        onChange={(id, model) => {
          setSelectedModelId(id);
          setSelectedModel(model);
        }}
      />
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        toolKey="ui"
        label="描述"
        placeholder={subTool === 'component_split'
          ? '描述需要拆分的组件类型……'
          : '描述 UI 类型、布局、层级和视觉风格……'}
        rows={6}
      />
      <RatioSelector value={ratio} onChange={setRatio} />
      <ResolutionSelector ratio={ratio} value={resolution} onChange={setResolution} />
      <Button
        className="w-full"
        onClick={submitGeneration}
        disabled={submitting || isCoolingDown || (subTool === 'layout_generate' ? !prompt.trim() : !sourceImage)}
      >
        {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {submitting ? '提交中……' : '生成'}
      </Button>
      {selectedModel && <p className="text-xs text-muted-foreground">当前模型：{selectedModel.name}</p>}
    </>
  );

  const paramsPanel = (
    <>
      <div>
        <label className="mb-2 block text-sm font-medium">子功能</label>
        <div className="space-y-2">
          {SUB_TOOLS.map((tool) => (
            <button
              type="button"
              key={tool.key}
              onClick={() => setSubTool(tool.key)}
              className={`w-full rounded-lg border p-2 text-left ${subTool === tool.key ? 'border-primary bg-primary/10' : 'border-border'}`}
            >
              <span className="block text-sm font-medium">{tool.label}</span>
              <span className="text-xs text-muted-foreground">{tool.desc}</span>
            </button>
          ))}
        </div>
      </div>
      {subTool === 'component_place' ? placementParams : generationParams}
    </>
  );

  const placementCanvas = (
    <div className="flex h-full min-h-[560px] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-medium">组件摆放画布</h3>
          <p className="text-xs text-muted-foreground">所有组件都被限制在 {ratio} 屏幕比例框内</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => {
          setComponents([]);
          setSelectedId(null);
        }}>
          清空
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto rounded-xl bg-muted/40 p-6">
        <div
          ref={canvasRef}
          className="relative w-full max-w-5xl overflow-hidden border-2 border-primary/60 bg-slate-900 shadow-2xl"
          style={{ aspectRatio: String(parseRatio(ratio)) }}
          onPointerMove={moveInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
          onPointerLeave={endInteraction}
          onPointerDown={() => setSelectedId(null)}
        >
          {sourceImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveImageUrl(sourceImage)} alt="" className="pointer-events-none absolute inset-0 size-full object-fill opacity-60" />
          )}
          {components.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-slate-400">
              <div><Layout className="mx-auto mb-2 size-12 opacity-40" /><p className="text-sm">从左侧添加方形或圆形组件</p></div>
            </div>
          )}
          {components.map((component) => (
            <div
              key={component.id}
              className={`absolute touch-none select-none border-2 text-white shadow-lg ${selectedId === component.id ? 'border-white' : 'border-white/30'}`}
              style={{
                left: `${component.x * 100}%`,
                top: `${component.y * 100}%`,
                width: `${component.width * 100}%`,
                height: `${component.height * 100}%`,
                borderRadius: component.shape === 'circle' ? '9999px' : '8px',
                backgroundColor: component.color,
              }}
              onPointerDown={(event) => startInteraction(event, component, 'move')}

            >
              <span className="pointer-events-none flex size-full items-center justify-center truncate px-1 text-xs font-medium">
                {component.label}
              </span>
              {selectedId === component.id && (
                <button
                  type="button"
                  aria-label={`调整 ${component.label} 大小`}
                  className="absolute -bottom-2 -right-2 size-5 cursor-nwse-resize rounded-full border-2 border-white bg-primary"
                  onPointerDown={(event) => startInteraction(event, component, 'resize')}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const resultCanvas = results.length ? (
    <div className="columns-1 gap-3 sm:columns-3 lg:columns-5">
      {results.map((result, index) => (
        <ResultImageCard
          key={`${result.taskId}-${result.taskIndex}`}
          url={result.url}
          projectId={projectId}
          index={index}
          name={result.name}
          taskId={result.taskId}
          taskIndex={result.taskIndex}
          onDelete={async () => {
            await generateApi.deleteOutput(result.taskId, result.taskIndex);
            await refreshTasks();
          }}
        />
      ))}
    </div>
  ) : (
    <div className="flex h-full items-center justify-center text-center text-muted-foreground">
      <div>
        <ImagePlus className="mx-auto mb-3 size-14 opacity-30" />
        <p>{subTool === 'component_split' ? '选择 UI 图片并提交组件拆分' : '描述需要生成的 UI 布局'}</p>
        <p className="mt-1 text-xs">生成结果会保留在这里，刷新页面后仍可查看</p>
      </div>
    </div>
  );

  return (
    <ToolLayout
      title="UI 生成"
      description="生成 UI 布局、在比例画框内摆放组件，或拆分 UI 素材"
      toolKey={subTool === 'component_place' ? undefined : (subTool === 'component_split' ? 'ui_component_split' : 'ui_layout_generate')}
      toolName={subTool === 'component_split' ? 'UI 组件拆分' : 'UI 布局生成'}
      paramsPanel={paramsPanel}
      canvas={subTool === 'component_place' ? placementCanvas : resultCanvas}
    />
  );
}
