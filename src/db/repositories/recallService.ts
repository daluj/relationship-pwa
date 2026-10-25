// Reads for memory recall (features §8.11). Nothing is stored; everything derives from live rows.
import {
  buildBrief,
  buildMilestones,
  dayBounds,
  groupOnThisDay,
  onThisDayDays,
  type Brief,
  type Milestone,
  type OnThisDayGroup,
} from '@/domain/recall';
import type { Contact, Moment } from '@/domain/types';
import { db } from '../db';
import { importantDatesFor } from './reminderService';
import { debtsFor, giftsFor, tasksFor } from './profileItems';
import { relationshipsFor } from './relationshipService';

const liveMomentsFor = (contactId: string): Promise<Moment[]> =>
  db.moments
    .where('contactIds')
    .equals(contactId)
    .filter((m) => !m.deletedAt)
    .toArray();

/** Everything "Before you meet" shows for one contact (AC-1..3). */
export async function getBrief(contact: Contact, today: Date): Promise<Brief> {
  const [moments, tasks, debts, gifts, importantDates] = await Promise.all([
    liveMomentsFor(contact.id),
    tasksFor(contact.id),
    debtsFor(contact.id),
    giftsFor(contact.id),
    importantDatesFor(contact.id),
  ]);
  return buildBrief({ contact, moments, tasks, debts, gifts, importantDates, today });
}

/** Rows behind the profile Milestones list (AC-6). */
export async function getMilestones(contact: Contact): Promise<Milestone[]> {
  const [moments, relationships, importantDates, gifts] = await Promise.all([
    liveMomentsFor(contact.id),
    relationshipsFor(contact.id),
    importantDatesFor(contact.id),
    giftsFor(contact.id),
  ]);
  return buildMilestones({ contact, moments, relationships, importantDates, gifts });
}

/**
 * Moments from earlier years on today's month and day (AC-4, AC-5). One `happenedAt` range query
 * per year, so cost follows the years covered, not the number of moments.
 */
export async function getOnThisDay(today: Date): Promise<OnThisDayGroup[]> {
  const t0 = performance.now();
  try {
    return await onThisDay(today);
  } finally {
    // Local-only timing the perf test reads (like D-050); never sent anywhere.
    performance.measure('kin-on-this-day', { start: t0, end: performance.now() });
  }
}

async function onThisDay(today: Date): Promise<OnThisDayGroup[]> {
  const oldest = await db.moments.orderBy('happenedAt').first();
  if (!oldest) return [];
  const firstYear = new Date(oldest.happenedAt).getFullYear();
  const found: Moment[] = [];
  for (let year = today.getFullYear() - 1; year >= firstYear; year--) {
    for (const [month, day] of onThisDayDays(today, year)) {
      const [start, end] = dayBounds(year, month, day);
      found.push(
        ...(await db.moments
          .where('happenedAt')
          .between(start, end, true, false)
          .filter((m) => !m.deletedAt)
          .toArray()),
      );
    }
  }
  return groupOnThisDay(found, today);
}

// Re-exported so UI code only imports from `db/repositories`.
export type { Brief, Milestone, OnThisDayGroup };
