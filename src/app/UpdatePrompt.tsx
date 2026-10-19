import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToasts } from './stores/toast';

const TOAST_ID = 'sw-update';

/**
 * Shows "Update available — Reload" when a new SW is waiting (SPEC §9).
 * Never auto-reloads: the user decides, so an in-progress composition is never lost.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const show = useToasts((s) => s.show);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    show({
      id: TOAST_ID,
      message: t('pwa.updateAvailable'),
      duration: null,
      action: { label: t('pwa.reload'), onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, show, t, updateServiceWorker]);

  return null;
}
