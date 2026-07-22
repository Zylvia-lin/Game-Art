import { NextResponse } from 'next/server';
import { getSystemPrompts } from '@/lib/store';

export async function GET() {
  const prompts = await getSystemPrompts();
  return NextResponse.json(prompts);
}
