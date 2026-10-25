# Phase 10 — Goals · plan

Each group leaves `npm run verify` green. Tick tasks as they land.

## 1. Domain

- [x] 1.1 `src/domain/types.ts`, `src/domain/schemas/`: `Goal`, `GoalMilestone`, `GoalReview` types and Zod schemas; `Task.goalId?`
- [x] 1.2 `src/domain/goals.ts`: progress %, Sunday-start week helpers (`weekOf`), review streak, Today-card ordering, deadline reminder dates
- [x] 1.3 `tests/unit/goals.test.ts`: AC-2, AC-7, AC-8 logic

## 2. Data

- [x] 2.1 `src/db/schema.ts`: `db.version(2)` with `goals`, `goalMilestones`, `goalReviews` (`&weekOf`) and `tasks.goalId`; `.upgrade()` no-op
- [x] 2.2 `tests/unit/schema.test.ts`: v1 → v2 upgrade keeps existing data

## 3. Repositories and services

- [x] 3.1 `src/db/repositories/goalService.ts`: create/update/status, milestones (with reorder), link contacts, review upsert (one transaction, search index updated)
- [x] 3.2 `reminderService.ts`: `goal` source, deadline reminders sync (AC-4)
- [x] 3.3 Cascade on goal/contact delete, Trash, merge (`mergeService.ts`) rewrite `contactIds`; `trashService.ts`
- [x] 3.4 `searchService.ts` + `domain/search.ts`: Goals group (AC-10)
- [x] 3.5 `backupService.ts`, `domain/backup.ts`, `demoService.ts`: new entities in export/import/demo; bump backup schemaVersion with migration
- [x] 3.6 Export from `src/db/repositories/index.ts`; tests for AC-1…AC-6, AC-9

## 4. UI

- [x] 4.1 `src/features/goals/`: `GoalsPage` (tabs, review streak), `GoalPage` (milestones, tasks, people), `GoalForm`
- [x] 4.2 `WeeklyReview` dialog and dismissible prompt card
- [x] 4.3 Home right rail Today card (`src/app/`), contact Details "Goals" line (`src/features/profile/`)
- [x] 4.4 Tasks: optional goal picker in the task form; show goal chip
- [x] 4.5 Router, nav item (desktop, tablet, mobile drawer), icons, keyboard shortcut `g g`

## 5. i18n

- [x] 5.1 `src/i18n/locales/en.json` and `es.json`: all new strings, both complete (locale-parity test must pass)

## 6. Tests

- [x] 6.1 E2E `tests/e2e/goals.spec.ts`: create goal → milestones → progress → achieve; weekly review; offline; axe in 3 themes
- [x] 6.2 Round-trip E2E/unit includes goals (AC-9)

## 7. Docs

- [x] 7.1 Fold into `specs/product/` (features §8.11, data-model §5.3, ui §6.11/§7) — drafted already, adjust to what shipped
- [ ] 7.2 Tick roadmap, `CHANGELOG.md` entry via `/changelog`
