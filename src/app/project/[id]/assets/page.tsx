'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FolderOpen, Trash2, Download, Filter } from 'lucide-react';
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
    } catch (err) {
      console.error('Failed to delete asset:', err);
    }
  };

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
      </div>

      {/* Assets grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">项目资产</h2>
          <span className="text-sm text-muted-foreground">{assets.length} 个资产</span>
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
              <div key={asset.id} className="group relative overflow-hidden rounded-xl border border-border bg-card hover:border-primary/30 transition-all">
                <div className="aspect-square">
                  <img src={asset.url} alt={asset.name} className="h-full w-full object-contain p-2" />
                </div>
                <div className="border-t border-border p-2">
                  <p className="truncate text-xs text-foreground">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">{asset.type}</p>
                </div>
                {/* Actions overlay */}
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={asset.url}
                    download
                    target="_blank"
                    className="rounded-md bg-card/80 p-1.5 text-foreground backdrop-blur-sm hover:bg-card transition-colors"
                  >
                    <Download className="h-3 w-3" />
                  </a>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="rounded-md bg-card/80 p-1.5 text-destructive backdrop-blur-sm hover:bg-card transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
