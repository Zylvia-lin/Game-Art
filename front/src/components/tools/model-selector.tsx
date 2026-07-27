'use client';

import { useEffect, useState } from 'react';
import { modelsApi } from '@/lib/api';
import type { ModelConfig } from '@/lib/api';

interface ModelSelectorProps {
  type: 'image' | 'text' | 'tool';
  value: string | null;
  onChange: (modelId: string, model: ModelConfig) => void;
  label?: string;
}

export function ModelSelector({ type, value, onChange, label = '生成模型' }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    modelsApi.list(type)
      .then((data) => {
        setModels(data);
        // Auto-select the default model on first load
        if (!value && data.length > 0) {
          const defaultModel = data.find((m) => m.is_default) || data[0];
          onChange(defaultModel.id, defaultModel);
        }
      })
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatPrice = (model: ModelConfig) => {
    if (!model.output_price) return '';
    if (model.price_unit === 'per_image') {
      return `¥${model.output_price}/张`;
    }
    if (model.price_unit === 'per_1M_tokens') {
      return `¥${model.output_price}/百万token`;
    }
    if (model.price_unit === 'per_1k_calls') {
      return `¥${model.output_price}/千次`;
    }
    return '';
  };

  if (loading) {
    return (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
        <div className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-muted-foreground">
          加载中...
        </div>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
        <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          暂无可用模型，请先在系统配置中添加
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => {
          const selected = models.find((m) => m.id === e.target.value);
          if (selected) {
            onChange(selected.id, selected);
          }
        }}
        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
      >
        {models.map((m) => {
          const price = formatPrice(m);
          return (
            <option key={m.id} value={m.id}>
              {m.name} {m.is_default ? '(默认)' : ''} {price ? `— ${price}` : ''}
            </option>
          );
        })}
      </select>
    </div>
  );
}
