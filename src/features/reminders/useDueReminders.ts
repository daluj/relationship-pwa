import { useMemo } from 'react';
import { useToday } from '@/app/useToday';
import { listReminders, useLiveQuery } from '@/db/repositories';
import { compareReminders, dueReminders } from '@/domain/reminders';
import type { Reminder } from '@/domain/types';

/** Live list of reminders due today or overdue (badge, banner, notifications — features §8.5). */
export function useDueReminders(): { due: Reminder[]; all: Reminder[] | undefined; today: Date } {
  const today = useToday();
  const all = useLiveQuery(listReminders, []);
  const due = useMemo(() => dueReminders(all ?? [], today).sort(compareReminders), [all, today]);
  return { due, all, today };
}
