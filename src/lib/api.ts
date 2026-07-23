import type {
  ModelConfig,
  SystemPrompt,
  Project,
  Generation,
  Asset,
  GenerateResponse,
  Task,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || error.detail || `Request failed: ${res.status}`);
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
  get: (id: number) => request<Project>(`/api/projects/${id}`),
  update: (id: number, data: Partial<Project>) =>
    request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/projects/${id}`, { method: 'DELETE' }),
  generations: (id: number) => request<Generation[]>(`/api/projects/${id}/generations`),
  assets: (id: number, type?: string) =>
    request<Asset[]>(`/api/projects/${id}/assets${type ? `?asset_type=${type}` : ''}`),
  createAsset: (data: { project_id: number; name: string; type: string; url: string; description?: string }) =>
    request<Asset>('/api/assets', { method: 'POST', body: JSON.stringify(data) }),
};

// Assets (standalone)
export const assetsApi = {
  get: (id: number) => request<Asset>(`/api/assets/${id}`),
  update: (id: number, data: { finalized?: boolean; name?: string; type?: string }) =>
    request<Asset>(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/api/assets/${id}`, { method: 'DELETE' }),
  finalize: (id: number, finalized: boolean) =>
    request<Asset>(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify({ finalized }) }),
};

// Generate — submit tasks to the queue
// toolKey uses underscores matching TOOL_KEY_MAP values (e.g. text_to_image)
export const generateApi = {
  submit: (toolKey: string, data: Record<string, unknown> & { project_id: number }) =>
    request<GenerateResponse>(`/api/generate/${toolKey}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  // Convenience methods matching tool keys
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
  animationSkeleton: (data: Record<string, unknown> & { project_id: number }) =>
    generateApi.submit('animation_skeleton', data),
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
