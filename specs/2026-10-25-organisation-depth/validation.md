# Phase 12 — Organisation depth: validation

## Automated

- [x] `npm run verify` is green.
- [x] AC-1, AC-2, AC-3: `tests/unit/searchFilters.test.ts`, `tests/unit/search.test.ts`, `tests/e2e/organise.spec.ts`
- [x] AC-4: `tests/unit/importExport.test.ts`, `tests/e2e/organise.spec.ts`
- [x] AC-5, AC-6: `tests/unit/bulkService.test.ts`, `tests/e2e/organise.spec.ts`
- [x] AC-7: `tests/e2e/organise.spec.ts`, `tests/e2e/a11y.spec.ts`
- [x] AC-8: `tests/unit/yearReview.test.ts`, `tests/e2e/organise.spec.ts`
- [x] AC-9: `tests/unit/schema.test.ts`, `tests/unit/importExport.test.ts`
- [x] AC-10: `tests/e2e/search.perf.ts`
- [x] AC-11: `tests/e2e/a11y.spec.ts`, `tests/e2e/offline.spec.ts`, `tests/unit/i18n.test.ts`

## Manual

- [ ] Upgrade a profile that has v1 data (run the previous build, create data, load the new one): everything still there
- [ ] Combine filters with the demo data and save/rename/delete a search
- [ ] Select 10 contacts on mobile, tag them, undo
- [ ] Year in review for the current and a past year; a year with no data
- [ ] Light/Dim/Lights out, Spanish locale, offline

## Definition of done

- [ ] All checks above ticked
- [ ] Roadmap Phase 12 ticked ("Search by date range and kind" is merged into the saved-searches/filters item)
- [ ] Lasting requirements folded into `specs/product/`; D-071 logged
- [ ] `CHANGELOG.md` entry
- [ ] User OK to merge
