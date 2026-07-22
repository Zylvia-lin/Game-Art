'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Star, Loader2, Settings, Key, Server } from 'lucide-react';
import { modelsApi } from '@/lib/api';
import type { ModelConfig, ModelConfigCreate } from '@/lib/types';

export default function ModelsSettingsPage() {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ModelConfigCreate>({
    type: 'text',
    name: '',
    provider: 'deepseek',
    api_base_url: '',
    api_key: '',
    model_name: '',
    is_default: false,
  });
  const [saving, setSaving] = useState(false);

  const fetchConfigs = async () => {
    try {
      const data = await modelsApi.list();
      setConfigs(data);
    } catch {
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const resetForm = () => {
    setForm({ type: 'text', name: '', provider: 'deepseek', api_base_url: '', api_key: '', model_name: '', is_default: false });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await modelsApi.update(editingId, form);
      } else {
        await modelsApi.create(form);
      }
      resetForm();
      fetchConfigs();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此模型配置？')) return;
    try {
      await modelsApi.delete(id);
      fetchConfigs();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await modelsApi.setDefault(id);
      fetchConfigs();
    } catch (err) {
      console.error('Set default failed:', err);
    }
  };

  const handleEdit = (config: ModelConfig) => {
    setForm({
      type: config.type,
      name: config.name,
      provider: config.provider,
      api_base_url: config.api_base_url,
      api_key: '',
      model_name: config.model_name,
      is_default: config.is_default,
    });
    setEditingId(config.id);
    setShowForm(true);
  };

  const textConfigs = configs.filter((c) => c.type === 'text');
  const imageConfigs = configs.filter((c) => c.type === 'image');

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">模型配置</h1>
          <p className="mt-1 text-sm text-muted-foreground">配置 AI 文本模型和图片模型的 API 信息</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          添加模型
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold text-foreground">{editingId ? '编辑模型' : '添加模型'}</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">模型类型</label>
                <div className="flex gap-2">
                  {(['text', 'image'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                        form.type === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {t === 'text' ? '文本模型' : '图片模型'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">显示名称</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：DeepSeek-V3"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">提供商</label>
                <select
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                >
                  <option value="deepseek">DeepSeek</option>
                  <option value="openai">OpenAI</option>
                  <option value="volcengine">火山引擎</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">API 地址</label>
                <input
                  value={form.api_base_url}
                  onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">API Key</label>
                <input
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">模型名称</label>
                <input
                  value={form.model_name}
                  onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                  placeholder="deepseek-chat"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <label htmlFor="is_default" className="text-sm text-foreground">设为默认模型</label>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={resetForm} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.api_base_url || !form.api_key || !form.model_name}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text models */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Key className="h-5 w-5 text-primary" />
          文本模型
        </h2>
        {textConfigs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            暂未配置文本模型，点击上方「添加模型」开始配置
          </div>
        ) : (
          <div className="space-y-3">
            {textConfigs.map((config) => (
              <div key={config.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{config.name}</span>
                      {config.is_default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">默认</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{config.provider} / {config.model_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!config.is_default && (
                    <button onClick={() => handleSetDefault(config.id)} className="rounded-lg p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="设为默认">
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => handleEdit(config)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                    编辑
                  </button>
                  <button onClick={() => handleDelete(config.id)} className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image models */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Settings className="h-5 w-5 text-primary" />
          图片模型
        </h2>
        {imageConfigs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            暂未配置图片模型，点击上方「添加模型」开始配置
          </div>
        ) : (
          <div className="space-y-3">
            {imageConfigs.map((config) => (
              <div key={config.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{config.name}</span>
                      {config.is_default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">默认</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{config.provider} / {config.model_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!config.is_default && (
                    <button onClick={() => handleSetDefault(config.id)} className="rounded-lg p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="设为默认">
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => handleEdit(config)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                    编辑
                  </button>
                  <button onClick={() => handleDelete(config.id)} className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
