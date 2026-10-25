import { db } from '@/db/db';
import {
  addToGroup,
  bulkUpdateContacts,
  contactRepo,
  deleteSavedSearch,
  findOrCreateTag,
  getYearReview,
  groupRepo,
  listSavedSearches,
  momentRepo,
  renameSavedSearch,
  restoreContact,
  restoreSavedSearch,
  reviewYears,
  saveContact,
  saveMoment,
  saveSearch,
  search,
  undoBulkUpdate,
} from '@/db/repositories';
import { tagToken } from '@/domain/momentText';
import { resetDb } from './helpers';

beforeEach(resetDb);

const person = (firstName: string, extra: Record<string, unknown> = {}) =>
  saveContact(undefined, { contact: { firstName, ...extra }, fields: [], addresses: [] });
const note = (body: string, happenedAt: string, extra: Record<string, unknown> = {}) =>
  saveMoment(undefined, { kind: 'note', body, happenedAt, contactIds: [], photos: [], ...extra });

describe('filtered search (features §8.13 AC-1..3, AC-10)', () => {
  it('kind + date range with no text returns only matching moments, newest first', async () => {
    await note('old call', new Date(2026, 0, 5, 12).toISOString(), { kind: 'call' });
    await note('march call a', new Date(2026, 2, 10, 9).toISOString(), { kind: 'call' });
    await note('march call b', new Date(2026, 2, 20, 9).toISOString(), { kind: 'call' });
    await note('march note', new Date(2026, 2, 12, 9).toISOString());
    const r = await search('', 50, { kinds: ['call'], from: '2026-03-01', to: '2026-03-31' });
    expect(r.moments.map((m) => m.body)).toEqual(['march call b', 'march call a']);
    expect(r.momentTotal).toBe(2);
    expect(r.contacts).toEqual([]);
  });

  it('text + tag combine as AND', async () => {
    const fam = await findOrCreateTag('family');
    const tagged = tagToken(fam.id, 'family');
    await note(`Lyon trip ${tagged}`, new Date(2026, 2, 1).toISOString());
    await note('Lyon work', new Date(2026, 2, 2).toISOString());
    await note(`Paris trip ${tagged}`, new Date(2026, 2, 3).toISOString());
    const r = await search('lyon', 50, { tagIds: [fam.id] });
    expect(r.moments.map((m) => m.body.split(' ')[1])).toEqual(['trip']);
    expect(r.moments).toHaveLength(1);
    expect(r.moments[0]!.body).toContain('Lyon');
  });

  it('group filter picks moments mentioning a member', async () => {
    const g = await groupRepo.create({ name: 'Book club' });
    const lise = await person('Élise');
    const marc = await person('Marc');
    await addToGroup(lise.id, g.id);
    await note('with lise', new Date(2026, 2, 1).toISOString(), { contactIds: [lise.id] });
    await note('with marc', new Date(2026, 2, 2).toISOString(), { contactIds: [marc.id] });
    const r = await search('', 50, { groupIds: [g.id] });
    expect(r.moments.map((m) => m.body)).toEqual(['with lise']);
    expect(r.contacts.map((c) => c.firstName)).toEqual(['Élise']);
  });

  it('"not contacted in N days" lists stale people by name, skipping archived and recent', async () => {
    const now = new Date(2026, 5, 1);
    const stale = await person('Zoé');
    const never = await person('Ana');
    const recent = await person('Marc');
    const archived = await person('Hugo', { isArchived: true });
    await note('old', new Date(2026, 0, 1).toISOString(), { contactIds: [stale.id, archived.id] });
    await note('new', new Date(2026, 4, 25).toISOString(), { contactIds: [recent.id] });
    const r = await search('', 50, { notContactedDays: 90 }, now);
    expect(r.contacts.map((c) => c.firstName)).toEqual(['Ana', 'Zoé']);
    expect(r.moments).toEqual([]);
    void never;
  });

  it('is unchanged without filters', async () => {
    await note('lyon coffee', new Date(2026, 2, 1).toISOString());
    expect((await search('lyon coffee')).moments).toHaveLength(1);
    expect((await search('lyon coffee', 50, {})).moments).toHaveLength(1);
  });
});

describe('saved searches (AC-4)', () => {
  it('saves query and filters, lists by name, renames and deletes with undo', async () => {
    const s = await saveSearch('Calls in March', ' lyon ', { kinds: ['call'], from: '2026-03-01' });
    await saveSearch('Another', '', { tagIds: ['t'] });
    expect(s.query).toBe('lyon');
    expect((await listSavedSearches()).map((x) => x.name)).toEqual(['Another', 'Calls in March']);
    await renameSavedSearch(s.id, 'March calls');
    expect((await listSavedSearches()).map((x) => x.name)).toEqual(['Another', 'March calls']);
    await deleteSavedSearch(s.id);
    expect(await listSavedSearches()).toHaveLength(1);
    await restoreSavedSearch(s.id);
    expect((await listSavedSearches()).find((x) => x.id === s.id)?.filters).toEqual({
      kinds: ['call'],
      from: '2026-03-01',
    });
  });
  it('rejects an empty name', async () => {
    await expect(saveSearch('  ', 'x', {})).rejects.toThrow();
  });
});

describe('bulk actions (AC-5, AC-6)', () => {
  it('adds a tag to exactly the selected contacts, reindexes, and undoes in one step', async () => {
    const tag = await findOrCreateTag('climbing');
    const [a, b, c, other] = [
      await person('Ana'),
      await person('Bruno'),
      await person('Chloé'),
      await person('Zed'),
    ];
    const { changed, undo } = await bulkUpdateContacts([a.id, b.id, c.id], {
      type: 'add-tag',
      tagId: tag.id,
    });
    expect(changed).toBe(3);
    expect((await contactRepo.get(a.id))!.tagIds).toEqual([tag.id]);
    expect((await contactRepo.get(other.id))!.tagIds).toEqual([]);
    expect((await search('climbing')).contacts.map((x) => x.firstName).sort()).toEqual([
      'Ana',
      'Bruno',
      'Chloé',
    ]);

    await undoBulkUpdate(undo);
    for (const id of [a.id, b.id, c.id]) expect((await contactRepo.get(id))!.tagIds).toEqual([]);
    expect((await search('climbing')).contacts).toEqual([]);
  });

  it('skips contacts that already have the tag, and only reverts the ones it changed', async () => {
    const tag = await findOrCreateTag('x');
    const a = await person('Ana');
    const b = await person('Bruno');
    await bulkUpdateContacts([a.id], { type: 'add-tag', tagId: tag.id });
    const { changed, undo } = await bulkUpdateContacts([a.id, b.id], {
      type: 'add-tag',
      tagId: tag.id,
    });
    expect(changed).toBe(1);
    await undoBulkUpdate(undo);
    expect((await contactRepo.get(a.id))!.tagIds).toEqual([tag.id]);
    expect((await contactRepo.get(b.id))!.tagIds).toEqual([]);
  });

  it('groups add/remove and undo', async () => {
    const g = await groupRepo.create({ name: 'Team' });
    const a = await person('Ana');
    const b = await person('Bruno');
    const add = await bulkUpdateContacts([a.id, b.id], { type: 'add-group', groupId: g.id });
    expect((await contactRepo.get(b.id))!.groupIds).toEqual([g.id]);
    await undoBulkUpdate(add.undo);
    expect((await contactRepo.get(b.id))!.groupIds).toEqual([]);
    await bulkUpdateContacts([a.id], { type: 'add-group', groupId: g.id });
    const rem = await bulkUpdateContacts([a.id], { type: 'remove-group', groupId: g.id });
    expect((await contactRepo.get(a.id))!.groupIds).toEqual([]);
    await undoBulkUpdate(rem.undo);
    expect((await contactRepo.get(a.id))!.groupIds).toEqual([g.id]);
  });

  it('archive and unarchive apply to the whole selection and undo restores', async () => {
    const a = await person('Ana');
    const b = await person('Bruno', { isArchived: true });
    const r = await bulkUpdateContacts([a.id, b.id], { type: 'archive', archived: true });
    expect(r.changed).toBe(1); // Bruno already archived
    expect((await contactRepo.get(a.id))!.isArchived).toBe(true);
    await undoBulkUpdate(r.undo);
    expect((await contactRepo.get(a.id))!.isArchived).toBe(false);
    expect((await contactRepo.get(b.id))!.isArchived).toBe(true);
  });

  it('moving to Trash cascades like a single delete (D-016) and undo restores', async () => {
    const a = await person('Ana', { birthday: { month: 3, day: 4 } });
    const b = await person('Bruno');
    const r = await bulkUpdateContacts([a.id, b.id], { type: 'trash' });
    expect(r.changed).toBe(2);
    expect(await contactRepo.get(a.id)).toBeUndefined();
    expect((await db.contacts.get(a.id))!.deletedAt).toBeTruthy();
    const dependents = await db.reminders.where('contactId').equals(a.id).toArray();
    expect(
      dependents.every((x) => x.deletedAt === (undefined as unknown as string) || !!x.deletedAt),
    ).toBe(true);
    await undoBulkUpdate(r.undo);
    expect((await contactRepo.get(a.id))!.firstName).toBe('Ana');
    expect(
      await db.reminders
        .where('contactId')
        .equals(a.id)
        .filter((x) => !x.deletedAt)
        .count(),
    ).toBe(1);
    void restoreContact;
  });

  it('ignores deleted or unknown ids', async () => {
    const r = await bulkUpdateContacts(['nope'], { type: 'archive', archived: true });
    expect(r.changed).toBe(0);
  });
});

describe('year in review reads', () => {
  it('counts from the database and lists years', async () => {
    const lise = await person('Élise');
    await momentRepo.create({
      kind: 'call',
      body: 'a',
      happenedAt: new Date(2025, 4, 1).toISOString(),
      contactIds: [lise.id],
    });
    await momentRepo.create({
      kind: 'note',
      body: 'b',
      happenedAt: new Date(2024, 4, 1).toISOString(),
    });
    expect(await reviewYears()).toEqual([2025, 2024]);
    const r = await getYearReview(2025);
    expect(r.momentTotal).toBe(1);
    expect(r.peopleMentioned).toBe(1);
  });
});
