# Phase 10 — Memory recall: plan

Each group leaves `npm run verify` green.

## 1. Domain

- [ ] 1.1 `src/domain/recall.ts`: `buildBrief(input)` (picks, limits and orders per AC-1..3), `onThisDay(moments, today)` with Feb 29 handling (AC-4, AC-5), `buildMilestones(input)` (AC-6)
- [ ] 1.2 Reuse `domain/partialDate.ts` for ordering partial dates; add helpers there only if missing
- [ ] 1.3 Unit tests `tests/unit/recall.test.ts` for limits, ordering, leap day, partial dates, empty inputs

## 2. Repositories

- [ ] 2.1 `src/db/repositories/recallService.ts`: `getBriefData(contactId)`, `getOnThisDay(today)`, `getMilestoneData(contactId)`; export from `index.ts`
- [ ] 2.2 Repository tests with fake-indexeddb in `tests/unit/recallService.test.ts` (deleted rows excluded, other contacts excluded)
- [ ] 2.3 Perf check in `tests/e2e/search.perf.ts` style: On this day over the 2k/20k seed stays < 100 ms (project `*.perf.ts`)

## 3. UI

- [ ] 3.1 `src/features/profile/BriefPage.tsx` and lazy route `c/:id/brief` in `src/app/router.tsx` (placed before `c/:id/:tab`)
- [ ] 3.2 "Before you meet" button in `ProfileHeader.tsx` and entry in the ⋯ menu
- [ ] 3.3 `src/features/home/OnThisDay.tsx`, rendered at the top of `HomePage.tsx`
- [ ] 3.4 Milestones filter chip and list in `TimelineTab.tsx`
- [ ] 3.5 Deceased/archived handling (AC-7)

## 4. i18n

- [ ] 4.1 `recall.*` keys in `en.json` and `es.json`; `tests/unit/i18n.test.ts` stays green

## 5. Tests

- [ ] 5.1 Component test for `BriefPage` (sections omitted when empty) in `tests/unit/BriefPage.test.tsx`
- [ ] 5.2 E2E `tests/e2e/recall.spec.ts`: AC-1..AC-7 flows with mocked date, offline reload (AC-8)
- [ ] 5.3 Add the new screens to the axe sweep in `tests/e2e/a11y.spec.ts` (AC-9)

## 6. Docs

- [ ] 6.1 Fold ACs into `specs/product/features.md` §8.11 and routes/UI into `specs/product/ui.md` §6.12; log D-069 in `specs/decisions.md`
