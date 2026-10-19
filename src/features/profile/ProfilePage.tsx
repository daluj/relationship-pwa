import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Tabs } from '@/components/Tabs';
import { contactRepo, useLiveRecord } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { DetailsTab } from './DetailsTab';
import { ProfileHeader } from './ProfileHeader';
import { RemindersTab } from './RemindersTab';
import { TimelineTab } from './TimelineTab';
import { isProfileTab, profileTabs, tabMilestone } from './tabs';

/** Contact profile `/c/:id` and `/c/:id/:tab` (SPEC §6.6). */
export function ProfilePage() {
  const { id, tab } = useParams();
  const { t } = useTranslation();
  const contact = useLiveRecord(contactRepo, id);

  if (tab !== undefined && !isProfileTab(tab)) return <Navigate to={`/c/${id}`} replace />;
  const active = tab ?? 'timeline';

  if (contact === undefined) return null; // first local read
  if (contact === null) {
    return (
      <>
        <PageHeader title={t('pages.profile')} back />
        <p className="px-8 py-12 text-center text-muted">{t('profile.notFound')}</p>
      </>
    );
  }

  const milestone = tabMilestone[active];
  return (
    <>
      <PageHeader title={fullName(contact)} back />
      <ProfileHeader contact={contact} />
      <Tabs
        label={t('pages.profile')}
        active={active}
        items={profileTabs.map((id) => ({
          id,
          label: t(`profile.tabs.${id}`),
          to: id === 'timeline' ? `/c/${contact.id}` : `/c/${contact.id}/${id}`,
        }))}
        className="sticky top-[106px] z-10 border-b border-border bg-bg/80 backdrop-blur-md md:top-[53px]"
      />
      <div role="tabpanel" aria-label={t(`profile.tabs.${active}`)}>
        {active === 'details' ? (
          <DetailsTab contact={contact} />
        ) : active === 'timeline' ? (
          <TimelineTab contact={contact} />
        ) : active === 'reminders' ? (
          <RemindersTab contact={contact} />
        ) : (
          <p className="px-8 py-12 text-center text-muted">
            {t('placeholder.comingIn', { milestone: `M${milestone}` })}
          </p>
        )}
      </div>
    </>
  );
}
