"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, FolderPlus, Check, Pencil, X, ZoomIn, User, Package, Layout, Image as ImageIcon, Film } from "lucide-react";
import { resolveImageUrl, assetsApi, downloadImage, generateApi } from "@/lib/api";

const ASSET_TYPES = [
  { value: "character", label: "角色", icon: User, color: "text-indigo-400" },
  { value: "prop", label: "道具", icon: Package, color: "text-emerald-400" },
  { value: "ui", label: "UI", icon: Layout, color: "text-sky-400" },
  { value: "scene", label: "场景", icon: ImageIcon, color: "text-amber-400" },
  { value: "animation_frame", label: "动画帧", icon: Film, color: "text-rose-400" },
] as const;

interface ResultImageCardProps {
  url: string;
  projectId: string;
  index?: number;
  name?: string;
  taskId?: string;
  taskIndex?: number;
  onNameChange?: (newName: string) => void;
}

export function ResultImageCard({
  url,
  projectId,
  index = 0,
  name,
  taskId,
  taskIndex,
  onNameChange,
}: ResultImageCardProps) {
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [displayName, setDisplayName] = useState(name || `生成图片 ${index + 1}`);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [addingToLibrary, setAddingToLibrary] = useState(false);
  const [added, setAdded] = useState(false);
  const [addedType, setAddedType] = useState<string | null>(null);
  const [showAssetTypeDialog, setShowAssetTypeDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);

  useEffect(() => {
    if (name) setDisplayName(name);
  }, [name]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = resolveImageUrl(url);
    return () => { img.onload = null; };
  }, [url]);

  const handleStartRename = () => {
    setEditing(true);
    setEditName(displayName);
  };

  const handleCancelRename = () => {
    setEditing(false);
    setEditName("");
  };

  const handleConfirmRename = async () => {
    const newName = editName.trim();
    if (!newName || newName === displayName) {
      setEditing(false);
      return;
    }
    setRenaming(true);
    try {
      if (taskId !== undefined && taskIndex !== undefined) {
        await generateApi.renameOutput(taskId, taskIndex, newName);
      }
      setDisplayName(newName);
      onNameChange?.(newName);
    } catch (err) {
      console.error("Rename failed:", err);
    } finally {
      setRenaming(false);
      setEditing(false);
    }
  };

  const handleDownload = useCallback(() => {
    downloadImage(url, `${displayName}.png`);
  }, [url, displayName]);

  const handleAddToLibrary = async (assetType: string) => {
    setShowAssetTypeDialog(false);
    setAddingToLibrary(true);
    try {
      await assetsApi.create({
        project_id: projectId,
        name: displayName,
        type: assetType,
        url,
      });
      setAdded(true);
      setAddedType(assetType);
    } catch (err) {
      console.error("Failed to add to library:", err);
    } finally {
      setAddingToLibrary(false);
    }
  };

  const handleOpenAssetDialog = () => {
    if (added) return;
    setShowAssetTypeDialog(true);
  };

  const handleImageClick = () => {
    handleOpenPreview();
  };

  const handleOpenPreview = () => {
    setPreviewZoom(1);
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setPreviewZoom(1);
  };

  const handlePreviewWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setPreviewZoom((prev) => Math.max(0.2, Math.min(5, Math.round((prev + delta) * 100) / 100)));
  };

  return (
    <>
      <div className="group relative mb-3 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card">
        <div className="relative cursor-pointer" onClick={handleImageClick}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveImageUrl(url)} alt={displayName} className="block w-full" loading="lazy" />

          {/* Resolution badge - top right */}
          {dimensions && (
            <span className="absolute right-2 top-2 z-10 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {dimensions.w} &times; {dimensions.h}px
            </span>
          )}

          {/* Zoom icon - center, hover only */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/20 group-hover:opacity-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm">
              <ZoomIn className="h-5 w-5 text-foreground" />
            </div>
          </div>
        </div>

        {/* Name badge - top left, editable on hover */}
        {editing ? (
          <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-1 bg-black/80 px-2 py-1.5 backdrop-blur-sm">
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmRename();
                if (e.key === "Escape") handleCancelRename();
              }}
              disabled={renaming}
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
              placeholder="输入名称"
            />
            <button
              onClick={handleConfirmRename}
              disabled={renaming}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-white hover:bg-primary/90"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={handleCancelRename}
              disabled={renaming}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-white hover:bg-muted/80"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-1 bg-gradient-to-b from-black/70 to-transparent px-2 py-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="flex-1 truncate text-xs text-white drop-shadow">{displayName}</span>
            <button
              onClick={handleStartRename}
              className="pointer-events-auto flex h-4 w-4 shrink-0 items-center justify-center text-white/70 hover:text-white"
              title="编辑名称"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Action buttons - bottom overlay, hover only */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-md bg-background/90 px-3 py-1.5 text-xs text-foreground hover:bg-background"
            title="下载"
          >
            <Download className="h-3.5 w-3.5" />
            下载
          </button>
          <button
            onClick={handleOpenAssetDialog}
            disabled={addingToLibrary}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-all ${
              added
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-background/90 text-foreground hover:bg-background"
            }`}
            title="添加到资产库"
          >
            {added ? <Check className="h-3.5 w-3.5" /> : <FolderPlus className="h-3.5 w-3.5" />}
            {added ? `已添加到${ASSET_TYPES.find(t => t.value === addedType)?.label || "资产库"}` : "添加到资产库"}
          </button>
        </div>
      </div>

      {/* Asset type selection dialog */}
      {showAssetTypeDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowAssetTypeDialog(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">选择资产类型</h3>
              <button
                onClick={() => setShowAssetTypeDialog(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">将「{displayName}」添加到哪种资产类型？</p>
            <div className="grid grid-cols-2 gap-2">
              {ASSET_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => handleAddToLibrary(t.value)}
                    disabled={addingToLibrary}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-4 transition-all hover:border-primary/40 hover:bg-muted"
                  >
                    <Icon className={`h-6 w-6 ${t.color}`} />
                    <span className="text-xs font-medium text-foreground">{t.label}</span>
                  </button>
                );
              })}
            </div>
            {addingToLibrary && (
              <div className="mt-4 text-center text-xs text-muted-foreground">添加中...</div>
            )}
          </div>
        </div>
      )}

      {/* Full-screen preview modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
          onClick={handleClosePreview}
        >
          {/* Top bar: zoom indicator + close */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 rounded-lg bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
              <span>滚轮缩放</span>
              <span className="text-foreground font-medium">{Math.round(previewZoom * 100)}%</span>
              {previewZoom !== 1 && (
                <button
                  onClick={() => setPreviewZoom(1)}
                  className="text-primary hover:text-primary/80"
                  title="重置"
                >
                  重置
                </button>
              )}
            </div>
            <button
              onClick={handleClosePreview}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-foreground hover:bg-background"
              title="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Image area - scrollable, no scrollbar */}
          <div
            className="flex flex-1 items-center justify-center overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            onClick={(e) => e.stopPropagation()}
            onWheel={handlePreviewWheel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveImageUrl(url)}
              alt={displayName}
              className="rounded-lg object-contain transition-transform duration-100"
              style={{
                transform: `scale(${previewZoom})`,
                transformOrigin: "center center",
                maxHeight: previewZoom > 1 ? "none" : "70vh",
                maxWidth: "90vw",
              }}
              draggable={false}
            />
          </div>

          {/* Fixed bottom bar: name + dimensions + actions */}
          <div
            className="flex items-center justify-center gap-4 px-4 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sm text-white/80">{displayName}</span>
            {dimensions && (
              <span className="text-xs text-white/50">{dimensions.w} × {dimensions.h}px</span>
            )}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-md bg-background/80 px-3 py-1.5 text-xs text-foreground hover:bg-background"
              title="下载"
            >
              <Download className="h-3.5 w-3.5" />
              下载
            </button>
            <button
              onClick={handleOpenAssetDialog}
              disabled={addingToLibrary}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-all ${
                added
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-background/80 text-foreground hover:bg-background"
              }`}
              title="添加到资产库"
            >
              {added ? <Check className="h-3.5 w-3.5" /> : <FolderPlus className="h-3.5 w-3.5" />}
              {added ? `已添加到${ASSET_TYPES.find(t => t.value === addedType)?.label || "资产库"}` : "添加到资产库"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
