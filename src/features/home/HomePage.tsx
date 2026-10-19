import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';

const tabIds = ['all', 'activities', 'notes', 'calls', 'journal'] as const;

/** Home feed. Tabs filter by moment kind; the feed itself arrives in M3. */
export function HomePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<string>('all');
  return (
    <>
      <PageHeader
        title={t('home.title')}
        tabs={tabIds.map((id) => ({ id, label: t(`home.tabs.${id}`) }))}
        activeTab={tab}
        onTabChange={setTab}
      />
      <section className="px-8 py-12 text-center text-muted">
        {t('placeholder.comingIn', { milestone: 'M3' })}
      </section>
    </>
  );
}
