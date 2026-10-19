export interface CropState {
  /** ≥ 1; 1 = image just covers the frame. */
  zoom: number;
  /** Pan as a fraction of the frame size, relative to centered. */
  panX: number;
  panY: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bounds for pan so the image always covers the frame. */
function panLimits(imgW: number, imgH: number, frameW: number, frameH: number, zoom: number) {
  const scale = Math.max(frameW / imgW, frameH / imgH) * zoom;
  return {
    scale,
    maxX: (imgW * scale - frameW) / 2 / frameW,
    maxY: (imgH * scale - frameH) / 2 / frameH,
  };
}

const clamp = (v: number, max: number) => Math.min(max, Math.max(-max, v));

export function clampCrop(
  s: CropState,
  img: { w: number; h: number },
  frame: { w: number; h: number },
): CropState {
  const zoom = Math.min(4, Math.max(1, s.zoom));
  const { maxX, maxY } = panLimits(img.w, img.h, frame.w, frame.h, zoom);
  return { zoom, panX: clamp(s.panX, maxX), panY: clamp(s.panY, maxY) };
}

/** Where to draw the image (destination rect) inside a frame of the given size. */
export function coverRect(
  s: CropState,
  img: { w: number; h: number },
  frame: { w: number; h: number },
): Rect {
  const c = clampCrop(s, img, frame);
  const { scale } = panLimits(img.w, img.h, frame.w, frame.h, c.zoom);
  const w = img.w * scale;
  const h = img.h * scale;
  return {
    x: (frame.w - w) / 2 + c.panX * frame.w,
    y: (frame.h - h) / 2 + c.panY * frame.h,
    w,
    h,
  };
}
