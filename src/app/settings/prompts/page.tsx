'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, FileText, Check } from 'lucide-react';
import { promptsApi } from '@/lib/api';
import type { SystemPrompt } from '@/lib/types';

export default function PromptsSettingsPage() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchPrompts = async () => {
    try {
      const data = await promptsApi.list();
      setPrompts(data);
      if (data.length > 0 && !selectedKey) {
        setSelectedKey(data[0].tool_key);
        setEditContent(data[0].prompt_content);
      }
    } catch {
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPrompts(); }, []);

  const handleSelect = (key: string) => {
    const p = prompts.find((p) => p.tool_key === key);
    if (p) {
      setSelectedKey(key);
      setEditContent(p.prompt_content);
      setSaved(false);
    }
  };

  const handleSave = async () => {
    if (!selectedKey) return;
    setSaving(true);
    try {
      await promptsApi.update(selectedKey, { prompt_content: editContent });
      setPrompts(prompts.map((p) => p.tool_key === selectedKey ? { ...p, prompt_content: editContent } : p));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const selectedPrompt = prompts.find((p) => p.tool_key === selectedKey);

  // Group prompts by category
  const groups = [
    { label: '基础生成', keys: ['text_to_image', 'image_to_image', 'inpaint'] },
    { label: '角色', keys: ['character_tpose', 'character_directions', 'character_part_split'] },
    { label: '动画', keys: ['animation_text', 'animation_skeleton', 'animation_frame_extract'] },
    { label: '道具', keys: ['prop_generate', 'prop_variant'] },
    { label: 'UI', keys: ['ui_layout_generate', 'ui_component_place', 'ui_component_split'] },
    { label: '场景', keys: ['scene_map_generate', 'scene_map_split'] },
  ];

  return (
    <div className="flex h-full">
      {/* Prompt list */}
      <div className="w-[260px] shrink-0 border-r border-border overflow-y-auto">
        <div className="p-4">
          <h2 className="mb-1 text-lg font-semibold text-foreground">系统提示词</h2>
          <p className="mb-4 text-xs text-muted-foreground">每个功能的提示词独立管理，修改后实时生效</p>
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h3>
              <div className="space-y-0.5">
                {group.keys.map((key) => {
                  const p = prompts.find((p) => p.tool_key === key);
                  if (!p) return null;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(key)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                        selectedKey === key
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      {p.tool_name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedPrompt ? (
          <>
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selectedPrompt.tool_name}</h2>
                <p className="text-xs text-muted-foreground">
                  tool_key: <code className="rounded bg-accent px-1.5 py-0.5 text-primary">{selectedPrompt.tool_key}</code>
                </p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saving ? '保存中...' : saved ? '已保存' : '保存修改'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <textarea
                value={editContent}
                onChange={(e) => { setEditContent(e.target.value); setSaved(false); }}
                className="h-full min-h-[400px] w-full resize-none rounded-xl border border-border bg-input p-4 font-mono text-sm text-foreground leading-relaxed placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                placeholder="输入系统提示词内容..."
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">选择左侧功能查看和编辑提示词</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
