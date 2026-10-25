# Phase 10 — Goals · requirements

> Part of the "Growth and networking" track (Phases 10–12, inspired by the goal-setting and relationship-leverage ideas in
> Dan Peña's _Quantum Leap Advantage_). Wording in the UI is neutral: no book branding or quotes (D-069).
> Phases 11 (networking pipeline) and 12 (event log) are specified in [features §8.12–§8.13](../product/features.md) and get
> their own spec folders when they come up.

## Goal

Let the user write down a few specific, time-bound goals, break them into milestones and next actions, link the people who
help reach them, and review progress each week. Everything stays on the device (mission §1.2 principles 1–2).

## Scope

### Included

- A **Goals** screen (`/goals`, `/goals/:id`) with tabs **Active · Achieved · Paused/Dropped**.
- Create/edit a goal: title (required), _why_ (free text), deadline (optional), area (optional free text, e.g. Career, Health),
  one **next action** line.
- **Milestones** per goal: checklist with optional due dates; reorder; tick/untick.
- **Linked tasks**: a Task can reference a goal (`Task.goalId`); the goal page lists them and offers "Add task".
- **Linked people**: pick contacts who help with the goal (`Goal.contactIds`), shown as avatars on the goal and as a
  **Goals** line on the contact's Details tab.
- **Progress**: percentage of milestones done (goals with no milestones show no bar). Status: active, achieved (sets
  `achievedAt`), paused, dropped.
- **Today card** on Home's right rail: up to 3 active goals (soonest deadline first) with their next action.
- **Weekly review**: a prompt card on the Goals page while this week's review is still to do (or the **Weekly review** button
  at any time) that walks through active goals and saves one `GoalReview` per Sunday-start week with an optional note. A **review streak** (consecutive weeks) is shown on the Goals page.
- Goal deadline reminders: a reminder with source `goal` created for each goal with a deadline (7 days before and on the day),
  following the pattern of important-date reminders (features §8.5).
- Search, Trash, JSON backup/restore, demo data and ICS export cover the new entities.
- English and Spanish strings.

### Out of scope

- Any score, rank or streak about **people** (mission §1.2 principle 3 stays for contacts).
- Habit tracking, sub-goals, goal templates, charts of progress over time, sharing or sync.
- Pipeline stages, event log, mentor circle, give/ask ledger (Phases 11–12 and backlog).

## Data

| Entity          | Fields                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Goal`          | `title`, `why?`, `area?`, `deadline?` (ISO date), `status` (`active`\|`achieved`\|`paused`\|`dropped`), `achievedAt?`, `nextAction?`, `contactIds: string[]`, `sortOrder` |
| `GoalMilestone` | `goalId`, `title`, `dueDate?`, `completedAt?`, `sortOrder`                                                                                                                |
| `GoalReview`    | `weekOf` (ISO date of the Sunday starting the week), `note?`; unique per `weekOf`                                                                                         |
| `Task` (extend) | `goalId?` (indexed)                                                                                                                                                       |

Dexie `db.version(2)` adds `goals`, `goalMilestones`, `goalReviews` and the `goalId` index on `tasks`, with an `.upgrade()`
that needs no data rewrite. See data-model §5.3.

## Acceptance criteria

- **AC-1** Creating a goal with only a title succeeds; an empty title is rejected with an inline error.
- **AC-2** Ticking a milestone updates the goal's progress percentage immediately; unticking reverses it.
- **AC-3** Marking a goal achieved sets `achievedAt` and moves it from Active to Achieved; reopening clears `achievedAt`.
- **AC-4** A goal with a deadline gets deadline reminders; changing the deadline updates them, removing it (or achieving/dropping
  the goal) deletes the open ones.
- **AC-5** Linking a contact to a goal shows that goal on the contact's Details tab; deleting the contact removes the link
  without deleting the goal.
- **AC-6** A task created from a goal appears in the goal and in `/tasks`; deleting the goal soft-deletes its milestones and
  unlinks (does not delete) its tasks.
- **AC-7** Completing the weekly review stores exactly one `GoalReview` per Sunday-start week; repeating it the same week edits the
  note. The streak counts consecutive weeks ending this or last week.
- **AC-8** The Home right-rail Today card lists at most 3 active goals, ordered by soonest deadline, and hides when none exist.
- **AC-9** Goals, milestones and reviews survive a JSON export → delete all → import round trip. Deleting a goal can be undone from the toast (milestones come back), and expired deleted goals are purged with the 30-day Trash purge. The Trash screen itself lists contacts and moments only, as it does for tasks and groups.
- **AC-10** Goal titles and whys are found by Search, in a new **Goals** result group.
- **AC-11** All new screens pass axe (WCAG 2.1 AA) in all three themes and work offline; en and es locales are complete.

## Decisions

- **D-069 (project-wide)** Mission principle 3 is narrowed: no scoring, ranking or gamification **of people**. Progress
  percentages and a weekly-review streak are allowed for the user's own goals. _Why:_ the user asked to relax the rule for
  goals only; contacts stay unscored. Logged in `specs/decisions.md`; mission §1.2 updated.
- **Neutral wording (project-wide, in D-069).** UI and code use generic terms (Goals, Inner circle, Pipeline); no book names,
  quotes or branding.
- Milestones are separate records, not an embedded array, so they can be reordered, searched and synced per-record later.
- Tasks link to goals with `Task.goalId` rather than copying tasks into milestones: one tasks system, no duplication.
- Linked people are `Goal.contactIds` (multi-entry index) with no per-link role; simplest option that satisfies the use case.
- Reminders use source `goal` and the existing reminder service; no new notification code.
- Weekly review is user-initiated or prompted by an in-app card on the Goals page (shown while the week's review is pending); no extra notification type.
- Confirmed at spec review: the week starts on Sunday; at most 3 goals on the Today card; no cap on goals; Phase 10 does not wait for Phase 9.
- Deadline reminders only exist for dates still ahead: a goal due in 3 days gets the on-the-day reminder but no "a week before" one.
- Reminder titles are worded from the source ("Goal deadline: …", "Goal due in a week: …"); they open the goal, not a contact.
- Linked people stay on the goal when a contact is soft-deleted (so Trash restore brings the link back) and are removed on purge and moved on merge.
- Deleting a goal unlinks its tasks and restoring it does not re-link them.
- The search index version stays at 1: no goals exist at upgrade time and a rebuild costs about 45 s for 20k moments (found in validation); `ChipPicker` gained an optional `onCreate` so it can pick from existing contacts only.

## Context

- Extends: features §8.5 (reminders), §8.6 (search), §8.7 (tasks), §8.9 (export), §8.10 (settings); data-model §5.1–§5.2;
  ui §6.1 (nav), §6.6 (profile Details), §6.7, §7 (routes).
- Follow the patterns of `src/features/tasks/`, `src/db/repositories/reminderService.ts` and `searchService.ts`;
  `src/domain/schemas/` for Zod; `src/domain/reminders.ts` for the date logic.
- Privacy: no network calls, no analytics. Accessibility: progress bar uses `role="progressbar"` with value text; milestone
  checkboxes are real checkboxes; reorder has keyboard buttons, not only drag.
- Nav: new **Goals** item in the left nav and mobile drawer (not the bottom bar).
