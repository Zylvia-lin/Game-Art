'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Paintbrush, Film, Scissors, Rotate3D, Layers, Check, X, Download, FolderPlus } from 'lucide-react';
import { projectsApi, assetsApi } from '@/lib/api';

interface GenerationResultActionsProps {
  projectId: string;
  imageUrl: string;
  imageType?: 'character' | 'prop' | 'scene' | 'ui' | 'general';
  assetId?: number;
  finalized?: boolean;
  onFinalizeChange?: (finalized: boolean) => void;
  showAddToLibrary?: boolean;
  onAddedToLibrary?: (assetId: number) => void;
}

export function GenerationResultActions({
  projectId,
  imageUrl,
  imageType = 'general',
  assetId,
  finalized = false,
  onFinalizeChange,
  showAddToLibrary = false,
  onAddedToLibrary,
}: GenerationResultActionsProps) {
  const router = useRouter();
  const [finalizing, setFinalizing] = useState(false);
  const [addingToLibrary, setAddingToLibrary] = useState(false);
  const [added, setAdded] = useState(false);

  const handleToggleFinalize = async () => {
    if (!assetId) return;
    setFinalizing(true);
    try {
      await assetsApi.update(assetId, { finalized: !finalized });
      onFinalizeChange?.(!finalized);
    } catch (err) {
      console.error('Failed to toggle finalize:', err);
    } finally {
      setFinalizing(false);
    }
  };

  const handleAddToLibrary = async () => {
    if (!projectId) return;
    setAddingToLibrary(true);
    try {
      const asset = await assetsApi.create({
        project_id: projectId,
        name: `生成图片 ${new Date().toLocaleString()}`,
        type: imageType === 'general' ? 'prop' : imageType,
        url: imageUrl,
        metadata: { source: 'toolbox' },
      });
      setAdded(true);
      onAddedToLibrary?.(asset.id);
    } catch (err) {
      console.error('Failed to add to library:', err);
    } finally {
      setAddingToLibrary(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `asset_${assetId || 'untitled'}.png`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed, falling back to direct link:', err);
      // Fallback: open in new tab for manual download
      const link = document.createElement('a');
      link.href = imageUrl;
      link.target = '_blank';
      link.download = `asset_${assetId || 'untitled'}.png`;
      link.click();
    }
  };

  const actions = [
    {
      icon: Paintbrush,
      label: '局部重绘',
      desc: '修改局部区域',
      onClick: () => {
        sessionStorage.setItem('preselect_image', imageUrl);
        router.push(`/project/${projectId}/inpaint`);
      },
    },
    {
      icon: Film,
      label: '生成动画',
      desc: '基于此图生成动画帧',
      onClick: () => {
        sessionStorage.setItem('preselect_image', imageUrl);
        router.push(`/project/${projectId}/animation`);
      },
      show: imageType === 'character' || imageType === 'general',
    },
    {
      icon: Rotate3D,
      label: '多方向',
      desc: '生成四/八方向视图',
      onClick: () => {
        sessionStorage.setItem('preselect_image', imageUrl);
        router.push(`/project/${projectId}/character`);
      },
      show: imageType === 'character' || imageType === 'general',
    },
    {
      icon: Scissors,
      label: '部件拆分',
      desc: '拆分为独立部件',
      onClick: () => {
        sessionStorage.setItem('preselect_image', imageUrl);
        router.push(`/project/${projectId}/character?tab=part_split`);
      },
      show: imageType === 'character',
    },
    {
      icon: Layers,
      label: '衍生变体',
      desc: '基于此图生成变体',
      onClick: () => {
        sessionStorage.setItem('preselect_image', imageUrl);
        router.push(`/project/${projectId}/prop`);
      },
      show: imageType === 'prop' || imageType === 'general',
    },
  ];

  const visibleActions = actions.filter(a => a.show !== false);

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 border-t border-[#27272a] bg-[#111118]/50">
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

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-md border border-[#27272a] bg-[#16161f] px-2.5 py-1.5 text-xs text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
          title="下载图片"
        >
          <Download className="w-3 h-3" />
          <span>下载</span>
        </button>

        {showAddToLibrary && (
          <button
            onClick={handleAddToLibrary}
            disabled={addingToLibrary || added}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-all ${
              added
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                : 'border-[#27272a] bg-[#16161f] text-zinc-400 hover:border-primary/50 hover:text-primary'
            }`}
            title="添加到资产库"
          >
            {added ? <Check className="w-3 h-3" /> : <FolderPlus className="w-3 h-3" />}
            <span>{added ? '已添加' : '添加到资产库'}</span>
          </button>
        )}

        {assetId && (
          <button
            onClick={handleToggleFinalize}
            disabled={finalizing}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-all ${
              finalized
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:border-red-500/50 hover:text-red-400'
                : 'border-[#27272a] bg-[#16161f] text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-400'
            }`}
            title={finalized ? '取消定稿' : '定稿此资产'}
          >
            {finalized ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            <span>{finalized ? '已定稿' : '定稿'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
