import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { groupMemberCounts, listGroups, useLiveQuery } from '@/db/repositories';
import { avatarPalette } from '@/domain/contact';
import { GroupDialog } from './GroupDialog';

/** `/groups`: like X Lists — banner color + emoji, name, member count (SPEC §6.7). */
export function GroupsPage() {
  const { t } = useTranslation();
  const groups = useLiveQuery(listGroups, []);
  const counts = useLiveQuery(groupMemberCounts, []);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title={t('pages.groups')}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden /> {t('groups.new')}
          </Button>
        }
      />
      {groups && groups.length === 0 && (
        <p className="px-8 py-12 text-center text-muted">{t('groups.empty')}</p>
      )}
      <ul>
        {groups?.map((g) => (
          <li key={g.id}>
            <Link
              to={`/groups/${g.id}`}
              className="flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-surface-1"
            >
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{ backgroundColor: g.bannerColor ?? avatarPalette[0] }}
              >
                {g.emoji ?? '👥'}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold">{g.name}</p>
                <p className="text-sm text-muted">
                  {t('groups.members', { count: counts?.[g.id] ?? 0 })}
                </p>
                {g.description && <p className="truncate text-sm">{g.description}</p>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <GroupDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
