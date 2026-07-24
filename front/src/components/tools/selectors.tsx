'use client';

import { ART_STYLES, IMAGE_RATIOS, RESOLUTION_TIERS, computeSize } from '@/lib/types';

interface StyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function StyleSelector({ value, onChange }: StyleSelectorProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">风格</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
      >
        {ART_STYLES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface RatioSelectorProps {
  value: string;
  onChange: (value: string) => void;
  showOriginal?: boolean;
  originalLabel?: string;
}

export function RatioSelector({ value, onChange, showOriginal = false, originalLabel }: RatioSelectorProps) {
  const options = showOriginal
    ? [{ value: 'original', label: '默认' }, ...IMAGE_RATIOS]
    : IMAGE_RATIOS;

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">比例</label>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((r) => {
          const selected = value === r.value;
          return (
            <button
              key={r.value}
              onClick={() => onChange(r.value)}
              className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {r.label}
              {r.value === 'original' && originalLabel && (
                <span className="block text-[10px] opacity-70 mt-0.5">{originalLabel}</span>
              )}
            </button>
          );
        })}
      </div>
      {showOriginal && value === 'original' && (
        <p className="mt-1 text-xs text-muted-foreground/70">
          {originalLabel ? `使用原图比例 (${originalLabel})` : '使用原图比例（请先上传图片）'}
        </p>
      )}
    </div>
  );
}

interface ResolutionSelectorProps {
  ratio: string;
  value: string;
  onChange: (value: string) => void;
  showOriginal?: boolean;
  originalLabel?: string;
}

export function ResolutionSelector({ ratio, value, onChange, showOriginal = false, originalLabel }: ResolutionSelectorProps) {
  const options = showOriginal
    ? [{ value: 'original', label: '默认' }]
    : [];

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">分辨率</label>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((t) => {
          const selected = value === t.value;
          return (
            <button
              key={t.value}
              onClick={() => onChange(t.value)}
              className={`rounded-lg border px-3 py-2 text-center transition-all ${
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              <div className="text-sm font-medium">{t.label}</div>
              <div className={`text-xs ${selected ? 'text-primary/70' : 'text-muted-foreground/60'}`}>
                {originalLabel ? `${originalLabel}px` : '待上传图片'}
              </div>
            </button>
          );
        })}
        {RESOLUTION_TIERS.map((t) => {
          const computed = computeSize(ratio === 'original' ? '1:1' : ratio, t.value);
          const selected = value === t.value;
          return (
            <button
              key={t.value}
              onClick={() => onChange(t.value)}
              className={`rounded-lg border px-3 py-2 text-center transition-all ${
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              <div className="text-sm font-medium">{t.label}</div>
              <div className={`text-xs ${selected ? 'text-primary/70' : 'text-muted-foreground/60'}`}>
                {ratio === 'original' ? `${t.label} 档` : computed}
              </div>
            </button>
          );
        })}
      </div>
      {showOriginal && value === 'original' && (
        <p className="mt-1 text-xs text-muted-foreground/70">
          {originalLabel ? `使用原图分辨率 (${originalLabel}px)` : '使用原图分辨率（请先上传图片）'}
        </p>
      )}
    </div>
  );
}
