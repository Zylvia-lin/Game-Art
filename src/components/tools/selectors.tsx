'use client';

import { ART_STYLES, IMAGE_RATIOS, getResolutionOptions, getDefaultResolution } from '@/lib/types';

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
}

export function RatioSelector({ value, onChange }: RatioSelectorProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">比例</label>
      <div className="flex gap-1.5">
        {IMAGE_RATIOS.map((r) => (
          <button
            key={r.value}
            onClick={() => onChange(r.value)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
              value === r.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ResolutionSelectorProps {
  ratio: string;
  value: string;
  onChange: (value: string) => void;
}

const QUALITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '标准',
  high: '高清',
  ultra: '超清',
};

const QUALITY_COLORS: Record<string, string> = {
  low: 'text-zinc-400',
  medium: 'text-blue-400',
  high: 'text-emerald-400',
  ultra: 'text-amber-400',
};

export function ResolutionSelector({ ratio, value, onChange }: ResolutionSelectorProps) {
  const options = getResolutionOptions(ratio);

  // Ensure current value is valid for this ratio, otherwise auto-select default
  const isValid = options.some((o) => o.value === value);
  const effectiveValue = isValid ? value : getDefaultResolution(ratio);

  if (!isValid && effectiveValue !== value) {
    // Sync the value up (in effect to avoid render loops)
    setTimeout(() => onChange(effectiveValue), 0);
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">分辨率</label>
      <div className="space-y-1">
        {options.map((r) => (
          <button
            key={r.value}
            onClick={() => onChange(r.value)}
            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all ${
              effectiveValue === r.value
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            <span>{r.label}</span>
            <span className={`text-xs font-medium ${QUALITY_COLORS[r.quality]}`}>
              {QUALITY_LABELS[r.quality]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
