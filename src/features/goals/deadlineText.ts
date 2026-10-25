import type { TFunction } from 'i18next';
import { daysLeft } from '@/domain/goals';
import { parseIsoDate } from '@/domain/recurrence';

/** "Due Jun 3 · in 12 days" / "Overdue since Jun 3" for a goal deadline. */
export function deadlineText(deadline: string, today: Date, locale: string, t: TFunction): string {
  const date = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: parseIsoDate(deadline).getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  }).format(parseIsoDate(deadline));
  const days = daysLeft(deadline, today);
  if (days < 0) return t('goals.deadline.overdue', { date });
  if (days === 0) return t('goals.deadline.today', { date });
  return t('goals.deadline.due', { date, count: days });
}
