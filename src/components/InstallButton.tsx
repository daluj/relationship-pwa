import { useTranslation } from 'react-i18next';
import { Download, Share } from 'lucide-react';
import { isIosSafari, isStandalone, useInstall } from '@/app/stores/install';
import { Button } from './Button';
import { Dialog } from './Dialog';

/** Whether to offer installing: Chromium's deferred prompt, or iOS Safari's manual flow. */
function useCanInstall() {
  const deferred = useInstall((s) => s.deferred);
  if (isStandalone()) return false;
  return !!deferred || isIosSafari();
}

/** Prompt (Chromium) or open the iOS instructions. */
const startInstall = () => {
  const { deferred, install } = useInstall.getState();
  if (deferred) void install();
  else useInstall.setState({ iosHelpOpen: true });
};

/**
 * "Install app" button (SPEC §9, onboarding and storage notes). Renders nothing when already installed or
 * not installable.
 */
export function InstallButton({
  variant = 'outline',
}: {
  variant?: 'primary' | 'outline' | 'ghost';
}) {
  const { t } = useTranslation();
  if (!useCanInstall()) return null;
  return (
    <Button variant={variant} onClick={startInstall}>
      <Download size={16} aria-hidden /> {t('install.button')}
    </Button>
  );
}

/** "Install app" entry for the left-nav More menu (SPEC §9). */
export function InstallMenuItem() {
  const { t } = useTranslation();
  if (!useCanInstall()) return null;
  return (
    <button
      type="button"
      role="menuitem"
      onClick={startInstall}
      className="flex w-full items-center gap-3 px-4 py-3 text-left font-bold hover:bg-surface-1"
    >
      <Download size={20} aria-hidden /> {t('install.button')}
    </button>
  );
}

/** iOS "Share → Add to Home Screen" sheet; rendered once at the app root. */
export function IosInstallDialog() {
  const { t } = useTranslation();
  const open = useInstall((s) => s.iosHelpOpen);
  return (
    <Dialog
      open={open}
      onClose={() => useInstall.setState({ iosHelpOpen: false })}
      title={t('install.iosTitle')}
    >
      <p className="flex items-center gap-2">
        <Share size={18} className="shrink-0 text-accent-text" aria-hidden />{' '}
        {t('install.iosSteps')}
      </p>
      <p className="mt-2 text-sm text-muted">{t('install.iosWhy')}</p>
    </Dialog>
  );
}
