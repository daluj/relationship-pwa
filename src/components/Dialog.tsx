import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Modal built on native <dialog> (focus trap, Esc, inert background for free). */
export function Dialog({ open, onClose, title, children, footer, wide }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', ''); // jsdom
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`m-auto w-[calc(100%-2rem)] rounded-2xl border border-border bg-bg p-0 text-text backdrop:bg-black/50 ${wide ? 'max-w-xl' : 'max-w-sm'}`}
    >
      {open && (
        <>
          <div className="flex items-center gap-4 px-4 pt-3">
            <IconButton label={t('common.close')} onClick={onClose} className="-ml-2">
              <X size={20} aria-hidden />
            </IconButton>
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
          </div>
          <div className="px-4 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 px-4 pb-4">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
