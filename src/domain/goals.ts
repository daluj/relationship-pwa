import { addDays, parseIsoDate } from './recurrence';
import { toIsoDate } from './partialDate';
import type { Goal, GoalMilestone } from './types';

// features §8.11. Progress and the review streak apply to the user's own goals only, never to people (D-069).

/** Most goals shown on the Home right-rail Today card (AC-8). */
export const TODAY_GOAL_LIMIT = 3;

/** Percentage of live milestones done (0–100), or `undefined` when the goal has none (AC-2). */
export function goalProgress(milestones: Pick<GoalMilestone, 'completedAt' | 'deletedAt'>[]) {
  const live = milestones.filter((m) => !m.deletedAt);
  if (!live.length) return undefined;
  return Math.round((live.filter((m) => m.completedAt).length / live.length) * 100);
}

/** `YYYY-MM-DD` of the Sunday that starts the week containing `date` (local time). */
export function weekOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  return toIsoDate(d);
}

/** Consecutive reviewed weeks ending this week or last week (AC-7). */
export function reviewStreak(weeks: string[], today: Date): number {
  const done = new Set(weeks);
  const thisWeek = weekOf(today);
  let cursor = done.has(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  let streak = 0;
  while (done.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

/** True when the weekly review for the current week is still to do. */
export const reviewDue = (weeks: string[], today: Date) => !weeks.includes(weekOf(today));

/** Soonest deadline first, goals without one last, then the order they were added. */
export const compareGoals = (a: Goal, b: Goal): number =>
  (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') ||
  a.sortOrder - b.sortOrder ||
  a.createdAt.localeCompare(b.createdAt);

/** Active goals for the Today card (AC-8). */
export const todayGoals = (goals: Goal[], limit = TODAY_GOAL_LIMIT): Goal[] =>
  goals
    .filter((g) => g.status === 'active' && !g.deletedAt)
    .sort(compareGoals)
    .slice(0, limit);

/** Goals that get deadline reminders: active, with a deadline (AC-4). */
export const wantsDeadlineReminders = (
  g: Pick<Goal, 'status' | 'deadline'> & { deletedAt?: string },
) => g.status === 'active' && !!g.deadline && !g.deletedAt;

/** Reminder dates: a week before the deadline, and on the day. */
export const deadlineReminderDates = (deadline: string) => ({
  week: addDays(deadline, -7),
  day: deadline,
});

/** Whole days from `today` to the deadline (negative once past). */
export const daysLeft = (deadline: string, today: Date) =>
  Math.round(
    (parseIsoDate(deadline).getTime() - parseIsoDate(toIsoDate(today)).getTime()) / 86_400_000,
  );
