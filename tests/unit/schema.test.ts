import { db } from '@/db/db';
import { SCHEMA_VERSION } from '@/db/schema';

describe('Dexie schema v1 (data-model §5.2)', () => {
  it('opens at the current version with every table', async () => {
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      [
        'addresses',
        'blobs',
        'contactFields',
        'contacts',
        'debts',
        'gifts',
        'groups',
        'importantDates',
        'moments',
        'pets',
        'relationships',
        'reminders',
        'searchIndex',
        'settings',
        'tags',
        'tasks',
      ].sort(),
    );
  });

  it('declares the indexes the spec relies on', () => {
    const idx = (table: string) => db.table(table).schema.indexes.map((i) => i.name);
    expect(idx('contacts')).toEqual(
      expect.arrayContaining(['tagIds', 'groupIds', 'lastInteractionAt']),
    );
    expect(db.table('contacts').schema.indexes.find((i) => i.name === 'tagIds')?.multi).toBe(true);
    expect(idx('moments')).toEqual(expect.arrayContaining(['contactIds', '[kind+happenedAt]']));
    expect(db.table('tags').schema.indexes.find((i) => i.name === 'nameLower')?.unique).toBe(true);
    expect(db.table('searchIndex').schema.primKey.name).toBe('[entity+entityId]');
  });
});
