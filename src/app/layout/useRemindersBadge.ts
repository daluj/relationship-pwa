import { useDueReminders } from '@/features/reminders/useDueReminders';

/** Reminders due today or overdue, for the nav badge (SPEC §6.7). */
export function useRemindersBadge(): number {
  return useDueReminders().due.length;
}
