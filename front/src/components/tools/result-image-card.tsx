"use client";

import { useEffect, useState } from "react";
import { resolveImageUrl } from "@/lib/api";
import { GenerationResultActions } from "./generation-result-actions";

interface ResultImageCardProps {
  url: string;
  projectId: string;
  index?: number;
}

export function ResultImageCard({ url, projectId, index = 0 }: ResultImageCardProps) {
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = resolveImageUrl(url);
    return () => { img.onload = null; };
  }, [url]);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative">
        <img src={resolveImageUrl(url)} alt={`Result ${index + 1}`} className="w-full object-contain" />
        {dimensions && (
          <span className="absolute top-2 right-2 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {dimensions.w} × {dimensions.h}px
          </span>
        )}
      </div>
      <div className="p-3 border-t border-border">
        <GenerationResultActions projectId={projectId} imageUrl={url} showAddToLibrary />
      </div>
    </div>
  );
}
