// @vitest-environment node
import { db } from '@/db/db';
import {
  contactRepo,
  findOrCreateTag,
  loadDemoData,
  recordCounts,
  removeDemoData,
  saveContact,
  search,
  settingsRepo,
} from '@/db/repositories';
import { resetDb } from './helpers';

beforeEach(resetDb);

describe('demo data (features §8.1)', () => {
  it('creates ~15 contacts with moments, reminders, gifts and relationships, then removes exactly that', async () => {
    const mine = await saveContact(undefined, {
      contact: { firstName: 'My own friend' },
      fields: [],
      addresses: [],
    });
    const myTag = await findOrCreateTag('family'); // also used by the demo — must survive removal

    const ids = await loadDemoData('en', new Date('2026-10-19T10:00:00'));
    const counts = await recordCounts();
    expect(ids.contacts).toHaveLength(15);
    expect(counts.contacts).toBe(16);
    expect(counts.moments).toBe(15);
    expect(counts.relationships).toBe(16); // 8 + inverses
    expect(counts.gifts).toBe(3);
    expect(counts.reminders).toBeGreaterThanOrEqual(3 + 9); // manual + birthdays + stay-in-touch + important date
    expect(counts.groups).toBe(3);
    expect((await search('lyon coffee')).moments).toHaveLength(1);
    expect((await settingsRepo.get('demo'))?.contacts).toEqual(ids.contacts);

    await removeDemoData();
    const after = await recordCounts();
    expect((await contactRepo.list()).map((c) => c.id)).toEqual([mine.id]);
    expect(after.moments).toBe(0);
    expect(after.relationships).toBe(0);
    expect(after.reminders).toBe(0);
    expect([after.gifts, after.debts, after.tasks, after.pets, after.importantDates]).toEqual([
      0, 0, 0, 0, 0,
    ]);
    expect(after.groups).toBe(0);
    expect(await db.tags.get(myTag.id)).toBeDefined();
    expect((await db.tags.toArray()).map((t) => t.name)).toEqual(['family']);
    expect(await settingsRepo.get('demo')).toBeUndefined();
    expect((await search('lyon')).moments).toEqual([]);
  });

  it('has Spanish content', async () => {
    await loadDemoData('es', new Date('2026-10-19T10:00:00'));
    expect((await search('cafe')).moments.map((m) => m.body)[0]).toContain('Café con');
  });
});
