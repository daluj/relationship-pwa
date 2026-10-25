# Phase 13 — Backlog polish: requirements

Roadmap: [Phase 13](../roadmap.md). Same branch and PR as Phases 10–12.

## Scope

### Included

| Item                          | What it does                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`.ics` import**             | Import yearly all-day VEVENTs (birthdays, anniversaries) with a preview table. Each row can be matched to a contact, create a contact, or be skipped. |
| **Undo for contact merge**    | After a merge, a toast and Settings › Data offer "Undo merge" for 30 days, restoring the secondary contact and every row the merge touched.           |
| **New locales: fr, de, pt**   | Three complete locale files (drafted by Claude, flagged for native review in the README) and a language picker update.                                |
| **Print / PDF view**          | "Print profile" in the profile ⋯ menu: print-optimised contact profile via `@media print` and `window.print()` (the browser's "Save as PDF").         |
| **Live-update announcements** | A single polite live region announcing results of actions that update the screen without moving focus (saved, undone, N reminders due, import done).  |

### Out of scope

- Importing events other than yearly all-day ones, free/busy, attendees or time zones; non-recurring events are shown in the preview as skipped with a reason.
- A PDF generation library (the browser prints; tech-stack gets no new dependency).
- Right-to-left locales.

## Data model change

Dexie `db.version(3)` adds a table:

```ts
interface MergeSnapshot extends BaseRecord {
  primaryId: string;
  secondaryId: string;
  // Prior state of every row the merge changed, keyed by table.
  before: Record<string, unknown[]>;
  mergedAt: string;
}
// mergeSnapshots: 'id, primaryId, secondaryId, mergedAt, deletedAt'
```

Snapshots are purged with the 30-day sweep. `SCHEMA_VERSION` and `BACKUP_SCHEMA_VERSION` become 3; `backupMigrations[2]` adds an empty table. Snapshots are included in backups (they reference photos and rows), but a snapshot whose rows no longer exist is ignored on undo.

## Acceptance criteria

- **AC-1** Importing an `.ics` file with a yearly all-day "Marc's birthday" event adds a birthday to the matched contact (or creates the contact) after confirming in the preview, and the birthday reminder appears via the existing flow (features §8.2 AC).
- **AC-2** Non-yearly, timed or malformed events are listed in the preview as skipped with a reason; nothing is written until the user confirms; an invalid file never partially imports.
- **AC-3** Folded lines, escaped characters, `VALUE=DATE`, `RRULE:FREQ=YEARLY` and CRLF/LF line endings are parsed (unit fixtures from Google Calendar and Apple Calendar exports).
- **AC-4** Merging two contacts then choosing "Undo merge" restores both contacts, their fields, relationships, moment `contactIds`, reminders, tags, groups and the search index exactly as before (round-trip equality test).
- **AC-5** Undo is refused with a clear message if either contact was edited or deleted after the merge, or if the snapshot is older than 30 days.
- **AC-6** Switching language to French, German or Portuguese shows no missing keys (key-parity test with `en`), dates and numbers use `Intl` with that locale, and the choice survives reload.
- **AC-7** "Print profile" opens a view that hides navigation and the composer, shows name, relationship line, key fields, dates, relationships, notes and the last 10 moments, and a print-media E2E (`page.emulateMedia({ media: 'print' })`) confirms navigation is hidden.
- **AC-8** After a save, undo, import and reminders-due event, a `role="status"` live region contains the localized message (component test), without stealing focus.
- **AC-9** The v2 → v3 upgrade keeps all data; a v1 or v2 backup still imports.
- **AC-10** All new screens work offline, en/es/fr/de/pt complete, axe passes in all three themes.

## Decisions

- **D-A: Snapshot table for merge undo** (interview). Only the touched rows are stored to keep backups small; undo is all-or-nothing and conservative (AC-5). _Project-wide: yes (D-072)._
- **D-B: Locales are Claude-drafted.** They ship as complete but are marked "needs native review" in the README; no machine-translation service is called at runtime. _Project-wide: yes (D-073)._
- **D-C: `.ics` reuses the vCard-style preview component** (`ImportPreview`) and the `ics.ts` module gains a `parseIcs` next to the exporter; no `ical.js`. _Project-wide: no._
- **D-D: Print uses the browser.** No canvas/PDF code, so output quality follows the user's browser and works offline.
- **D-E: One live region** mounted in the app shell, fed by a small Zustand store, instead of per-component `aria-live`.

## Context

- Extends `features §8.2` (merge), `§8.9` (import/export), `ui §6.9` (accessibility), `§6.10`, `tech-stack §12` (i18n). New subsections: features §8.14, ui §6.14.
- Files: `src/domain/ics.ts`, `src/features/data/*`, `src/db/repositories/mergeService.ts`, `src/db/schema.ts`, `src/domain/backup.ts`, `src/i18n/index.ts`, `src/i18n/locales/`, `src/features/settings/` (language picker), `src/styles/` (print CSS), `src/app/layout/`.
- Accessibility: print view and live region follow WCAG 2.1 AA; announcements are short and localized.
- Privacy: `.ics` files are read locally; nothing is uploaded.
