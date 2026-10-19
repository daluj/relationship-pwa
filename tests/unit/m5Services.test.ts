import { db } from '@/db/db';
import {
  addToGroup,
  contactRepo,
  debtRepo,
  debtsFor,
  deleteContact,
  deleteGroup,
  deleteRelationship,
  groupMemberCounts,
  groupMembers,
  groupTimeline,
  purgeExpiredTrash,
  relationshipsFor,
  removeFromGroup,
  restoreContact,
  restoreRelationship,
  saveDebt,
  saveGroup,
  saveMoment,
  saveRelationship,
  settleDebt,
  starredMoments,
  setMomentStarred,
  DuplicateError,
  ValidationError,
} from '@/db/repositories';
import { balances, formatMoney } from '@/domain/money';
import { countByGroup, groupOfRelationship, inverseOf } from '@/domain/relationships';
import { resetDb } from './helpers';

beforeEach(resetDb);
afterEach(() => vi.useRealTimers());

describe('relationship domain (SPEC §8.3)', () => {
  it('inverts asymmetric types and mirrors symmetric ones', () => {
    expect(inverseOf('parent')).toBe('child');
    expect(inverseOf('uncle-aunt')).toBe('nephew-niece');
    expect(inverseOf('protege')).toBe('mentor');
    expect(inverseOf('sibling')).toBe('sibling');
    expect(inverseOf('best-friend')).toBe('best-friend');
  });
  it('groups into Family / Love / Friends / Work / Other', () => {
    expect(groupOfRelationship('in-law')).toBe('family');
    expect(groupOfRelationship('ex-partner')).toBe('love');
    expect(groupOfRelationship('mentor')).toBe('work');
    expect(groupOfRelationship('neighbour')).toBe('other');
    expect(countByGroup(['parent', 'sibling', 'friend'])).toEqual({ family: 2, friends: 1 });
  });
});

describe('relationships', () => {
  const two = async () =>
    [
      await contactRepo.create({ firstName: 'Élise' }),
      await contactRepo.create({ firstName: 'Marc' }),
    ] as const;

  it('creates the inverse, linked both ways', async () => {
    const [a, b] = await two();
    const r = await saveRelationship(undefined, {
      fromContactId: a.id,
      toContactId: b.id,
      type: 'parent',
      since: { day: 1, month: 1, year: 2000 },
    });
    const [inv] = await relationshipsFor(b.id);
    expect(inv).toMatchObject({
      fromContactId: b.id,
      toContactId: a.id,
      type: 'child',
      inverseId: r.id,
      since: { year: 2000 },
    });
    expect(r.inverseId).toBe(inv!.id);
  });

  it('editing updates the inverse', async () => {
    const [a, b] = await two();
    const r = await saveRelationship(undefined, {
      fromContactId: a.id,
      toContactId: b.id,
      type: 'boss',
    });
    await saveRelationship(r.id, {
      fromContactId: a.id,
      toContactId: b.id,
      type: 'mentor',
      notes: 'since uni',
    });
    expect((await relationshipsFor(b.id))[0]).toMatchObject({
      type: 'protege',
      notes: 'since uni',
    });
  });

  it('deleting one side deletes the inverse (AC); undo restores both', async () => {
    const [a, b] = await two();
    await saveRelationship(undefined, { fromContactId: a.id, toContactId: b.id, type: 'friend' });
    const [inv] = await relationshipsFor(b.id);
    await deleteRelationship(inv!.id);
    expect(await relationshipsFor(a.id)).toEqual([]);
    expect(await relationshipsFor(b.id)).toEqual([]);
    await restoreRelationship(inv!.id);
    expect(await relationshipsFor(a.id)).toHaveLength(1);
  });

  it('rejects self links and duplicates; contact delete/restore cascades both sides', async () => {
    const [a, b] = await two();
    await expect(
      saveRelationship(undefined, { fromContactId: a.id, toContactId: a.id, type: 'friend' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await saveRelationship(undefined, { fromContactId: a.id, toContactId: b.id, type: 'friend' });
    await expect(
      saveRelationship(undefined, { fromContactId: a.id, toContactId: b.id, type: 'friend' }),
    ).rejects.toBeInstanceOf(DuplicateError);
    await deleteContact(a.id);
    expect(await relationshipsFor(b.id)).toEqual([]);
    await restoreContact(a.id);
    expect(await relationshipsFor(b.id)).toHaveLength(1);
  });
});

describe('money (SPEC §8.7)', () => {
  it('nets unsettled debts per currency without float drift', () => {
    const d = (
      direction: 'i-owe' | 'they-owe',
      amount: number,
      currency = 'EUR',
      settledAt?: string,
    ) => ({ direction, amount, currency, settledAt }) as never;
    expect(
      balances([
        d('they-owe', 0.1),
        d('they-owe', 0.2),
        d('i-owe', 20, 'USD'),
        d('they-owe', 5, 'EUR', 'x'),
      ]),
    ).toEqual({ EUR: 0.3, USD: -20 });
    expect(balances([d('they-owe', 10), d('i-owe', 10)])).toEqual({});
    expect(formatMoney(35, 'EUR', 'en')).toBe('€35.00');
  });

  it('settling removes a debt from the balance and records the date (AC)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T10:00:00Z'));
    const c = await contactRepo.create({ firstName: 'Ana' });
    const debt = await saveDebt(undefined, {
      contactId: c.id,
      direction: 'they-owe',
      amount: 35,
      currency: 'EUR',
      date: '2026-10-01',
    });
    await saveDebt(undefined, {
      contactId: c.id,
      direction: 'i-owe',
      amount: 20,
      currency: 'EUR',
      date: '2026-10-02',
    });
    expect(balances(await debtsFor(c.id))).toEqual({ EUR: 15 });
    await settleDebt(debt.id, true);
    expect(balances(await debtsFor(c.id))).toEqual({ EUR: -20 });
    expect((await debtRepo.get(debt.id))?.settledAt).toBe('2026-10-19T10:00:00.000Z');
    await settleDebt(debt.id, false);
    expect(await debtRepo.get(debt.id)).not.toHaveProperty('settledAt');
  });
});

describe('groups (SPEC §6.7, §8.8)', () => {
  it('membership, counts, timeline, soft delete, purge cleanup', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const g = await saveGroup(undefined, { name: 'Book club', emoji: '📚' });
    const a = await contactRepo.create({ firstName: 'A' });
    const b = await contactRepo.create({ firstName: 'B' });
    const c = await contactRepo.create({ firstName: 'C' });
    await addToGroup(a.id, g.id);
    await addToGroup(a.id, g.id); // idempotent
    await addToGroup(b.id, g.id);
    expect((await groupMembers(g.id)).map((x) => x.firstName).sort()).toEqual(['A', 'B']);
    expect(await groupMemberCounts()).toEqual({ [g.id]: 2 });

    const both = await saveMoment(undefined, {
      kind: 'note',
      body: 'x',
      happenedAt: '2026-01-01T10:00:00.000Z',
      contactIds: [a.id, b.id],
      photos: [],
    });
    await saveMoment(undefined, {
      kind: 'note',
      body: 'y',
      happenedAt: '2026-01-01T09:00:00.000Z',
      contactIds: [c.id],
      photos: [],
    });
    expect((await groupTimeline(g.id)).map((m) => m.id)).toEqual([both.id]);

    await removeFromGroup(b.id, g.id);
    expect(await groupMembers(g.id)).toHaveLength(1);

    await deleteGroup(g.id);
    expect((await contactRepo.get(a.id))?.groupIds).toEqual([g.id]); // kept for undo
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    await purgeExpiredTrash();
    expect(await db.groups.get(g.id)).toBeUndefined();
    expect((await contactRepo.get(a.id))?.groupIds).toEqual([]);
  });
});

it('starred moments, newest first', async () => {
  const m1 = await saveMoment(undefined, {
    kind: 'note',
    body: 'a',
    happenedAt: '2026-01-01T00:00:00.000Z',
    contactIds: [],
    photos: [],
  });
  const m2 = await saveMoment(undefined, {
    kind: 'note',
    body: 'b',
    happenedAt: '2026-02-01T00:00:00.000Z',
    contactIds: [],
    photos: [],
  });
  await saveMoment(undefined, {
    kind: 'note',
    body: 'c',
    happenedAt: '2026-03-01T00:00:00.000Z',
    contactIds: [],
    photos: [],
  });
  await setMomentStarred(m1.id, true);
  await setMomentStarred(m2.id, true);
  expect((await starredMoments()).map((m) => m.body)).toEqual(['b', 'a']);
});
