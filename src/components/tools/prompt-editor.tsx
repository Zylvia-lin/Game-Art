'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Save, Check } from 'lucide-react';
import { promptsApi } from '@/lib/api';

interface PromptEditorProps {
  toolKey: string;
  toolName: string;
}

export function PromptEditor({ toolKey, toolName }: PromptEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadPrompt = async () => {
    if (loaded) return;
    try {
      const data = await promptsApi.get(toolKey);
      setPrompt(data.prompt_content);
      setLoaded(true);
    } catch {
      setPrompt('// 提示词加载失败，请检查后端服务是否启动');
      setLoaded(true);
    }
  };

  const handleExpand = () => {
    if (!expanded) loadPrompt();
    setExpanded(!expanded);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await promptsApi.update(toolKey, { prompt_content: prompt });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save prompt:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card/50">
      <button
        onClick={handleExpand}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          系统提示词 - {toolName}
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="border-t border-border p-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-y"
            placeholder="输入系统提示词..."
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-all"
            >
              {saved ? (
                <>
                  <Check className="h-3 w-3" />
                  已保存
                </>
              ) : (
                <>
                  <Save className="h-3 w-3" />
                  {saving ? '保存中...' : '保存修改'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
