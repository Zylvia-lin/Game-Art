'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, User } from 'lucide-react';
import { ToolLayout } from '@/components/tools/tool-layout';
import { StyleSelector } from '@/components/tools/selectors';
import { generateApi } from '@/lib/api';

const SUB_TOOLS = [
  { key: 'tpose', label: 'T-pose 生成', desc: '生成标准站姿角色' },
  { key: 'directions', label: '多方向生成', desc: '生成四/八方向视图' },
  { key: 'part_split', label: '部件拆分', desc: '拆分为独立部件层' },
] as const;

export default function CharacterPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [subTool, setSubTool] = useState<string>('tpose');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('anime');
  const [directions, setDirections] = useState(8);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const toolKeyMap: Record<string, string> = {
    tpose: 'character_tpose',
    directions: 'character_directions',
    part_split: 'character_part_split',
  };
  const toolNameMap: Record<string, string> = {
    tpose: 'T-pose角色生成',
    directions: '多方向角色生成',
    part_split: '角色部件拆分',
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await generateApi.character({
        project_id: projectId,
        prompt,
        sub_tool: subTool,
        directions,
        style,
      });
      setResults(res.output_urls);
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setLoading(false);
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
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">角色描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="描述角色外观，如：身穿银色铠甲的女骑士，手持长剑..."
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
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {results.map((url, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <img src={url} alt={`Character ${i + 1}`} className="w-full object-contain" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">描述你的角色，选择功能开始生成</p>
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
