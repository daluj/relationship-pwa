import { differenceInCalendarDays } from 'date-fns';
import { toIsoDate } from './partialDate';
import { parseIsoDate } from './recurrence';
import type { Reminder } from './types';

/** The date a reminder is currently due: its snooze date if snoozed, else its due date. */
export const effectiveDate = (r: Pick<Reminder, 'dueDate' | 'snoozedUntil'>) =>
  (r.snoozedUntil ?? r.dueDate).slice(0, 10);

export const isOpen = (r: Reminder) => !r.completedAt && !r.deletedAt;

export type ReminderGroup = 'overdue' | 'today' | 'week' | 'month' | 'later';

/**
 * Groups for the Reminders page (ui §6.7): Today / This week (next 6 days) / This month
 * (within 30 days) / Later; anything before today is overdue.
 */
export function groupOf(r: Reminder, today: Date): ReminderGroup {
  const days = differenceInCalendarDays(parseIsoDate(effectiveDate(r)), today);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days < 7) return 'week';
  if (days <= 30) return 'month';
  return 'later';
}

/** Open reminders due today or earlier — the nav/app badge count (ui §6.7, §8.5). */
export function dueReminders(reminders: Reminder[], today: Date): Reminder[] {
  const limit = toIsoDate(today);
  return reminders.filter((r) => isOpen(r) && effectiveDate(r) <= limit);
}

/** Due and not yet notified for its current due date (features §8.5 `lastNotifiedAt`). */
export function needsNotification(r: Reminder, today: Date): boolean {
  if (!isOpen(r) || effectiveDate(r) > toIsoDate(today)) return false;
  return !r.lastNotifiedAt || toIsoDate(new Date(r.lastNotifiedAt)) < effectiveDate(r);
}

/** Sort by effective date, then time (untimed first), then title. */
export function compareReminders(a: Reminder, b: Reminder): number {
  return (
    effectiveDate(a).localeCompare(effectiveDate(b)) ||
    (a.dueTime ?? '').localeCompare(b.dueTime ?? '') ||
    a.title.localeCompare(b.title)
  );
}
