'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, User } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector, RatioSelector, ResolutionSelector } from '@/components/tools/selectors';
import { ImageSourceSelector } from '@/components/tools/image-source-selector';
import { GenerationResultActions } from '@/components/tools/generation-result-actions';
import { generateApi, projectsApi } from '@/lib/api';

const SUB_TOOLS = [
  { key: 'tpose', label: 'T-pose 生成', desc: '生成标准站姿角色' },
  { key: 'three_view', label: '三视图生成', desc: '生成正面/侧面/背面三视图' },
  { key: 'directions', label: '多方向生成', desc: '生成四/八方向视图' },
  { key: 'part_split', label: '部件拆分', desc: '拆分为独立部件层' },
] as const;

export default function CharacterPage() {
  const params = useParams();
  const projectId = String(params.id);
  const [projectStyle, setProjectStyle] = useState<string>('pixel');

  // Load project to get default style
  useEffect(() => {
    projectsApi.get(Number(projectId)).then(p => {
      if (p?.style) setProjectStyle(p.style);
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
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const toolKeyMap: Record<string, string> = {
    tpose: 'character_tpose',
    three_view: 'character_three_view',
    directions: 'character_directions',
    part_split: 'character_part_split',
  };
  const toolNameMap: Record<string, string> = {
    tpose: 'T-pose角色生成',
    three_view: '三视图角色生成',
    directions: '多方向角色生成',
    part_split: '角色部件拆分',
  };

  const handleGenerate = async () => {
    if (subTool === 'tpose' && !prompt.trim()) return;
    if ((subTool === 'directions' || subTool === 'part_split') && !sourceImage) return;
    if (subTool === 'three_view' && !prompt.trim() && !sourceImage) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/generate/${toolKeyMap[subTool]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: Number(projectId),
          prompt: prompt || '基于输入图片生成',
          image_url: sourceImage || undefined,
          directions,
          style,
          ratio,
          resolution,
        }),
      });
      const data = await res.json();
      if (data.data?.urls?.length) {
        setResults(data.data.urls);
      } else if (data.data?.enhanced_prompt) {
        setResults([]);
        alert(`图片模型未配置。增强后的提示词：\n${data.data.enhanced_prompt}`);
      }
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setLoading(false);
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
          projectId={projectId}
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
        disabled={loading || (subTool === 'tpose' ? !prompt.trim() : !sourceImage)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />生成中...</> : <><Sparkles className="h-4 w-4" />生成角色</>}
      </button>
    </>
  );

  const canvas = (
    <div className="flex h-full flex-col">
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">AI 正在设计角色...</p>
          </div>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          {results.map((url, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <img src={url} alt={`Character ${i + 1}`} className="w-full object-contain" />
              <GenerationResultActions imageUrl={url} projectId={projectId} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {needsImage ? '请先选择或上传角色图片' : '描述你的角色，开始生成'}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout
      title="角色生成"
      description="生成游戏角色资产"
      toolKey={toolKeyMap[subTool]}
      toolName={toolNameMap[subTool]}
      params={paramsPanel}
      canvas={canvas}
    />
  );
}
