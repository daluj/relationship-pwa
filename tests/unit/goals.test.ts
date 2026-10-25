// @vitest-environment node
// Goals (features §8.11, Phase 10). AC numbers refer to specs/2026-10-25-goals/requirements.md.
import { db } from '@/db/db';
import {
  contactRepo,
  deleteAllData,
  deleteContact,
  deleteGoal,
  deleteMilestone,
  ensureSearchIndex,
  exportBackup,
  goalsFor,
  importBackup,
  listReminders,
  loadDemoData,
  mergeContacts,
  milestonesFor,
  moveMilestone,
  purgeExpiredTrash,
  recordCounts,
  removeDemoData,
  restoreGoal,
  saveContact,
  saveGoal,
  saveMilestone,
  saveTask,
  saveWeeklyReview,
  search,
  setGoalStatus,
  setMilestoneDone,
  tasksForGoal,
  ValidationError,
  goalRepo,
  taskRepo,
} from '@/db/repositories';
import { BackupError, parseBackup } from '@/domain/backup';
import {
  compareGoals,
  daysLeft,
  deadlineReminderDates,
  goalProgress,
  reviewDue,
  reviewStreak,
  todayGoals,
  weekOf,
} from '@/domain/goals';
import type { Goal } from '@/domain/types';
import { resetDb } from './helpers';

beforeEach(resetDb);
afterEach(() => vi.useRealTimers());

const at = (iso: string) => vi.useFakeTimers({ toFake: ['Date'], now: new Date(iso) });
const person = (firstName: string) =>
  saveContact(undefined, { contact: { firstName }, fields: [], addresses: [] });
const goalOf = (over: Partial<Goal> = {}): Goal => ({
  id: crypto.randomUUID(),
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  title: 'G',
  status: 'active',
  contactIds: [],
  sortOrder: 0,
  ...over,
});
const goalReminders = async () =>
  (await listReminders())
    .filter((r) => r.source === 'goal')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

describe('goals domain', () => {
  it('progress is the share of live milestones done, undefined with none (AC-2)', () => {
    expect(goalProgress([])).toBeUndefined();
    expect(
      goalProgress([{ completedAt: 'x' }, {}, {}, { deletedAt: 'y' }, { completedAt: 'z' }]),
    ).toBe(50);
  });

  it('weeks start on Sunday (D-069 review)', () => {
    expect(weekOf(new Date(2026, 9, 25))).toBe('2026-10-25'); // a Sunday
    expect(weekOf(new Date(2026, 9, 31))).toBe('2026-10-25'); // Saturday
    expect(weekOf(new Date(2026, 10, 1))).toBe('2026-11-01'); // next Sunday
  });

  it('streak counts consecutive weeks ending this or last week (AC-7)', () => {
    const today = new Date(2026, 9, 28); // Wednesday; week of 10-25
    expect(reviewStreak([], today)).toBe(0);
    expect(reviewStreak(['2026-10-25', '2026-10-18', '2026-10-11'], today)).toBe(3);
    expect(reviewStreak(['2026-10-18', '2026-10-11'], today)).toBe(2); // this week still open
    expect(reviewStreak(['2026-10-25', '2026-10-11'], today)).toBe(1); // gap breaks it
    expect(reviewStreak(['2026-10-11'], today)).toBe(0);
    expect(reviewDue(['2026-10-18'], today)).toBe(true);
    expect(reviewDue(['2026-10-25'], today)).toBe(false);
  });

  it('Today card shows at most 3 active goals, soonest deadline first (AC-8)', () => {
    const goals = [
      goalOf({ title: 'none', sortOrder: 0 }),
      goalOf({ title: 'late', deadline: '2026-12-01' }),
      goalOf({ title: 'soon', deadline: '2026-11-01' }),
      goalOf({ title: 'mid', deadline: '2026-11-20' }),
      goalOf({ title: 'paused', status: 'paused', deadline: '2026-10-30' }),
      goalOf({ title: 'gone', deadline: '2026-10-29', deletedAt: '2026-10-02T00:00:00.000Z' }),
    ];
    expect(todayGoals(goals).map((g) => g.title)).toEqual(['soon', 'mid', 'late']);
    expect(todayGoals([goalOf({ status: 'achieved' })])).toEqual([]);
    expect([goals[0]!, goals[2]!].sort(compareGoals).map((g) => g.title)).toEqual(['soon', 'none']);
  });

  it('computes reminder dates and days left', () => {
    expect(deadlineReminderDates('2026-12-10')).toEqual({ week: '2026-12-03', day: '2026-12-10' });
    expect(daysLeft('2026-10-30', new Date(2026, 9, 28, 15))).toBe(2);
    expect(daysLeft('2026-10-27', new Date(2026, 9, 28))).toBe(-1);
  });
});

describe('goal service', () => {
  it('creates a goal with only a title; an empty title is rejected (AC-1)', async () => {
    const g = await saveGoal(undefined, { title: '  Run a marathon  ', contactIds: [] });
    expect(g).toMatchObject({ title: 'Run a marathon', status: 'active', sortOrder: 0 });
    await expect(saveGoal(undefined, { title: '   ', contactIds: [] })).rejects.toBeInstanceOf(
      ValidationError,
    );
    const second = await saveGoal(undefined, { title: 'Learn Spanish', contactIds: [] });
    expect(second.sortOrder).toBe(1);
  });

  it('clears optional fields left empty on edit', async () => {
    const g = await saveGoal(undefined, {
      title: 'A',
      why: 'because',
      deadline: '2027-01-01',
      contactIds: [],
    });
    const edited = await saveGoal(g.id, { title: 'A', contactIds: [] });
    expect(edited.why).toBeUndefined();
    expect(edited.deadline).toBeUndefined();
  });

  it('ticking milestones updates progress and un-ticking reverses it (AC-2)', async () => {
    const g = await saveGoal(undefined, { title: 'G', contactIds: [] });
    const a = await saveMilestone(g.id, undefined, { title: 'a' });
    const b = await saveMilestone(g.id, undefined, { title: 'b' });
    await setMilestoneDone(a.id, true);
    expect(goalProgress(await milestonesFor(g.id))).toBe(50);
    await setMilestoneDone(b.id, true);
    expect(goalProgress(await milestonesFor(g.id))).toBe(100);
    await setMilestoneDone(a.id, false);
    expect(goalProgress(await milestonesFor(g.id))).toBe(50);
  });

  it('reorders and deletes milestones', async () => {
    const g = await saveGoal(undefined, { title: 'G', contactIds: [] });
    const [a, b, c] = [
      await saveMilestone(g.id, undefined, { title: 'a' }),
      await saveMilestone(g.id, undefined, { title: 'b' }),
      await saveMilestone(g.id, undefined, { title: 'c' }),
    ];
    await moveMilestone(c!.id, -1);
    expect((await milestonesFor(g.id)).map((m) => m.title)).toEqual(['a', 'c', 'b']);
    await moveMilestone(a!.id, -1); // already first: no change
    await moveMilestone(b!.id, 1); // already last: no change
    expect((await milestonesFor(g.id)).map((m) => m.title)).toEqual(['a', 'c', 'b']);
    await deleteMilestone(c!.id);
    expect((await milestonesFor(g.id)).map((m) => m.title)).toEqual(['a', 'b']);
  });

  it('achieving sets achievedAt and reopening clears it (AC-3)', async () => {
    const g = await saveGoal(undefined, { title: 'G', contactIds: [] });
    const done = await setGoalStatus(g.id, 'achieved');
    expect(done.status).toBe('achieved');
    expect(done.achievedAt).toBeDefined();
    const reopened = await setGoalStatus(g.id, 'active');
    expect(reopened.achievedAt).toBeUndefined();
    expect((await setGoalStatus(g.id, 'paused')).achievedAt).toBeUndefined();
  });

  it('keeps deadline reminders in step with the goal (AC-4)', async () => {
    at('2026-10-25T10:00:00');
    const g = await saveGoal(undefined, { title: 'Ship', deadline: '2026-12-10', contactIds: [] });
    expect((await goalReminders()).map((r) => [r.dueDate, r.sourceId])).toEqual([
      ['2026-12-03', `${g.id}:week`],
      ['2026-12-10', `${g.id}:day`],
    ]);

    await saveGoal(g.id, { title: 'Ship', deadline: '2026-12-24', contactIds: [] });
    expect((await goalReminders()).map((r) => r.dueDate)).toEqual(['2026-12-17', '2026-12-24']);

    await saveGoal(g.id, { title: 'Ship v2', deadline: '2026-12-24', contactIds: [] });
    expect((await goalReminders()).map((r) => r.title)).toEqual(['Ship v2', 'Ship v2']);

    await setGoalStatus(g.id, 'achieved');
    expect(await goalReminders()).toEqual([]);
    await setGoalStatus(g.id, 'active');
    expect(await goalReminders()).toHaveLength(2);
    await saveGoal(g.id, { title: 'Ship v2', contactIds: [] });
    expect(await goalReminders()).toEqual([]);
  });

  it('skips reminder dates already in the past', async () => {
    at('2026-10-25T10:00:00');
    await saveGoal(undefined, { title: 'Soon', deadline: '2026-10-28', contactIds: [] });
    expect((await goalReminders()).map((r) => r.dueDate)).toEqual(['2026-10-28']);
    await saveGoal(undefined, { title: 'Past', deadline: '2026-10-01', contactIds: [] });
    expect(await goalReminders()).toHaveLength(1);
  });

  it('links contacts; deleting a contact keeps the goal (AC-5)', async () => {
    const ana = await person('Ana');
    const g = await saveGoal(undefined, { title: 'G', contactIds: [ana.id, ana.id] });
    expect(g.contactIds).toEqual([ana.id]);
    expect((await goalsFor(ana.id)).map((x) => x.id)).toEqual([g.id]);
    await deleteContact(ana.id);
    expect(await goalRepo.get(g.id)).toBeDefined();
    expect((await goalRepo.get(g.id))?.contactIds).toEqual([ana.id]); // restore brings it back
  });

  it('merging contacts moves goal links to the primary (AC-5)', async () => {
    const [a, b] = [await person('Ana'), await person('Anna')];
    const g = await saveGoal(undefined, { title: 'G', contactIds: [b.id] });
    await mergeContacts(a.id, b.id);
    expect((await goalRepo.get(g.id))?.contactIds).toEqual([a.id]);
  });

  it('tasks link to a goal; deleting the goal unlinks but keeps them (AC-6)', async () => {
    const g = await saveGoal(undefined, { title: 'G', contactIds: [] });
    const m = await saveMilestone(g.id, undefined, { title: 'step' });
    const task = await saveTask(undefined, { title: 'Do it', goalId: g.id });
    expect((await tasksForGoal(g.id)).map((t) => t.id)).toEqual([task.id]);
    expect((await taskRepo.list()).map((t) => t.id)).toEqual([task.id]); // also on /tasks

    await deleteGoal(g.id);
    expect(await goalRepo.get(g.id)).toBeUndefined();
    expect((await db.goalMilestones.get(m.id))?.deletedAt).toBeDefined();
    const kept = await taskRepo.get(task.id);
    expect(kept).toBeDefined();
    expect(kept?.goalId).toBeUndefined();

    await restoreGoal(g.id);
    expect(await milestonesFor(g.id)).toHaveLength(1);
  });

  it('purges expired goals from Trash with their milestones', async () => {
    const g = await saveGoal(undefined, { title: 'G', deadline: '2099-01-01', contactIds: [] });
    await saveMilestone(g.id, undefined, { title: 'm' });
    await deleteGoal(g.id);
    await purgeExpiredTrash(new Date(Date.now() + 40 * 86_400_000));
    expect(await db.goals.count()).toBe(0);
    expect(await db.goalMilestones.count()).toBe(0);
  });

  it('saves one review per week; saving again edits the note (AC-7)', async () => {
    const wed = new Date(2026, 9, 28);
    const sat = new Date(2026, 9, 31);
    const first = await saveWeeklyReview('good week', wed);
    const again = await saveWeeklyReview(' better ', sat);
    expect(again.id).toBe(first.id);
    expect(again.note).toBe('better');
    expect(await db.goalReviews.count()).toBe(1);
    await saveWeeklyReview(undefined, new Date(2026, 10, 2));
    expect(await db.goalReviews.count()).toBe(2);
    expect((await db.goalReviews.toArray()).map((r) => r.weekOf).sort()).toEqual([
      '2026-10-25',
      '2026-11-01',
    ]);
  });

  it('finds goals by title, why and area in Search (AC-10)', async () => {
    const g = await saveGoal(undefined, {
      title: 'Run a marathon',
      why: 'Stay healthy for my kids',
      area: 'Fitness',
      contactIds: [],
    });
    expect((await search('marathon')).goals.map((x) => x.id)).toEqual([g.id]);
    expect((await search('healthy kids')).goals).toHaveLength(1);
    expect((await search('fitness')).goals).toHaveLength(1);
    await saveGoal(g.id, { title: 'Swim', contactIds: [] });
    expect((await search('marathon')).goals).toEqual([]);
    expect((await search('swim')).goals).toHaveLength(1);
    await deleteGoal(g.id);
    expect((await search('swim')).goals).toEqual([]);
    await restoreGoal(g.id);
    expect((await search('swim')).goals).toHaveLength(1);
  });
});

describe('upgrade from schema v1', () => {
  it('does not rebuild the search index on start: existing installs would pay for 20k moments', async () => {
    const ana = await person('Ana');
    await ensureSearchIndex(); // first run: builds and records the version
    await db.searchIndex.put({ entity: 'contact', entityId: 'sentinel', tokens: ['sentinel'] });
    await ensureSearchIndex(); // same version: must leave the index alone
    expect(await db.searchIndex.get(['contact', 'sentinel'])).toBeDefined();
    expect((await search('ana')).contacts.map((c) => c.id)).toEqual([ana.id]);
  });
});

describe('goals in backup, demo and Trash (AC-9)', () => {
  const snap = async () => ({
    goals: await db.goals.orderBy('id').toArray(),
    milestones: await db.goalMilestones.orderBy('id').toArray(),
    reviews: await db.goalReviews.orderBy('id').toArray(),
    tasks: await db.tasks.orderBy('id').toArray(),
  });

  it('round-trips through JSON export → delete all → import', async () => {
    const ana = await person('Ana');
    const g = await saveGoal(undefined, {
      title: 'Learn piano',
      why: 'w',
      deadline: '2099-05-01',
      contactIds: [ana.id],
    });
    await saveMilestone(g.id, undefined, { title: 'm1', dueDate: '2099-01-01' });
    await setMilestoneDone((await milestonesFor(g.id))[0]!.id, true);
    await saveTask(undefined, { title: 't', goalId: g.id });
    await saveWeeklyReview('note');
    const before = await snap();
    const counts = await recordCounts();
    expect(counts.goals).toBe(1);

    const file = await exportBackup();
    await deleteAllData();
    expect((await recordCounts()).goals).toBe(0);
    await importBackup(parseBackup(JSON.parse(await file.text())), 'replace');

    expect(await snap()).toEqual(before);
    expect({ ...(await recordCounts()), settings: 0 }).toEqual({ ...counts, settings: 0 });
    expect((await search('Ana')).contacts).toHaveLength(1);
    expect((await search('piano')).goals).toHaveLength(1); // index rebuilt with goals
  });

  it('still reads a version-1 backup that has no goal tables', async () => {
    const ana = await person('Ana');
    const json = JSON.parse(await (await exportBackup()).text()) as {
      schemaVersion: number;
      data: Record<string, unknown>;
    };
    json.schemaVersion = 1;
    for (const t of ['goals', 'goalMilestones', 'goalReviews']) delete json.data[t];
    await deleteAllData();
    await importBackup(parseBackup(json), 'replace');
    expect((await contactRepo.list()).map((c) => c.id)).toEqual([ana.id]);
    expect((await recordCounts()).goals).toBe(0);
  });

  it('rejects a backup from a newer schema version', async () => {
    const json = JSON.parse(await (await exportBackup()).text()) as { schemaVersion: number };
    json.schemaVersion = 99;
    expect(() => parseBackup(json)).toThrow(BackupError);
  });

  it('demo data includes a goal, and removing the demo removes it with its reminders', async () => {
    const ids = await loadDemoData('en', new Date('2026-10-19T10:00:00'));
    expect(ids.goals).toHaveLength(1);
    const counts = await recordCounts();
    expect([counts.goals, counts.goalMilestones]).toEqual([1, 2]);
    expect((await search('lyon')).goals).toHaveLength(1);
    await removeDemoData();
    const after = await recordCounts();
    expect([after.goals, after.goalMilestones, after.reminders]).toEqual([0, 0, 0]);
    expect((await search('lyon')).goals).toEqual([]);
  });
});
