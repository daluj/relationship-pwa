import { fullName } from '@/domain/contact';
import { toIsoDate } from '@/domain/partialDate';
import { addDays, nextRecurringDate, yearlyReminderDate } from '@/domain/recurrence';
import type { Contact, ImportantDate, PartialDate, Reminder } from '@/domain/types';
import { db } from '../db';
import { nowIso } from './createRepository';
import { importantDateRepo, reminderRepo } from './entities';
import { RecordNotFoundError } from './errors';

const tables = () => [db.reminders, db.contacts, db.importantDates];

const findAuto = (source: Reminder['source'], sourceId: string) =>
  db.reminders
    .where('sourceId')
    .equals(sourceId)
    .filter((r) => r.source === source && !r.deletedAt)
    .first();

const sameDate = (a?: PartialDate, b?: PartialDate) =>
  a?.day === b?.day && a?.month === b?.month && a?.year === b?.year;

const today = () => new Date();

// ── Auto reminders (SPEC §8.5) ───────────────────────────────────────────────
// Auto reminders are purged, not trashed, when their source goes away (DECISIONS D-015).

/** Yearly reminder on the contact's birthday (SPEC §8.2 AC). */
export async function syncBirthdayReminder(
  contact: Contact,
  previous?: PartialDate,
): Promise<void> {
  const existing = await findAuto('birthday', contact.id);
  if (!contact.birthday || contact.deletedAt) {
    if (existing) await reminderRepo.purge(existing.id);
    return;
  }
  const dueDate = yearlyReminderDate(contact.birthday, 0, today());
  const title = fullName(contact);
  if (!existing) {
    await reminderRepo.create({
      contactId: contact.id,
      title,
      dueDate,
      recurrence: 'yearly',
      source: 'birthday',
      sourceId: contact.id,
    });
  } else {
    const changed = !sameDate(contact.birthday, previous);
    await reminderRepo.update(existing.id, {
      title,
      ...(changed && { dueDate, snoozedUntil: undefined, lastNotifiedAt: undefined }),
    });
  }
}

/** Stay-in-touch due date: last interaction (or when the contact was added) + frequency. */
const stayInTouchDue = (c: Contact) =>
  addDays(toIsoDate(new Date(c.lastInteractionAt ?? c.createdAt)), c.stayInTouchDays!);

/**
 * "Stay in touch" reminder (SPEC §8.5). Due `stayInTouchDays` after the last interaction; logging a
 * moment moves it forward. None for archived or deceased contacts.
 */
export async function syncStayInTouchReminder(contact: Contact): Promise<void> {
  const existing = await findAuto('stay-in-touch', contact.id);
  const active =
    !!contact.stayInTouchDays && !contact.isArchived && !contact.isDeceased && !contact.deletedAt;
  if (!active) {
    if (existing) await reminderRepo.purge(existing.id);
    return;
  }
  const dueDate = stayInTouchDue(contact);
  const title = fullName(contact);
  if (!existing) {
    await reminderRepo.create({
      contactId: contact.id,
      title,
      dueDate,
      recurrence: 'none',
      source: 'stay-in-touch',
      sourceId: contact.id,
    });
  } else if (existing.dueDate !== dueDate || existing.title !== title) {
    await reminderRepo.update(existing.id, {
      title,
      dueDate,
      ...(existing.dueDate !== dueDate && { snoozedUntil: undefined, lastNotifiedAt: undefined }),
    });
  }
}

/** Yearly reminder `remindDaysBefore` days before an important date (SPEC §8.5). */
export async function syncImportantDateReminder(
  d: ImportantDate,
  previous?: ImportantDate,
): Promise<void> {
  const existing = await findAuto('important-date', d.id);
  if (!d.remind || d.deletedAt) {
    if (existing) await reminderRepo.purge(existing.id);
    return;
  }
  const lead = d.remindDaysBefore ?? 0;
  const dueDate = yearlyReminderDate(d.date, lead, today());
  if (!existing) {
    await reminderRepo.create({
      contactId: d.contactId,
      title: d.label,
      dueDate,
      recurrence: 'yearly',
      source: 'important-date',
      sourceId: d.id,
    });
  } else {
    const changed =
      !previous || !sameDate(d.date, previous.date) || lead !== (previous.remindDaysBefore ?? 0);
    await reminderRepo.update(existing.id, {
      title: d.label,
      ...(changed && { dueDate, snoozedUntil: undefined, lastNotifiedAt: undefined }),
    });
  }
}

/**
 * Re-derives auto reminders on app start (repairs data created before a sync existed). A read-only pass
 * decides what needs work; the write transaction only runs, and only touches those contacts, when
 * something is missing or stale — so start-up doesn't hold a write lock over every contact.
 */
export async function ensureAutoReminders(): Promise<void> {
  const { contacts, autos, dates } = await db.transaction('r', tables(), async () => ({
    contacts: await db.contacts
      .filter((c) => !c.deletedAt && (!!c.birthday || !!c.stayInTouchDays))
      .toArray(),
    autos: await db.reminders
      .where('source')
      .anyOf('birthday', 'stay-in-touch', 'important-date')
      .filter((r) => !r.deletedAt)
      .toArray(),
    dates: await db.importantDates.filter((d) => !d.deletedAt && d.remind).toArray(),
  }));
  const auto = new Map(autos.map((r) => [`${r.source}|${r.sourceId}`, r]));
  const qualifies = (c: Contact) => !!c.stayInTouchDays && !c.isArchived && !c.isDeceased;

  const birthdays = contacts.filter((c) => {
    const r = c.birthday && auto.get(`birthday|${c.id}`);
    return c.birthday && (!r || r.title !== fullName(c));
  });
  const stayInTouch = contacts.filter((c) => {
    const r = auto.get(`stay-in-touch|${c.id}`);
    return qualifies(c) ? !r || r.dueDate !== stayInTouchDue(c) || r.title !== fullName(c) : !!r;
  });
  // Stay-in-touch reminders whose contact no longer qualifies (or is gone).
  const byId = new Set(contacts.filter(qualifies).map((c) => c.id));
  const orphanStay = autos.filter(
    (r) =>
      r.source === 'stay-in-touch' &&
      !byId.has(r.sourceId!) &&
      !stayInTouch.some((c) => c.id === r.sourceId),
  );
  const missingDates = dates.filter((d) => !auto.has(`important-date|${d.id}`));
  if (!birthdays.length && !stayInTouch.length && !orphanStay.length && !missingDates.length)
    return;

  await db.transaction('rw', tables(), async () => {
    for (const c of birthdays) {
      const existing = await findAuto('birthday', c.id);
      if (!existing) await syncBirthdayReminder(c);
      else await reminderRepo.update(existing.id, { title: fullName(c) });
    }
    for (const c of stayInTouch) await syncStayInTouchReminder(c);
    for (const r of orphanStay) {
      const c = r.sourceId ? await db.contacts.get(r.sourceId) : undefined;
      if (c) await syncStayInTouchReminder(c);
      else await reminderRepo.purge(r.id);
    }
    for (const d of missingDates) await syncImportantDateReminder(d);
  });
}

// ── Important dates ──────────────────────────────────────────────────────────

export type ImportantDateDraft = Pick<
  ImportantDate,
  'contactId' | 'label' | 'date' | 'remind' | 'remindDaysBefore'
>;

export async function saveImportantDate(
  id: string | undefined,
  draft: ImportantDateDraft,
): Promise<ImportantDate> {
  return db.transaction('rw', tables(), async () => {
    const before = id ? await importantDateRepo.get(id) : undefined;
    if (id && !before) throw new RecordNotFoundError('importantDate', id);
    const saved = before
      ? await importantDateRepo.update(before.id, {
          ...draft,
          remindDaysBefore: draft.remindDaysBefore,
        })
      : await importantDateRepo.create(draft);
    await syncImportantDateReminder(saved, before);
    return saved;
  });
}

export async function deleteImportantDate(id: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    await importantDateRepo.softDelete(id);
    const existing = await findAuto('important-date', id);
    if (existing) await reminderRepo.purge(existing.id);
  });
}

export const importantDatesFor = (contactId: string) =>
  db.importantDates
    .where('contactId')
    .equals(contactId)
    .filter((d) => !d.deletedAt)
    .toArray();

// ── Manual reminders & actions ───────────────────────────────────────────────

export type ReminderDraft = Pick<
  Reminder,
  'title' | 'contactId' | 'notes' | 'dueDate' | 'dueTime' | 'recurrence' | 'recurrenceInterval'
>;

/** Create/update a manual reminder. Changing the date clears snooze and notification state. */
export async function saveReminder(
  id: string | undefined,
  draft: ReminderDraft,
): Promise<Reminder> {
  const data = {
    ...draft,
    recurrenceInterval: draft.recurrence === 'none' ? undefined : draft.recurrenceInterval,
  };
  if (!id) return reminderRepo.create({ ...data, source: 'manual' });
  const before = await reminderRepo.get(id);
  if (!before) throw new RecordNotFoundError('reminder', id);
  const moved = before.dueDate !== draft.dueDate || before.dueTime !== draft.dueTime;
  return reminderRepo.update(id, {
    ...data,
    ...(moved && { snoozedUntil: undefined, lastNotifiedAt: undefined, completedAt: undefined }),
  });
}

/**
 * "Done" (SPEC §8.5): one-off reminders are completed; recurring ones advance to the next
 * occurrence after today. Stay-in-touch "Done" (reached out outside the app) snoozes a full period.
 */
export async function completeReminder(id: string, now = new Date()): Promise<Reminder> {
  return db.transaction('rw', tables(), async () => {
    const r = await reminderRepo.get(id);
    if (!r) throw new RecordNotFoundError('reminder', id);
    const reset = { snoozedUntil: undefined, lastNotifiedAt: undefined };

    if (r.source === 'stay-in-touch') {
      const c = r.contactId ? await db.contacts.get(r.contactId) : undefined;
      return reminderRepo.update(id, {
        snoozedUntil: addDays(toIsoDate(now), c?.stayInTouchDays ?? 30),
        lastNotifiedAt: undefined,
      });
    }
    if (r.source === 'birthday' && r.contactId) {
      const c = await db.contacts.get(r.contactId);
      if (c?.birthday)
        return reminderRepo.update(id, {
          ...reset,
          dueDate: yearlyReminderDate(c.birthday, 0, now, true),
        });
    }
    if (r.source === 'important-date' && r.sourceId) {
      const d = await db.importantDates.get(r.sourceId);
      if (d) {
        return reminderRepo.update(id, {
          ...reset,
          dueDate: yearlyReminderDate(d.date, d.remindDaysBefore ?? 0, now, true),
        });
      }
    }
    if (r.recurrence !== 'none') {
      return reminderRepo.update(id, {
        ...reset,
        dueDate: nextRecurringDate(r.dueDate, r.recurrence, r.recurrenceInterval ?? 1, now),
      });
    }
    return reminderRepo.update(id, { ...reset, completedAt: nowIso() });
  });
}

export const reopenReminder = (id: string) => reminderRepo.update(id, { completedAt: undefined });

/** Snooze until a date (`YYYY-MM-DD`); it reappears and re-notifies then. */
export const snoozeReminder = (id: string, until: string) =>
  reminderRepo.update(id, { snoozedUntil: until, lastNotifiedAt: undefined });

export const deleteReminder = (id: string) => reminderRepo.softDelete(id);
export const restoreReminder = (id: string) => reminderRepo.restore(id);

export async function markNotified(ids: string[], now = new Date()): Promise<void> {
  const stampIso = now.toISOString();
  await db.reminders
    .where('id')
    .anyOf(ids)
    .modify((r) => {
      r.lastNotifiedAt = stampIso;
    });
}

/** All live reminders (open and completed). */
export const listReminders = () => db.reminders.filter((r) => !r.deletedAt).toArray();

export const remindersFor = (contactId: string) =>
  db.reminders
    .where('contactId')
    .equals(contactId)
    .filter((r) => !r.deletedAt)
    .toArray();
