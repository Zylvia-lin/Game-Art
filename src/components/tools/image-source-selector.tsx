'use client';

import { useState, useRef, useCallback, DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ProjectAssetSelector } from './project-asset-selector';
import { generateApi } from '@/lib/api';
import type { Asset } from '@/lib/types';
import { Upload, X, FolderOpen, Loader2 } from 'lucide-react';

interface ImageSourceSelectorProps {
  projectId: string;
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
  label?: string;
  assetType?: string;
}

export function ImageSourceSelector({ projectId, imageUrl, onImageChange, label = '输入图片', assetType }: ImageSourceSelectorProps) {
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const res = await generateApi.upload(file);
      if (res.url) onImageChange(res.url);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [onImageChange]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  }, [uploadFile]);

  const handleAssetSelect = (asset: Asset) => {
    onImageChange(asset.url);
    setShowAssetSelector(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-400">{label}</label>
      {imageUrl ? (
        <div className="relative group rounded-lg overflow-hidden border border-[#27272a]">
          <img src={imageUrl} alt="Source" className="w-full h-40 object-contain bg-[#0a0a0f]" />
          <button
            onClick={() => onImageChange(null)}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          className="flex gap-2"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Upload from local / drag & drop */}
          <div
            className={`flex-1 rounded-lg border border-dashed transition-colors cursor-pointer ${
              dragOver
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-[#27272a] hover:border-indigo-500/50 bg-[#0a0a0f]/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-zinc-500 hover:text-zinc-300">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="text-xs">{uploading ? '上传中...' : dragOver ? '松开以上传' : '拖拽或点击上传'}</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          {/* Select from project assets */}
          <Button
            variant="outline"
            className="flex-1 h-auto py-6 flex-col gap-2 border-dashed border-[#27272a] hover:border-indigo-500/50 bg-[#0a0a0f]/50 text-zinc-500 hover:text-zinc-300"
            onClick={() => setShowAssetSelector(true)}
          >
            <FolderOpen className="w-4 h-4" />
            <span className="text-xs">从项目资产选择</span>
          </Button>
        </div>
      )}

      {showAssetSelector && (
        <ProjectAssetSelector
          projectId={projectId}
          filterType={assetType}
          onSelect={handleAssetSelect}
          onClose={() => setShowAssetSelector(false)}
        />
      )}
    </div>
  );
}
