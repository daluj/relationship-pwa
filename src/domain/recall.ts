// Memory recall (features §8.11): the pre-meeting brief, "On this day" and milestones.
// Everything is derived from existing records; nothing is ranked or scored (mission §1.2).
import { inYear, nextOccurrence } from './partialDate';
import { balances } from './money';
import type {
  Contact,
  Debt,
  Gift,
  ImportantDate,
  Moment,
  PartialDate,
  Relationship,
  RelationshipType,
  Task,
} from './types';

const newestFirst = (a: Moment, b: Moment) => b.happenedAt.localeCompare(a.happenedAt);

export const BRIEF_RECENT_MOMENTS = 5;
export const BRIEF_RECENT_GIFTS = 3;
export const BRIEF_UPCOMING_DATES = 3;

export interface UpcomingDate {
  id: string;
  /** `birthday` or the label of an important date. */
  kind: 'birthday' | 'important-date';
  label?: string;
  date: Date;
}

export interface Brief {
  recentMoments: Moment[];
  openTasks: Task[];
  /** Net unsettled balance per currency; positive means they owe you (D-044). */
  balances: Record<string, number>;
  unsettledDebts: Debt[];
  giftIdeas: Gift[];
  giftsGiven: Gift[];
  upcoming: UpcomingDate[];
}

interface BriefInput {
  contact: Contact;
  moments: Moment[];
  tasks: Task[];
  debts: Debt[];
  gifts: Gift[];
  importantDates: ImportantDate[];
  today: Date;
}

const live = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

/** Dated tasks first (soonest), then undated ones. */
const byDue = (a: Task, b: Task) =>
  (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
  a.createdAt.localeCompare(b.createdAt);

/** features §8.11 AC-1..3 and AC-7. */
export function buildBrief(input: BriefInput): Brief {
  const { contact, today } = input;
  const unsettledDebts = live(input.debts).filter((d) => !d.settledAt);
  const gifts = live(input.gifts);
  const upcoming: UpcomingDate[] = [];
  if (contact.birthday && !contact.isDeceased) {
    upcoming.push({
      id: 'birthday',
      kind: 'birthday',
      date: nextOccurrence(contact.birthday, today),
    });
  }
  for (const d of live(input.importantDates)) {
    upcoming.push({
      id: d.id,
      kind: 'important-date',
      label: d.label,
      date: nextOccurrence(d.date, today),
    });
  }
  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    recentMoments: live(input.moments).sort(newestFirst).slice(0, BRIEF_RECENT_MOMENTS),
    openTasks: live(input.tasks)
      .filter((t) => !t.completedAt)
      .sort(byDue),
    balances: balances(unsettledDebts),
    unsettledDebts,
    giftIdeas: gifts.filter((g) => g.status === 'idea'),
    giftsGiven: gifts
      .filter((g) => g.status === 'given')
      .sort((a, b) => (b.date ?? b.createdAt).localeCompare(a.date ?? a.createdAt))
      .slice(0, BRIEF_RECENT_GIFTS),
    upcoming: upcoming.slice(0, BRIEF_UPCOMING_DATES),
  };
}

export const isBriefEmpty = (b: Brief, contact: Contact): boolean =>
  b.recentMoments.length === 0 &&
  b.openTasks.length === 0 &&
  b.unsettledDebts.length === 0 &&
  b.giftIdeas.length === 0 &&
  b.giftsGiven.length === 0 &&
  b.upcoming.length === 0 &&
  !contact.howWeMet &&
  !contact.bio &&
  !contact.foodPreferences;

// ── On this day ──────────────────────────────────────────────────────────────

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export interface OnThisDayGroup {
  year: number;
  yearsAgo: number;
  moments: Moment[];
}

/** Local `[start, end)` ISO bounds of the calendar day `month/day` in `year`. */
export function dayBounds(year: number, month: number, day: number): [string, string] {
  return [
    new Date(year, month - 1, day).toISOString(),
    new Date(year, month - 1, day + 1).toISOString(),
  ];
}

/** Month/days that count as "today" in an earlier `year`: Feb 29 shows on Feb 28 in non-leap years (AC-5). */
export function onThisDayDays(today: Date, year: number): Array<[number, number]> {
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const days: Array<[number, number]> = [[month, day]];
  if (month === 2 && day === 28 && !isLeapYear(today.getFullYear()) && isLeapYear(year)) {
    days.push([2, 29]);
  }
  return days;
}

/** Group moments from earlier years that fall on today's month and day (AC-4). */
export function groupOnThisDay(moments: Moment[], today: Date): OnThisDayGroup[] {
  const thisYear = today.getFullYear();
  const byYear = new Map<number, Moment[]>();
  for (const m of live(moments)) {
    const d = new Date(m.happenedAt);
    const year = d.getFullYear();
    if (year >= thisYear) continue;
    const hit = onThisDayDays(today, year).some(
      ([mo, da]) => d.getMonth() + 1 === mo && d.getDate() === da,
    );
    if (!hit) continue;
    byYear.set(year, [...(byYear.get(year) ?? []), m]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, list]) => ({ year, yearsAgo: thisYear - year, moments: list.sort(newestFirst) }));
}

// ── Milestones ───────────────────────────────────────────────────────────────

export type MilestoneType =
  'met' | 'relationship' | 'life-event' | 'important-date' | 'first-moment' | 'gift';

export interface Milestone {
  id: string;
  type: MilestoneType;
  date: Date;
  /** Free text: a place, an important-date label, a gift name. */
  text?: string;
  relationshipType?: RelationshipType;
  otherContactId?: string;
  lifeEventType?: Moment['lifeEventType'];
  /** Moment to open, when the milestone comes from one. */
  momentId?: string;
}

interface MilestoneInput {
  contact: Contact;
  moments: Moment[];
  relationships: Relationship[];
  importantDates: ImportantDate[];
  gifts: Gift[];
}

/** A partial date counts as a milestone only when its year is known (AC-6). */
const yearly = (pd: PartialDate | undefined): Date | undefined =>
  pd?.year === undefined ? undefined : inYear(pd, pd.year);

/** Dated moments in the history of a relationship, oldest first (features §8.11 AC-6). */
export function buildMilestones(input: MilestoneInput): Milestone[] {
  const { contact } = input;
  const out: Milestone[] = [];

  const met = yearly(contact.howWeMet?.date);
  if (met) {
    out.push({
      id: 'met',
      type: 'met',
      date: met,
      text: contact.howWeMet?.place,
      otherContactId: contact.howWeMet?.introducedById,
    });
  }
  for (const r of live(input.relationships)) {
    const since = yearly(r.since);
    if (since) {
      out.push({
        id: `rel-${r.id}`,
        type: 'relationship',
        date: since,
        relationshipType: r.type,
        otherContactId: r.toContactId,
      });
    }
  }
  for (const d of live(input.importantDates)) {
    const date = yearly(d.date);
    if (date) out.push({ id: `date-${d.id}`, type: 'important-date', date, text: d.label });
  }
  for (const g of live(input.gifts)) {
    if (g.status === 'given' && g.date) {
      const date = new Date(g.date);
      if (!Number.isNaN(date.getTime())) {
        out.push({ id: `gift-${g.id}`, type: 'gift', date, text: g.name });
      }
    }
  }
  const moments = live(input.moments);
  for (const m of moments) {
    if (m.kind === 'life-event') {
      out.push({
        id: `moment-${m.id}`,
        type: 'life-event',
        date: new Date(m.happenedAt),
        lifeEventType: m.lifeEventType,
        text: m.location,
        momentId: m.id,
      });
    }
  }
  const first = [...moments].sort((a, b) => a.happenedAt.localeCompare(b.happenedAt))[0];
  // A first moment that is itself a life event is already listed above.
  if (first && first.kind !== 'life-event') {
    out.push({
      id: 'first',
      type: 'first-moment',
      date: new Date(first.happenedAt),
      momentId: first.id,
    });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
}
