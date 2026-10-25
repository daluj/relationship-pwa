# Phase 12 — Organisation depth: plan

## 1. Domain

- [x] 1.1 `src/domain/schemas/savedSearch.ts` (Zod) and `SavedSearch` in `domain/types.ts`
- [x] 1.2 `src/domain/searchFilters.ts`: filter model, "not contacted" predicate, date-range normalisation (AC-1, AC-2)
- [x] 1.3 `src/domain/yearReview.ts`: `buildYearReview(records, year)` (AC-8)
- [x] 1.4 Unit tests `tests/unit/searchFilters.test.ts`, `tests/unit/yearReview.test.ts`

## 2. Data

- [x] 2.1 `src/db/schema.ts`: `db.version(2)` with `savedSearches`; `SCHEMA_VERSION = 2`
- [x] 2.2 `src/domain/backup.ts`: `BACKUP_SCHEMA_VERSION = 2`, `backupMigrations[1]`, table lists and schemas include `savedSearches`
- [x] 2.3 Migration tests: v1 DB opens with data intact; v1 backup imports (AC-9) in `tests/unit/schema.test.ts` and `importExport.test.ts`

## 3. Repositories

- [x] 3.1 `savedSearchRepo` in `src/db/repositories/entities.ts`/`index.ts` (soft delete, Undo)
- [x] 3.2 Extend `searchService.ts` with filters (AC-1..3); keep index updates unchanged
- [x] 3.3 `src/db/repositories/bulkService.ts`: bulk tag/group/archive/trash with undo token (AC-5, AC-6)
- [x] 3.4 `src/db/repositories/reviewService.ts` reads for the year review
- [x] 3.5 Repository tests `tests/unit/bulkService.test.ts`, `searchFilters` repo cases in `tests/unit/search.test.ts`
- [x] 3.6 Perf case in `tests/e2e/search.perf.ts` (AC-10)

## 4. UI

- [x] 4.1 Filter bar and saved searches list in `SearchPage.tsx` (new `SearchFilters.tsx`, `SavedSearches.tsx`)
- [x] 4.2 Selection mode in `src/features/contacts/` with action bar and live-region count (AC-7)
- [x] 4.3 `src/features/review/ReviewPage.tsx`, lazy route `review/:year`, entry from Settings and the profile-less left rail "More" area
- [x] 4.4 Include `savedSearches` in Data page counts and Trash-less Undo toasts

## 5. i18n

- [x] 5.1 `search.filters.*`, `savedSearches.*`, `bulk.*`, `review.*` in `en.json` and `es.json`

## 6. Tests

- [x] 6.1 E2E `tests/e2e/organise.spec.ts`: AC-1..AC-8 flows, export/import of saved search
- [x] 6.2 Axe sweep additions (AC-11) and offline check

## 7. Docs

- [x] 7.1 Fold into `specs/product/data-model.md` (§5.1 `SavedSearch`, §5.2 v2), `features.md` §8.13, `ui.md` §6.13; log D-071; update `pwa.md` only if routes affect offline precache
