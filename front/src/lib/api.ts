export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================
// Types
// ============================================

export interface Project {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  style: string;
  created_at: string;
  updated_at: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  type: 'text' | 'image' | 'video' | 'tool';
  provider: string;
  api_base_url: string;
  api_key: string;
  model_name: string;
  is_default: boolean;
  input_price: number;
  output_price: number;
  output_price_high: number;
  pixel_threshold: number;
  price_unit: 'per_image' | 'per_1M_tokens' | 'per_1k_calls';
  created_at: string;
  updated_at: string;
}

export interface SystemPrompt {
  id: string;
  tool_key: string;
  tool_name: string;
  description: string | null;
  prompt_content: string;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  project_id: string;
  generation_id: string | null;
  name: string;
  description: string;
  type: string;
  url: string;
  finalized: boolean;
  metadata_: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
}

export interface Generation {
  id: string;
  project_id: string;
  tool_key: string;
  input_params: Record<string, unknown> | null;
  output_urls: string[];
  output_names?: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  tool_key: string;
  input_params: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  output_urls: string[];
  output_names?: string[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ============================================
// Helper
// ============================================

function isValidId(id: unknown): boolean {
  if (typeof id === 'string') return id.length > 0;
  if (typeof id === 'number') return Number.isFinite(id);
  return false;
}

function toIdString(id: unknown): string {
  return String(id);
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      const detail = body.detail || body.error;
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail.map((e: { msg?: string; message?: string }) => e.msg || e.message || JSON.stringify(e)).join('; ');
      } else if (detail && typeof detail === 'object') {
        message = detail.message || detail.msg || JSON.stringify(detail);
      } else if (detail) {
        message = String(detail);
      }
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

// ============================================
// Projects API
// ============================================

export const projectsApi = {
  list: () => request<Project[]>('/api/projects'),

  get: (id: string) => {
    if (!isValidId(id)) throw new Error('Invalid project ID');
    return request<Project>(`/api/projects/${id}`);
  },

  create: (data: { name: string; style?: string; description?: string }) =>
    request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; style?: string; description?: string }) => {
    if (!isValidId(id)) throw new Error('Invalid project ID');
    return request<Project>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id: string) => {
    if (!isValidId(id)) throw new Error('Invalid project ID');
    return request<void>(`/api/projects/${id}`, { method: 'DELETE' });
  },

  assets: (projectId: string, assetType?: string) => {
    if (!isValidId(projectId)) throw new Error('Invalid project ID');
    const query = assetType ? `?asset_type=${encodeURIComponent(assetType)}` : '';
    return request<Asset[]>(`/api/projects/${projectId}/assets${query}`);
  },

  generations: (projectId: string) => {
    if (!isValidId(projectId)) throw new Error('Invalid project ID');
    return request<Generation[]>(`/api/projects/${projectId}/generations`);
  },
};

// ============================================
// Storage API
// ============================================

export interface StorageConfig {
  provider: string;
  access_key: string;
  secret_key: string;
  bucket: string;
  endpoint: string;
  region: string;
  is_active: boolean;
  configured: boolean;
}

export const storageApi = {
  getConfig: () => request<StorageConfig>(`/api/storage/config`),

  updateConfig: (data: Omit<StorageConfig, 'is_active' | 'configured'>) =>
    request(`/api/storage/config`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ============================================
// Models API
// ============================================

export const modelsApi = {
  list: (type?: string) =>
    request<ModelConfig[]>(`/api/models${type ? `?type=${type}` : ''}`),

  get: (id: string) => {
    if (!isValidId(id)) throw new Error('Invalid model ID');
    return request<ModelConfig>(`/api/models/${id}`);
  },

  create: (data: {
    type: string;
    name: string;
    provider: string;
    api_base_url: string;
    api_key: string;
    model_name: string;
    is_default?: boolean;
    input_price?: number;
    output_price?: number;
    output_price_high?: number;
    pixel_threshold?: number;
    price_unit?: string;
  }) =>
    request<ModelConfig>('/api/models', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<ModelConfig>) => {
    if (!isValidId(id)) throw new Error('Invalid model ID');
    return request<ModelConfig>(`/api/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id: string) => {
    if (!isValidId(id)) throw new Error('Invalid model ID');
    return request<void>(`/api/models/${id}`, { method: 'DELETE' });
  },

  setDefault: (id: string) => {
    if (!isValidId(id)) throw new Error('Invalid model ID');
    return request<ModelConfig>(`/api/models/${id}/default`, { method: 'PUT' });
  },
};

// ============================================
// Prompts API
// ============================================

export const promptsApi = {
  list: () => request<SystemPrompt[]>('/api/prompts'),

  get: (toolKey: string) =>
    request<SystemPrompt>(`/api/prompts/${toolKey}`),

  update: (toolKey: string, data: { prompt_content: string; description?: string }) =>
    request<SystemPrompt>(`/api/prompts/${toolKey}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ============================================
// Assets API
// ============================================

export const assetsApi = {
  create: (data: { project_id: string; name: string; type: string; url: string; description?: string; metadata?: Record<string, unknown> }) =>
    request<Asset>('/api/assets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string | number, data: { name?: string; type?: string; finalized?: boolean }) => {
    const idStr = toIdString(id);
    return request<Asset>(`/api/assets/${idStr}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: (id: string | number) => {
    const idStr = toIdString(id);
    if (!isValidId(idStr)) throw new Error('Invalid asset ID');
    return request<void>(`/api/assets/${idStr}`, { method: 'DELETE' });
  },

  checkBatch: (projectId: string, urls: string[]) =>
    request<Record<string, { exists: boolean; type?: string; asset_id?: string }>>('/api/assets/check-batch', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, urls }),
    }),
};

// ============================================
// Generate API
// ============================================

export const generateApi = {
  submit: (toolKey: string, data: Record<string, unknown>) =>
    request<{ status: string; task_id: string; message: string }>(`/api/generate/${toolKey}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  textToImage: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('text_to_image', data),
  imageToImage: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('image_to_image', data),
  inpaint: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('inpaint', data),
  characterTpose: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('character_tpose', data),
  characterDirections: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('character_directions', data),
  characterThreeView: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('character_three_view', data),
  characterPartSplit: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('character_part_split', data),
  animationText: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('animation_text', data),
  propGenerate: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('prop_generate', data),
  propVariant: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('prop_variant', data),
  uiLayoutGenerate: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('ui_layout_generate', data),
  sceneMapGenerate: (data: Record<string, unknown> & { project_id: string }) =>
    generateApi.submit('scene_map_generate', data),

  createCompletedTask: (data: { project_id: string; tool_key: string; output_url: string; output_name?: string }) =>
    request<{ status: string; task_id: string }>('/api/generate/task/completed', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // File upload
  upload: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  // Task management
  getTask: (taskId: string) =>
    request<Task>(`/api/generate/task?task_id=${taskId}`),
  getProjectTasks: (projectId: string, status?: string) => {
    if (!isValidId(projectId)) return Promise.resolve([]);
    return request<Task[]>(`/api/generate/task?project_id=${projectId}${status ? `&status=${status}` : ''}`);
  },
  getTasks: (projectId: string, toolKey?: string) => {
    if (!isValidId(projectId)) return Promise.resolve([]);
    return request<Task[]>(`/api/generate/task?project_id=${projectId}${toolKey ? `&tool_key=${toolKey}` : ''}`);
  },
  getQueueStats: (projectId?: string) =>
    request<{ pending: number; processing: number; completed: number; failed: number }>(
      `/api/generate/task?stats=true${projectId ? `&project_id=${projectId}` : ''}`
    ),
  cancelTask: (taskId: string) =>
    request<Task>(`/api/generate/task/${taskId}/cancel`, { method: 'POST' }),
  deleteTasks: (projectId: string, status?: string) =>
    request<{ deleted: number }>(`/api/generate/task?project_id=${projectId}${status ? `&status=${status}` : ''}`, { method: 'DELETE' }),
  deleteTask: (taskId: string) =>
    request<{ success: boolean }>(`/api/generate/task/${taskId}`, { method: 'DELETE' }),

  // On-demand prompt optimization (LLM)
  optimizePrompt: (prompt: string, toolKey?: string) =>
    request<{ optimized_prompt: string }>('/api/generate/optimize-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, tool_key: toolKey }),
    }),

  // Rename a generated image
  renameOutput: (taskId: string, index: number, name: string) =>
    request<{ success: boolean }>(`/api/generate/task/${taskId}/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index, name }),
    }),

  deleteOutput: (taskId: string, index: number) =>
    request<{ success: boolean; remaining: number }>(`/api/generate/task/${taskId}/output/${index}`, {
      method: 'DELETE',
    }),
};

// ============================================
// Tools API (local tools, no AI)
// ============================================

export const toolsApi = {
  extractFrames: (data: { image_url: string; rows: number; cols: number }) =>
    request<{ frames: string[] }>('/api/tools/extract-frames', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  removeBackgroundAI: (data: { image_url: string; scene?: string }) =>
    request<{ url: string; width: number; height: number }>('/api/tools/ai-remove-bg', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  removeBgMask: (data: { image_url: string; mask_url: string; bg_color?: string }) =>
    request<{ url: string }>('/api/tools/remove-bg-mask', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============================================
// Image URL resolver
// ============================================

export function resolveImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('data:')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ============================================
// Download helper (uses backend proxy for forced download)
// ============================================

export function downloadImage(url: string, filename?: string): void {
  let path = url;
  // Extract path portion from full URL
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const urlObj = new URL(path);
      path = urlObj.pathname;
    } catch {
      // keep as-is
    }
  }
  const downloadUrl = `${API_BASE}/api/download?path=${encodeURIComponent(path)}`;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename || path.split('/').pop() || 'download.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================
// Billing API
// ============================================

export const billingApi = {
  getSummary: (projectId?: string, modelType?: string) => {
    const params = new URLSearchParams();
    if (projectId) params.set('project_id', projectId);
    if (modelType) params.set('model_type', modelType);
    const qs = params.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return request<any>(`/api/billing/summary${qs ? `?${qs}` : ''}`);
  },

  getStats: (period: 'daily' | 'monthly' = 'daily', days = 30, projectId?: string, modelType?: string) => {
    const params = new URLSearchParams({ period, days: String(days) });
    if (projectId) params.set('project_id', projectId);
    if (modelType) params.set('model_type', modelType);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return request<any>(`/api/billing/stats?${params.toString()}`);
  },

  getRecords: (limit = 50, offset = 0, projectId?: string, modelType?: string) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (projectId) params.set('project_id', projectId);
    if (modelType) params.set('model_type', modelType);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return request<any>(`/api/billing/records?${params.toString()}`);
  },

  getProjects: () => request<{ project_id: string; project_name: string }[]>('/api/billing/projects'),

  getExportUrl: (dateFrom: string, dateTo: string, projectId?: string, modelType?: string) => {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    if (projectId) params.set('project_id', projectId);
    if (modelType) params.set('model_type', modelType);
    return `${API_BASE}/api/billing/export?${params.toString()}`;
  },
};
