import { NextRequest, NextResponse } from 'next/server';
import { extractFrames, ensureUploadDir } from '@/lib/image-processor';

// POST /api/tools/extract-frames - 将 sprite 图切割为帧
export async function POST(request: NextRequest) {
  try {
    ensureUploadDir();
    const body = await request.json();
    const { image_url, rows, cols } = body as {
      image_url: string;
      rows: number;
      cols: number;
    };

    if (!image_url) {
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }
    if (!rows || !cols || rows < 1 || cols < 1) {
      return NextResponse.json({ error: 'rows and cols must be positive integers' }, { status: 400 });
    }

    const frames = await extractFrames(image_url, rows, cols);
    return NextResponse.json({ frames });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to extract frames';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
