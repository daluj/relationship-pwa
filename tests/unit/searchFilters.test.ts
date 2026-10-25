import {
  contactMatchesFilters,
  dayRange,
  filtersFromParams,
  filtersToParams,
  hasAnyFilter,
  momentMatchesFilters,
  staleCutoff,
} from '@/domain/searchFilters';
import type { Contact, Moment } from '@/domain/types';

const moment = (over: Partial<Moment>): Moment =>
  ({
    id: 'm',
    kind: 'note',
    body: '',
    happenedAt: new Date(2026, 2, 10, 12).toISOString(),
    contactIds: [],
    tagIds: [],
    photoBlobIds: [],
    isStarred: false,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Moment;
const contact = (over: Partial<Contact>): Contact =>
  ({
    id: 'c',
    firstName: 'A',
    isStarred: false,
    isArchived: false,
    tagIds: [],
    groupIds: [],
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Contact;

describe('moment filters (features §8.13 AC-1, AC-3)', () => {
  it('kind and an inclusive local date range', () => {
    const f = { kinds: ['call' as const], from: '2026-03-10', to: '2026-03-10' };
    const lateEvening = moment({
      kind: 'call',
      happenedAt: new Date(2026, 2, 10, 23, 59).toISOString(),
    });
    const earlyMorning = moment({
      kind: 'call',
      happenedAt: new Date(2026, 2, 10, 0, 1).toISOString(),
    });
    expect(momentMatchesFilters(lateEvening, f)).toBe(true);
    expect(momentMatchesFilters(earlyMorning, f)).toBe(true);
    expect(momentMatchesFilters(moment({ kind: 'note' }), f)).toBe(false);
    expect(
      momentMatchesFilters(
        moment({ kind: 'call', happenedAt: new Date(2026, 2, 11, 0, 1).toISOString() }),
        f,
      ),
    ).toBe(false);
    expect(
      momentMatchesFilters(
        moment({ kind: 'call', happenedAt: new Date(2026, 2, 9, 23, 59).toISOString() }),
        f,
      ),
    ).toBe(false);
  });
  it('tags must all match; any member of a selected group matches', () => {
    expect(momentMatchesFilters(moment({ tagIds: ['a', 'b'] }), { tagIds: ['a', 'b'] })).toBe(true);
    expect(momentMatchesFilters(moment({ tagIds: ['a'] }), { tagIds: ['a', 'b'] })).toBe(false);
    const members = new Set(['p1']);
    expect(
      momentMatchesFilters(moment({ contactIds: ['p1', 'x'] }), { groupIds: ['g'] }, members),
    ).toBe(true);
    expect(momentMatchesFilters(moment({ contactIds: ['x'] }), { groupIds: ['g'] }, members)).toBe(
      false,
    );
  });
  it('"not contacted" is a people filter, so it excludes moments', () => {
    expect(momentMatchesFilters(moment({}), { notContactedDays: 30 })).toBe(false);
  });
});

describe('contact filters (AC-2)', () => {
  const now = new Date(2026, 5, 1);
  const f = { notContactedDays: 90 };
  it('matches never-contacted and older-than-N-days contacts', () => {
    expect(contactMatchesFilters(contact({}), f, now)).toBe(true);
    const old = new Date(2026, 1, 1).toISOString();
    expect(contactMatchesFilters(contact({ lastInteractionAt: old }), f, now)).toBe(true);
    const recent = new Date(2026, 4, 1).toISOString();
    expect(contactMatchesFilters(contact({ lastInteractionAt: recent }), f, now)).toBe(false);
  });
  it('excludes archived and deceased contacts', () => {
    expect(contactMatchesFilters(contact({ isArchived: true }), f, now)).toBe(false);
    expect(contactMatchesFilters(contact({ isDeceased: true }), f, now)).toBe(false);
  });
  it('kind or date filters exclude every contact', () => {
    expect(contactMatchesFilters(contact({}), { kinds: ['call'] }, now)).toBe(false);
  });
  it('tags all, groups any', () => {
    expect(contactMatchesFilters(contact({ tagIds: ['a'] }), { tagIds: ['a'] }, now)).toBe(true);
    expect(
      contactMatchesFilters(contact({ groupIds: ['g2'] }), { groupIds: ['g1', 'g2'] }, now),
    ).toBe(true);
    expect(contactMatchesFilters(contact({ groupIds: [] }), { groupIds: ['g1'] }, now)).toBe(false);
  });
  it('staleCutoff subtracts whole days', () => {
    expect(staleCutoff(new Date('2026-04-01T00:00:00Z'), 1)).toBe('2026-03-31T00:00:00.000Z');
  });
});

describe('URL params', () => {
  it('round-trips filters and ignores junk', () => {
    const f = {
      kinds: ['call' as const, 'note' as const],
      from: '2026-01-01',
      to: '2026-02-01',
      tagIds: ['t1'],
      groupIds: ['g1', 'g2'],
      notContactedDays: 90,
    };
    expect(filtersFromParams(filtersToParams(f))).toEqual(f);
    const junk = new URLSearchParams('kinds=nope&from=yesterday&stale=-3&tags=');
    expect(filtersFromParams(junk)).toEqual({});
    expect(hasAnyFilter({})).toBe(false);
    expect(hasAnyFilter({ tagIds: ['a'] })).toBe(true);
  });
  it('filtersToParams replaces old filter params but keeps others', () => {
    const base = new URLSearchParams('q=lyon&kinds=call');
    const next = filtersToParams({ tagIds: ['t'] }, base);
    expect(next.get('q')).toBe('lyon');
    expect(next.get('kinds')).toBeNull();
    expect(next.get('tags')).toBe('t');
  });
  it('dayRange is open-ended on a missing side', () => {
    expect(dayRange()).toEqual({ start: undefined, end: undefined });
    expect(dayRange('2026-03-10').end).toBeUndefined();
  });
});
