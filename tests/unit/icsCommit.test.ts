import { db } from '@/db/db';
import { commitIcs, contactRepo, importantDatesFor, saveContact } from '@/db/repositories';
import type { ParsedIcsEvent } from '@/domain/ics';
import { resetDb } from './helpers';

beforeEach(resetDb);

const birthday = (over: Partial<ParsedIcsEvent> = {}): ParsedIcsEvent => ({
  title: "Marc's birthday",
  month: 3,
  day: 18,
  year: 1987,
  kind: 'birthday',
  name: 'Marc',
  ...over,
});
const anniversary = (over: Partial<ParsedIcsEvent> = {}): ParsedIcsEvent => ({
  title: 'Wedding anniversary',
  month: 6,
  day: 1,
  year: 2015,
  kind: 'date',
  ...over,
});
const person = (firstName: string, extra: Record<string, unknown> = {}) =>
  saveContact(undefined, { contact: { firstName, ...extra }, fields: [], addresses: [] });
const reminders = (source: string) => db.reminders.filter((r) => r.source === source).toArray();

describe('commitIcs (features §8.14 AC-1, AC-2)', () => {
  it('creates a contact with a birthday and its yearly reminder', async () => {
    const r = await commitIcs([{ event: birthday(), target: { create: 'Marc Dupont' } }]);
    expect(r).toEqual({ birthdays: 1, dates: 0, created: 1, skipped: 0 });
    const [c] = await contactRepo.list();
    expect(c).toMatchObject({
      firstName: 'Marc',
      lastName: 'Dupont',
      birthday: { year: 1987, month: 3, day: 18 },
      isBirthdayYearKnown: true,
    });
    const [rem] = await reminders('birthday');
    expect(rem).toMatchObject({ contactId: c!.id, recurrence: 'yearly' });
  });

  it('sets the birthday of a matched contact and creates the reminder', async () => {
    const marc = await person('Marc');
    const r = await commitIcs([
      { event: birthday({ year: undefined }), target: { contactId: marc.id } },
    ]);
    expect(r.birthdays).toBe(1);
    expect((await contactRepo.get(marc.id))!.birthday).toEqual({ month: 3, day: 18 });
    expect(await reminders('birthday')).toHaveLength(1);
  });

  it('keeps a different birthday, accepts the same one, and fills in a missing year', async () => {
    const different = await person('Anna', { birthday: { month: 5, day: 5, year: 1990 } });
    const same = await person('Bo', { birthday: { month: 3, day: 18, year: 1987 } });
    const noYear = await person('Cy', { birthday: { month: 3, day: 18 } });
    const r = await commitIcs([
      { event: birthday(), target: { contactId: different.id } },
      { event: birthday(), target: { contactId: same.id } },
      { event: birthday(), target: { contactId: noYear.id } },
    ]);
    expect(r).toMatchObject({ birthdays: 2, skipped: 1 });
    expect((await contactRepo.get(different.id))!.birthday).toEqual({
      month: 5,
      day: 5,
      year: 1990,
    });
    expect((await contactRepo.get(noYear.id))!.birthday).toEqual({ month: 3, day: 18, year: 1987 });
  });

  it('adds anniversaries as important dates with a reminder, and skips duplicates', async () => {
    const marc = await person('Marc');
    const row = { event: anniversary(), target: { contactId: marc.id } };
    expect(await commitIcs([row])).toMatchObject({ dates: 1, skipped: 0 });
    expect(await commitIcs([row])).toMatchObject({ dates: 0, skipped: 1 });
    const [d] = await importantDatesFor(marc.id);
    expect(d).toMatchObject({
      label: 'Wedding anniversary',
      date: { year: 2015, month: 6, day: 1 },
    });
    expect(await reminders('important-date')).toHaveLength(1);
  });

  it('writes nothing for skipped or unassigned rows', async () => {
    const r = await commitIcs([
      { event: birthday(), target: null },
      { event: birthday({ skip: 'timed' }), target: { create: 'Zed' } },
    ]);
    expect(r).toEqual({ birthdays: 0, dates: 0, created: 0, skipped: 2 });
    expect(await db.contacts.count()).toBe(0);
  });
});
