// PostgreSQL-based data store for all API routes
import postgres from 'postgres';
import type { ModelConfig, SystemPrompt, Project, Generation, Asset } from '@/lib/types';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'game_art_ai',
  username: process.env.DB_USER || 'gameart',
  password: process.env.DB_PASSWORD || 'gameart123',
};

export const sql = postgres(dbConfig);

// Helper to convert postgres row to our types
const toModelConfig = (row: Record<string, unknown>): ModelConfig => ({
  id: row.id as number,
  name: row.name as string,
  type: row.type as ModelConfig['type'],
  provider: row.provider as string,
  api_base_url: row.api_base_url as string,
  api_key: row.api_key as string,
  model_name: row.model_name as string,
  is_default: row.is_default as boolean,
  created_at: (row.created_at as Date).toISOString(),
  updated_at: (row.updated_at as Date).toISOString(),
});

// Mask api_key for list responses (security)
export const toModelConfigSafe = (row: Record<string, unknown>): ModelConfig => {
  const config = toModelConfig(row);
  if (config.api_key && config.api_key.length > 8) {
    config.api_key = config.api_key.slice(0, 4) + '****' + config.api_key.slice(-4);
  }
  return config;
};

const toSystemPrompt = (row: Record<string, unknown>): SystemPrompt => ({
  id: row.id as number,
  tool_key: row.tool_key as string,
  tool_name: row.tool_name as string,
  description: (row.description as string) ?? null,
  prompt_content: row.prompt_content as string,
  created_at: (row.created_at as Date).toISOString(),
  updated_at: (row.updated_at as Date).toISOString(),
});

const toProject = (row: Record<string, unknown>): Project => ({
  id: row.id as number,
  name: row.name as string,
  description: (row.description as string) ?? null,
  cover_url: (row.cover_url as string) ?? null,
  style: (row.style as string) ?? 'pixel',
  created_at: (row.created_at as Date).toISOString(),
  updated_at: (row.updated_at as Date).toISOString(),
});

const toAsset = (row: Record<string, unknown>): Asset => {
  let metadata: Record<string, unknown> | null = (row.metadata as Record<string, unknown>) ?? null;
  // postgres.js may return jsonb as string, parse it
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata as unknown as string); } catch { metadata = null; }
  }
  return {
    id: row.id as number,
    project_id: row.project_id as number,
    generation_id: (row.generation_id as number) ?? null,
    name: row.name as string,
    description: (metadata?.description as string) ?? '',
    type: row.type as Asset['type'],
    url: row.url as string,
    finalized: row.finalized as boolean,
    metadata_: metadata,
    created_at: (row.created_at as Date)?.toISOString?.() ?? (row.created_at as string),
  };
};

const toGeneration = (row: Record<string, unknown>): Generation => ({
  id: row.id as number,
  project_id: row.project_id as number,
  tool_key: row.tool_key as string,
  input_params: (row.input_params as Record<string, unknown>) ?? null,
  output_urls: (row.output_urls as string[]) ?? null,
  status: row.status as Generation['status'],
  error_message: (row.error_message as string) ?? null,
  created_at: (row.created_at as Date).toISOString(),
});

// ============ Model Configs ============
export async function getModelConfigs(): Promise<ModelConfig[]> {
  const rows = await sql`SELECT * FROM model_configs ORDER BY created_at DESC`;
  return rows.map(r => toModelConfig(r as unknown as Record<string, unknown>));
}

export async function getModelConfig(id: number): Promise<ModelConfig | undefined> {
  const rows = await sql`SELECT * FROM model_configs WHERE id = ${id}`;
  return rows[0] ? toModelConfig(rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function getDefaultModelConfig(type: string): Promise<ModelConfig | undefined> {
  const rows = await sql`SELECT * FROM model_configs WHERE type = ${type} AND is_default = true LIMIT 1`;
  return rows[0] ? toModelConfig(rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function createModelConfig(data: Omit<ModelConfig, 'id' | 'created_at' | 'updated_at'>): Promise<ModelConfig> {
  const rows = await sql`
    INSERT INTO model_configs (name, type, provider, api_base_url, api_key, model_name, is_default)
    VALUES (${data.name}, ${data.type}, ${data.provider}, ${data.api_base_url}, ${data.api_key}, ${data.model_name}, ${data.is_default || false})
    RETURNING *
  `;
  return toModelConfig(rows[0] as unknown as Record<string, unknown>);
}

export async function updateModelConfig(id: number, data: Partial<ModelConfig>): Promise<ModelConfig | undefined> {
  const rows = await sql`
    UPDATE model_configs SET 
      name = COALESCE(${data.name ?? null}, name),
      type = COALESCE(${data.type ?? null}, type),
      provider = COALESCE(${data.provider ?? null}, provider),
      api_base_url = COALESCE(${data.api_base_url ?? null}, api_base_url),
      api_key = COALESCE(${data.api_key ?? null}, api_key),
      model_name = COALESCE(${data.model_name ?? null}, model_name),
      is_default = COALESCE(${data.is_default ?? null}, is_default),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? toModelConfig(rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function deleteModelConfig(id: number): Promise<boolean> {
  const result = await sql`DELETE FROM model_configs WHERE id = ${id}`;
  return result.count > 0;
}

export async function setDefaultModel(id: number): Promise<ModelConfig | undefined> {
  // First, clear all defaults
  await sql`UPDATE model_configs SET is_default = false, updated_at = NOW()`;
  // Then set the new default
  const rows = await sql`
    UPDATE model_configs
    SET is_default = true, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? toModelConfig(rows[0] as unknown as Record<string, unknown>) : undefined;
}

// ============ System Prompts ============
export async function getSystemPrompts(): Promise<SystemPrompt[]> {
  const rows = await sql`SELECT * FROM system_prompts ORDER BY id`;
  return rows.map(r => toSystemPrompt(r as unknown as Record<string, unknown>));
}

export async function getSystemPrompt(toolKey: string): Promise<SystemPrompt | undefined> {
  const rows = await sql`SELECT * FROM system_prompts WHERE tool_key = ${toolKey}`;
  return rows[0] ? toSystemPrompt(rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function updateSystemPrompt(toolKey: string, promptContent: string): Promise<SystemPrompt | undefined> {
  const rows = await sql`
    UPDATE system_prompts SET prompt_content = ${promptContent}, updated_at = CURRENT_TIMESTAMP
    WHERE tool_key = ${toolKey}
    RETURNING *
  `;
  return rows[0] ? toSystemPrompt(rows[0] as unknown as Record<string, unknown>) : undefined;
}

// ============ Projects ============
export async function getProjects(): Promise<Project[]> {
  const rows = await sql`SELECT * FROM projects ORDER BY updated_at DESC`;
  return rows.map(r => toProject(r as unknown as Record<string, unknown>));
}

export async function getProject(id: number): Promise<Project | undefined> {
  const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
  return rows[0] ? toProject(rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function createProject(data: { name: string; description?: string; cover_url?: string; style?: string }): Promise<Project> {
  const rows = await sql`
    INSERT INTO projects (name, description, cover_url, style)
    VALUES (${data.name}, ${data.description || null}, ${data.cover_url || null}, ${data.style || 'pixel'})
    RETURNING *
  `;
  return toProject(rows[0] as unknown as Record<string, unknown>);
}

export async function updateProject(id: number, data: Partial<Project>): Promise<Project | undefined> {
  const rows = await sql`
    UPDATE projects SET 
      name = COALESCE(${data.name ?? null}, name),
      description = COALESCE(${data.description ?? null}, description),
      cover_url = COALESCE(${data.cover_url ?? null}, cover_url),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? toProject(rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function deleteProject(id: number): Promise<boolean> {
  const result = await sql`DELETE FROM projects WHERE id = ${id}`;
  return result.count > 0;
}

// ============ Assets ============
export async function getAssets(projectId?: number, type?: string): Promise<Asset[]> {
  let rows;
  if (projectId && type) {
    rows = await sql`SELECT * FROM assets WHERE project_id = ${projectId} AND type = ${type} ORDER BY created_at DESC`;
  } else if (projectId) {
    rows = await sql`SELECT * FROM assets WHERE project_id = ${projectId} ORDER BY created_at DESC`;
  } else {
    rows = await sql`SELECT * FROM assets ORDER BY created_at DESC`;
  }
  return rows.map(r => toAsset(r as unknown as Record<string, unknown>));
}

export async function getAsset(id: number): Promise<Asset | undefined> {
  const rows = await sql`SELECT * FROM assets WHERE id = ${id}`;
  return rows[0] ? toAsset(rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function createAsset(data: { project_id: number; name: string; type: string; url: string; metadata_?: Record<string, unknown> }): Promise<Asset> {
  const rows = await sql`
    INSERT INTO assets (project_id, name, type, url, metadata)
    VALUES (${data.project_id}, ${data.name}, ${data.type}, ${data.url}, ${JSON.stringify(data.metadata_ || {})}::jsonb)
    RETURNING *
  `;
  return toAsset(rows[0] as unknown as Record<string, unknown>);
}

export async function updateAsset(id: number, data: Partial<Asset>): Promise<Asset | undefined> {
  const rows = await sql`
    UPDATE assets SET 
      name = COALESCE(${data.name ?? null}, name),
      type = COALESCE(${data.type ?? null}, type),
      url = COALESCE(${data.url ?? null}, url),
      finalized = COALESCE(${data.finalized ?? null}, finalized),
      metadata = COALESCE(${data.metadata_ ? JSON.stringify(data.metadata_) : null}::jsonb, metadata),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? toAsset(rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function deleteAsset(id: number): Promise<boolean> {
  const result = await sql`DELETE FROM assets WHERE id = ${id}`;
  return result.count > 0;
}

// ============ Generations ============
export async function getGenerations(projectId?: number): Promise<Generation[]> {
  let rows;
  if (projectId) {
    rows = await sql`SELECT * FROM generations WHERE project_id = ${projectId} ORDER BY created_at DESC`;
  } else {
    rows = await sql`SELECT * FROM generations ORDER BY created_at DESC`;
  }
  return rows.map(r => toGeneration(r as unknown as Record<string, unknown>));
}

export async function createGeneration(data: { project_id: number; tool_key: string; input_params?: Record<string, unknown>; output_urls?: string[]; status?: string; error_message?: string }): Promise<Generation> {
  const rows = await sql`
    INSERT INTO generations (project_id, tool_key, input_params, output_urls, status, error_message)
    VALUES (${data.project_id}, ${data.tool_key}, ${JSON.stringify(data.input_params || {})}::jsonb, ${JSON.stringify(data.output_urls || [])}::jsonb, ${data.status || 'completed'}, ${data.error_message || null})
    RETURNING *
  `;
  return toGeneration(rows[0] as unknown as Record<string, unknown>);
}

export default sql;
