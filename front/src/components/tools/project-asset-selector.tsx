'use client';

import { useState, useEffect } from 'react';
import { Image as ImageIcon, X, Search, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { projectsApi, resolveImageUrl } from '@/lib/api';
import type { Asset } from '@/lib/types';

interface ProjectAssetSelectorProps {
  projectId: string;
  onSelect: (asset: Asset) => void;
  onClose: () => void;
  filterType?: string;
}

export function ProjectAssetSelector({ projectId, onSelect, onClose, filterType }: ProjectAssetSelectorProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAssets();
  }, [projectId]);

  const loadAssets = async () => {
    if (!projectId || isNaN(Number(projectId))) return;
    try {
      setLoading(true);
      const data = await projectsApi.assets(Number(projectId));
      setAssets(data);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter(asset => {
    if (filterType && asset.type !== filterType) return false;
    if (search && !asset.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#16161f] border border-[#27272a] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#27272a]">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-zinc-200">从项目资产中选择</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#27272a]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="搜索资产名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#0a0a0f] border-[#27272a] h-9 text-sm"
            />
          </div>
        </div>

        {/* Assets Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
              <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">
                {search ? '没有匹配的资产' : '当前项目暂无资产'}
              </p>
              <p className="text-xs mt-1">先生成一些图片资产吧</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => onSelect(asset)}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-[#27272a] hover:border-indigo-500/50 transition-all"
                >
                  <img
                    src={resolveImageUrl(asset.url)}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <span className="text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      选择
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                    <p className="text-[10px] text-zinc-300 truncate">{asset.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
