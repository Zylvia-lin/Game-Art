'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Sparkles, User, Film, Sword, Layout, Map, FolderOpen } from 'lucide-react';
import { projectsApi } from '@/lib/api';
import type { Project } from '@/lib/types';

const TOOLS = [
  { key: 'text2img', label: '文生图', desc: '通过文字描述生成图片', icon: Sparkles, href: 'text2img', color: 'from-violet-500/20 to-purple-500/20' },
  { key: 'img2img', label: '图生图', desc: '基于参考图片进行编辑', icon: Sparkles, href: 'img2img', color: 'from-blue-500/20 to-cyan-500/20' },
  { key: 'inpaint', label: '局部重绘', desc: '涂抹区域并替换内容', icon: Sparkles, href: 'inpaint', color: 'from-rose-500/20 to-pink-500/20' },
  { key: 'character', label: '角色生成', desc: '生成角色、多方向、部件拆分', icon: User, href: 'character', color: 'from-emerald-500/20 to-teal-500/20' },
  { key: 'animation', label: '动画生成', desc: '为角色生成动画帧', icon: Film, href: 'animation', color: 'from-amber-500/20 to-orange-500/20' },
  { key: 'prop', label: '道具生成', desc: '生成道具及变体', icon: Sword, href: 'prop', color: 'from-indigo-500/20 to-blue-500/20' },
  { key: 'ui', label: 'UI生成', desc: '生成游戏UI布局', icon: Layout, href: 'ui', color: 'from-fuchsia-500/20 to-purple-500/20' },
  { key: 'scene', label: '场景生成', desc: '生成游戏场景地图', icon: Map, href: 'scene', color: 'from-lime-500/20 to-green-500/20' },
];

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectsApi.get(projectId).then(setProject).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{project?.name || '项目工作台'}</h1>
        {project?.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            onClick={() => router.push(`/project/${projectId}/${tool.href}`)}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-left transition-all hover:border-primary/30 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <tool.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-foreground">{tool.label}</h3>
              <p className="text-sm text-muted-foreground">{tool.desc}</p>
            </div>
          </button>
        ))}

        {/* Assets card */}
        <button
          onClick={() => router.push(`/project/${projectId}/assets`)}
          className="group relative overflow-hidden rounded-2xl border border-dashed border-border p-6 text-left transition-all hover:border-primary/30 hover:-translate-y-1"
        >
          <div className="relative">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent group-hover:bg-primary/10 transition-colors">
              <FolderOpen className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <h3 className="mb-1 text-base font-semibold text-foreground">项目资产</h3>
            <p className="text-sm text-muted-foreground">查看和管理所有生成的资产</p>
          </div>
        </button>
      </div>
    </div>
  );
}
