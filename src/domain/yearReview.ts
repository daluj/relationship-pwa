// Year in review (features §8.13): plain counts, in a fixed order, never ranked (mission §1.2).
import type { Contact, Debt, Gift, Moment, MomentKind } from './types';
import { momentKinds } from './schemas';

export interface YearReview {
  year: number;
  /** Moments per kind, in the fixed `momentKinds` order. */
  momentsByKind: Record<MomentKind, number>;
  momentTotal: number;
  /** Distinct people mentioned in this year's moments. */
  peopleMentioned: number;
  newContacts: number;
  giftsGiven: number;
  debtsSettled: number;
  tagsUsed: number;
}

const live = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter((r) => !r.deletedAt);
/** Local calendar year of an ISO instant or date. */
const yearOf = (iso: string) => new Date(iso).getFullYear();
const dateYear = (d: string) => (d.length === 10 ? Number(d.slice(0, 4)) : yearOf(d));

export function buildYearReview(
  year: number,
  input: { moments: Moment[]; contacts: Contact[]; gifts: Gift[]; debts: Debt[] },
): YearReview {
  const moments = live(input.moments).filter((m) => yearOf(m.happenedAt) === year);
  const momentsByKind = Object.fromEntries(momentKinds.map((k) => [k, 0])) as Record<
    MomentKind,
    number
  >;
  for (const m of moments) momentsByKind[m.kind]++;
  return {
    year,
    momentsByKind,
    momentTotal: moments.length,
    peopleMentioned: new Set(moments.flatMap((m) => m.contactIds)).size,
    newContacts: live(input.contacts).filter((c) => yearOf(c.createdAt) === year).length,
    giftsGiven: live(input.gifts).filter(
      (g) => g.status === 'given' && g.date !== undefined && dateYear(g.date) === year,
    ).length,
    debtsSettled: live(input.debts).filter((d) => d.settledAt && yearOf(d.settledAt) === year)
      .length,
    tagsUsed: new Set(moments.flatMap((m) => m.tagIds)).size,
  };
}

/** Years that have any moments, newest first (for the year picker). */
export function yearsWithMoments(moments: Moment[]): number[] {
  return [...new Set(live(moments).map((m) => yearOf(m.happenedAt)))].sort((a, b) => b - a);
}
