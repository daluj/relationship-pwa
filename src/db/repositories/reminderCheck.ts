// Shared by the page and the service worker — must not import React or UI code.
import { toIsoDate } from '@/domain/partialDate';
import {
  compareReminders,
  dueReminders,
  effectiveDate,
  needsNotification,
} from '@/domain/reminders';
import type { Contact, Reminder } from '@/domain/types';
import { db } from '../db';
import { listReminders, markNotified } from './reminderService';

export interface DueNotification {
  reminder: Reminder;
  contact?: Contact;
  /** Where a click should take the user. */
  url: string;
  overdue: boolean;
}

/**
 * Computes due reminders (today + overdue) and, when `show` is given, shows a notification for each
 * one not yet notified for its current due date, then records `lastNotifiedAt` (SPEC §8.5).
 * Returns the due count (for the app badge).
 */
export async function runReminderCheck(
  now: Date,
  show?: (items: DueNotification[]) => Promise<void>,
): Promise<number> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = dueReminders(await listReminders(), today).sort(compareReminders);
  if (show) {
    const pending = due.filter((r) => needsNotification(r, today));
    if (pending.length) {
      const items: DueNotification[] = [];
      for (const r of pending) {
        const contact = r.contactId ? await db.contacts.get(r.contactId) : undefined;
        items.push({
          reminder: r,
          contact,
          url: r.source === 'stay-in-touch' && contact ? `/c/${contact.id}` : '/reminders',
          overdue: effectiveDate(r) < toIsoDate(today),
        });
      }
      await show(items);
      await markNotified(
        pending.map((r) => r.id),
        now,
      );
    }
  }
  return due.length;
}
