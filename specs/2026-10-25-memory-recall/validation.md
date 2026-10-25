# Phase 10 — Memory recall: validation

## Automated

- [x] `npm run verify` is green.
- [x] AC-1, AC-2, AC-3: `tests/unit/recall.test.ts` (domain) and `tests/unit/BriefPage.test.tsx`
- [x] AC-4, AC-5: `tests/unit/recall.test.ts`, `tests/unit/recallService.test.ts`, `tests/e2e/recall.spec.ts`
- [x] AC-6: `tests/unit/recall.test.ts`, `tests/e2e/recall.spec.ts`
- [x] AC-7: `tests/unit/BriefPage.test.tsx`
- [x] AC-8: `tests/e2e/recall.spec.ts` (offline reload, zero foreign requests)
- [x] AC-9: `tests/unit/i18n.test.ts`, `tests/e2e/a11y.spec.ts`
- [x] On this day over 2k contacts / 20k moments < 100 ms (perf project)

## Manual

- [ ] Open a contact with demo data → Before you meet shows all sections in a sensible order
- [ ] A contact with nothing logged shows a friendly empty state, no empty headings
- [ ] Home On this day appears with a moment dated a past year today; dismissing is not required, it disappears the next day
- [ ] Milestones chip on Timeline reads oldest → newest
- [ ] Mobile layout (bottom bar, no horizontal scroll), Light/Dim/Lights out themes, Spanish locale, offline reload

## Definition of done

- [ ] All checks above ticked
- [ ] Roadmap Phase 10 ticked
- [ ] Lasting requirements folded into `specs/product/` (features §8.11, ui §6.11); D-069 logged
- [ ] `CHANGELOG.md` entry
- [ ] User OK to merge
