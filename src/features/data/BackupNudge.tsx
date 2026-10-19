import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { HardDriveDownload } from 'lucide-react';
import { useToday } from '@/app/useToday';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { dataSince, settingsRepo, useLiveQuery, useSettingsQuery } from '@/db/repositories';
import { downloadBackup } from './backupDownload';

const DAYS_30 = 30 * 86_400_000;

/**
 * "Back up your data" banner (SPEC §8.9): when data exists and nothing was exported in 30 days.
 * Dismissing hides it for 30 days. Important because browsers may evict local storage.
 */
export function BackupNudge() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const today = useToday();
  const showToast = useToasts((s) => s.show);
  const settings = useSettingsQuery();
  const since = useLiveQuery(dataSince, []);
  if (!settings || !since || pathname.startsWith('/settings/data')) return null;

  const now = today.getTime();
  const old = (iso?: string) => !iso || now - new Date(iso).getTime() > DAYS_30;
  const due = old(settings.lastBackupAt ?? since) && old(settings.backupNudgeDismissedAt);
  if (!due) return null;

  const backUp = async () => {
    if (await downloadBackup(true)) showToast({ message: t('data.exported') });
  };

  return (
    <div
      role="region"
      aria-label={t('nudge.title')}
      className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-1 px-4 py-3 text-sm"
    >
      <HardDriveDownload size={20} className="shrink-0 text-accent-text" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t('nudge.title')}</p>
        <p className="text-muted">{t('nudge.body')}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void settingsRepo.set('backupNudgeDismissedAt', new Date().toISOString())}
        >
          {t('nudge.later')}
        </Button>
        <Button size="sm" onClick={() => void backUp()}>
          {t('nudge.now')}
        </Button>
      </div>
    </div>
  );
}
