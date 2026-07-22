'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FolderOpen, Trash2, Download, Filter, Check, CheckSquare, Square } from 'lucide-react';
import { projectsApi } from '@/lib/api';
import type { Asset } from '@/lib/types';

const ASSET_TYPES = [
  { value: '', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'character', label: '角色' },
  { value: 'prop', label: '道具' },
  { value: 'ui', label: 'UI' },
  { value: 'scene', label: '场景' },
  { value: 'animation_frame', label: '动画帧' },
] as const;

export default function AssetsPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const data = await projectsApi.assets(projectId, filter || undefined);
      setAssets(data);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [projectId, filter]);

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此资产吗？')) return;
    try {
      await projectsApi.deleteAsset(id);
      setAssets(assets.filter((a) => a.id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      console.error('Failed to delete asset:', err);
    }
  };

  const handleToggleFinalize = async (asset: Asset) => {
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalized: !asset.finalized }),
      });
      if (res.ok) {
        setAssets(assets.map(a => a.id === asset.id ? { ...a, finalized: !a.finalized } : a));
      }
    } catch (err) {
      console.error('Failed to toggle finalize:', err);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map(a => a.id)));
    }
  };

  const handleSelectFinalized = () => {
    setSelectedIds(new Set(assets.filter(a => a.finalized).map(a => a.id)));
  };

  const handleBatchDownload = async () => {
    const selectedAssets = assets.filter(a => selectedIds.has(a.id));
    for (const asset of selectedAssets) {
      try {
        const response = await fetch(asset.url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${asset.name || `asset_${asset.id}`}.png`;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
        // Small delay between downloads
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(`Failed to download ${asset.name}:`, err);
      }
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个资产吗？`)) return;
    for (const id of selectedIds) {
      try {
        await projectsApi.deleteAsset(id);
      } catch (err) {
        console.error('Failed to delete:', err);
      }
    }
    setAssets(assets.filter(a => !selectedIds.has(a.id)));
    setSelectedIds(new Set());
  };

  const finalizedCount = assets.filter(a => a.finalized).length;

  return (
    <div className="flex h-full">
      {/* Filter sidebar */}
      <div className="w-[200px] shrink-0 border-r border-border p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4" />
          筛选
        </h3>
        <div className="space-y-1">
          {ASSET_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                filter === t.value
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">批量操作</h3>
          <div className="space-y-2">
            <button
              onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                selectMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {selectMode ? '退出选择' : '多选模式'}
            </button>
            {selectMode && (
              <>
                <button
                  onClick={handleSelectAll}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                >
                  <Square className="h-3.5 w-3.5" />
                  全选 ({assets.length})
                </button>
                <button
                  onClick={handleSelectFinalized}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                >
                  <Check className="h-3.5 w-3.5" />
                  选择定稿 ({finalizedCount})
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <button
                      onClick={handleBatchDownload}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      下载选中 ({selectedIds.size})
                    </button>
                    <button
                      onClick={handleBatchDelete}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除选中 ({selectedIds.size})
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Assets grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">项目资产</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-400">{finalizedCount} 个已定稿</span>
            <span className="text-sm text-muted-foreground">{assets.length} 个资产</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-card border border-border" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="mb-4 rounded-full bg-accent p-6">
              <FolderOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">暂无资产</h3>
            <p className="text-sm text-muted-foreground">使用工具生成资产后会自动出现在这里</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className={`group relative overflow-hidden rounded-xl border bg-card hover:border-primary/30 transition-all cursor-pointer ${
                  selectedIds.has(asset.id) ? 'border-primary ring-1 ring-primary' : 'border-border'
                } ${asset.finalized ? 'ring-1 ring-emerald-500/30' : ''}`}
                onClick={() => selectMode && handleToggleSelect(asset.id)}
              >
                {/* Finalized badge */}
                {asset.finalized && (
                  <div className="absolute left-1 top-1 z-10 rounded bg-emerald-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    定稿
                  </div>
                )}

                {/* Select checkbox */}
                {selectMode && (
                  <div className="absolute right-1 top-1 z-10">
                    {selectedIds.has(asset.id) ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-zinc-500" />
                    )}
                  </div>
                )}

                <div className="aspect-square">
                  <img src={asset.url} alt={asset.name} className="h-full w-full object-contain p-2" />
                </div>
                <div className="border-t border-border p-2">
                  <p className="truncate text-xs text-foreground">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">{asset.type}</p>
                </div>
                {/* Actions overlay */}
                {!selectMode && (
                  <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleFinalize(asset); }}
                      className={`rounded-md p-1.5 backdrop-blur-sm transition-colors ${
                        asset.finalized
                          ? 'bg-emerald-500/80 text-white hover:bg-red-500/80'
                          : 'bg-card/80 text-foreground hover:bg-card'
                      }`}
                      title={asset.finalized ? '取消定稿' : '定稿'}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <a
                      href={asset.url}
                      download
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-md bg-card/80 p-1.5 text-foreground backdrop-blur-sm hover:bg-card transition-colors"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }}
                      className="rounded-md bg-card/80 p-1.5 text-destructive backdrop-blur-sm hover:bg-card transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
