/**
 * Compact X-style timestamp (SPEC §6.4/§12): "5m ago" / "hace 2 h" under a week,
 * then "Mar 18", or "Mar 18, 2024" for other years.
 */
export function shortRelative(date: Date, now: Date, locale: string): string {
  const diffSec = Math.round((now.getTime() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { style: 'narrow', numeric: 'always' });
  if (diffSec >= 0) {
    if (diffSec < 60) return rtf.format(-Math.max(1, diffSec), 'second');
    if (diffSec < 3600) return rtf.format(-Math.floor(diffSec / 60), 'minute');
    if (diffSec < 86_400) return rtf.format(-Math.floor(diffSec / 3600), 'hour');
    if (diffSec < 7 * 86_400) return rtf.format(-Math.floor(diffSec / 86_400), 'day');
  }
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  }).format(date);
}

/** Full localized date + time for tooltips. */
export function fullDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(date);
}

/** `YYYY-MM-DDTHH:mm` in local time, for `<input type="datetime-local">`. */
export function toDateTimeLocal(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}
