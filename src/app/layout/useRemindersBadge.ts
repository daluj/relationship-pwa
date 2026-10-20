import { useDueReminders } from '@/features/reminders/useDueReminders';

/** Reminders due today or overdue, for the nav badge (ui §6.7). */
export function useRemindersBadge(): number {
  return useDueReminders().due.length;
}
