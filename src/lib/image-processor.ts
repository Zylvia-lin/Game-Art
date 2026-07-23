import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

// 绿色背景（#00FF00）的 HSV 范围，用于色键抠图
const GREEN_MIN = { h: 60, s: 40, v: 20 };
const GREEN_MAX = { h: 180, s: 100, v: 100 };

/**
 * RGB 转 HSV
 */
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === rN) h = ((gN - bN) / diff + (gN < bN ? 6 : 0)) * 60;
    else if (max === gN) h = ((bN - rN) / diff + 2) * 60;
    else h = ((rN - gN) / diff + 4) * 60;
  }

  const s = max === 0 ? 0 : (diff / max) * 100;
  const v = max * 100;

  return { h, s, v };
}

/**
 * 移除图片中的绿色背景，转为透明 PNG
 * @param inputPath 输入图片路径（相对于 public/ 或绝对路径）
 * @param tolerance 容差值 0-100，越大移除越多绿色，默认 30
 * @returns 输出图片路径（相对于 public/）
 */
export async function removeGreenBackground(
  inputPath: string,
  tolerance: number = 30
): Promise<string> {
  // 解析输入路径
  let absInput: string;
  if (inputPath.startsWith('/uploads/')) {
    absInput = path.join(process.cwd(), 'public', inputPath);
  } else if (path.isAbsolute(inputPath)) {
    absInput = inputPath;
  } else {
    absInput = path.join(process.cwd(), 'public', inputPath);
  }

  if (!fs.existsSync(absInput)) {
    throw new Error(`Input file not found: ${absInput}`);
  }

  // 生成输出路径
  const ext = path.extname(absInput);
  const baseName = path.basename(absInput, ext);
  const outputName = `${baseName}_transparent.png`;
  const absOutput = path.join(path.dirname(absInput), outputName);

  // 读取图片像素数据
  const { data, info } = await sharp(absInput)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  const pixels = new Uint8Array(data);

  // 遍历每个像素，将绿色区域设为透明
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];

    const hsv = rgbToHsv(r, g, b);

    // 判断是否为绿色背景（带容差）
    const isGreen =
      hsv.h >= GREEN_MIN.h - tolerance &&
      hsv.h <= GREEN_MAX.h + tolerance &&
      hsv.s >= GREEN_MIN.s &&
      hsv.v >= GREEN_MIN.v;

    if (isGreen) {
      // 绿色像素 → 完全透明
      pixels[offset + 3] = 0;
    }
  }

  // 边缘柔化：对半透明边缘做 feather 处理
  const feathered = await featherEdges(pixels, info.width, info.height);

  // 输出为 PNG
  await sharp(feathered, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toFile(absOutput);

  // 返回相对路径
  const relativePath = `/uploads/${outputName}`;
  return relativePath;
}

/**
 * 边缘柔化处理：对透明与不透明边界做 1px 的 alpha 渐变
 */
async function featherEdges(
  pixels: Uint8Array,
  width: number,
  height: number
): Promise<Uint8Array> {
  const result = new Uint8Array(pixels);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const alpha = pixels[idx + 3];

      // 如果当前像素不透明，检查周围是否有透明像素
      if (alpha === 255) {
        let hasTransparentNeighbor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            if (pixels[nIdx + 3] === 0) {
              hasTransparentNeighbor = true;
              break;
            }
          }
          if (hasTransparentNeighbor) break;
        }

        // 边缘像素降低 alpha，做 1px 渐变
        if (hasTransparentNeighbor) {
          result[idx + 3] = 128;
        }
      }
    }
  }

  return result;
}

/**
 * 将 Sprite 图切割为单独的帧
 * @param inputPath sprite 图路径
 * @param rows 行数
 * @param cols 列数
 * @param outputPrefix 输出文件名前缀
 * @returns 切割后的帧路径列表
 */
export async function extractFrames(
  inputPath: string,
  rows: number,
  cols: number,
  outputPrefix?: string
): Promise<string[]> {
  let absInput: string;
  if (inputPath.startsWith('/uploads/')) {
    absInput = path.join(process.cwd(), 'public', inputPath);
  } else if (path.isAbsolute(inputPath)) {
    absInput = inputPath;
  } else {
    absInput = path.join(process.cwd(), 'public', inputPath);
  }

  if (!fs.existsSync(absInput)) {
    throw new Error(`Input file not found: ${absInput}`);
  }

  const metadata = await sharp(absInput).metadata();
  const imgWidth = metadata.width || 0;
  const imgHeight = metadata.height || 0;

  if (imgWidth === 0 || imgHeight === 0) {
    throw new Error('Invalid image dimensions');
  }

  const frameWidth = Math.floor(imgWidth / cols);
  const frameHeight = Math.floor(imgHeight / rows);

  const prefix = outputPrefix || `frame_${Date.now()}`;
  const frames: string[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * frameWidth;
      const top = row * frameHeight;
      const outputName = `${prefix}_${row}_${col}.png`;
      const absOutput = path.join(UPLOAD_DIR, outputName);

      await sharp(absInput)
        .extract({ left, top, width: frameWidth, height: frameHeight })
        .png()
        .toFile(absOutput);

      frames.push(`/uploads/${outputName}`);
    }
  }

  return frames;
}

/**
 * 确保上传目录存在
 */
export function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}
