# Phase 13 — Backlog polish: plan

## 1. Domain

- [ ] 1.1 `src/domain/ics.ts`: `parseIcs(text)` → rows `{ title, month, day, year?, kind, skipReason? }` (AC-1..3)
- [ ] 1.2 `src/domain/mergeSnapshot.ts` and Zod schema for `MergeSnapshot` (`domain/schemas/`)
- [ ] 1.3 Unit tests `tests/unit/icsImport.test.ts` with Google and Apple fixtures

## 2. Data

- [ ] 2.1 `src/db/schema.ts`: `db.version(3)` with `mergeSnapshots`; `SCHEMA_VERSION = 3`
- [ ] 2.2 `src/domain/backup.ts`: `BACKUP_SCHEMA_VERSION = 3`, `backupMigrations[2]`, table list and schema (AC-9)
- [ ] 2.3 Include `mergeSnapshots` in the 30-day purge sweep (`trashService.ts`)
- [ ] 2.4 Migration tests v1/v2 → v3 and backup import (AC-9)

## 3. Repositories

- [ ] 3.1 `mergeService.ts`: capture the `before` snapshot inside the merge transaction; `undoMerge(snapshotId)` with the guards in AC-5 and search index rebuild for touched rows (AC-4)
- [ ] 3.2 `importService.ts`: `.ics` rows → important dates/birthdays through existing contact services (AC-1, AC-2)
- [ ] 3.3 Repository tests `tests/unit/mergeUndo.test.ts` (round-trip equality, refusal cases)

## 4. UI

- [ ] 4.1 `.ics` accepted in `readImportFile.ts` and `DataPage.tsx`; preview via `ImportPreview.tsx`; file handler/share target keeps working (D-057)
- [ ] 4.2 "Undo merge" toast and Settings › Data list (`MergeDialog.tsx`, `DataPage.tsx`)
- [ ] 4.3 Language picker offers en, es, fr, de, pt; `src/i18n/index.ts` registers the new resources (lazy-loaded if the bundle budget requires it)
- [ ] 4.4 `src/features/profile/PrintView.tsx` + `@media print` rules in `src/styles/index.css`, menu entry "Print profile" (AC-7)
- [ ] 4.5 `src/components/LiveRegion.tsx` + `src/app/stores/announce.ts`, mounted in the shell; hook up save/undo/import/reminders-due (AC-8)

## 5. i18n

- [ ] 5.1 `src/i18n/locales/{fr,de,pt}.json` complete; new keys in all five locales
- [ ] 5.2 Extend `tests/unit/i18n.test.ts` to check key parity for all locales (AC-6); README note on native review

## 6. Tests

- [ ] 6.1 E2E `tests/e2e/polish2.spec.ts`: ics import preview/confirm, merge → undo, language switch, print media, live region (AC-1, 2, 4, 6, 7, 8)
- [ ] 6.2 Axe sweep and offline checks for new screens in all locales sampled (AC-10)
- [ ] 6.3 First-load bundle budget check (≤ 250 KB gzipped, tech-stack §10)

## 7. Docs

- [ ] 7.1 Fold into `specs/product/data-model.md` (§5.1 `MergeSnapshot`, §5.2 v3), `features.md` §8.14, `ui.md` §6.15, `pwa.md` if `.ics` file handling changes the manifest; log D-072 and D-073; update `tech-stack.md` §12 locale list; update `backlog/README.md` (remove delivered items)
