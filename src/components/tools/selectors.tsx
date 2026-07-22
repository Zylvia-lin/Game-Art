'use client';

import { ART_STYLES, IMAGE_RATIOS, RESOLUTIONS } from '@/lib/types';

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
  value: string;
  onChange: (value: string) => void;
}

export function ResolutionSelector({ value, onChange }: ResolutionSelectorProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">分辨率</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
      >
        {RESOLUTIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}
