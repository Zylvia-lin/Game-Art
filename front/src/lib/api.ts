const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================
// Types
// ============================================

export interface Project {
  id: string;
  name: string;
  style: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  type: string;
  provider: string;
  api_base_url: string;
  api_key: string;
  model_name: string;
  is_default: boolean;
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
  name: string;
  type: string;
  url: string;
  finalized: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Generation {
  id: string;
  project_id: string;
  task_id: string;
  tool_key: string;
  prompt: string;
  result_url?: string;
  status: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  tool_key: string;
  status: string;
  progress: number;
  result_url?: string;
  output_urls?: string[];
  error?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Helper
// ============================================

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0;
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

  create: (data: { name: string; style: string; description?: string }) =>
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

  assets: (projectId: string) => {
    if (!isValidId(projectId)) throw new Error('Invalid project ID');
    return request<Asset[]>(`/api/projects/${projectId}/assets`);
  },

  generations: (projectId: string) => {
    if (!isValidId(projectId)) throw new Error('Invalid project ID');
    return request<Generation[]>(`/api/projects/${projectId}/generations`);
  },
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

  create: (data: Omit<ModelConfig, 'id' | 'created_at' | 'updated_at'>) =>
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
  create: (data: { project_id: string; name: string; type: string; url: string; description?: string }) =>
    request<Asset>('/api/assets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; type?: string; finalized?: boolean }) =>
    request<Asset>(`/api/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => {
    if (!isValidId(id)) throw new Error('Invalid asset ID');
    return request<void>(`/api/assets/${id}`, { method: 'DELETE' });
  },
};

// ============================================
// Generate API
// ============================================

export const generateApi = {
  submit: (toolKey: string, data: Record<string, unknown>) =>
    request<Task>(`/api/generate/${toolKey}`, {
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
  removeBackground: (data: { image_url: string }) =>
    request<{ url: string }>('/api/tools/remove-bg', {
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
  getSummary: () => request(`${API_BASE}/api/billing/summary`),

  getStats: (period: 'daily' | 'monthly' = 'daily', days = 30) =>
    request(`${API_BASE}/api/billing/stats?period=${period}&days=${days}`),

  getRecords: (limit = 50, offset = 0) =>
    request(`${API_BASE}/api/billing/records?limit=${limit}&offset=${offset}`),
};
