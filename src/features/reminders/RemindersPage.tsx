import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { CalendarPlus, Plus } from 'lucide-react';
import { useToday } from '@/app/useToday';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { listReminders, useLiveQuery } from '@/db/repositories';
import { compareReminders, groupOf, isOpen, type ReminderGroup } from '@/domain/reminders';
import type { Reminder } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';
import { exportIcs } from './reminderIcs';
import { ReminderDialog } from './ReminderDialog';
import { ReminderRow } from './ReminderRow';

const tabs = ['upcoming', 'overdue', 'done'] as const;
type Tab = (typeof tabs)[number];
const upcomingGroups: ReminderGroup[] = ['today', 'week', 'month', 'later'];

/** `/reminders`: Upcoming · Overdue · Done, grouped by when (SPEC §6.7). */
export function RemindersPage() {
  const { t } = useTranslation();
  const lookup = useLookup();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (tabs as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'upcoming';
  const all = useLiveQuery(listReminders, []);
  const [editing, setEditing] = useState<Reminder | null | undefined>(undefined); // null = new

  const { groups, overdue, done, recurring } = useMemo(() => {
    const open = (all ?? []).filter(isOpen).sort(compareReminders);
    const byGroup = new Map<ReminderGroup, Reminder[]>();
    for (const r of open) {
      const g = groupOf(r, today);
      byGroup.set(g, [...(byGroup.get(g) ?? []), r]);
    }
    return {
      groups: byGroup,
      overdue: byGroup.get('overdue') ?? [],
      done: (all ?? [])
        .filter((r) => r.completedAt)
        .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!)),
      recurring: open.filter((r) => r.recurrence !== 'none'),
    };
  }, [all, today]);

  const list = (items: Reminder[]) => (
    <ul>
      {items.map((r) => (
        <ReminderRow key={r.id} reminder={r} today={today} onEdit={setEditing} />
      ))}
    </ul>
  );
  const empty = (key: Tab) => (
    <p className="px-8 py-12 text-center text-muted">{t(`reminders.empty.${key}`)}</p>
  );

  return (
    <>
      <PageHeader
        title={t('pages.reminders')}
        tabs={tabs.map((id) => ({
          id,
          label:
            id === 'overdue' && overdue.length
              ? `${t('reminders.tabs.overdue')} (${overdue.length})`
              : t(`reminders.tabs.${id}`),
        }))}
        activeTab={tab}
        onTabChange={(id) => setParams(id === 'upcoming' ? {} : { tab: id }, { replace: true })}
        actions={
          <Button size="sm" onClick={() => setEditing(null)}>
            <Plus size={16} aria-hidden />
            <span className="hidden sm:inline">{t('reminders.new')}</span>
            <span className="sr-only sm:hidden">{t('reminders.new')}</span>
          </Button>
        }
      />
      {all &&
        (tab === 'upcoming'
          ? upcomingGroups.some((g) => groups.get(g)?.length)
            ? upcomingGroups.map((g) =>
                groups.get(g)?.length ? (
                  <section key={g} aria-labelledby={`group-${g}`}>
                    <h2 id={`group-${g}`} className="bg-surface-1 px-4 py-2 text-sm font-extrabold">
                      {t(`reminders.groups.${g}`)}
                    </h2>
                    {list(groups.get(g)!)}
                  </section>
                ) : null,
              )
            : empty('upcoming')
          : tab === 'overdue'
            ? overdue.length
              ? list(overdue)
              : empty('overdue')
            : done.length
              ? list(done)
              : empty('done'))}

      {recurring.length > 0 && tab === 'upcoming' && (
        <div className="flex justify-center px-4 py-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportIcs(recurring, lookup.contact, t)}
          >
            <CalendarPlus size={16} aria-hidden /> {t('reminders.actions.exportAll')}
          </Button>
        </div>
      )}

      <ReminderDialog
        open={editing !== undefined}
        reminder={editing ?? undefined}
        onClose={() => setEditing(undefined)}
      />
    </>
  );
}
