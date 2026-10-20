import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { inputClass } from '@/components/form/fieldClass';
import { importBackup } from '@/db/repositories';
import type { ParsedBackup } from '@/domain/backup';

/** Restore a JSON backup: Merge, or Replace all with typed confirmation (features §8.9). */
export function RestoreDialog({
  backup,
  onClose,
}: {
  backup: ParsedBackup | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setMode('merge');
    setTyped('');
  }, [backup]);
  if (!backup) return null;

  const word = t('restore.replaceWord');
  const canRestore = !busy && (mode === 'merge' || typed.trim() === word);
  const restore = async () => {
    setBusy(true);
    try {
      const s = await importBackup(backup, mode);
      showToast({ message: t('restore.done', { added: s.added, updated: s.updated }) });
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const live = (rows: unknown[]) =>
    rows.filter((r) => !(r as { deletedAt?: string }).deletedAt).length;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('restore.title')}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={mode === 'replace' ? 'danger' : 'primary'}
            disabled={!canRestore}
            onClick={() => void restore()}
          >
            {t('restore.restore')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-bold">
            {t('restore.summary', {
              date: new Intl.DateTimeFormat(i18n.language, {
                dateStyle: 'long',
                timeStyle: 'short',
              }).format(new Date(backup.meta.exportedAt)),
            })}
          </p>
          <p className="text-sm text-muted">
            {t('restore.counts', {
              contacts: live(backup.contacts),
              moments: live(backup.moments),
              reminders: live(backup.reminders),
            })}
          </p>
          {!backup.meta.includesPhotos && (
            <p className="text-sm text-muted">{t('restore.noPhotos')}</p>
          )}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-bold">{t('restore.mode')}</legend>
          {(['merge', 'replace'] as const).map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer gap-3 rounded-md border p-3 ${mode === m ? 'border-accent' : 'border-border'}`}
            >
              <input
                type="radio"
                name="restore-mode"
                checked={mode === m}
                onChange={() => setMode(m)}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>
                <span className="block font-bold">{t(`restore.${m}`)}</span>
                <span className="block text-sm text-muted">{t(`restore.${m}Hint`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {mode === 'replace' && (
          <label className="text-sm font-bold text-muted">
            {t('data.typeToConfirm', { word })}
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className={`${inputClass} mt-1 font-normal text-text`}
            />
          </label>
        )}
      </div>
    </Dialog>
  );
}
