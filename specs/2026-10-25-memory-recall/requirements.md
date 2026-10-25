# Phase 10 — Memory recall: requirements

Roadmap: [Phase 10](../roadmap.md). Branch `phase-10-13-recall-capture-organise` (Phases 10–13 share one PR).

## Scope

### Included

| Item                | What it does                                                                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Before you meet** | Route `/c/:id/brief`: one screen for a contact with the latest moments, open tasks, unsettled debts, gift ideas and recent gifts, "how we met", notes, and upcoming dates. Reachable from the profile ⋯ menu and a "Before you meet" button on the profile header. |
| **On this day**     | Home panel listing the user's moments from the same month and day in earlier years (grouped by year, newest first). Hidden when there are none.                                                                                                                    |
| **Milestones**      | A "Milestones" filter chip on the profile Timeline tab. Shows a chronological (oldest first) list of how-we-met, relationships `since`, life events, important dates, first logged moment and given gifts.                                                         |

### Out of scope

- Any ranking, score or "relationship health" (mission §1.2 principle 3).
- New persisted data: everything is derived from existing tables. No `db.version` change.
- Editing from the brief (it links to the existing screens).

## Acceptance criteria

- **AC-1** The brief for a contact shows the 5 newest live moments mentioning them, each linking to the moment detail.
- **AC-2** The brief lists only incomplete tasks of that contact, only unsettled debts (per currency totals), gifts with status `idea` and the 3 newest `given`.
- **AC-3** The brief shows "how we met" (text, date, place, introduced by) when set, and omits empty sections instead of rendering empty headings.
- **AC-4** With the system date mocked to 25 Oct 2026, a moment dated 25 Oct 2024 appears in Home › On this day under "2 years ago"; a moment dated today does not; deleted moments never appear.
- **AC-5** A 29 Feb moment appears in On this day on 28 Feb in non-leap years.
- **AC-6** The Milestones filter lists items in ascending date order, includes only dated items (partial dates with a year), and each row links to its source (moment or Details).
- **AC-7** Deceased and archived contacts still get a brief; deceased shows "In memoriam" and hides stay-in-touch information.
- **AC-8** All three views work offline and add no network requests.
- **AC-9** Both locales are complete and the new screens pass axe (WCAG 2.1 AA) in all three themes.

## Decisions

- **D-A: Route, not dialog.** `/c/:id/brief` is a lazy route so it can be a deep link, works with the back button on mobile and is easy to print in Phase 13. _Project-wide: no._
- **D-B: Derive, don't store.** Pure functions in `domain/recall.ts` build the brief, On this day and milestones from rows the repositories already return. No denormalisation, no index changes. For On this day we scan `moments` by `happenedAt` using one `[month-day]` filter over the key range per year; at the spec's 20k moments this stays under the 100 ms interaction target (checked in a perf test). _Project-wide: yes (D-069)._
- **D-C: Milestone ordering uses the item's own date.** Items with no usable date are omitted rather than guessed. _Project-wide: no._
- **D-D: Neutral wording.** No "you haven't talked in X days" language in the brief; the existing stay-in-touch nudge stays the only reminder-style signal (mission §1.2 principle 3).

## Context

- Extends `features §8.4` (moments), `§8.7` (gifts, debts, tasks), `ui §6` (profile, Home) and `§7` (routes). New subsections go at the end: features §8.11, ui §6.11.
- Follows existing patterns: `useLiveQuery` from `@/db/repositories`, `PageHeader`, `Tabs`, `MomentCard`. New repository reads go in `src/db/repositories/recallService.ts`.
- i18n: keys under `recall.*` in `en.json` and `es.json`; dates via `Intl` with the user locale.
- Accessibility: sections are landmarks with headings; "N years ago" is text, not colour; focus order follows reading order.
- Privacy: nothing leaves the device (mission §1.2).
