import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive } from 'lucide-react';
import { isIosSafari, isStandalone } from '@/app/stores/install';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { InstallButton } from '@/components/InstallButton';
import { loadDemoData, removeDemoData, useSettings } from '@/db/repositories';

const formatBytes = (n: number, locale: string) => {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: units[i],
    maximumFractionDigits: n < 10 && i > 0 ? 1 : 0,
  }).format(n);
};

/** Settings › Your data › Storage (SPEC §8.10) and demo data removal (SPEC §8.1). */
export function StorageSection() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const showToast = useToasts((s) => s.show);
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setEstimate((await navigator.storage?.estimate?.()) ?? {});
    setPersisted((await navigator.storage?.persisted?.()) ?? null);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh, settings.demo]);

  const request = async () => {
    const ok = (await navigator.storage?.persist?.()) ?? false;
    setDenied(!ok);
    void refresh();
  };

  return (
    <>
      <section className="border-b border-border px-4 py-5" aria-labelledby="storage-title">
        <h2 id="storage-title" className="mb-2 flex items-center gap-2 text-lg font-extrabold">
          <HardDrive size={18} aria-hidden /> {t('storage.title')}
        </h2>
        <p className="mb-2 text-sm" data-testid="storage-usage">
          {estimate?.usage !== undefined && estimate.quota
            ? t('storage.usage', {
                used: formatBytes(estimate.usage, i18n.language),
                quota: formatBytes(estimate.quota, i18n.language),
              })
            : t('storage.usageUnknown')}
        </p>
        {persisted !== null && (
          <p className="mb-3 text-sm text-muted" data-testid="storage-persisted">
            {persisted ? t('storage.persisted') : t('storage.notPersisted')}
          </p>
        )}
        {persisted === false && (
          <Button size="sm" variant="outline" onClick={() => void request()}>
            {t('storage.request')}
          </Button>
        )}
        {denied && <p className="mt-2 text-sm text-muted">{t('storage.denied')}</p>}
        {isIosSafari() && !isStandalone() && (
          <div className="mt-3 rounded-md border border-border bg-surface-1 p-3 text-sm">
            <p className="mb-2">{t('storage.ios')}</p>
            <InstallButton />
          </div>
        )}
      </section>

      <section className="border-b border-border px-4 py-5" aria-labelledby="demo-title">
        <h2 id="demo-title" className="mb-1 text-lg font-extrabold">
          {t('demoData.title')}
        </h2>
        {settings.demo ? (
          <>
            <p className="mb-3 text-sm text-muted">{t('demoData.body')}</p>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await removeDemoData();
                setBusy(false);
                showToast({ message: t('demoData.removed') });
              }}
            >
              {t('demoData.remove')}
            </Button>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">{t('onboarding.demoHint')}</p>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await loadDemoData(settings.locale);
                setBusy(false);
              }}
            >
              {busy ? t('onboarding.loadingDemo') : t('onboarding.demo')}
            </Button>
          </>
        )}
      </section>
    </>
  );
}
