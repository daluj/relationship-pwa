import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { momentRepo, useLiveRecord } from '@/db/repositories';
import type { Contact } from '@/domain/types';
import { ContactRow } from '@/features/contacts/ContactRow';
import { useLookup } from './useLookup';
import { MomentCard } from './MomentCard';

/** `/moment/:id`: full text, full-size photos and linked contacts (ui §6.4). */
export function MomentPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const lookup = useLookup();
  const moment = useLiveRecord(momentRepo, id);

  if (moment === undefined) return null;
  if (moment === null) {
    return (
      <>
        <PageHeader title={t('pages.moment')} back />
        <p className="px-8 py-12 text-center text-muted">{t('moment.notFound')}</p>
      </>
    );
  }
  const people = moment.contactIds
    .map((cid) => lookup.contact(cid))
    .filter((c): c is Contact => !!c);
  return (
    <>
      <PageHeader title={t('pages.moment')} back />
      <MomentCard moment={moment} detail />
      {people.length > 0 && (
        <section aria-labelledby="moment-people">
          <h2 id="moment-people" className="px-4 pt-4 pb-1 text-lg font-extrabold">
            {t('moment.people')}
          </h2>
          <ul>
            {people.map((c) => (
              <li key={c.id}>
                <ContactRow contact={c} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
