import { db } from '@/db/db';
import {
  contactRepo,
  giftRepo,
  groupRepo,
  findOrCreateTag,
  listMergeHistory,
  mergeContactsUndoable,
  MergeUndoError,
  purgeExpiredTrash,
  saveContact,
  saveDebt,
  saveMoment,
  saveRelationship,
  saveTask,
  search,
  undoMerge,
  updateContactStatus,
} from '@/db/repositories';
import { mentionToken } from '@/domain/momentText';
import { resetDb } from './helpers';

beforeEach(resetDb);

const TABLES = [
  'contacts',
  'contactFields',
  'addresses',
  'relationships',
  'moments',
  'reminders',
  'importantDates',
  'gifts',
  'debts',
  'tasks',
  'pets',
  'tags',
  'groups',
] as const;

/** Every row of every data table, ordered by id, plus the search index (which undo must also restore). */
async function snapshotAll() {
  const out: Record<string, unknown> = {};
  for (const t of TABLES)
    out[t] = (await db.table(t).toArray()).sort((a, b) => a.id.localeCompare(b.id));
  out.searchIndex = (await db.searchIndex.toArray()).sort((a, b) =>
    `${a.entity}${a.entityId}`.localeCompare(`${b.entity}${b.entityId}`),
  );
  return out;
}

async function seedPair() {
  const fam = await findOrCreateTag('family');
  const club = await groupRepo.create({ name: 'Book club' });
  const lise = await saveContact(undefined, {
    contact: {
      firstName: 'Élise',
      lastName: 'Aubert',
      stayInTouchDays: 30,
      tagIds: [fam.id],
      groupIds: [club.id],
    },
    fields: [{ type: 'email', value: 'lise@example.com' }],
    addresses: [{ city: 'Lyon', isCurrent: true }],
  });
  const dupe = await saveContact(undefined, {
    contact: {
      firstName: 'Lise',
      nickname: 'lili',
      company: 'Acme',
      birthday: { month: 3, day: 18, year: 1987 },
      stayInTouchDays: 60,
    },
    fields: [
      { type: 'email', value: 'LISE@example.com' },
      { type: 'phone', value: '+33 1' },
    ],
    addresses: [{ city: 'Paris', isCurrent: true }],
  });
  const marc = await saveContact(undefined, {
    contact: { firstName: 'Marc', howWeMet: { introducedById: dupe.id, text: 'Via Lise' } },
    fields: [],
    addresses: [],
  });
  await saveRelationship(undefined, {
    fromContactId: dupe.id,
    toContactId: marc.id,
    type: 'friend',
  });
  await saveRelationship(undefined, {
    fromContactId: lise.id,
    toContactId: dupe.id,
    type: 'friend',
  });
  await saveMoment(undefined, {
    kind: 'note',
    body: `Hi ${mentionToken(dupe.id, 'Lise')} and ${mentionToken(lise.id, 'Élise Aubert')} lyon`,
    happenedAt: '2026-10-10T10:00:00.000Z',
    contactIds: [],
    photos: [],
  });
  await saveMoment(undefined, {
    kind: 'call',
    body: 'long call',
    happenedAt: '2026-10-12T10:00:00.000Z',
    contactIds: [lise.id],
    photos: [],
  });
  await giftRepo.create({ contactId: dupe.id, name: 'Scarf', status: 'idea' });
  await saveDebt(undefined, {
    contactId: dupe.id,
    direction: 'they-owe',
    amount: 5,
    currency: 'EUR',
    date: '2026-09-01',
  });
  await saveTask(undefined, { contactId: dupe.id, title: 'Return book' });
  return { lise, dupe, marc };
}

describe('undoMerge (features §8.14 AC-4, AC-5)', () => {
  it('restores both contacts and everything the merge touched, exactly', async () => {
    const { lise, dupe } = await seedPair();
    const before = await snapshotAll();

    const { snapshotId } = await mergeContactsUndoable(lise.id, dupe.id);
    expect(await snapshotAll()).not.toEqual(before); // the merge really changed things
    expect(await contactRepo.get(dupe.id)).toBeUndefined();

    await undoMerge(snapshotId);
    expect(await snapshotAll()).toEqual(before);
    expect(await db.mergeSnapshots.count()).toBe(0);
    expect((await search('lili')).contacts.map((c) => c.firstName)).toEqual(['Lise']);
  });

  it('lists the merge until it is undone', async () => {
    const { lise, dupe } = await seedPair();
    const { snapshotId } = await mergeContactsUndoable(lise.id, dupe.id);
    const [entry] = await listMergeHistory();
    expect(entry).toMatchObject({
      id: snapshotId,
      primaryName: 'Élise Aubert',
      secondaryName: 'Lise',
    });
    await undoMerge(snapshotId);
    expect(await listMergeHistory()).toEqual([]);
  });

  it('is refused when the kept contact was edited after the merge', async () => {
    const { lise, dupe } = await seedPair();
    const { snapshotId } = await mergeContactsUndoable(lise.id, dupe.id);
    await contactRepo.update(lise.id, { bio: 'Edited after' });
    await expect(undoMerge(snapshotId)).rejects.toMatchObject({ code: 'changed' });
    expect((await contactRepo.get(lise.id))!.bio).toBe('Edited after');
    expect(await db.mergeSnapshots.count()).toBe(1); // still there
  });

  it('is refused when the merged-away contact was restored or purged', async () => {
    const { lise, dupe } = await seedPair();
    const { snapshotId } = await mergeContactsUndoable(lise.id, dupe.id);
    await db.contacts.delete(dupe.id);
    await expect(undoMerge(snapshotId)).rejects.toBeInstanceOf(MergeUndoError);
    await expect(undoMerge(snapshotId)).rejects.toMatchObject({ code: 'changed' });
  });

  it('is refused after 30 days and the sweep removes the snapshot', async () => {
    const { lise, dupe } = await seedPair();
    const { snapshotId } = await mergeContactsUndoable(lise.id, dupe.id);
    const later = new Date(Date.now() + 31 * 86_400_000);
    await expect(undoMerge(snapshotId, later)).rejects.toMatchObject({ code: 'expired' });
    expect(await listMergeHistory(later)).toEqual([]);
    await purgeExpiredTrash(later);
    expect(await db.mergeSnapshots.count()).toBe(0);
    await expect(undoMerge(snapshotId)).rejects.toMatchObject({ code: 'missing' });
  });

  it('plain mergeContacts (used by imports) records no snapshot', async () => {
    const { mergeContacts } = await import('@/db/repositories');
    const { lise, dupe } = await seedPair();
    await mergeContacts(lise.id, dupe.id);
    expect(await db.mergeSnapshots.count()).toBe(0);
  });

  it('archiving the kept contact after the merge blocks undo', async () => {
    const { lise, dupe } = await seedPair();
    const { snapshotId } = await mergeContactsUndoable(lise.id, dupe.id);
    await updateContactStatus(lise.id, { isArchived: true });
    await expect(undoMerge(snapshotId)).rejects.toMatchObject({ code: 'changed' });
  });
});
