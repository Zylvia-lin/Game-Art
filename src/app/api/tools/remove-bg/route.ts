import { NextRequest, NextResponse } from 'next/server';
import { removeGreenBackground, ensureUploadDir } from '@/lib/image-processor';

// POST /api/tools/remove-bg - 移除图片绿色背景转为透明
export async function POST(request: NextRequest) {
  try {
    ensureUploadDir();
    const body = await request.json();
    const { image_url, tolerance } = body as {
      image_url: string;
      tolerance?: number;
    };

    if (!image_url) {
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }

    const resultUrl = await removeGreenBackground(image_url, tolerance ?? 30);
    return NextResponse.json({ url: resultUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove background';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
