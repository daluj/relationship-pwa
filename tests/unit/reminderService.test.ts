import { db } from '@/db/db';
import {
  completeReminder,
  contactRepo,
  deleteContact,
  deleteImportantDate,
  ensureAutoReminders,
  listReminders,
  markNotified,
  reminderRepo,
  saveContact,
  saveImportantDate,
  saveMoment,
  saveReminder,
  snoozeReminder,
  updateContactStatus,
} from '@/db/repositories';
import { dueReminders, groupOf, needsNotification } from '@/domain/reminders';
import { resetDb } from './helpers';

beforeEach(async () => {
  await resetDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-18T10:00:00'));
});
afterEach(() => vi.useRealTimers());

const bySource = async (source: string) =>
  (await listReminders()).filter((r) => r.source === source);

describe('birthday reminder (SPEC §8.5 AC)', () => {
  it('is due today on the birthday, counts as due, and Done moves it to next year', async () => {
    const c = await saveContact(undefined, {
      contact: { firstName: 'Élise', birthday: { month: 3, day: 18, year: 1987 } },
      fields: [],
      addresses: [],
    });
    const [r] = await bySource('birthday');
    expect(r).toMatchObject({ dueDate: '2026-03-18', contactId: c.id, recurrence: 'yearly' });
    const today = new Date();
    expect(groupOf(r!, today)).toBe('today');
    expect(dueReminders(await listReminders(), today)).toHaveLength(1);

    const done = await completeReminder(r!.id);
    expect(done.dueDate).toBe('2027-03-18');
    expect(done.completedAt).toBeUndefined();
    expect(dueReminders(await listReminders(), today)).toHaveLength(0);
  });

  it('Feb 29 birthdays fall on Feb 28 in non-leap years and return to Feb 29', async () => {
    vi.setSystemTime(new Date('2027-02-28T10:00:00'));
    await saveContact(undefined, {
      contact: { firstName: 'Leap', birthday: { month: 2, day: 29 } },
      fields: [],
      addresses: [],
    });
    const [r] = await bySource('birthday');
    expect(r!.dueDate).toBe('2027-02-28');
    expect((await completeReminder(r!.id)).dueDate).toBe('2028-02-29');
  });
});

describe('manual reminders', () => {
  it('one-off Done completes; recurring Done advances past today with clamping', async () => {
    const once = await saveReminder(undefined, {
      title: 'Return book',
      dueDate: '2026-03-18',
      recurrence: 'none',
    });
    expect((await completeReminder(once.id)).completedAt).toBeDefined();

    const monthly = await saveReminder(undefined, {
      title: 'Pay rent',
      dueDate: '2026-01-31',
      recurrence: 'monthly',
      recurrenceInterval: 1,
    });
    expect((await completeReminder(monthly.id)).dueDate).toBe('2026-03-28'); // Jan 31 → Feb 28 → Mar 28 (> today)
  });

  it('snooze moves the effective date and resets notification; editing the date clears snooze', async () => {
    const r = await saveReminder(undefined, {
      title: 'Call',
      dueDate: '2026-03-18',
      recurrence: 'none',
    });
    await markNotified([r.id]);
    expect(needsNotification((await reminderRepo.get(r.id))!, new Date())).toBe(false);
    await snoozeReminder(r.id, '2026-03-19');
    const snoozed = (await reminderRepo.get(r.id))!;
    expect(snoozed.snoozedUntil).toBe('2026-03-19');
    expect(groupOf(snoozed, new Date())).toBe('week');
    const moved = await saveReminder(r.id, {
      title: 'Call',
      dueDate: '2026-03-20',
      recurrence: 'none',
    });
    expect(moved.snoozedUntil).toBeUndefined();
  });

  it('non-recurring reminders drop the interval', async () => {
    const r = await saveReminder(undefined, {
      title: 'x',
      dueDate: '2026-03-18',
      recurrence: 'none',
      recurrenceInterval: 3,
    });
    expect(r).not.toHaveProperty('recurrenceInterval');
  });
});

describe('stay in touch (SPEC §8.5)', () => {
  it('is due N days after the last interaction; logging a moment clears it', async () => {
    const c = await saveContact(undefined, {
      contact: { firstName: 'Marc', stayInTouchDays: 30 },
      fields: [],
      addresses: [],
    });
    let [r] = await bySource('stay-in-touch');
    expect(r!.dueDate).toBe('2026-04-17'); // createdAt + 30

    await saveMoment(undefined, {
      kind: 'call',
      body: 'hi',
      happenedAt: '2026-01-01T12:00:00.000Z',
      contactIds: [c.id],
      photos: [],
    });
    [r] = await bySource('stay-in-touch');
    expect(r!.dueDate).toBe('2026-01-31');
    expect(groupOf(r!, new Date())).toBe('overdue');

    await saveMoment(undefined, {
      kind: 'note',
      body: 'today',
      happenedAt: new Date().toISOString(),
      contactIds: [c.id],
      photos: [],
    });
    [r] = await bySource('stay-in-touch');
    expect(r!.dueDate).toBe('2026-04-17');
  });

  it('Done (reached out elsewhere) snoozes a full period; archive/deceased/clearing removes it', async () => {
    const c = await saveContact(undefined, {
      contact: { firstName: 'Marc', stayInTouchDays: 7 },
      fields: [],
      addresses: [],
    });
    const [r] = await bySource('stay-in-touch');
    expect((await completeReminder(r!.id)).snoozedUntil).toBe('2026-03-25');

    await updateContactStatus(c.id, { isArchived: true });
    expect(await bySource('stay-in-touch')).toHaveLength(0);
    await updateContactStatus(c.id, { isArchived: false });
    expect(await bySource('stay-in-touch')).toHaveLength(1);
    await updateContactStatus(c.id, { isDeceased: true });
    expect(await bySource('stay-in-touch')).toHaveLength(0);
  });

  it('is removed with the contact (cascade) and re-created by ensureAutoReminders', async () => {
    const c = await contactRepo.create({
      firstName: 'Old',
      stayInTouchDays: 14,
      birthday: { month: 5, day: 1 },
    });
    expect(await listReminders()).toHaveLength(0); // created outside the service
    await ensureAutoReminders();
    expect((await listReminders()).map((r) => r.source).sort()).toEqual([
      'birthday',
      'stay-in-touch',
    ]);
    await deleteContact(c.id);
    expect(await listReminders()).toHaveLength(0);
  });
});

describe('important dates', () => {
  it('reminds remindDaysBefore days ahead, yearly; editing re-schedules; deleting removes it', async () => {
    const c = await contactRepo.create({ firstName: 'Ana' });
    const d = await saveImportantDate(undefined, {
      contactId: c.id,
      label: 'Wedding anniversary',
      date: { month: 6, day: 10, year: 2015 },
      remind: true,
      remindDaysBefore: 7,
    });
    let [r] = await bySource('important-date');
    expect(r).toMatchObject({
      dueDate: '2026-06-03',
      title: 'Wedding anniversary',
      recurrence: 'yearly',
    });

    vi.setSystemTime(new Date('2026-06-03T09:00:00'));
    expect((await completeReminder(r!.id)).dueDate).toBe('2027-06-03');

    await saveImportantDate(d.id, { ...d, remindDaysBefore: 0 });
    [r] = await bySource('important-date');
    expect(r!.dueDate).toBe('2026-06-10');

    await saveImportantDate(d.id, { ...d, remind: false });
    expect(await bySource('important-date')).toHaveLength(0);
    await saveImportantDate(d.id, { ...d, remind: true });
    await deleteImportantDate(d.id);
    expect(await bySource('important-date')).toHaveLength(0);
    expect(await db.importantDates.get(d.id)).toHaveProperty('deletedAt');
  });
});
