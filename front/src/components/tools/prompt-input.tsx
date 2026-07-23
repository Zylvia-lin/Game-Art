'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { generateApi } from '@/lib/api';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  toolKey?: string;
  label?: string;
  placeholder?: string;
  rows?: number;
}

export function PromptInput({
  value,
  onChange,
  toolKey,
  label = '提示词',
  placeholder = '描述你想要生成的游戏美术资产...',
  rows = 4,
}: PromptInputProps) {
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    if (!value.trim() || optimizing) return;
    setOptimizing(true);
    setError(null);
    try {
      const result = await generateApi.optimizePrompt(value, toolKey);
      const optimized = result.optimized_prompt;
      onChange(typeof optimized === 'string' ? optimized : JSON.stringify(optimized));
    } catch (err) {
      const msg = err instanceof Error ? err.message : (typeof err === 'string' ? err : '优化失败，请重试');
      setError(msg);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">{label}</label>
        <button
          onClick={handleOptimize}
          disabled={!value.trim() || optimizing}
          title="使用 AI 优化提示词"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {optimizing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              优化中...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              AI 优化
            </>
          )}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
      />
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
