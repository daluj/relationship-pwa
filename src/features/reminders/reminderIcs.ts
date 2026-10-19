import type { TFunction } from 'i18next';
import { buildIcs, type IcsEvent } from '@/domain/ics';
import type { Contact, Reminder } from '@/domain/types';
import { saveFile } from '@/lib/download';
import { reminderTitle } from './reminderText';

const toEvent = (r: Reminder, contact: Contact | undefined, t: TFunction): IcsEvent => ({
  uid: `${r.id}@kin.local`,
  title: reminderTitle(r, contact, t),
  description: r.notes,
  date: r.dueDate.slice(0, 10),
  time: r.dueTime,
  recurrence: r.recurrence,
  interval: r.recurrenceInterval,
});

/** Download reminders as an .ics calendar file (SPEC §8.5). */
export function exportIcs(
  reminders: Reminder[],
  contact: (id: string) => Contact | undefined,
  t: TFunction,
  fileName = 'kin-reminders.ics',
): Promise<boolean> {
  const ics = buildIcs(
    reminders.map((r) => toEvent(r, r.contactId ? contact(r.contactId) : undefined, t)),
  );
  return saveFile(fileName, 'text/calendar', ics);
}
