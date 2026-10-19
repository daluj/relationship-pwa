import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import {
  listTrashedContacts,
  listTrashedMoments,
  purgeContact,
  purgeMoment,
  restoreContact,
  restoreMoment,
  TRASH_RETENTION_DAYS,
  useLiveQuery,
} from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { bodyToPlainText } from '@/domain/momentText';
import { formatRelativeDay } from '@/domain/partialDate';
import type { Contact, Moment } from '@/domain/types';
import { ContactRow } from '@/features/contacts/ContactRow';
import { kindIcon } from '@/features/moments/kindMeta';

type Pending = { kind: 'contact'; item: Contact } | { kind: 'moment'; item: Moment } | null;

/** Settings › Trash (SPEC §6.7): restore or delete forever; auto-purged after 30 days. */
export function TrashPage() {
  const { t, i18n } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const contacts = useLiveQuery(listTrashedContacts, []);
  const moments = useLiveQuery(listTrashedMoments, []);
  const [pending, setPending] = useState<Pending>(null);
  const now = new Date();

  const when = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const purgeAt = new Date(deleted.getTime() + TRASH_RETENTION_DAYS * 86_400_000);
    return `${t('trash.deletedAgo', { relative: formatRelativeDay(deleted, now, i18n.language) })} · ${t('trash.purgeIn', { relative: formatRelativeDay(purgeAt, now, i18n.language) })}`;
  };

  const actions = (onRestore: () => void, onDelete: () => void) => (
    <div className="flex shrink-0 flex-wrap justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onRestore}>
        {t('common.restore')}
      </Button>
      <Button variant="danger" size="sm" onClick={onDelete}>
        {t('trash.deleteForever')}
      </Button>
    </div>
  );

  const loaded = contacts && moments;
  const empty = loaded && contacts.length === 0 && moments.length === 0;

  return (
    <>
      <PageHeader title={t('pages.trash')} back />
      <p className="border-b border-border px-4 py-3 text-sm text-muted">
        {t('trash.intro', { days: TRASH_RETENTION_DAYS })}
      </p>
      {empty && <p className="px-8 py-12 text-center text-muted">{t('trash.empty')}</p>}

      {!!contacts?.length && (
        <Section title={t('trashSections.contacts')}>
          {contacts.map((c) => (
            <li key={c.id} className="border-b border-border">
              <ContactRow
                contact={c}
                linkTo={null}
                secondary={<p className="text-sm text-muted">{when(c.deletedAt!)}</p>}
                actions={actions(
                  () =>
                    void restoreContact(c.id).then(() =>
                      showToast({ message: t('trash.restored', { name: fullName(c) }) }),
                    ),
                  () => setPending({ kind: 'contact', item: c }),
                )}
              />
            </li>
          ))}
        </Section>
      )}

      {!!moments?.length && (
        <Section title={t('trashSections.moments')}>
          {moments.map((m) => {
            const Icon = kindIcon(m);
            return (
              <li key={m.id} className="flex items-start gap-3 border-b border-border px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
                  <Icon size={18} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2">
                    {bodyToPlainText(m.body) || t(`moment.kinds.${m.kind}`)}
                  </p>
                  <p className="text-sm text-muted">{when(m.deletedAt!)}</p>
                </div>
                {actions(
                  () =>
                    void restoreMoment(m.id).then(() =>
                      showToast({ message: t('trashMoment.restored') }),
                    ),
                  () => setPending({ kind: 'moment', item: m }),
                )}
              </li>
            );
          })}
        </Section>
      )}

      <ConfirmDialog
        open={!!pending}
        title={t('trash.confirmTitle')}
        message={
          pending?.kind === 'contact'
            ? t('trash.confirmBody', { name: fullName(pending.item) })
            : t('trashMoment.confirmBody')
        }
        confirmLabel={t('trash.deleteForever')}
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending?.kind === 'contact') void purgeContact(pending.item.id);
          if (pending?.kind === 'moment') void purgeMoment(pending.item.id);
          setPending(null);
        }}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-4 pt-4 pb-2 text-lg font-extrabold">{title}</h2>
      <ul>{children}</ul>
    </section>
  );
}
