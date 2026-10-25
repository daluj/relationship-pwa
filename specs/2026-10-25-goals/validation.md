# Phase 10 — Goals · validation

## Automated

`npm run verify` is green, and:

| AC    | Proven by                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------- |
| AC-1  | `tests/unit/goals.test.ts` (create, empty title rejected)                                                |
| AC-2  | `tests/unit/goals.test.ts` progress; `tests/e2e/goals.spec.ts` tick/untick                               |
| AC-3  | `goals.test.ts` status transitions                                                                       |
| AC-4  | `goals.test.ts` deadline reminders (create, move, remove, achieve)                                       |
| AC-5  | `goals.test.ts` contact link/unlink; contact delete                                                      |
| AC-6  | `goals.test.ts` task link, goal delete cascade                                                           |
| AC-7  | `goals.test.ts` streak; `goals.test.ts` one review per week                                              |
| AC-8  | `goals.test.ts` Today ordering; e2e Today card                                                           |
| AC-9  | `goals.test.ts` backup round trip and Trash purge                                                        |
| AC-10 | `goals.test.ts` search group                                                                             |
| AC-11 | `tests/e2e/a11y.spec.ts` (new screens × 3 themes); `goals.spec.ts` offline; `i18n.test.ts` locale parity |

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
