import { NextRequest, NextResponse } from 'next/server';
import { sql, getModelConfig, toModelConfigSafe } from '@/lib/store';

/**
 * PUT /api/models/[id]/default
 * Set a model as the default for its type (unset others of same type)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const modelId = parseInt(id);

    const model = await getModelConfig(modelId);
    if (!model) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Unset all defaults of the same type, then set this one
    await sql`UPDATE model_configs SET is_default = false WHERE type = ${model.type}`;
    const rows = await sql`
      UPDATE model_configs SET is_default = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${modelId}
      RETURNING *
    `;

    return NextResponse.json(toModelConfigSafe(rows[0] as unknown as Record<string, unknown>));
  } catch (error) {
    console.error('Error setting default model:', error);
    return NextResponse.json({ error: 'Failed to set default model' }, { status: 500 });
  }
}
