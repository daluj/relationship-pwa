import Dexie from 'dexie';
import { db } from '@/db/db';
import { KinDB, SCHEMA_VERSION } from '@/db/schema';

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
        'savedSearches',
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

describe('upgrade from schema v1 (features §8.13 AC-9)', () => {
  it('keeps every existing record and adds the savedSearches table', async () => {
    const name = `kin-v1-${crypto.randomUUID()}`;
    // The released v1 schema, declared the way the app did before Phase 12.
    const old = new Dexie(name);
    old.version(1).stores({
      contacts:
        'id, firstName, lastName, nickname, isStarred, isArchived, lastInteractionAt, *tagIds, *groupIds, updatedAt, deletedAt',
      moments:
        'id, kind, happenedAt, *contactIds, *tagIds, isStarred, deletedAt, [kind+happenedAt]',
      settings: 'key',
    });
    await old.table('contacts').put({ id: 'c1', firstName: 'Élise', tagIds: [], groupIds: [] });
    await old
      .table('moments')
      .put({ id: 'm1', kind: 'note', happenedAt: '2026-01-01T00:00:00.000Z', contactIds: ['c1'] });
    old.close();

    const upgraded = new KinDB(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(2);
    expect((await upgraded.contacts.get('c1'))?.firstName).toBe('Élise');
    expect(await upgraded.moments.count()).toBe(1);
    expect(await upgraded.savedSearches.count()).toBe(0);
    upgraded.close();
    await Dexie.delete(name);
  });
});
