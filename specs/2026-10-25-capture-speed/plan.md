# Phase 11 — Capture speed: plan

## 1. Domain

- [ ] 1.1 `src/domain/momentTemplates.ts`: template ids and the `applyTemplate(draft, id)` rule (AC-1, AC-2)
- [ ] 1.2 Unit tests `tests/unit/momentTemplates.test.ts`

## 2. Repositories

- [ ] 2.1 Gift photo save/replace/remove in `profileItems.ts` via `blobRepo` (old blob and thumb deleted, AC-4)
- [ ] 2.2 Make sure contact purge and backup export include gift blobs (AC-4, AC-5); tests in `tests/unit/m5Services.test.ts` and `importExport.test.ts`

## 3. UI

- [ ] 3.1 Template picker in `Composer.tsx` (menu above the textarea) wired to `useComposer` prefill
- [ ] 3.2 "Log a call" in `ProfileHeader.tsx` and ⋯ menu; composer opens with kind `call` and contact (AC-3)
- [ ] 3.3 Gift photo control in the gift dialog and photo display in the gift row (`src/features/gifts/`)

## 4. i18n

- [ ] 4.1 `compose.templates.*`, `profile.logCall`, `gifts.photo*` in `en.json` and `es.json`

## 5. Tests

- [ ] 5.1 Component test additions in `tests/unit/Composer.test.tsx` (AC-1, AC-2)
- [ ] 5.2 E2E `tests/e2e/capture.spec.ts`: template, log a call, gift photo round trip including export/import (AC-1..AC-5)
- [ ] 5.3 Extend axe sweep for the new controls (AC-6)

## 6. Docs

- [ ] 6.1 Fold into `specs/product/features.md` §8.12 and `ui.md` §6.12; log D-070 in `specs/decisions.md`; move "voice dictation" into `backlog/README.md` with the privacy note
