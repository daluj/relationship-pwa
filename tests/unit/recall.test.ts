import { db } from '@/db/db';
import {
  contactRepo,
  getBrief,
  getMilestones,
  getOnThisDay,
  giftRepo,
  importantDateRepo,
  momentRepo,
  relationshipRepo,
  saveDebt,
  saveGift,
  saveTask,
  settleDebt,
} from '@/db/repositories';
import { buildBrief, buildMilestones, groupOnThisDay } from '@/domain/recall';
import type { Moment } from '@/domain/types';
import { resetDb } from './helpers';

beforeEach(resetDb);

const at = (iso: string): Moment =>
  ({
    id: iso,
    kind: 'note',
    body: '',
    happenedAt: new Date(iso).toISOString(),
    contactIds: [],
    tagIds: [],
    photoBlobIds: [],
    isStarred: false,
    createdAt: iso,
    updatedAt: iso,
  }) as Moment;

describe('groupOnThisDay (features §8.11 AC-4, AC-5)', () => {
  const today = new Date(2026, 9, 25);
  it('groups earlier years on the same month and day, newest year first', () => {
    const groups = groupOnThisDay(
      [
        at('2024-10-25T09:00:00'),
        at('2022-10-25T09:00:00'),
        at('2024-10-24T09:00:00'),
        at('2026-10-25T08:00:00'), // today: excluded
      ],
      today,
    );
    expect(groups.map((g) => [g.year, g.yearsAgo, g.moments.length])).toEqual([
      [2024, 2, 1],
      [2022, 4, 1],
    ]);
  });
  it('skips deleted moments', () => {
    const m = { ...at('2024-10-25T09:00:00'), deletedAt: '2026-01-01T00:00:00.000Z' };
    expect(groupOnThisDay([m], today)).toEqual([]);
  });
  it('shows a Feb 29 moment on Feb 28 in a non-leap year, but not in a leap year', () => {
    const leapDay = at('2024-02-29T10:00:00');
    expect(groupOnThisDay([leapDay], new Date(2027, 1, 28))).toHaveLength(1);
    expect(groupOnThisDay([leapDay], new Date(2028, 1, 28))).toHaveLength(0);
    expect(groupOnThisDay([leapDay], new Date(2028, 1, 29))).toHaveLength(1);
  });
});

describe('buildBrief (AC-1..AC-3)', () => {
  it('limits and orders recent moments, tasks, debts and gifts', async () => {
    const c = await contactRepo.create({ firstName: 'Élise' });
    const base = { contactId: c.id } as const;
    const moments = Array.from({ length: 7 }, (_, i) => ({
      ...at(`2026-10-0${i + 1}T10:00:00`),
      contactIds: [c.id],
    }));
    const tasks = [
      { id: 'a', title: 'Later', dueDate: '2026-12-01', createdAt: '1', updatedAt: '1', ...base },
      { id: 'b', title: 'Undated', createdAt: '2', updatedAt: '2', ...base },
      { id: 'c', title: 'Sooner', dueDate: '2026-11-01', createdAt: '3', updatedAt: '3', ...base },
      {
        id: 'd',
        title: 'Done',
        completedAt: '2026-10-01',
        createdAt: '4',
        updatedAt: '4',
        ...base,
      },
    ];
    const gifts = [
      { id: 'g1', name: 'Book', status: 'idea', createdAt: '1', updatedAt: '1', ...base },
      { id: 'g2', name: 'Scarf', status: 'bought', createdAt: '2', updatedAt: '2', ...base },
      ...[1, 2, 3, 4].map((n) => ({
        id: `gg${n}`,
        name: `Given ${n}`,
        status: 'given',
        date: `2026-0${n}-01`,
        createdAt: '1',
        updatedAt: '1',
        ...base,
      })),
    ];
    const debts = [
      {
        id: 'd1',
        direction: 'they-owe',
        amount: 20,
        currency: 'EUR',
        date: '2026-01-01',
        createdAt: '1',
        updatedAt: '1',
        ...base,
      },
      {
        id: 'd2',
        direction: 'they-owe',
        amount: 5,
        currency: 'EUR',
        date: '2026-01-01',
        settledAt: '2026-02-01',
        createdAt: '1',
        updatedAt: '1',
        ...base,
      },
    ];
    const brief = buildBrief({
      contact: c,
      moments,
      tasks: tasks as never,
      debts: debts as never,
      gifts: gifts as never,
      importantDates: [],
      today: new Date(2026, 9, 25),
    });
    expect(brief.recentMoments).toHaveLength(5);
    expect(brief.recentMoments[0]!.happenedAt > brief.recentMoments[4]!.happenedAt).toBe(true);
    expect(brief.openTasks.map((t) => t.title)).toEqual(['Sooner', 'Later', 'Undated']);
    expect(brief.balances).toEqual({ EUR: 20 });
    expect(brief.unsettledDebts).toHaveLength(1);
    expect(brief.giftIdeas.map((g) => g.name)).toEqual(['Book']);
    expect(brief.giftsGiven.map((g) => g.name)).toEqual(['Given 4', 'Given 3', 'Given 2']);
  });

  it('lists the next birthday and important dates, none for deceased contacts', async () => {
    const c = await contactRepo.create({ firstName: 'Marc', birthday: { month: 11, day: 3 } });
    const input = {
      moments: [],
      tasks: [],
      debts: [],
      gifts: [],
      importantDates: [
        {
          id: 'i1',
          contactId: c.id,
          label: 'Anniversary',
          date: { month: 10, day: 30 },
          remind: true,
        } as never,
      ],
      today: new Date(2026, 9, 25),
    };
    const brief = buildBrief({ contact: c, ...input });
    expect(brief.upcoming.map((u) => u.kind)).toEqual(['important-date', 'birthday']);
    const gone = buildBrief({ contact: { ...c, isDeceased: true }, ...input });
    expect(gone.upcoming.map((u) => u.kind)).toEqual(['important-date']);
  });
});

describe('buildMilestones (AC-6)', () => {
  it('orders dated items oldest first and omits ones without a year', async () => {
    const c = await contactRepo.create({
      firstName: 'Élise',
      howWeMet: { date: { year: 2015, month: 6, day: 1 }, place: 'Lyon' },
    });
    const other = await contactRepo.create({ firstName: 'Marc' });
    const milestones = buildMilestones({
      contact: c,
      moments: [
        {
          ...at('2020-05-01T10:00:00'),
          kind: 'life-event',
          lifeEventType: 'moved',
          contactIds: [c.id],
        },
        { ...at('2018-01-01T10:00:00'), contactIds: [c.id] },
      ],
      relationships: [
        {
          id: 'r1',
          fromContactId: c.id,
          toContactId: other.id,
          type: 'friend',
          since: { year: 2016, month: 1, day: 1 },
        },
        {
          id: 'r2',
          fromContactId: c.id,
          toContactId: other.id,
          type: 'colleague',
          since: { month: 1, day: 1 },
        },
      ] as never,
      importantDates: [
        { id: 'i1', contactId: c.id, label: 'No year', date: { month: 1, day: 1 }, remind: true },
        {
          id: 'i2',
          contactId: c.id,
          label: 'Wedding',
          date: { year: 2019, month: 8, day: 3 },
          remind: true,
        },
      ] as never,
      gifts: [
        { id: 'g1', contactId: c.id, name: 'Book', status: 'given', date: '2021-12-25' },
      ] as never,
    });
    expect(milestones.map((m) => m.type)).toEqual([
      'met',
      'relationship',
      'first-moment',
      'important-date',
      'life-event',
      'gift',
    ]);
    expect(milestones.map((m) => m.date.getTime())).toEqual(
      [...milestones.map((m) => m.date.getTime())].sort((a, b) => a - b),
    );
  });
});

describe('recall service reads', () => {
  it('getBrief excludes deleted rows and other contacts', async () => {
    const a = await contactRepo.create({ firstName: 'A' });
    const b = await contactRepo.create({ firstName: 'B' });
    await momentRepo.create({ kind: 'note', body: 'mine', contactIds: [a.id] });
    const gone = await momentRepo.create({ kind: 'note', body: 'gone', contactIds: [a.id] });
    await momentRepo.softDelete(gone.id);
    await momentRepo.create({ kind: 'note', body: 'theirs', contactIds: [b.id] });
    await saveTask(undefined, { contactId: a.id, title: 'Call' });
    await saveTask(undefined, { contactId: b.id, title: 'Other' });
    await saveGift(undefined, { contactId: a.id, name: 'Tea', status: 'idea' });
    const debt = await saveDebt(undefined, {
      contactId: a.id,
      direction: 'i-owe',
      amount: 10,
      currency: 'EUR',
      date: '2026-01-01',
    });
    const brief = await getBrief(a, new Date(2026, 9, 25));
    expect(brief.recentMoments.map((m) => m.body)).toEqual(['mine']);
    expect(brief.openTasks.map((t) => t.title)).toEqual(['Call']);
    expect(brief.giftIdeas).toHaveLength(1);
    expect(brief.balances).toEqual({ EUR: -10 });
    await settleDebt(debt.id, true);
    expect((await getBrief(a, new Date(2026, 9, 25))).unsettledDebts).toHaveLength(0);
  });

  it('getMilestones reads relationships, important dates and gifts', async () => {
    const a = await contactRepo.create({ firstName: 'A' });
    const b = await contactRepo.create({ firstName: 'B' });
    await relationshipRepo.create({
      fromContactId: a.id,
      toContactId: b.id,
      type: 'friend',
      since: { year: 2010, month: 1, day: 1 },
    });
    await importantDateRepo.create({
      contactId: a.id,
      label: 'Met',
      date: { year: 2011, month: 2, day: 2 },
    });
    await giftRepo.create({ contactId: a.id, name: 'Book', status: 'given', date: '2012-03-03' });
    const m = await getMilestones(a);
    expect(m.map((x) => x.type)).toEqual(['relationship', 'important-date', 'gift']);
  });

  it('getOnThisDay finds earlier years by range query, ignoring deleted and today', async () => {
    await momentRepo.create({
      kind: 'note',
      body: 'two years',
      happenedAt: new Date(2024, 9, 25, 9).toISOString(),
    });
    await momentRepo.create({
      kind: 'note',
      body: 'five years',
      happenedAt: new Date(2021, 9, 25, 23, 30).toISOString(),
    });
    await momentRepo.create({
      kind: 'note',
      body: 'other day',
      happenedAt: new Date(2024, 9, 26, 9).toISOString(),
    });
    await momentRepo.create({
      kind: 'note',
      body: 'today',
      happenedAt: new Date(2026, 9, 25, 8).toISOString(),
    });
    const del = await momentRepo.create({
      kind: 'note',
      body: 'deleted',
      happenedAt: new Date(2023, 9, 25, 9).toISOString(),
    });
    await momentRepo.softDelete(del.id);
    const groups = await getOnThisDay(new Date(2026, 9, 25, 12));
    expect(groups.map((g) => [g.yearsAgo, g.moments.map((m) => m.body)])).toEqual([
      [2, ['two years']],
      [5, ['five years']],
    ]);
    expect(await db.moments.count()).toBe(5);
  });

  it('getOnThisDay shows Feb 29 moments on Feb 28 of a non-leap year', async () => {
    await momentRepo.create({
      kind: 'note',
      body: 'leap',
      happenedAt: new Date(2024, 1, 29, 9).toISOString(),
    });
    expect(await getOnThisDay(new Date(2027, 1, 28))).toHaveLength(1);
    expect(await getOnThisDay(new Date(2028, 1, 28))).toHaveLength(0);
  });
});
