'use client';

import { useRouter } from 'next/navigation';
import { Paintbrush, Film, Scissors, Rotate3D, Layers } from 'lucide-react';

interface GenerationResultActionsProps {
  projectId: string;
  imageUrl: string;
  imageType?: 'character' | 'prop' | 'scene' | 'ui' | 'general';
}

export function GenerationResultActions({ projectId, imageUrl, imageType = 'general' }: GenerationResultActionsProps) {
  const router = useRouter();

  const actions = [
    {
      icon: Paintbrush,
      label: '局部重绘',
      desc: '修改局部区域',
      onClick: () => {
        // Store the image URL in session storage for the inpaint page to pick up
        sessionStorage.setItem('inpaint_source_image', imageUrl);
        router.push(`/project/${projectId}/inpaint`);
      },
    },
    {
      icon: Film,
      label: '生成动画',
      desc: '基于此图生成动画帧',
      onClick: () => {
        sessionStorage.setItem('animation_source_image', imageUrl);
        router.push(`/project/${projectId}/animation`);
      },
      show: imageType === 'character' || imageType === 'general',
    },
    {
      icon: Rotate3D,
      label: '多方向',
      desc: '生成四/八方向视图',
      onClick: () => {
        sessionStorage.setItem('character_source_image', imageUrl);
        router.push(`/project/${projectId}/character`);
      },
      show: imageType === 'character' || imageType === 'general',
    },
    {
      icon: Scissors,
      label: '部件拆分',
      desc: '拆分为独立部件',
      onClick: () => {
        sessionStorage.setItem('character_source_image', imageUrl);
        router.push(`/project/${projectId}/character?tab=split`);
      },
      show: imageType === 'character',
    },
    {
      icon: Layers,
      label: '衍生变体',
      desc: '基于此图生成变体',
      onClick: () => {
        sessionStorage.setItem('prop_source_image', imageUrl);
        router.push(`/project/${projectId}/prop`);
      },
      show: imageType === 'prop' || imageType === 'general',
    },
  ];

  const visibleActions = actions.filter(a => a.show !== false);

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleActions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className="flex items-center gap-1.5 rounded-md border border-[#27272a] bg-[#16161f] px-2.5 py-1.5 text-xs text-zinc-400 hover:border-indigo-500/50 hover:text-indigo-400 transition-all"
          title={action.desc}
        >
          <action.icon className="w-3 h-3" />
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
