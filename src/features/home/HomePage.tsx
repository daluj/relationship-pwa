import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { feed, useLiveQuery } from '@/db/repositories';
import type { MomentKind } from '@/domain/types';
import { Composer } from '@/features/compose/Composer';
import { Feed } from '@/features/moments/Feed';

const PAGE = 30; // features §8.4
const tabs = {
  all: undefined,
  activities: 'activity',
  notes: 'note',
  calls: 'call',
  journal: 'journal',
} as const;
type TabId = keyof typeof tabs;

/** Home timeline of your own moments, filterable by kind (mission §1.3, §6.1). */
export function HomePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>('all');
  const [limit, setLimit] = useState(PAGE);
  const kind: MomentKind | undefined = tabs[tab];
  const moments = useLiveQuery(() => feed({ kind, limit }), [kind, limit]);
  const hasMore = moments?.length === limit;
  const loadMore = useCallback(() => hasMore && setLimit((l) => l + PAGE), [hasMore]);

  return (
    <>
      <PageHeader
        title={t('home.title')}
        tabs={(Object.keys(tabs) as TabId[]).map((id) => ({ id, label: t(`home.tabs.${id}`) }))}
        activeTab={tab}
        onTabChange={(id) => {
          setTab(id as TabId);
          setLimit(PAGE);
        }}
      />
      <div className="hidden border-b border-border px-4 py-3 md:block">
        <Composer variant="inline" />
      </div>
      {moments && moments.length === 0 ? (
        <p className="px-8 py-12 text-center text-muted">
          {tab === 'all' ? t('feed.empty') : t('feed.emptyKind')}
        </p>
      ) : (
        <Feed moments={moments ?? []} onEndReached={loadMore} />
      )}
    </>
  );
}
