export interface ModelConfig {
  id: string;
  type: 'text' | 'image' | 'video';
  name: string;
  provider: string;
  api_base_url: string;
  api_key: string;
  model_name: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ModelConfigCreate {
  type: 'text' | 'image' | 'video';
  name: string;
  provider: string;
  api_base_url: string;
  api_key: string;
  model_name: string;
  is_default: boolean;
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

export interface Project {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  style: string;
  created_at: string;
  updated_at: string;
}

export interface Generation {
  id: string;
  project_id: string;
  tool_key: string;
  input_params: Record<string, unknown> | null;
  output_urls: string[] | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  project_id: string;
  generation_id: string | null;
  name: string;
  description: string;
  type: 'character' | 'prop' | 'ui' | 'scene' | 'animation_frame' | 'image';
  url: string;
  metadata_: Record<string, unknown> | null;
  finalized: boolean;
  created_at: string;
}

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Task {
  id: string;
  project_id: string;
  tool_key: string;
  input_params: Record<string, unknown>;
  status: TaskStatus;
  output_urls: string[];
  error_message: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface GenerateRequest {
  project_id: string;
  prompt: string;
  model_id?: string;
  [key: string]: unknown;
}

export interface GenerateResponse {
  status: string;
  task_id: string;
  message: string;
}

export const ART_STYLES = [
  { value: 'anime', label: '二次元' },
  { value: 'pixel', label: '像素风' },
