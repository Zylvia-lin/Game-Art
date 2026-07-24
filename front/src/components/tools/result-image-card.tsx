"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, FolderPlus, Check, Pencil, X, ZoomIn } from "lucide-react";
import { resolveImageUrl, assetsApi, downloadImage, generateApi } from "@/lib/api";

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
  const [showPreview, setShowPreview] = useState(false);

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

  const handleAddToLibrary = async () => {
    setAddingToLibrary(true);
    try {
      await assetsApi.create({
        project_id: projectId,
        name: displayName,
        type: "image",
        url,
      });
      setAdded(true);
    } catch (err) {
      console.error("Failed to add to library:", err);
    } finally {
      setAddingToLibrary(false);
    }
  };

  const handleImageClick = () => {
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
  };

  return (
    <>
      <div className="group relative overflow-hidden rounded-xl border border-border bg-card">
        <div className="relative cursor-pointer" onClick={handleImageClick}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveImageUrl(url)} alt={displayName} className="w-full object-contain" loading="lazy" />

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
            onClick={handleAddToLibrary}
            disabled={addingToLibrary || added}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-all ${
              added
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-background/90 text-foreground hover:bg-background"
            }`}
            title="添加到资产库"
          >
            {added ? <Check className="h-3.5 w-3.5" /> : <FolderPlus className="h-3.5 w-3.5" />}
            {added ? "已添加" : "添加到资产库"}
          </button>
        </div>
      </div>

      {/* Full-screen preview modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={handleClosePreview}
        >
          {/* Close button */}
          <button
            onClick={handleClosePreview}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-foreground hover:bg-background"
            title="关闭"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Image */}
          <div className="flex max-h-[85vh] max-w-[90vw] flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveImageUrl(url)}
              alt={displayName}
              className="max-h-[78vh] max-w-full rounded-lg object-contain"
            />
            {/* Info bar */}
            <div className="mt-3 flex items-center gap-4">
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
                onClick={handleAddToLibrary}
                disabled={addingToLibrary || added}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-all ${
                  added
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-background/80 text-foreground hover:bg-background"
                }`}
                title="添加到资产库"
              >
                {added ? <Check className="h-3.5 w-3.5" /> : <FolderPlus className="h-3.5 w-3.5" />}
                {added ? "已添加" : "添加到资产库"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
