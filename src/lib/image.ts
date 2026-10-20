import type { NewImage } from '@/db/repositories';
import { coverRect, type CropState } from '@/domain/crop';

/** Decodes an image file, honouring EXIF orientation. */
export function loadImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Renders the cropped region at `outW`×`outH` and encodes it as WebP, or JPEG where the browser
 * can't encode WebP (older Safari). Output is never upscaled beyond the crop's source pixels.
 */
export async function renderCrop(
  bitmap: ImageBitmap,
  crop: CropState,
  outW: number,
  outH: number,
): Promise<NewImage> {
  const img = { w: bitmap.width, h: bitmap.height };
  // Source pixels visible in the frame → cap output size to avoid upscaling small images.
  const unit = coverRect(crop, img, { w: 1, h: outH / outW });
  const factor = Math.min(1, img.w / unit.w / outW);
  const width = Math.max(1, Math.round(outW * factor));
  const height = Math.max(1, Math.round(outH * factor));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  const r = coverRect(crop, img, { w: width, h: height });
  ctx.drawImage(bitmap, r.x, r.y, r.w, r.h);

  return encode(canvas);
}

/** WebP, falling back to JPEG where the browser can't encode WebP (older Safari). */
async function encode(canvas: HTMLCanvasElement): Promise<NewImage> {
  let blob = await toBlob(canvas, 'image/webp', 0.85);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85);
  if (!blob) throw new Error('Image encoding failed');
  return { data: blob, mime: blob.type, width: canvas.width, height: canvas.height };
}

/** Scales an image down so its longest side is at most `maxDim` (never up). */
export function resize(bitmap: ImageBitmap, maxDim: number): Promise<NewImage> {
  const k = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * k));
  canvas.height = Math.max(1, Math.round(bitmap.height * k));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return encode(canvas);
}

/** Moment photo (≤ 1600px) plus feed thumbnail (≤ 600px) (tech-stack §3, §10). */
export async function prepareMomentPhoto(
  file: Blob,
): Promise<{ image: NewImage; thumb: NewImage }> {
  const bitmap = await loadImage(file);
  try {
    return { image: await resize(bitmap, 1600), thumb: await resize(bitmap, 600) };
  } finally {
    bitmap.close();
  }
}
