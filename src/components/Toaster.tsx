import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';

/** Bottom-center toasts on the accent color (ui §6.9). */
export function Toaster() {
  const { t } = useTranslation();
  const { toasts, dismiss } = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-center gap-3 rounded-md bg-accent px-4 py-3 text-sm text-on-accent shadow-lg"
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="font-bold underline underline-offset-2"
              onClick={() => {
                toast.action?.onClick();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" aria-label={t('pwa.dismiss')} onClick={() => dismiss(toast.id)}>
            <X size={16} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
