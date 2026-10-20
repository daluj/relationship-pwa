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
 * one not yet notified for its current due date (features §8.5). Returns the due count (for the app badge).
 *
 * Reminders are *claimed* first — read and stamped with `lastNotifiedAt` in one transaction — and only
 * then shown. Concurrent checks (re-run effects, a second tab, the service worker) serialize on that
 * transaction, so each reminder is notified exactly once.
 */
export async function runReminderCheck(
  now: Date,
  show?: (items: DueNotification[]) => Promise<void>,
): Promise<number> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { count, claimed } = await db.transaction('rw', [db.reminders, db.contacts], async () => {
    const due = dueReminders(await listReminders(), today).sort(compareReminders);
    const pending = show ? due.filter((r) => needsNotification(r, today)) : [];
    if (pending.length)
      await markNotified(
        pending.map((r) => r.id),
        now,
      );
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
    return { count: due.length, claimed: items };
  });
  if (show && claimed.length) await show(claimed);
  return count;
}
