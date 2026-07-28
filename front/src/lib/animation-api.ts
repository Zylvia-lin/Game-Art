import { API_BASE } from './api';

export type VideoTaskStatus = 'submitted' | 'queued' | 'running' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface VideoTask {
  id: string;
  project_id: string;
  task_type: 'generate' | 'edit';
  source_video_task_id: string | null;
  model_id: string;
  status: VideoTaskStatus;
  user_prompt: string;
  enhanced_prompt: string;
  reference_asset_ids: string[];
  video_url: string | null;
  ratio: string;
  resolution: string;
  duration: number;
  fps: number | null;
  created_at: string;
}

export interface FrameItem {
  number: number;
  url: string;
  thumbnail_url: string;
}

export interface FrameExtraction {
  id: string;
  project_id: string;
  source_video_task_id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  extraction_fps: number;
  total_frames: number;
  frames: FrameItem[];
  selected_frames: number[];
  export_video_path?: string | null;
  export_video_fps?: number | null;
  sequence_dir?: string | null;
  export_video_url?: string | null;
  sequence_preview_urls?: string[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `请求失败 (${response.status})`);
  }
  return response.json();
}

export const animationApi = {
  tasks: (projectId: string) =>
    request<VideoTask[]>(`/api/video/projects/${projectId}/tasks`),
  generate: (data: {
    project_id: string;
    model_id: string;
    prompt: string;
    asset_ids: string[];
    ratio: string;
    resolution: string;
    duration: number;
    generate_audio: boolean;
  }) => request<VideoTask>('/api/video/projects/generate', {
    method: 'POST', body: JSON.stringify(data),
  }),
  edit: (data: {
    project_id: string;
    source_video_task_id: string;
    model_id: string;
    prompt: string;
    generate_audio: boolean;
  }) => request<VideoTask>('/api/video/projects/edit', {
    method: 'POST', body: JSON.stringify(data),
  }),
  refresh: (taskId: string) =>
    request<VideoTask>(`/api/video/projects/tasks/${taskId}`),
  extractions: (projectId: string) =>
    request<FrameExtraction[]>(`/api/video/projects/${projectId}/extractions`),
  extract: (taskId: string) =>
    request<FrameExtraction>(`/api/video/projects/tasks/${taskId}/extract`, { method: 'POST' }),
  saveSelection: (id: string, selected_frames: number[]) =>
    request<FrameExtraction>(`/api/video/extractions/${id}/selection`, {
      method: 'PUT', body: JSON.stringify({ selected_frames }),
    }),
  exportVideo: (id: string, selected_frames: number[], fps: number) =>
    request<{ url: string; fps: number }>(`/api/video/extractions/${id}/export-video`, {
      method: 'POST', body: JSON.stringify({ selected_frames, fps }),
    }),
  exportSequence: (id: string, selected_frames: number[]) =>
    request<{ preview_urls: string[] }>(`/api/video/extractions/${id}/export-sequence`, {
      method: 'POST', body: JSON.stringify({ selected_frames }),
    }),
  zipUrl: (id: string) => `${API_BASE}/api/video/extractions/${id}/sequence.zip`,
};

