import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import {
  listTrashedContacts,
  purgeContact,
  restoreContact,
  TRASH_RETENTION_DAYS,
  useLiveQuery,
} from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { formatRelativeDay } from '@/domain/partialDate';
import type { Contact } from '@/domain/types';
import { ContactRow } from '@/features/contacts/ContactRow';

/** Settings › Trash (SPEC §6.7): restore or delete forever. Moments and other items join later. */
export function TrashPage() {
  const { t, i18n } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const contacts = useLiveQuery(listTrashedContacts, []);
  const [confirm, setConfirm] = useState<Contact | null>(null);
  const now = new Date();

  const restore = async (c: Contact) => {
    await restoreContact(c.id);
    showToast({ message: t('trash.restored', { name: fullName(c) }) });
  };

  return (
    <>
      <PageHeader title={t('pages.trash')} back />
      <p className="border-b border-border px-4 py-3 text-sm text-muted">
        {t('trash.intro', { days: TRASH_RETENTION_DAYS })}
      </p>
      {contacts && contacts.length === 0 && (
        <p className="px-8 py-12 text-center text-muted">{t('trash.empty')}</p>
      )}
      <ul>
        {contacts?.map((c) => {
          const deleted = new Date(c.deletedAt!);
          const purgeAt = new Date(deleted.getTime() + TRASH_RETENTION_DAYS * 86_400_000);
          return (
            <li key={c.id} className="border-b border-border">
              <ContactRow
                contact={c}
                linkTo={null}
                secondary={
                  <p className="text-sm text-muted">
                    {t('trash.deletedAgo', {
                      relative: formatRelativeDay(deleted, now, i18n.language),
                    })}{' '}
                    ·{' '}
                    {t('trash.purgeIn', {
                      relative: formatRelativeDay(purgeAt, now, i18n.language),
                    })}
                  </p>
                }
                actions={
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => void restore(c)}>
                      {t('common.restore')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setConfirm(c)}>
                      {t('trash.deleteForever')}
                    </Button>
                  </div>
                }
              />
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!confirm}
        title={t('trash.confirmTitle')}
        message={confirm ? t('trash.confirmBody', { name: fullName(confirm) }) : ''}
        confirmLabel={t('trash.deleteForever')}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void purgeContact(confirm.id);
          setConfirm(null);
        }}
      />
    </>
  );
}
