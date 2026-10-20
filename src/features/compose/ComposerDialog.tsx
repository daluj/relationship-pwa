import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useComposer } from '@/app/stores/composer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconButton } from '@/components/IconButton';
import { Composer } from './Composer';

/** Composer as a modal on desktop and a full-screen sheet on mobile (ui §6.5). */
export function ComposerDialog() {
  const { t } = useTranslation();
  const { open, momentId, prefill, session, close } = useComposer();
  const ref = useRef<HTMLDialogElement>(null);
  const dirty = useRef(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      dirty.current = false;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
      // showModal focuses the first control (✕); the text box is what people want.
      d.querySelector('textarea')?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  /** Esc / ✕: confirm before discarding a dirty draft. */
  const requestClose = () => (dirty.current ? setConfirm(true) : close());
  const onDirtyChange = useCallback((v: boolean) => {
    dirty.current = v;
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={momentId ? t('composer.editTitle') : t('composer.title')}
      // React re-propagates close/cancel from nested dialogs (the discard confirm); only handle our own.
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        requestClose();
      }}
      // Browsers may close a modal on Esc without a cancellable event (no recent user activation);
      // keep the store in sync if that happens.
      onClose={(e) => {
        if (e.target === e.currentTarget && useComposer.getState().open) close();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-bg p-0 text-text backdrop:bg-black/50 md:m-auto md:mt-[5vh] md:h-auto md:max-h-[90vh] md:w-[600px] md:rounded-2xl md:border md:border-border"
    >
      {open && (
        <div className="pt-safe flex flex-col">
          <div className="flex items-center gap-4 px-4 pt-3 pb-2">
            <IconButton label={t('common.close')} onClick={requestClose} className="-ml-2">
              <X size={20} aria-hidden />
            </IconButton>
            <h2 className="text-lg font-bold">
              {momentId ? t('composer.editTitle') : t('composer.title')}
            </h2>
          </div>
          <div className="px-4 pb-4">
            <Composer
              key={session}
              variant="modal"
              momentId={momentId}
              prefill={prefill}
              onDone={close}
              onDirtyChange={onDirtyChange}
            />
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title={t('composer.discard')}
        confirmLabel={t('common.discard')}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          close();
        }}
      />
    </dialog>
  );
}
