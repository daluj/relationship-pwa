# Phase 13 — Backlog polish: validation

## Automated

- [x] `npm run verify` is green.
- [x] AC-1, AC-2, AC-3: `tests/unit/icsImport.test.ts`, `tests/e2e/polish2.spec.ts`
- [x] AC-4, AC-5: `tests/unit/mergeUndo.test.ts`, `tests/e2e/polish2.spec.ts`
- [x] AC-6: `tests/unit/i18n.test.ts`, `tests/e2e/polish2.spec.ts`
- [x] AC-7: `tests/e2e/polish2.spec.ts` (print media emulation)
- [x] AC-8: `tests/unit/LiveRegion.test.tsx`
- [x] AC-9: `tests/unit/schema.test.ts`, `tests/unit/importExport.test.ts`
- [x] AC-10: `tests/e2e/a11y.spec.ts`, `tests/e2e/offline.spec.ts`, bundle budget check

## Manual

- [ ] Export a real calendar (Google/Apple) containing birthdays and import it
- [ ] Merge two demo contacts, undo, compare profiles; edit one then try undo (refused)
- [ ] Walk each new language on mobile for layout overflow (German is longest)
- [ ] Print preview of a profile in Chrome and Firefox; save as PDF
- [ ] Screen reader (NVDA/VoiceOver) announces save, undo and import results
- [ ] Light/Dim/Lights out themes, offline

## Definition of done

- [ ] All checks above ticked
- [ ] Roadmap Phase 13 ticked
- [ ] Lasting requirements folded into `specs/product/`; D-072 and D-073 logged; backlog updated
- [ ] `CHANGELOG.md` entry
- [ ] User OK to merge and native review of fr/de/pt noted as a follow-up
