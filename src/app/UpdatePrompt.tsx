import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { logError } from '@/lib/diagnostics';
import { useComposer } from './stores/composer';
import { useToasts } from './stores/toast';

const TOAST_ID = 'sw-update';

/**
 * Shows "Update available — Reload" when a new SW is waiting (pwa §9).
 * Never auto-reloads, and the prompt waits while the composer is open, so a draft can't be lost by
 * reloading mid-composition.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const show = useToasts((s) => s.show);
  const dismiss = useToasts((s) => s.dismiss);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Kept in the local diagnostics log (tech-stack §11); e.g. a registration interrupted by navigation.
    onRegisterError: (e: unknown) =>
      logError({
        kind: 'error',
        message: `Service worker registration: ${e instanceof Error ? e.message : String(e)}`,
      }),
  });

  const composing = useComposer((st) => st.open);
  useEffect(() => {
    if (!needRefresh) return;
    if (composing) return dismiss(TOAST_ID);
    show({
      id: TOAST_ID,
      message: t('pwa.updateAvailable'),
      duration: null,
      action: { label: t('pwa.reload'), onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, composing, show, dismiss, t, updateServiceWorker]);

  return null;
}
