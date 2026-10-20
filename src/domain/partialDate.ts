import { differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';
import type { PartialDate } from './schemas';

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Local Date for `pd` in `year`; Feb 29 falls back to Feb 28 in non-leap years (features §8.5). */
export function inYear(pd: PartialDate, year: number): Date {
  const day = pd.month === 2 && pd.day === 29 && !isLeapYear(year) ? 28 : pd.day;
  return new Date(year, pd.month - 1, day);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Next occurrence of a yearly partial date, today included. */
export function nextOccurrence(pd: PartialDate, today: Date): Date {
  const t = startOfDay(today);
  const thisYear = inYear(pd, t.getFullYear());
  return thisYear >= t ? thisYear : inYear(pd, t.getFullYear() + 1);
}

/** Age in whole years on `date`, or undefined when the year is unknown. */
export function ageOn(pd: PartialDate, date: Date): number | undefined {
  if (pd.year === undefined) return undefined;
  const birthdayThisYear = inYear(pd, date.getFullYear());
  return date.getFullYear() - pd.year - (startOfDay(date) < birthdayThisYear ? 1 : 0);
}

/** `YYYY-MM-DD` in local time. */
export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "March 18" / "March 18, 1987" localized. */
export function formatPartialDate(pd: PartialDate, locale: string): string {
  const d = inYear(pd, pd.year ?? 2000);
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    ...(pd.year !== undefined && { year: 'numeric' }),
  }).format(d);
}

/** Relative phrase from `today` to `target` ("tomorrow", "in 12 days", "in 7 months"). */
export function formatRelativeDay(target: Date, today: Date, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const days = differenceInCalendarDays(target, today);
  if (Math.abs(days) < 31) return rtf.format(days, 'day');
  const months = differenceInCalendarMonths(target, today);
  if (Math.abs(months) < 12) return rtf.format(months, 'month');
  return rtf.format(Math.round(months / 12), 'year');
}

/** Converts form inputs to a PartialDate; `null` when blank, `'invalid'` when incomplete. */
export function partialDateFromParts(
  day: string,
  month: string,
  year: string,
): PartialDate | null | 'invalid' {
  if (!day && !month && !year) return null;
  if (!day || !month) return 'invalid';
  const pd: PartialDate = { day: Number(day), month: Number(month) };
  if (year) pd.year = Number(year);
  const valid =
    Number.isInteger(pd.day) &&
    Number.isInteger(pd.month) &&
    pd.month >= 1 &&
    pd.month <= 12 &&
    (pd.year === undefined || (Number.isInteger(pd.year) && pd.year > 0 && pd.year < 10000)) &&
    pd.day >= 1 &&
    pd.day <= new Date(pd.year ?? 2000, pd.month, 0).getDate();
  return valid ? pd : 'invalid';
}
