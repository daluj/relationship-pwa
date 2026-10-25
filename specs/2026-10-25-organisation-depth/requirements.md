# Phase 12 — Organisation depth: requirements

Roadmap: [Phase 12](../roadmap.md). Same branch and PR as Phases 10–11.

## Scope

### Included

| Item                    | What it does                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Search filters**      | Search page gains filters: kind (moments), date range, tag, group, and "not contacted in N days" (contacts). Filters combine with the text query.            |
| **Saved searches**      | Save the current query and filters under a name; list, run, rename and delete them from the Search page and the left-rail search area.                         |
| **Bulk actions**        | Contacts list selection mode: select several contacts, then add/remove a tag, add/remove a group, archive/unarchive or move to Trash, with one Undo toast.   |
| **Year in review**      | `/review/:year` page with plain counts: moments by kind, people mentioned, new contacts, gifts given, debts settled, tags used. No rankings or scores.       |

### Out of scope

- Ranking people by anything ("most contacted"); the review lists counts only, in a fixed order.
- Saving filters for non-search lists (Contacts list filters stay as they are, D-042).
- Boolean index fix (D-046): deferred, because `isStarred`/`isArchived` are only filtered after other indexed narrowing and bulk selection doesn't change that. Revisit if a perf test shows a need.

## Data model change

Dexie `db.version(2)` adds one table (no `.upgrade()` data change needed, but present as a no-op for clarity):

```ts
interface SavedSearch extends BaseRecord {
  name: string;
  query: string;
  filters: {
    kinds?: MomentKind[];
    from?: string; // ISO date
    to?: string; // ISO date
    tagIds?: string[];
    groupIds?: string[];
    notContactedDays?: number;
  };
}
// savedSearches: 'id, name, deletedAt'
```

`SCHEMA_VERSION` and `BACKUP_SCHEMA_VERSION` become 2; `backupMigrations[1]` adds an empty `savedSearches` table. Saved searches are included in export/import and in Trash-less soft delete (Undo toast).

## Acceptance criteria

- **AC-1** Selecting kind `call` and a date range in Search returns only call moments inside the range (inclusive of both days, local time).
- **AC-2** "Not contacted in 90 days" lists contacts whose `lastInteractionAt` is older than 90 days or unset, excluding archived and deceased contacts, ordered by name (never by any score).
- **AC-3** Filters combine with text: query `lyon` + tag `family` returns moments matching both.
- **AC-4** A saved search stores its query and filters, re-running it shows current data, and it survives reload and a JSON export → import round trip. Rename and delete (with Undo) work.
- **AC-5** In selection mode, adding tag T to 3 selected contacts updates exactly those 3, updates the search index in the same transaction, and shows one Undo toast that reverts all 3.
- **AC-6** Bulk archive/unarchive and move-to-Trash apply to the whole selection; Trash cascades follow D-016.
- **AC-7** Selection mode is keyboard operable (Space toggles, Shift+click range on desktop), announces the selected count, and exits on Escape.
- **AC-8** Year in review for a year shows correct counts for a seeded dataset, uses the user's locale for the year/number formatting, and shows an empty state for years without data. Deleted records are excluded.
- **AC-9** Opening the v2 database from a v1 database keeps all existing data (migration test), and a v1 backup file still imports.
- **AC-10** Search with filters on the 2k/20k dataset stays < 100 ms (perf project).
- **AC-11** All screens work offline, en/es complete, axe passes in three themes.

## Decisions

- **D-A: One new table, not settings keys** (interview). Gives rename/delete/soft-delete semantics, backup inclusion and a path to sync later. _Project-wide: yes (D-071)._
- **D-B: Date range filters use the `happenedAt` index**; kind and tag filtering narrows afterwards. Reuses the strategy in D-049.
- **D-C: Bulk operations are service functions** (`bulkService.ts`) that run in one Dexie transaction and return an undo token holding the prior `tagIds`/`groupIds`/`isArchived` values for the touched rows only.
- **D-D: No ranking** anywhere, including the year in review (mission §1.2 principle 3). Sections render in a fixed order; lists of people are alphabetical.

## Context

- Extends `features §8.6` (search), `§8.8` (tags and groups), `§8.2` (archive); `data-model §5.2` (new table); `ui §6` and `§7` (routes `/review/:year`). New subsections: features §8.13, ui §6.14.
- Files: `src/features/search/SearchPage.tsx`, `src/db/repositories/searchService.ts`, `src/features/contacts/*`, `src/db/schema.ts`, `src/domain/backup.ts`, `src/domain/schemas/`.
- i18n under `search.filters.*`, `savedSearches.*`, `bulk.*`, `review.*`. Accessibility: selection count in a polite live region, checkboxes have names, charts (if any) are plain text/tables.
- Privacy: nothing leaves the device.
