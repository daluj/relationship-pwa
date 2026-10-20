import { inYear, toIsoDate } from './partialDate';
import type { PartialDate, Reminder } from './types';

export type Recurrence = Reminder['recurrence'];

/** Parses `YYYY-MM-DD` (or the date part of an ISO datetime) as a local date. */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

/**
 * Adds `n` recurrence units to a date (features §8.5): month-end clamping (Jan 31 + 1 month → Feb 28/29),
 * Feb 29 + 1 year → Feb 28 in non-leap years.
 */
export function addRecurrence(date: Date, rule: Exclude<Recurrence, 'none'>, n = 1): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  switch (rule) {
    case 'daily':
      return new Date(y, m, d + n);
    case 'weekly':
      return new Date(y, m, d + 7 * n);
    case 'monthly': {
      const total = m + n;
      const ny = y + Math.floor(total / 12);
      const nm = ((total % 12) + 12) % 12;
      return new Date(ny, nm, Math.min(d, daysInMonth(ny, nm)));
    }
    case 'yearly':
      return new Date(y + n, m, Math.min(d, daysInMonth(y + n, m)));
  }
}

/** Next occurrence strictly after `today` (advances at least once). */
export function nextRecurringDate(
  dueDate: string,
  rule: Exclude<Recurrence, 'none'>,
  interval: number,
  today: Date,
): string {
  const limit = toIsoDate(today);
  let d = addRecurrence(parseIsoDate(dueDate), rule, interval);
  // Bounded: daily reminders years overdue still converge quickly enough.
  for (let i = 0; i < 100_000 && toIsoDate(d) <= limit; i++) d = addRecurrence(d, rule, interval);
  return toIsoDate(d);
}

/**
 * Reminder date for a yearly partial date with a lead time (important dates, features §8.5):
 * the earliest `occurrence − daysBefore` that is on/after `from` (or strictly after when `after`).
 */
export function yearlyReminderDate(
  pd: PartialDate,
  daysBefore: number,
  from: Date,
  after = false,
): string {
  const limit = toIsoDate(from);
  for (let y = from.getFullYear() - 1; y <= from.getFullYear() + 2; y++) {
    const occ = inYear(pd, y);
    const remind = toIsoDate(
      new Date(occ.getFullYear(), occ.getMonth(), occ.getDate() - daysBefore),
    );
    if (after ? remind > limit : remind >= limit) return remind;
  }
  /* c8 ignore next */
  throw new Error('unreachable');
}

/** Adds whole days to an ISO date. */
export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}
