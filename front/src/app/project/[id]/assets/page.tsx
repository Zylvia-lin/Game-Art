'use client';

import { useEffect, useState, useRef, useCallback, DragEvent } from 'react';
import { useParams } from 'next/navigation';
import { FolderOpen, Trash2, Download, Filter, Check, CheckSquare, Square, Upload, X, Loader2 } from 'lucide-react';
import { projectsApi, assetsApi, generateApi, resolveImageUrl } from '@/lib/api';
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

const UPLOAD_CATEGORIES = [
  { value: 'character', label: '角色' },
  { value: 'prop', label: '道具' },
  { value: 'ui', label: 'UI' },
  { value: 'scene', label: '场景' },
  { value: 'animation_frame', label: '动画帧' },
  { value: 'image', label: '其他图片' },
] as const;

export default function AssetsPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Upload dialog state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>('');
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState<string>('character');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadDragging, setUploadDragging] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wait for params to load
  if (!params.id || isNaN(projectId)) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
    if (!projectId || isNaN(projectId)) return;
    fetchAssets();
  }, [projectId, filter]);

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此资产吗？')) return;
    try {
      await assetsApi.delete(id);
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
        await assetsApi.delete(id);
      } catch (err) {
        console.error('Failed to delete:', err);
      }
    }
    setAssets(assets.filter(a => !selectedIds.has(a.id)));
    setSelectedIds(new Set());
  };

  const finalizedCount = assets.filter(a => a.finalized).length;

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过 10MB');
      return;
    }
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    if (!uploadName) {
      setUploadName(file.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) return;
    setUploading(true);
    try {
      // 1. Upload file to server
      const { url } = await generateApi.upload(uploadFile);
      // 2. Create asset record
      const asset = await projectsApi.createAsset({
        project_id: projectId,
        name: uploadName.trim(),
        type: uploadCategory,
        url,
        description: uploadDescription.trim(),
      });
      // 3. Add to list and close dialog
      setAssets(prev => [asset, ...prev]);
      resetUploadDialog();
    } catch (err) {
      console.error('Upload failed:', err);
      alert('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadDialog = () => {
    setShowUploadDialog(false);
    setUploadFile(null);
    setUploadPreview('');
    setUploadName('');
    setUploadDescription('');
    setUploadCategory('character');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
            <button
              onClick={() => setShowUploadDialog(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-all"
            >
              <Upload className="h-3.5 w-3.5" />
              上传资产
            </button>
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
                  <img src={resolveImageUrl(asset.url)} alt={asset.name} className="h-full w-full object-contain p-2" />
                </div>
                <div className="border-t border-border p-2">
                  <p className="truncate text-xs font-medium text-foreground">{asset.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{ASSET_TYPES.find(t => t.value === asset.type)?.label || asset.type}</span>
                    {asset.description && (
                      <span className="truncate text-[10px] text-muted-foreground/60">· {asset.description}</span>
                    )}
                  </div>
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

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-[#16161f] p-6 shadow-2xl">
            <button
              onClick={resetUploadDialog}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="mb-5 text-lg font-semibold text-foreground">上传资产</h3>

            {/* File upload area */}
            <div className="mb-4">
              {uploadPreview ? (
                <div className="relative group">
                  <div className="aspect-square max-h-[200px] rounded-lg overflow-hidden border border-border bg-[#0a0a0f] flex items-center justify-center">
                    <img src={uploadPreview} alt="Preview" className="max-w-full max-h-full object-contain" />
                  </div>
                  <button
                    onClick={() => { setUploadFile(null); setUploadPreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="absolute top-2 right-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 transition-colors ${
                    uploadDragging ? 'border-primary bg-primary/10' : 'border-border bg-[#0a0a0f]/50 hover:border-primary/50'
                  }`}
                  onDragOver={(e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setUploadDragging(true); }}
                  onDragEnter={(e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setUploadDragging(true); }}
                  onDragLeave={(e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setUploadDragging(false); }}
                  onDrop={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setUploadDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      if (file.size > 10 * 1024 * 1024) { setUploadError('文件大小超过 10MB 限制'); return; }
                      setUploadError('');
                      setUploadFile(file);
                      if (!uploadName.trim()) setUploadName(file.name.replace(/\.[^.]+$/, ''));
                      const reader = new FileReader();
                      reader.onload = (ev) => setUploadPreview(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{uploadDragging ? '松开以上传' : '点击选择或拖拽图片到此处'}</span>
                  <span className="text-xs text-muted-foreground/60">支持 JPG、PNG、WebP，最大 10MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
              )}
            </div>

            {/* Category */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-foreground">分类</label>
              <div className="grid grid-cols-3 gap-2">
                {UPLOAD_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setUploadCategory(cat.value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      uploadCategory === cat.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-foreground">名称</label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="输入资产名称..."
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-foreground">描述</label>
              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                rows={2}
                placeholder="可选，描述资产内容..."
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={resetUploadDialog}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
              >
                取消
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || !uploadName.trim() || uploading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {uploading ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />上传中...</>
                ) : (
                  <><Upload className="h-4 w-4" />上传</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
