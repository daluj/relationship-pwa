import type { Goal, GoalMilestone, GoalReview, GoalStatus, Task } from '@/domain/types';
import { weekOf } from '@/domain/goals';
import { db } from '../db';
import { nowIso } from './createRepository';
import { goalMilestoneRepo, goalRepo, goalReviewRepo, taskRepo } from './entities';
import { RecordNotFoundError } from './errors';
import { syncGoalReminders } from './reminderService';
import { indexGoal, removeGoalFromIndex, searchTables } from './searchService';

// features §8.11. Cross-entity goal writes: one transaction, search index and deadline reminders kept in step.

const tables = () => [
  db.goals,
  db.goalMilestones,
  db.goalReviews,
  db.tasks,
  db.reminders,
  ...searchTables(),
];

export type GoalDraft = Pick<
  Goal,
  'title' | 'why' | 'area' | 'deadline' | 'nextAction' | 'contactIds'
>;

const mustGet = async (id: string): Promise<Goal> => {
  const goal = await goalRepo.get(id);
  if (!goal) throw new RecordNotFoundError('goal', id);
  return goal;
};

async function refresh(goal: Goal): Promise<Goal> {
  await syncGoalReminders(goal);
  await indexGoal(goal.id);
  return goal;
}

const nextOrder = async (table: { toArray: () => Promise<{ sortOrder: number }[]> }) =>
  (await table.toArray()).reduce((max, r) => Math.max(max, r.sortOrder + 1), 0);

/** Create or update a goal (AC-1). Optional fields left empty are cleared. */
export async function saveGoal(id: string | undefined, draft: GoalDraft): Promise<Goal> {
  return db.transaction('rw', tables(), async () => {
    const data = { ...draft, contactIds: [...new Set(draft.contactIds)] };
    if (id) {
      await mustGet(id);
      return refresh(
        await goalRepo.update(id, {
          why: undefined,
          area: undefined,
          deadline: undefined,
          nextAction: undefined,
          ...data,
        }),
      );
    }
    const sortOrder = await nextOrder(db.goals.filter((g) => !g.deletedAt));
    return refresh(await goalRepo.create({ ...data, sortOrder }));
  });
}

/** Status changes (AC-3): achieving stamps `achievedAt`, any other status clears it. */
export async function setGoalStatus(id: string, status: GoalStatus): Promise<Goal> {
  return db.transaction('rw', tables(), async () => {
    await mustGet(id);
    return refresh(
      await goalRepo.update(id, {
        status,
        achievedAt: status === 'achieved' ? nowIso() : undefined,
      }),
    );
  });
}

/** Soft-delete a goal and its milestones; linked tasks are unlinked, not deleted (AC-6). */
export async function deleteGoal(id: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    const goal = await mustGet(id);
    const now = nowIso();
    await goalRepo.softDelete(id);
    await db.goalMilestones
      .where('goalId')
      .equals(id)
      .filter((m) => !m.deletedAt)
      .modify((m) => {
        m.deletedAt = now;
        m.updatedAt = now;
      });
    await db.tasks
      .where('goalId')
      .equals(id)
      .modify((t) => {
        delete t.goalId;
        t.updatedAt = now;
      });
    await refresh({ ...goal, deletedAt: now });
  });
}

/** Permanently remove a goal with its milestones and deadline reminders (demo removal, Trash purge). */
export async function purgeGoal(id: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    await db.goalMilestones.where('goalId').equals(id).delete();
    await db.reminders
      .where('source')
      .equals('goal')
      .filter((r) => !!r.sourceId?.startsWith(`${id}:`))
      .delete();
    await db.tasks
      .where('goalId')
      .equals(id)
      .modify((t) => {
        delete t.goalId;
      });
    await removeGoalFromIndex(id);
    await db.goals.delete(id);
  });
}

/** Undo a delete. Milestones tombstoned with the goal come back; tasks stay unlinked. */
export async function restoreGoal(id: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    const deleted = await goalRepo.get(id, { includeDeleted: true });
    if (!deleted) throw new RecordNotFoundError('goal', id);
    const stamp = deleted.deletedAt;
    await goalRepo.restore(id);
    await db.goalMilestones
      .where('goalId')
      .equals(id)
      .filter((m) => !!stamp && m.deletedAt === stamp)
      .modify((m) => {
        delete m.deletedAt;
        m.updatedAt = nowIso();
      });
    await refresh(await mustGet(id));
  });
}

// ── Milestones ───────────────────────────────────────────────────────────────

export type MilestoneDraft = Pick<GoalMilestone, 'title' | 'dueDate'>;

export async function saveMilestone(
  goalId: string,
  id: string | undefined,
  draft: MilestoneDraft,
): Promise<GoalMilestone> {
  return db.transaction('rw', [db.goals, db.goalMilestones], async () => {
    await mustGet(goalId);
    if (id) return goalMilestoneRepo.update(id, { dueDate: undefined, ...draft });
    const sortOrder = await nextOrder(
      db.goalMilestones
        .where('goalId')
        .equals(goalId)
        .filter((m) => !m.deletedAt),
    );
    return goalMilestoneRepo.create({ ...draft, goalId, sortOrder });
  });
}

export const setMilestoneDone = (id: string, done: boolean) =>
  goalMilestoneRepo.update(id, { completedAt: done ? nowIso() : undefined });

export const deleteMilestone = (id: string) => goalMilestoneRepo.softDelete(id);
export const restoreMilestone = (id: string) => goalMilestoneRepo.restore(id);

/** Swap a milestone with its neighbour (`-1` up, `1` down). */
export async function moveMilestone(id: string, step: -1 | 1): Promise<void> {
  await db.transaction('rw', db.goalMilestones, async () => {
    const m = await goalMilestoneRepo.get(id);
    if (!m) throw new RecordNotFoundError('goalMilestone', id);
    const list = await milestonesFor(m.goalId);
    const from = list.findIndex((x) => x.id === id);
    const to = from + step;
    if (to < 0 || to >= list.length) return;
    const reordered = [...list];
    reordered.splice(to, 0, reordered.splice(from, 1)[0]!);
    for (const [sortOrder, x] of reordered.entries()) {
      if (x.sortOrder !== sortOrder) await goalMilestoneRepo.update(x.id, { sortOrder });
    }
  });
}

// ── Reads ────────────────────────────────────────────────────────────────────

export const listGoals = (): Promise<Goal[]> => goalRepo.list();

export const listMilestones = (): Promise<GoalMilestone[]> => goalMilestoneRepo.list();

export const milestonesFor = async (goalId: string): Promise<GoalMilestone[]> =>
  (
    await db.goalMilestones
      .where('goalId')
      .equals(goalId)
      .filter((m) => !m.deletedAt)
      .toArray()
  ).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));

export const tasksForGoal = (goalId: string): Promise<Task[]> =>
  db.tasks
    .where('goalId')
    .equals(goalId)
    .filter((t) => !t.deletedAt)
    .toArray();

/** Live goals a contact helps with (contact Details tab, AC-5). */
export const goalsFor = (contactId: string): Promise<Goal[]> =>
  db.goals
    .where('contactIds')
    .equals(contactId)
    .filter((g) => !g.deletedAt)
    .toArray();

/** Link or unlink a task to a goal from the task side. */
export const setTaskGoal = (taskId: string, goalId: string | undefined) =>
  taskRepo.update(taskId, { goalId });

// ── Weekly review (AC-7) ─────────────────────────────────────────────────────

export const listReviews = (): Promise<GoalReview[]> => goalReviewRepo.list();

/** One review per week: saving again in the same week edits the note. */
export async function saveWeeklyReview(note?: string, now = new Date()): Promise<GoalReview> {
  const week = weekOf(now);
  const trimmed = note?.trim() || undefined;
  return db.transaction('rw', db.goalReviews, async () => {
    const existing = await db.goalReviews.where('weekOf').equals(week).first();
    if (!existing) return goalReviewRepo.create({ weekOf: week, note: trimmed });
    return goalReviewRepo.update(existing.id, { note: trimmed });
  });
}
