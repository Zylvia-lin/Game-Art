import type {
  ModelConfig,
  SystemPrompt,
  Project,
  Generation,
  Asset,
  GenerateResponse,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Request failed: ${res.status}`);
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
  create: (data: { name: string; description?: string }) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => request<Project>(`/api/projects/${id}`),
  update: (id: number, data: Partial<Project>) =>
    request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/projects/${id}`, { method: 'DELETE' }),
  generations: (id: number) => request<Generation[]>(`/api/projects/${id}/generations`),
  assets: (id: number, type?: string) =>
    request<Asset[]>(`/api/projects/${id}/assets${type ? `?asset_type=${type}` : ''}`),
  deleteAsset: (id: number) =>
    request<{ message: string }>(`/api/projects/assets/${id}`, { method: 'DELETE' }),
};

// Generate
export const generateApi = {
  textToImage: (data: Record<string, unknown>) =>
    request<GenerateResponse>('/api/generate/text-to-image', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  imageToImage: (data: Record<string, unknown>) =>
    request<GenerateResponse>('/api/generate/image-to-image', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  inpaint: (data: Record<string, unknown>) =>
    request<GenerateResponse>('/api/generate/inpaint', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  character: (data: Record<string, unknown>) =>
    request<GenerateResponse>('/api/generate/character', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  animation: (data: Record<string, unknown>) =>
    request<GenerateResponse>('/api/generate/animation', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  prop: (data: Record<string, unknown>) =>
    request<GenerateResponse>('/api/generate/prop', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  uiLayout: (data: Record<string, unknown>) =>
    request<GenerateResponse>('/api/generate/ui-layout', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  scene: (data: Record<string, unknown>) =>
    request<GenerateResponse>('/api/generate/scene', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  upload: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/generate/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
};
