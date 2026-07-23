import type {
  ModelConfig,
  SystemPrompt,
  Project,
  Generation,
  Asset,
  GenerateResponse,
  Task,
} from './types';

/**
 * Python FastAPI backend URL.
 * Set NEXT_PUBLIC_API_URL in .env.local, e.g. http://localhost:8000
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Resolve image URLs. Backend returns /uploads/xxx.png paths,
 * which need to be prefixed with the backend URL for display.
 */
export function resolveImageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('/uploads/')) {
    return `${API_BASE}${path}`;
  }
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  return path;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Validate path doesn't contain NaN
  if (path.includes('NaN')) {
    throw new Error(`Invalid API path: ${path}`);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    const message = typeof error === 'string' ? error : (error.error || error.detail || error.message || `Request failed: ${res.status}`);
    throw new Error(message);
  }
  return res.json();
}

// Models
export const modelsApi = {
  list: () => request<ModelConfig[]>('/api/models'),
  create: (data: Partial<ModelConfig>) =>
    request<ModelConfig>('/api/models', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<ModelConfig>) =>
    request<ModelConfig>(`/api/models/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/models/${id}`, { method: 'DELETE' }),
  setDefault: (id: number) =>
    request<ModelConfig>(`/api/models/${id}/default`, { method: 'PUT' }),
};

// Prompts
export const promptsApi = {
  list: () => request<SystemPrompt[]>('/api/prompts'),
  get: (toolKey: string) => request<SystemPrompt>(`/api/prompts/${toolKey}`),
  update: (toolKey: string, data: { prompt_content: string; description?: string }) =>
    request<SystemPrompt>(`/api/prompts/${toolKey}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Projects
export const projectsApi = {
  list: () => request<Project[]>('/api/projects'),
  create: (data: { name: string; description?: string; style?: string }) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => {
    if (id === undefined || id === null || isNaN(id)) throw new Error('Invalid project ID');
    return request<Project>(`/api/projects/${id}`);
  },
  update: (id: number, data: Partial<Project>) => {
    if (id === undefined || id === null || isNaN(id)) throw new Error('Invalid project ID');
    return request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete: (id: number) => {
    if (id === undefined || id === null || isNaN(id)) throw new Error('Invalid project ID');
    return request<{ message: string }>(`/api/projects/${id}`, { method: 'DELETE' });
  },
  generations: (id: number) => {
    if (id === undefined || id === null || isNaN(id)) throw new Error('Invalid project ID');
    return request<Generation[]>(`/api/projects/${id}/generations`);
  },
  assets: (id: number, type?: string) => {
    if (id === undefined || id === null || isNaN(id)) throw new Error('Invalid project ID');
    return request<Asset[]>(`/api/projects/${id}/assets${type ? `?asset_type=${type}` : ''}`);
  },
  createAsset: (data: { project_id: number; name: string; type: string; url: string; description?: string }) =>
    request<Asset>('/api/assets', { method: 'POST', body: JSON.stringify(data) }),
};

// Assets (standalone)
export const assetsApi = {
  get: (id: number) => {
    if (!id || isNaN(id)) throw new Error('Invalid asset ID');
    return request<Asset>(`/api/assets/${id}`);
  },
  update: (id: number, data: { finalized?: boolean; name?: string; type?: string }) => {
    if (!id || isNaN(id)) throw new Error('Invalid asset ID');
    return request<Asset>(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete: (id: number) => {
    if (!id || isNaN(id)) throw new Error('Invalid asset ID');
    return request<{ success: boolean }>(`/api/assets/${id}`, { method: 'DELETE' });
  },
  finalize: (id: number, finalized: boolean) => {
    if (!id || isNaN(id)) throw new Error('Invalid asset ID');
    return request<Asset>(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify({ finalized }) });
  },
};

// Generate — submit tasks to the queue
export const generateApi = {
  submit: (toolKey: string, data: Record<string, unknown> & { project_id: number }) =>
    request<GenerateResponse>(`/api/generate/${toolKey}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  textToImage: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('text_to_image', data),
  imageToImage: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('image_to_image', data),
  inpaint: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('inpaint', data),
  characterTpose: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('character_tpose', data),
  characterDirections: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('character_directions', data),
  characterThreeView: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('character_three_view', data),
  characterPartSplit: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('character_part_split', data),
  animationText: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('animation_text', data),
  propGenerate: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('prop_generate', data),
  propVariant: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('prop_variant', data),
  uiLayoutGenerate: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('ui_layout_generate', data),
  sceneMapGenerate: (data: Record<string, unknown> & { project_id: number }) =>
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
  getTask: (taskId: number) =>
    request<Task>(`/api/generate/task?task_id=${taskId}`),
  getProjectTasks: (projectId: number, status?: string) =>
    request<Task[]>(`/api/generate/task?project_id=${projectId}${status ? `&status=${status}` : ''}`),
  getQueueStats: (projectId?: number) =>
    request<{ pending: number; processing: number; completed: number; failed: number }>(
      `/api/generate/task?stats=true${projectId ? `&project_id=${projectId}` : ''}`
    ),
  cancelTask: (taskId: number) =>
    request<Task>(`/api/generate/task/${taskId}/cancel`, { method: 'POST' }),
};

// 本地工具 API（不走 AI）
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
};
