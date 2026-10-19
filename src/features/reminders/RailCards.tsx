import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useComposer } from '@/app/stores/composer';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { fullName } from '@/domain/contact';
import { formatRelativeDay, toIsoDate } from '@/domain/partialDate';
import { parseIsoDate } from '@/domain/recurrence';
import { compareReminders, effectiveDate, isOpen } from '@/domain/reminders';
import { useLookup } from '@/features/moments/useLookup';
import { reminderTitle } from './reminderText';
import { useDueReminders } from './useDueReminders';

export function RailCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-surface-2"
      aria-label={title}
    >
      <h2 className="px-4 pt-3 pb-1 text-xl font-extrabold">{title}</h2>
      <div className="pb-2">{children}</div>
      {footer}
    </section>
  );
}

/** Right rail "Upcoming": next 5 birthdays/reminders (SPEC §6.1). */
export function UpcomingCard() {
  const { t, i18n } = useTranslation();
  const lookup = useLookup();
  const { all, today } = useDueReminders();
  const limit = toIsoDate(today);
  const next = (all ?? [])
    .filter((r) => isOpen(r) && r.source !== 'stay-in-touch' && effectiveDate(r) >= limit)
    .sort(compareReminders)
    .slice(0, 5);

  return (
    <RailCard
      title={t('rail.upcoming')}
      footer={
        next.length > 0 && (
          <Link
            to="/reminders"
            className="block px-4 py-3 text-sm text-accent-text hover:bg-surface-1"
          >
            {t('reminders.showAll')}
          </Link>
        )
      }
    >
      {next.length === 0 ? (
        <p className="px-4 pb-2 text-muted">{t('rail.upcomingEmpty')}</p>
      ) : (
        <ul>
          {next.map((r) => {
            const c = r.contactId ? lookup.contact(r.contactId) : undefined;
            return (
              <li key={r.id}>
                <Link
                  to={c ? `/c/${c.id}` : '/reminders'}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-surface-1"
                >
                  {c ? (
                    <Avatar contact={c} size={32} />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-tint text-accent-text">
                      <Bell size={16} aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{reminderTitle(r, c, t)}</p>
                    <p className="text-xs text-muted">
                      {formatRelativeDay(parseIsoDate(effectiveDate(r)), today, i18n.language)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </RailCard>
  );
}

/**
 * Right rail "Reach out": stay-in-touch reminders that are due, max 3, each with "Log" where X has
 * "Follow" (SPEC §6.1). Ordered by due date only — never a ranking of people.
 */
export function ReachOutCard() {
  const { t, i18n } = useTranslation();
  const lookup = useLookup();
  const openComposer = useComposer((s) => s.openComposer);
  const { due, today } = useDueReminders();
  const people = due
    .filter((r) => r.source === 'stay-in-touch' && r.contactId)
    .map((r) => lookup.contact(r.contactId!))
    .filter((c) => c && !c.isArchived)
    .slice(0, 3);

  return (
    <RailCard title={t('rail.reachOut')}>
      {people.length === 0 ? (
        <p className="px-4 pb-2 text-muted">{t('rail.reachOutEmpty')}</p>
      ) : (
        <ul>
          {people.map((c) => (
            <li key={c!.id} className="flex items-center gap-3 px-4 py-2">
              <Link to={`/c/${c!.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar contact={c!} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-bold">{fullName(c!)}</p>
                  <p className="truncate text-xs text-muted">
                    {c!.lastInteractionAt
                      ? t('profile.lastSpoke', {
                          relative: formatRelativeDay(
                            new Date(c!.lastInteractionAt),
                            today,
                            i18n.language,
                          ),
                        })
                      : t('reminders.neverSpoke')}
                  </p>
                </div>
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openComposer({ prefill: { contactIds: [c!.id] } })}
              >
                {t('rail.log')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </RailCard>
  );
}
