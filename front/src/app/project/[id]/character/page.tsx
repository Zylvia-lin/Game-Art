'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector, RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { PromptInput } from '@/components/tools/prompt-input';
import { ResultImageCard } from '@/components/tools/result-image-card';
import { projectsApi, generateApi } from '@/lib/api';
import { useTaskQueue } from '@/hooks/use-task-queue';
import { useButtonCooldown } from '@/hooks/use-button-cooldown';
import { estimateCostFromModel, formatCostDisplay } from '@/lib/types';
import { ModelSelector } from '@/components/tools/model-selector';
import type { ModelConfig } from '@/lib/types';

const SUB_TOOLS = [
  { key: 'tpose', label: '基础角色生成', desc: '生成标准站姿角色' },
  { key: 'three_view', label: '三视图生成', desc: '生成正面/侧面/背面三视图' },
  { key: 'directions', label: '多方向生成', desc: '生成四/八方向视图' },
  { key: 'part_split', label: '部件拆分', desc: '拆分为独立部件层' },
] as const;

const POSE_OPTIONS = [
  { key: 'apose', label: 'A-pose', desc: '双臂微张', prompt: '专业的A-pose姿势，双臂微张与身体呈45度夹角自然下垂，双腿微微分开与肩同宽，身体呈A字形' },
  { key: 'free', label: '无限制', desc: 'AI自由发挥', prompt: '自然站立姿势' },
  { key: 'custom', label: '自定义', desc: '手动输入姿势', prompt: '' },
] as const;

const TOOL_KEY_MAP: Record<string, string> = {
  tpose: 'character_tpose',
  three_view: 'character_three_view',
  directions: 'character_directions',
  part_split: 'character_part_split',
};

export default function CharacterPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [projectStyle, setProjectStyle] = useState<string>('pixel');

  // Load project to get default style
  useEffect(() => {
    if (!projectId) return;
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
      setSourceImages(prev => ({ ...prev, tpose: saved }));
      sessionStorage.removeItem('preselect_image');
    }
  }, []);

  const [subTool, setSubTool] = useState<string>('tpose');
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [style, setStyle] = useState(projectStyle);
  const [directions, setDirections] = useState(8);
  const [pose, setPose] = useState<string>('apose');
  const [customPose, setCustomPose] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1080p');
  const [sourceImages, setSourceImages] = useState<Record<string, string | null>>({});
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);

  // Per-sub-tool derived values
  const prompt = prompts[subTool] || '';
  const sourceImage = sourceImages[subTool] || null;
  const setPrompt = (value: string) => setPrompts(prev => ({ ...prev, [subTool]: value }));
  const setSourceImage = (value: string | null) => setSourceImages(prev => ({ ...prev, [subTool]: value }));

  const { submitting, submitTask, completedTasks, refreshTasks } = useTaskQueue({
    projectId,
    onTaskComplete: () => {},
  });
  const { isCoolingDown: genCooldown, triggerCooldown: genTrigger } = useButtonCooldown(2000);

  // 从已完成的任务中派生结果图片（刷新页面后也能恢复）
  const results = useMemo(() => {
    const toolKeys = Object.values(TOOL_KEY_MAP);
    return completedTasks
      .filter(t => toolKeys.includes(t.tool_key))
      .sort((a, b) => {
        const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return tb - ta;
      })
      .flatMap(t => {
        const urls = t.output_urls || [];
        const names = t.output_names || [];
        return urls.map((url, i) => ({
          url,
          taskId: t.id,
          taskIndex: i,
          name: names[i] || '',
        }));
      });
  }, [completedTasks]);

  const handleDeleteResult = async (taskId: string, taskIndex: number) => {
    await generateApi.deleteOutput(taskId, taskIndex);
    refreshTasks();
  };

  const handleGenerate = async () => {
    if (subTool === 'tpose' && !prompt.trim()) return;
    if ((subTool === 'directions' || subTool === 'part_split' || subTool === 'three_view') && !sourceImage) return;
    genTrigger();

    // Resolve pose text
    const poseText = subTool === 'tpose'
      ? pose === 'custom' ? customPose : POSE_OPTIONS.find(p => p.key === pose)?.prompt || '专业的A-pose姿势，双臂微张与身体呈45度夹角自然下垂'
      : undefined;

    try {
      await submitTask(TOOL_KEY_MAP[subTool], {
        prompt: prompt || '基于输入图片生成',
        image_url: sourceImage || undefined,
        directions,
        pose: poseText,
        style: subTool === 'part_split' ? undefined : style,
        ratio: subTool === 'three_view' || subTool === 'part_split' ? '16:9' : subTool === 'directions' ? '1:1' : ratio,
        resolution,
        model_id: selectedModelId || undefined,
      });
      toast.success('任务提交成功');
    } catch (err) {
      console.error('Generation failed:', err);
      toast.error('任务提交失败', { description: err instanceof Error ? err.message : '未知错误' });
    }
  };

  const needsImage = subTool === 'directions' || subTool === 'part_split' || subTool === 'three_view';

  // Wait for params to load
  if (!params.id) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
          projectId={String(projectId)}
          imageUrl={sourceImage}
          onImageChange={setSourceImage}
          label="角色图片"
          assetType="character"
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
        toolKey="character"
        label={needsImage ? '补充描述（可选）' : '角色描述'}
        placeholder={needsImage ? '描述需要调整的内容...' : '描述角色外观，如：身穿银色铠甲的女骑士，手持长剑...'}
        rows={3}
      />
      {subTool !== 'three_view' && subTool !== 'directions' && subTool !== 'part_split' && (
        <StyleSelector value={style} onChange={setStyle} />
      )}
      {subTool === 'tpose' && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">角色姿势</label>
            <div className="grid grid-cols-2 gap-2">
              {POSE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setPose(opt.key)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    pose === opt.key
                      ? 'border-primary bg-primary/10'
                      : 'border-zinc-800 bg-[#1a1a24] hover:border-zinc-600'
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-[11px] text-zinc-500">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
          {pose === 'custom' && (
            <Input
              value={customPose}
              onChange={(e) => setCustomPose(e.target.value)}
              placeholder="输入自定义姿势描述，如：双手叉腰、单手持剑..."
              className="bg-[#1a1a24] border-zinc-800"
            />
          )}
        </div>
      )}

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
      {subTool !== 'three_view' && subTool !== 'directions' && subTool !== 'part_split' && (
        <RatioSelector value={ratio} onChange={setRatio} />
      )}
      <ResolutionSelector ratio={subTool === 'three_view' || subTool === 'part_split' ? '16:9' : subTool === 'directions' ? '1:1' : ratio} value={resolution} onChange={setResolution} />
      <button
        onClick={handleGenerate}
        disabled={submitting || genCooldown || (subTool === 'directions' || subTool === 'part_split' || subTool === 'three_view' ? !sourceImage : !prompt.trim()) || (subTool === 'tpose' && pose === 'custom' && !customPose.trim())}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />提交中...</> : <><Sparkles className="h-4 w-4" />生成角色<span className="ml-1 text-xs opacity-80">≈{formatCostDisplay(estimateCostFromModel(selectedModel, resolution, 1, sourceImage ? 1 : 0))}</span></>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {results.length > 0 ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="columns-1 gap-3 sm:columns-3 lg:columns-5">
            {results.map((r, i) => (
              <ResultImageCard
                key={`${r.taskId}-${r.taskIndex}`}
                url={r.url}
                projectId={String(projectId)}
                index={i}
                name={r.name}
                taskId={r.taskId}
                taskIndex={r.taskIndex}
                onDelete={() => handleDeleteResult(r.taskId, r.taskIndex)}
              />
            ))}
          </div>
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

  // Use direction-specific prompt key so PromptEditor shows the correct prompt
  const displayToolKey = subTool === 'directions'
    ? `character_directions_${directions}`
    : TOOL_KEY_MAP[subTool];

  return (
    <ToolLayout
      title="角色生成"
      description="生成游戏角色：T-pose、三视图、多方向、部件拆分"
      toolKey={displayToolKey}
      toolName={SUB_TOOLS.find(t => t.key === subTool)?.label || '角色生成'}
      paramsPanel={paramsPanel}
      canvas={canvas}
    />
  );
}
