import { buildYearReview, yearsWithMoments } from '@/domain/yearReview';
import type { Contact, Debt, Gift, Moment } from '@/domain/types';

const at = (y: number, m = 5, d = 5) => new Date(y, m - 1, d, 12).toISOString();
const moment = (over: Partial<Moment>) =>
  ({
    id: 'm',
    kind: 'note',
    body: '',
    happenedAt: at(2025),
    contactIds: [],
    tagIds: [],
    ...over,
  }) as Moment;

describe('buildYearReview (features §8.13 AC-8)', () => {
  const input = {
    moments: [
      moment({ kind: 'call', happenedAt: at(2025), contactIds: ['a', 'b'], tagIds: ['t1'] }),
      moment({
        kind: 'call',
        happenedAt: at(2025, 12, 31),
        contactIds: ['a'],
        tagIds: ['t1', 't2'],
      }),
      moment({ kind: 'journal', happenedAt: at(2025) }),
      moment({ kind: 'note', happenedAt: at(2024) }),
      moment({
        kind: 'note',
        happenedAt: at(2025),
        deletedAt: '2026-01-01T00:00:00.000Z',
        contactIds: ['z'],
      }),
    ],
    contacts: [
      { createdAt: at(2025) },
      { createdAt: at(2024) },
      { createdAt: at(2025), deletedAt: '2026-01-01T00:00:00.000Z' },
    ] as Contact[],
    gifts: [
      { status: 'given', date: '2025-03-01' },
      { status: 'given', date: at(2025) },
      { status: 'idea', date: '2025-03-01' },
      { status: 'given' },
    ] as Gift[],
    debts: [{ settledAt: at(2025) }, { settledAt: at(2024) }, {}] as Debt[],
  };
  it('counts what happened in the year, excluding deleted records', () => {
    expect(buildYearReview(2025, input)).toEqual({
      year: 2025,
      momentsByKind: { activity: 0, note: 0, call: 2, journal: 1, 'life-event': 0 },
      momentTotal: 3,
      peopleMentioned: 2,
      newContacts: 1,
      giftsGiven: 2,
      debtsSettled: 1,
      tagsUsed: 2,
    });
  });
  it('is all zeros for a year without data', () => {
    const r = buildYearReview(2020, input);
    expect(r.momentTotal).toBe(0);
    expect(Object.values(r.momentsByKind).every((n) => n === 0)).toBe(true);
  });
  it('lists years with moments newest first', () => {
    expect(yearsWithMoments(input.moments)).toEqual([2025, 2024]);
  });
});
