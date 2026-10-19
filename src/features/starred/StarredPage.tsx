import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { starredContacts, starredMoments, useLiveQuery } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { Feed } from '@/features/moments/Feed';

/** `/starred`: starred people row + starred moments feed (SPEC §6.7). */
export function StarredPage() {
  const { t } = useTranslation();
  const contacts = useLiveQuery(starredContacts, []);
  const moments = useLiveQuery(starredMoments, []);
  const empty = contacts?.length === 0 && moments?.length === 0;

  return (
    <>
      <PageHeader title={t('pages.starred')} />
      {empty && <p className="px-8 py-12 text-center text-muted">{t('starred.empty')}</p>}
      {!!contacts?.length && (
        <section aria-labelledby="starred-people" className="border-b border-border py-3">
          <h2 id="starred-people" className="px-4 pb-2 text-lg font-extrabold">
            {t('starred.contacts')}
          </h2>
          <ul className="flex gap-4 overflow-x-auto px-4 pb-1">
            {[...contacts]
              .sort((a, b) => fullName(a).localeCompare(fullName(b)))
              .map((c) => (
                <li key={c.id} className="shrink-0">
                  <Link
                    to={`/c/${c.id}`}
                    className="flex w-16 flex-col items-center gap-1 text-center"
                  >
                    <Avatar contact={c} size={56} />
                    <span className="w-full truncate text-xs">{c.firstName}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
      {!!moments?.length && (
        <section aria-labelledby="starred-moments">
          <h2 id="starred-moments" className="px-4 pt-3 pb-1 text-lg font-extrabold">
            {t('starred.moments')}
          </h2>
          <Feed moments={moments} />
        </section>
      )}
    </>
  );
}
