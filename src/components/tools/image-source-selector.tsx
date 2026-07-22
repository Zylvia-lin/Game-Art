'use client';

import { useState } from 'react';
import { Upload, FolderOpen, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectAssetSelector } from './project-asset-selector';
import type { Asset } from '@/lib/types';

interface ImageSourceSelectorProps {
  projectId: string;
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
  label?: string;
  assetType?: string; // Filter assets by type (e.g., 'character', 'ui', 'scene')
}

export function ImageSourceSelector({ projectId, imageUrl, onImageChange, label = '输入图片', assetType }: ImageSourceSelectorProps) {
  const [showAssetSelector, setShowAssetSelector] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onImageChange(url);
    }
  };

  const handleAssetSelect = (asset: Asset) => {
    onImageChange(asset.url);
    setShowAssetSelector(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-zinc-400">{label}</label>

      {imageUrl ? (
        <div className="relative group">
          <div className="aspect-square max-h-[240px] rounded-lg overflow-hidden border border-[#27272a] bg-[#0a0a0f] flex items-center justify-center">
            <img src={imageUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80"
            onClick={() => onImageChange(null)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Upload file */}
          <label className="flex-1 flex items-center justify-center gap-2 px-3 py-6 rounded-lg border border-dashed border-[#27272a] hover:border-indigo-500/50 cursor-pointer transition-colors bg-[#0a0a0f]/50">
            <Upload className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">上传图片</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>

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
