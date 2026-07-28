'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Star, Loader2, Settings, Key, Server, ArrowLeft, Eraser, Cloud, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { modelsApi, providerApi, storageApi } from '@/lib/api';
import type { ModelConfig, ModelConfigCreate } from '@/lib/types';
import type { StorageConfig } from '@/lib/api';

// 提供商配置：根据模型类型提供不同的提供商和默认API地址
const PROVIDER_CONFIG = {
  text: {
    deepseek: { name: 'DeepSeek', apiUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
    openai: { name: 'OpenAI', apiUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
    custom: { name: '自定义', apiUrl: '', defaultModel: '' },
  },
  image: {
    volcengine: { name: '火山引擎', apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/images/generations', defaultModel: 'seeddream-5.0-pro' },
    fal: { name: 'fal.ai', apiUrl: 'https://fal.run', defaultModel: 'fal-ai/flux-pro' },
    custom: { name: '自定义', apiUrl: '', defaultModel: '' },
  },
  video: {
    volcengine: { name: '火山引擎', apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks', defaultModel: 'doubao-seedance-2-0' },
    custom: { name: '自定义', apiUrl: '', defaultModel: '' },
  },
  tool: {
    volcengine: { name: '火山引擎', apiUrl: 'https://mediakit.cn-beijing.volces.com', defaultModel: '' },
    custom: { name: '自定义', apiUrl: '', defaultModel: '' },
  },
} as const;

type ModelType = keyof typeof PROVIDER_CONFIG;

const VIDEO_MODEL_OPTIONS = [
  { value: 'doubao-seedance-2-0', label: 'Seedance 2.0', textImagePrice: 46, videoReferencePrice: 28, estimates: '480p ¥2.31 · 720p ¥4.97 · 1080p ¥11.18', priceConfig: { '480p': { video_reference: 28, text_image: 46 }, '720p': { video_reference: 28, text_image: 46 }, '1080p': { video_reference: 31, text_image: 51 }, '4k': { video_reference: 16, text_image: 26 } } },
  { value: 'doubao-seedance-2-0-mini', label: 'Seedance 2.0 Mini', textImagePrice: 23, videoReferencePrice: 14, estimates: '480p 约¥1.16 · 720p 约¥2.50', priceConfig: { '480p': { video_reference: 14, text_image: 23 }, '720p': { video_reference: 14, text_image: 23 } } },
  { value: 'doubao-seedance-2-0-fast', label: 'Seedance 2.0 Fast', textImagePrice: 37, videoReferencePrice: 22, estimates: '480p ¥1.86 · 720p ¥4.00', priceConfig: { '480p': { video_reference: 22, text_image: 37 }, '720p': { video_reference: 22, text_image: 37 } } },
] as const;

type VideoPriceConfig = Record<string, { video_reference: number; text_image: number }>;

function normalizeVideoPriceConfig(value: unknown): VideoPriceConfig {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<VideoPriceConfig>((result, [resolution, price]) => {
    if (price && typeof price === 'object' && !Array.isArray(price)) {
      const entry = price as Record<string, unknown>;
      result[resolution] = {
        video_reference: Number(entry.video_reference) || 0,
        text_image: Number(entry.text_image) || 0,
      };
    }
    return result;
  }, {});
}

export default function ModelsSettingsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    type: ModelType;
    name: string;
    provider: string;
    api_base_url: string;
    api_key: string;
    model_name: string;
    is_default: boolean;
    input_price: number;
    output_price: number;
    output_price_high: number;
    pixel_threshold: number;
    price_unit: string;
    price_config: Record<string, { video_reference: number; text_image: number }>;
  }>({
    type: 'text',
    name: '',
    provider: 'deepseek',
    api_base_url: 'https://api.deepseek.com/v1',
    api_key: '',
    model_name: 'deepseek-chat',
    is_default: false,
    input_price: 0,
    output_price: 0,
    output_price_high: 0,
    pixel_threshold: 2360000,
    price_unit: 'per_image',
    price_config: {},
  });
  const [saving, setSaving] = useState(false);
  const [volcengineApiKey, setVolcengineApiKey] = useState('');
  const [volcengineConfigured, setVolcengineConfigured] = useState(false);
  const [providerSaving, setProviderSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'provider' | 'models' | 'storage-tools'>('provider');

  // Storage config state
  const [storageCfg, setStorageCfg] = useState<StorageConfig | null>(null);
  const [storageForm, setStorageForm] = useState({
    access_key: '',
    secret_key: '',
    bucket: '',
    endpoint: '',
    region: 'cn-beijing',
  });
  const [storageSaving, setStorageSaving] = useState(false);

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

  const fetchVolcengineProvider = async () => {
    try {
      const data = await providerApi.get('volcengine');
      setVolcengineConfigured(data.configured);
    } catch {
      setVolcengineConfigured(false);
    }
  };

  const fetchStorageConfig = async () => {
    try {
      const data = await storageApi.getConfig();
      setStorageCfg(data);
      setStorageForm({
        access_key: '',
        secret_key: '',
        bucket: data.bucket || '',
        endpoint: data.endpoint || '',
        region: data.region || 'cn-beijing',
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchVolcengineProvider();
    fetchStorageConfig();
  }, []);

  const resetForm = () => {
    setForm({ type: 'text', name: '', provider: 'deepseek', api_base_url: 'https://api.deepseek.com/v1', api_key: '', model_name: 'deepseek-chat', is_default: false, input_price: 0, output_price: 0, output_price_high: 0, pixel_threshold: 2360000, price_unit: 'per_image', price_config: {} });
    setEditingId(null);
    setShowForm(false);
  };

  // 切换模型类型时，重置提供商和API地址，设置定价单位
  const handleTypeChange = (type: ModelType) => {
    const providers = PROVIDER_CONFIG[type];
    const firstProvider = Object.keys(providers)[0] as string;
    const config = providers[firstProvider as keyof typeof providers];
    const priceUnit = type === 'image' ? 'per_image' : type === 'video' || type === 'text' ? 'per_1M_tokens' : 'per_1k_calls';
    const defaultVideo = VIDEO_MODEL_OPTIONS[0];
    setForm({
      ...form,
      type,
      provider: firstProvider,
      api_base_url: config.apiUrl,
      model_name: config.defaultModel,
      input_price: type === 'video' ? defaultVideo.videoReferencePrice : form.input_price,
      output_price: type === 'video' ? defaultVideo.textImagePrice : form.output_price,
      price_config: type === 'video' ? defaultVideo.priceConfig : form.price_config,
      price_unit: priceUnit,
    });
  };

  // 切换提供商时，自动填充API地址和默认模型
  const handleVideoModelChange = (modelName: string) => {
    const option = VIDEO_MODEL_OPTIONS.find((item) => item.value === modelName);
    if (!option) return;
    setForm({
      ...form,
      model_name: option.value,
      input_price: option.videoReferencePrice,
      price_config: option.priceConfig,
      output_price: option.textImagePrice,
      price_unit: 'per_1M_tokens',
    });
  };

  const handleVideoPriceChange = (resolution: string, field: 'video_reference' | 'text_image', value: string) => {
    setForm({
      ...form,
      price_config: {
        ...form.price_config,
        [resolution]: {
          ...form.price_config[resolution],
          [field]: Number(value) || 0,
        },
      },
    });
  };

  const handleProviderChange = (provider: string) => {
    const type = form.type as ModelType;
    const config = PROVIDER_CONFIG[type][provider as keyof typeof PROVIDER_CONFIG[typeof type]];
    if (config) {
      setForm({
        ...form,
        provider,
        api_base_url: config.apiUrl,
        model_name: config.defaultModel,
      });
    } else {
      setForm({ ...form, provider });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        type: form.type as 'text' | 'image' | 'video' | 'tool',
        name: form.name,
        provider: form.provider,
        api_base_url: form.api_base_url,
        api_key: form.api_key,
        model_name: form.model_name,
        is_default: form.is_default,
        input_price: form.input_price,
        output_price: form.output_price,
        output_price_high: form.output_price_high,
        pixel_threshold: form.pixel_threshold,
        price_unit: form.price_unit,
        price_config: form.price_config,
      };
      if (editingId) {
        const updateData: Record<string, unknown> = { ...data };
        if (!form.api_key) {
          delete updateData.api_key;
        }
        await modelsApi.update(editingId, updateData as Partial<ModelConfig>);
      } else {
        await modelsApi.create(data as ModelConfigCreate);
      }
      resetForm();
      fetchConfigs();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此模型配置？')) return;
    try {
      await modelsApi.delete(id);
      fetchConfigs();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await modelsApi.setDefault(id);
      fetchConfigs();
    } catch (err) {
      console.error('Set default failed:', err);
    }
  };

  const handleEdit = (config: ModelConfig) => {
    setForm({
      type: config.type as ModelType,
      name: config.name,
      provider: config.provider,
      api_base_url: config.api_base_url,
      api_key: '',
      model_name: config.model_name,
      is_default: config.is_default,
      input_price: config.input_price || 0,
      output_price: config.output_price || 0,
      output_price_high: config.output_price_high || 0,
      pixel_threshold: config.pixel_threshold || 2360000,
      price_unit: config.price_unit || 'per_image',
      price_config: normalizeVideoPriceConfig(config.price_config),
    });
    setEditingId(config.id);
    setShowForm(true);
  };

  const handleVolcengineProviderSave = async () => {
    if (!volcengineApiKey) return;
    setProviderSaving(true);
    try {
      await providerApi.update('volcengine', volcengineApiKey);
      setVolcengineApiKey('');
      setVolcengineConfigured(true);
    } catch (err) {
      console.error('Provider API key save failed:', err);
    } finally {
      setProviderSaving(false);
    }
  };

  const handleStorageSave = async () => {
    setStorageSaving(true);
    try {
      await storageApi.updateConfig({
        provider: 'volcengine',
        ...storageForm,
      });
      fetchStorageConfig();
    } catch (err) {
      console.error('Storage config save failed:', err);
    } finally {
      setStorageSaving(false);
    }
  };

  const textConfigs = configs.filter((c) => c.type === 'text');
  const imageConfigs = configs.filter((c) => c.type === 'image');
  const videoConfigs = configs.filter((c) => c.type === 'video');
  const toolConfigs = configs.filter((c) => c.type === 'tool');
  const selectedVideoOption = VIDEO_MODEL_OPTIONS.find((item) => item.value === form.model_name);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">系统配置</h1>
            <p className="mt-1 text-sm text-muted-foreground">配置 AI 模型、工具模型和对象存储</p>
          </div>
        </div>
        {activeTab === 'models' && (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          添加模型
        </button>
        )}
      </div>

      <div className="mb-6 flex border-b border-border" role="tablist" aria-label="系统配置分类">
        {[
          { id: 'provider', label: '服务提供商', icon: Key },
          { id: 'models', label: '模型配置', icon: Server },
          { id: 'storage-tools', label: '存储与工具', icon: Cloud },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id as 'provider' | 'models' | 'storage-tools')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
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
                  {(['text', 'image', 'video', 'tool'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleTypeChange(t)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                        form.type === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {t === 'text' ? '文本模型' : t === 'image' ? '图片模型' : t === 'video' ? '视频模型' : '工具'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">显示名称</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={form.type === 'text' ? '如：DeepSeek-V3' : form.type === 'video' ? '如：Seedance 2.0' : '如：SeedDream 5.0'}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">提供商</label>
                <select
                  value={form.provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                >
                  {Object.entries(PROVIDER_CONFIG[form.type as ModelType]).map(([key, config]) => (
                    <option key={key} value={key}>{config.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">API 地址</label>
                <input
                  value={form.api_base_url}
                  onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
                  placeholder={form.type === 'text' ? 'https://api.deepseek.com/v1' : form.type === 'video' ? 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks' : 'https://ark.cn-beijing.volces.com/api/v3/images/generations'}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
                <p className="mt-1 text-xs text-muted-foreground">切换提供商时会自动填充默认地址，选择"自定义"可手动输入</p>
              </div>
              {(form.provider !== 'volcengine' || form.type === 'tool') && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">API Key</label>
                <input
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  placeholder={editingId ? '留空则保持原密钥不变' : 'sk-...'}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
                {editingId && (
                  <p className="mt-1 text-xs text-muted-foreground">编辑模式下留空表示不修改已有密钥</p>
                )}
                </div>
              )}
              {form.type === 'video' ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">模型名称</label>
                  <select value={form.model_name} onChange={(e) => handleVideoModelChange(e.target.value)} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                    {VIDEO_MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}（{option.value}）</option>)}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">保存时会使用对应的火山方舟 API 模型；单价会自动填充。</p>
                </div>
              ) : form.type !== 'tool' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">模型名称</label>
                  <input value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })} placeholder={form.type === 'text' ? 'deepseek-chat' : 'seeddream-5.0-pro'} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
                  <p className="mt-1 text-xs text-muted-foreground">切换提供商时会自动填充默认模型名</p>
                </div>
              )}
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

              {/* 定价配置 */}
              <div className="border-t border-border pt-4">
                <label className="mb-2 block text-sm font-medium text-foreground">定价配置</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      {form.type === 'image' ? '输入图单价 (元/张)' : form.type === 'video' ? '含视频参考单价 (元/1M tokens)' : form.type === 'text' ? '输入单价 (元/1M tokens)' : '输入单价'}
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={form.input_price}
                      onChange={(e) => setForm({ ...form, input_price: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      {form.type === 'image' ? '低分辨率输出单价 (元/张)' : form.type === 'video' ? '文生/图生单价 (元/1M tokens)' : form.type === 'text' ? '输出单价 (元/1M tokens)' : '处理单价 (元/千次)'}
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={form.output_price}
                      onChange={(e) => setForm({ ...form, output_price: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                </div>
                {form.type === 'video' && selectedVideoOption && (
                  <div className="mt-3 rounded-lg border border-border p-3 text-xs">
                    <p className="mb-2 text-muted-foreground">分辨率 Token 单价（元/百万 Token）；16:9、5 秒、无参考视频估算：<span className="font-medium text-primary">{selectedVideoOption.estimates}</span></p>
                    <div className="grid grid-cols-3 gap-2 text-muted-foreground"><span>分辨率</span><span>含视频参考</span><span>文生/图生</span></div>
                    {Object.entries(form.price_config).map(([resolution, price]) => (
                      <div key={resolution} className="mt-2 grid grid-cols-3 items-center gap-2">
                        <span>{resolution}</span>
                        <input type="number" min="0" step="0.01" value={price.video_reference} onChange={(e) => handleVideoPriceChange(resolution, 'video_reference', e.target.value)} className="w-full rounded border border-border bg-input px-2 py-1 text-xs text-foreground" aria-label={`${resolution} 含视频参考单价`} />
                        <input type="number" min="0" step="0.01" value={price.text_image} onChange={(e) => handleVideoPriceChange(resolution, 'text_image', e.target.value)} className="w-full rounded border border-border bg-input px-2 py-1 text-xs text-foreground" aria-label={`${resolution} 文生图生单价`} />
                      </div>
                    ))}
                  </div>
                )}
                {form.type === 'image' && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">高分辨率输出单价 (元/张)</label>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={form.output_price_high}
                        onChange={(e) => setForm({ ...form, output_price_high: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">像素阈值 (万)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={Math.round(form.pixel_threshold / 10000)}
                        onChange={(e) => setForm({ ...form, pixel_threshold: (parseInt(e.target.value) || 0) * 10000 })}
                        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      />
                    </div>
                  </div>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  计价单位：
                  <span className="text-primary font-medium ml-1">
                    {form.price_unit === 'per_image' ? '元/张' : form.price_unit === 'per_1M_tokens' ? '元/百万token' : '元/千次'}
                  </span>
                  {form.type === 'image' && form.output_price_high > 0 && (
                    <span className="ml-1">
                      · 超过 {Math.round(form.pixel_threshold / 10000)} 万像素自动使用高分辨率单价
                    </span>
                  )}
                  <span className="ml-1">（根据模型类型自动设定）</span>
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={resetForm} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.api_base_url || (!editingId && !form.api_key && (form.provider !== 'volcengine' || form.type === 'tool')) || (form.type !== 'tool' && !form.model_name)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'models' && (
        <div className="space-y-8">
      {/* Text models */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Key className="h-5 w-5 text-primary" />
          文本模型
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : textConfigs.length === 0 ? (
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
                    {(config.input_price > 0 || config.output_price > 0) && (
                      <p className="text-xs text-primary/70">
                        入 ¥{config.input_price} / 出 ¥{config.output_price} / 百万token
                      </p>
                    )}
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
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Settings className="h-5 w-5 text-primary" />
          图片模型
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : imageConfigs.length === 0 ? (
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
                    {(config.input_price > 0 || config.output_price > 0) && (
                      <p className="text-xs text-primary/70">
                        入 ¥{config.input_price} / 出 ¥{config.output_price}
                        {config.output_price_high > 0 ? ` / 高 ¥${config.output_price_high}` : ''} / 张
                      </p>
                    )}
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

      {/* Video models */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Settings className="h-5 w-5 text-primary" />
          视频模型
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : videoConfigs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">暂未配置视频模型，点击上方「添加模型」开始配置</div>
        ) : (
          <div className="space-y-3">
            {videoConfigs.map((config) => (
              <div key={config.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Settings className="h-5 w-5 text-primary" /></div>
                  <div>
                    <div className="flex items-center gap-2"><span className="font-medium text-foreground">{config.name}</span>{config.is_default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">默认</span>}</div>
                    <p className="text-xs text-muted-foreground">{config.provider} / {config.model_name}</p>
                    {config.output_price > 0 && <p className="text-xs text-primary/70">¥{config.output_price} / 百万 Token</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!config.is_default && <button onClick={() => handleSetDefault(config.id)} className="rounded-lg p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="设为默认"><Star className="h-4 w-4" /></button>}
                  <button onClick={() => handleEdit(config)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all">编辑</button>
                  <button onClick={() => handleDelete(config.id)} className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      )}

      {activeTab === 'storage-tools' && (
        <div>
      {/* Tool models */}
      {toolConfigs.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Eraser className="h-5 w-5 text-primary" />
            工具模型
          </h2>
          <div className="space-y-3">
            {toolConfigs.map((config) => (
              <div key={config.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Eraser className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{config.name}</span>
                      {config.is_default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">默认</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{config.provider} / {config.model_name || '无模型名'}</p>
                    {config.output_price > 0 && (
                      <p className="text-xs text-primary/70">¥{config.output_price} / 千次</p>
                    )}
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
        </div>
      )}

        </div>
      )}

      {activeTab === 'provider' && (
        <div>
      {/* Provider credentials */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Key className="h-5 w-5 text-primary" />
          服务提供商配置
        </h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-lg bg-primary/10 px-3 py-1 text-sm font-medium text-primary">火山引擎</span>
            {volcengineConfigured && <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-500">已配置</span>}
          </div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Ark API Key</label>
          <div className="flex gap-3">
            <input type="password" value={volcengineApiKey} onChange={(e) => setVolcengineApiKey(e.target.value)} placeholder={volcengineConfigured ? '输入新 Key 以替换当前配置' : '输入火山方舟 API Key'} className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <button onClick={handleVolcengineProviderSave} disabled={providerSaving || !volcengineApiKey} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {providerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Seedream 与 Seedance 模型会共用此 Ark Key；MediaKit 等工具模型需在模型配置中单独填写工具 API Key。</p>
        </div>
      </div>
        </div>
      )}

      {activeTab === 'storage-tools' && (
        <div>
      {/* Storage config */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Cloud className="h-5 w-5 text-primary" />
          对象存储配置
        </h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-lg bg-primary/10 px-3 py-1 text-sm font-medium text-primary">火山引擎 TOS</span>
            {storageCfg?.configured && (
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-500">已配置</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Access Key</label>
              <input
                type="password"
                value={storageForm.access_key}
                onChange={(e) => setStorageForm({ ...storageForm, access_key: e.target.value })}
                placeholder={storageCfg?.access_key ? storageCfg.access_key : 'AKLT****'}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Secret Key</label>
              <input
                type="password"
                value={storageForm.secret_key}
                onChange={(e) => setStorageForm({ ...storageForm, secret_key: e.target.value })}
                placeholder={storageCfg?.secret_key ? storageCfg.secret_key : '****'}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Bucket 名称</label>
              <input
                value={storageForm.bucket}
                onChange={(e) => setStorageForm({ ...storageForm, bucket: e.target.value })}
                placeholder="gameart-images"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Endpoint</label>
              <input
                value={storageForm.endpoint}
                onChange={(e) => setStorageForm({ ...storageForm, endpoint: e.target.value })}
                placeholder="tos-cn-beijing.volces.com"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Region</label>
              <input
                value={storageForm.region}
                onChange={(e) => setStorageForm({ ...storageForm, region: e.target.value })}
                placeholder="cn-beijing"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            用于去除背景等功能将图片上传到 TOS，火山引擎 MediaKit 通过 tos:// 协议读取。Access Key 和 Secret Key 留空则保持原配置不变。
          </p>
          <div className="mt-4">
            <button
              onClick={handleStorageSave}
              disabled={storageSaving || (!storageForm.access_key && !storageCfg?.configured) || !storageForm.bucket || !storageForm.endpoint}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {storageSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存存储配置
            </button>
          </div>
        </div>
      </div>
        </div>
      )}
    </div>
  );
}
