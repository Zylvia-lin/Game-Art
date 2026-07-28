'use client';

import { useEffect, useMemo, useState } from 'react';
import { projectsApi, resolveImageUrl, type Asset } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  projectId: string;
  value: string;
  onChange: (value: string) => void;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
}

export function AssetMentionPrompt({
  projectId, value, onChange, selectedIds, onSelectedIdsChange,
}: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    projectsApi.assets(projectId).then(setAssets).catch(() => setAssets([]));
  }, [projectId]);

  const selected = useMemo(
    () => assets.filter((asset) => selectedIds.includes(asset.id)),
    [assets, selectedIds],
  );

  const toggle = (asset: Asset) => {
    const exists = selectedIds.includes(asset.id);
    onSelectedIdsChange(exists
      ? selectedIds.filter((id) => id !== asset.id)
      : [...selectedIds, asset.id]);
    if (!exists && !value.includes(`@${asset.name}`)) {
      onChange(`${value}${value && !value.endsWith(' ') ? ' ' : ''}@${asset.name} `);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">提示词与引用资产</label>
      <Textarea
        value={value}
        rows={5}
        placeholder="描述视频内容；输入 @ 或从下方选择项目资产"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          if (event.target.value.endsWith('@')) setOpen(true);
        }}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((asset) => (
            <button
              type="button"
              key={asset.id}
              onClick={() => toggle(asset)}
              className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
              title={`真实资产 ID：${asset.id}`}
            >
              @{asset.name} ×
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="max-h-52 space-y-1 overflow-auto rounded-lg border bg-popover p-2">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-muted"
            >
              <Checkbox
                aria-label={`选择资产 ${asset.name}`}
                checked={selectedIds.includes(asset.id)}
                onCheckedChange={() => toggle(asset)}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveImageUrl(asset.url)} alt="" className="size-9 rounded object-cover" />
              <span className="min-w-0 truncate text-sm">{asset.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{asset.type}</span>
            </div>
          ))}
          {assets.length === 0 && <p className="p-3 text-sm text-muted-foreground">项目暂无可用资产</p>}
          <button type="button" className="w-full p-1 text-xs text-muted-foreground" onClick={() => setOpen(false)}>
            收起资产列表
          </button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        @名称仅用于展示，提交时发送真实资产 ID；后端会校验项目归属。
      </p>
    </div>
  );
}

