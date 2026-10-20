import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/Dialog';
import { shortcuts } from '../useGlobalShortcuts';

/** `?` — list of keyboard shortcuts (ui §6.9). */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} title={t('shortcuts.title')}>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2">
        {shortcuts.map(({ keys, action }) => (
          <Fragment key={action}>
            <dt className="flex items-center gap-1 text-sm">
              {keys.map((k, i) => (
                <Fragment key={k}>
                  {i > 0 && <span className="text-muted">{t('shortcuts.then')}</span>}
                  <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
                    {k}
                  </kbd>
                </Fragment>
              ))}
            </dt>
            <dd>{t(`shortcuts.actions.${action}`)}</dd>
          </Fragment>
        ))}
      </dl>
    </Dialog>
  );
}
