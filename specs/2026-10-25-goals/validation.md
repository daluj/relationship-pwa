# Phase 10 — Goals · validation

## Automated

`npm run verify` is green, and:

| AC    | Proven by                                                                          |
| ----- | ---------------------------------------------------------------------------------- |
| AC-1  | `tests/unit/goalService.test.ts` (create, empty title rejected)                    |
| AC-2  | `tests/unit/goals.test.ts` progress; `tests/e2e/goals.spec.ts` tick/untick         |
| AC-3  | `goalService.test.ts` status transitions                                           |
| AC-4  | `goalService.test.ts` deadline reminders (create, move, remove, achieve)           |
| AC-5  | `goalService.test.ts` contact link/unlink; contact delete                          |
| AC-6  | `goalService.test.ts` task link, goal delete cascade                               |
| AC-7  | `goals.test.ts` streak; `goalService.test.ts` one review per week                  |
| AC-8  | `goals.test.ts` Today ordering; e2e Today card                                     |
| AC-9  | backup round-trip unit test; Trash restore test                                    |
| AC-10 | `searchService.test.ts` Goals group                                                |
| AC-11 | `tests/e2e/a11y.spec.ts` (new screens × 3 themes); offline e2e; locale parity test |

## Manual

- [ ] Create a goal with why, deadline, 3 milestones, 1 linked contact, 1 task; tick milestones to 100%; mark achieved
- [ ] Run the weekly review twice in one week (second edits the note); check streak after a skipped week
- [ ] Contact profile › Details shows the goal; deleting the contact keeps the goal
- [ ] Light, Dim and Lights-out themes; mobile layout (drawer entry, no horizontal scroll); keyboard-only milestone reorder
- [ ] Spanish locale: no missing keys, no overflow
- [ ] Airplane mode: everything above works; export → delete all → import restores goals

## Definition of done

- [ ] All automated and manual checks ticked
- [ ] Roadmap Phase 10 ticked; lasting requirements folded into `specs/product/`; D-069 in `specs/decisions.md`
- [ ] `CHANGELOG.md` entry added
- [ ] User OK to merge
