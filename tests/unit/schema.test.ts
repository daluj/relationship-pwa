import Dexie from 'dexie';
import { db } from '@/db/db';
import { SCHEMA_VERSION } from '@/db/schema';

describe('Dexie schema (data-model §5.2, §5.3)', () => {
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
        'goalMilestones',
        'goalReviews',
        'goals',
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

  it('declares the goal indexes (data-model §5.3)', () => {
    const idx = (table: string) => db.table(table).schema.indexes.map((i) => i.name);
    expect(db.table('goals').schema.indexes.find((i) => i.name === 'contactIds')?.multi).toBe(true);
    expect(idx('goalMilestones')).toContain('goalId');
    expect(db.table('goalReviews').schema.indexes.find((i) => i.name === 'weekOf')?.unique).toBe(
      true,
    );
    expect(idx('tasks')).toContain('goalId');
  });

  it('upgrades a v1 database to v2 without touching existing data', async () => {
    const name = `kin-upgrade-${crypto.randomUUID()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({
      contacts: 'id, firstName',
      tasks: 'id, contactId, dueDate, completedAt, deletedAt',
    });
    await v1.table('contacts').add({ id: 'c1', firstName: 'Ana' });
    await v1.table('tasks').add({ id: 't1', title: 'Old task' });
    v1.close();

    const upgraded = new Dexie(name);
    upgraded.version(1).stores({
      contacts: 'id, firstName',
      tasks: 'id, contactId, dueDate, completedAt, deletedAt',
    });
    upgraded.version(2).stores({
      tasks: 'id, contactId, goalId, dueDate, completedAt, deletedAt',
      goals: 'id, status, deadline, *contactIds, sortOrder, deletedAt',
    });
    expect(await upgraded.table('contacts').get('c1')).toMatchObject({ firstName: 'Ana' });
    expect(await upgraded.table('tasks').get('t1')).toMatchObject({ title: 'Old task' });
    expect(await upgraded.table('goals').count()).toBe(0);
    upgraded.close();
    await Dexie.delete(name);
  });
});
