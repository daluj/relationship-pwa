import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { momentsForContact, useLiveQuery } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import type { Contact } from '@/domain/types';
import { Feed } from '@/features/moments/Feed';
import { Milestones } from '@/features/recall/Milestones';

/** Profile › Timeline: pinned first, then every moment mentioning this contact (ui §6.6). */
export function TimelineTab({ contact }: { contact: Contact }) {
  const { t } = useTranslation();
  const [view, setView] = useState<'all' | 'milestones'>('all');
  const moments = useLiveQuery(() => momentsForContact(contact.id), [contact.id]);
  if (!moments) return null;
  const filters = (
    <div
      role="group"
      aria-label={t('recall.view')}
      className="flex gap-2 border-b border-border px-4 py-2"
    >
      {(['all', 'milestones'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={`rounded-full border px-3 py-1 text-sm ${view === v ? 'border-accent bg-accent text-on-accent' : 'border-border hover:bg-surface-2'}`}
        >
          {t(`recall.views.${v}`)}
        </button>
      ))}
    </div>
  );
  if (view === 'milestones') {
    return (
      <>
        {filters}
        <Milestones contact={contact} />
      </>
    );
  }
  if (moments.length === 0) {
    return (
      <p className="px-8 py-12 text-center text-muted">
        {t('feed.timelineEmpty', { name: contact.firstName || fullName(contact) })}
      </p>
    );
  }
  return (
    <>
      {filters}
      <Feed moments={moments} showPinned />
    </>
  );
}
