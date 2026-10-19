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

  let blob = await toBlob(canvas, 'image/webp', 0.85);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85);
  if (!blob) throw new Error('Image encoding failed');
  return { data: blob, mime: blob.type, width, height };
}
