import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { NewImage } from '@/db/repositories';
import { clampCrop, coverRect, type CropState } from '@/domain/crop';
import { loadImage, renderCrop } from '@/lib/image';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface Props {
  file: File | null;
  /** width / height — 1 for avatars, 3 for banners (features §8.2). */
  aspect: 1 | 3;
  /** Output width in px; height follows the aspect (avatars ≤ 400px, tech-stack §3). */
  outputWidth: number;
  onCancel: () => void;
  onDone: (image: NewImage) => void;
}

const initial: CropState = { zoom: 1, panX: 0, panY: 0 };

/** Pan/zoom crop dialog with a fixed-aspect frame. */
export function ImageCropper({ file, aspect, outputWidth, onCancel, onDone }: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap>();
  const [error, setError] = useState(false);
  const [crop, setCrop] = useState<CropState>(initial);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; start: CropState } | null>(null);

  useEffect(() => {
    setBitmap(undefined);
    setError(false);
    setCrop(initial);
    if (!file) return;
    let cancelled = false;
    loadImage(file)
      .then((b) => (cancelled ? b.close() : setBitmap(b)))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const update = useCallback(
    (next: CropState) => {
      const canvas = canvasRef.current;
      if (!bitmap || !canvas) return;
      setCrop(clampCrop(next, { w: bitmap.width, h: bitmap.height }, { w: 1, h: 1 / aspect }));
    },
    [bitmap, aspect],
  );

  // Draw preview.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    const w = canvas.clientWidth * devicePixelRatio;
    const h = w / aspect;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const r = coverRect(crop, { w: bitmap.width, h: bitmap.height }, { w, h });
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bitmap, r.x, r.y, r.w, r.h);
  }, [bitmap, crop, aspect]);

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: crop };
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const rect = e.currentTarget.getBoundingClientRect();
    update({
      ...d.start,
      panX: d.start.panX + (e.clientX - d.x) / rect.width,
      panY: d.start.panY + (e.clientY - d.y) / rect.height,
    });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step = 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    update({ ...crop, panX: crop.panX + m[0], panY: crop.panY + m[1] });
  };

  const apply = async () => {
    if (!bitmap) return;
    setBusy(true);
    try {
      onDone(await renderCrop(bitmap, crop, outputWidth, Math.round(outputWidth / aspect)));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!file}
      onClose={onCancel}
      title={aspect === 1 ? t('cropper.title') : t('cropper.titleBanner')}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void apply()} disabled={!bitmap || busy}>
            {t('common.apply')}
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-danger">
          {t('cropper.error')}
        </p>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-lg bg-surface-2">
            <canvas
              ref={canvasRef}
              tabIndex={0}
              role="img"
              aria-label={t('cropper.frame')}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={onKeyDown}
              onWheel={(e) => update({ ...crop, zoom: crop.zoom - e.deltaY / 500 })}
              className="block w-full cursor-move touch-none"
              style={{ aspectRatio: String(aspect) }}
            />
            {aspect === 1 && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              />
            )}
          </div>
          <label className="mt-4 flex items-center gap-3">
            <span className="text-sm text-muted">{t('cropper.zoom')}</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={crop.zoom}
              onChange={(e) => update({ ...crop, zoom: Number(e.target.value) })}
              className="flex-1 accent-[var(--accent)]"
            />
          </label>
        </>
      )}
    </Dialog>
  );
}
