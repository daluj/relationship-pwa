import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { ImageCropper } from '@/components/ImageCropper';
import type { NewImage } from '@/db/repositories';

/** `undefined` = unchanged, `null` = removed, otherwise a new cropped image. */
export type ImageChange = NewImage | null | undefined;

interface Props {
  label: string;
  aspect: 1 | 3;
  outputWidth: number;
  /** URL of the stored image, if any. */
  currentUrl?: string;
  value: ImageChange;
  onChange: (v: ImageChange) => void;
}

export function ImagePicker({ label, aspect, outputWidth, currentUrl, value, onChange }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();

  useEffect(() => {
    if (!value) {
      setPreviewUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(value.data);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const shown = value === null ? undefined : (previewUrl ?? currentUrl);

  return (
    <div>
      <p className="mb-1 text-sm font-bold text-muted">{label}</p>
      <div className="flex items-center gap-3">
        <div
          className={`overflow-hidden bg-surface-2 ${aspect === 1 ? 'h-16 w-16 rounded-full' : 'h-16 w-48 rounded-md'}`}
        >
          {shown && <img src={shown} alt="" className="h-full w-full object-cover" />}
        </div>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <ImagePlus size={16} aria-hidden />
          {shown ? t('form.changePhoto') : t('form.choosePhoto')}
        </Button>
        {shown && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            aria-label={`${t('form.removePhoto')}: ${label}`}
          >
            <Trash2 size={16} aria-hidden />
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label={label}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>
      <ImageCropper
        file={file}
        aspect={aspect}
        outputWidth={outputWidth}
        onCancel={() => setFile(null)}
        onDone={(img) => {
          setFile(null);
          onChange(img);
        }}
      />
    </div>
  );
}
