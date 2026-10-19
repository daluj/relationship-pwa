import type { NewImage } from '@/db/repositories';
import { base64ToBlob } from '@/lib/base64';
import { loadImage, renderCrop } from '@/lib/image';

/** Inline vCard photo → square ≤ 400px avatar (same pipeline as manual uploads). */
export async function preparePhoto(photo: {
  mime: string;
  base64: string;
}): Promise<NewImage | undefined> {
  const bitmap = await loadImage(base64ToBlob(photo.base64, photo.mime));
  try {
    return await renderCrop(bitmap, { zoom: 1, panX: 0, panY: 0 }, 400, 400);
  } finally {
    bitmap.close();
  }
}
