import { useTranslation } from 'react-i18next';
import { momentsForContact, useLiveQuery } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import type { Contact } from '@/domain/types';
import { Feed } from '@/features/moments/Feed';

/** Profile › Timeline: pinned first, then every moment mentioning this contact (ui §6.6). */
export function TimelineTab({ contact }: { contact: Contact }) {
  const { t } = useTranslation();
  const moments = useLiveQuery(() => momentsForContact(contact.id), [contact.id]);
  if (!moments) return null;
  if (moments.length === 0) {
    return (
      <p className="px-8 py-12 text-center text-muted">
        {t('feed.timelineEmpty', { name: contact.firstName || fullName(contact) })}
      </p>
    );
  }
  return <Feed moments={moments} showPinned />;
}
