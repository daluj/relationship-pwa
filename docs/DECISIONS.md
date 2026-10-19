# Decisions

Spec ambiguities resolved during implementation (SPEC §0). Newest last.

## D-001 — `Tag.nameLower` field (M1)

SPEC §5.2 indexes `tags` by `&nameLower`, but the §5.1 `Tag` interface has no such field. Added
`nameLower: string` to `Tag`. `tagRepo` derives it from `name` (trim + lowercase); callers never set it.

## D-002 — `Relationship.inverseId` field (M1)

§5.1 says inverse relationships are "linked via inverseId", but the interface omits it. Added
`inverseId?: string`. The auto-inverse logic lands in M5.

## D-003 — Offline E2E scope in M1 (M1)

The §9 AC ("go offline, reload, create a contact and a moment") needs the M2/M3 UI. In M1, the
offline E2E test checks: app shell, lazy-loaded route and deep-link reload offline; data written to IndexedDB
through the UI (settings) persists across offline reloads; zero foreign-origin requests. The full
AC gets added to `tests/e2e/offline.spec.ts` in M3. _Update M2:_ creating a contact offline and reloading is now covered;
creating a moment offline comes in M3.

## D-004 — Unique tag names vs. soft delete (M1)

The `&nameLower` unique index also covers soft-deleted tags. Re-creating a tag whose name matches a
soft-deleted tag restores that tag (same id, new name casing and color) instead of failing.

## D-005 — Zod schemas are the source of truth for types (M1)

Entity types in `domain/types.ts` are `z.infer<>` of the schemas in `domain/schemas/`, so validation
and types can't drift. They match §5.1 apart from D-001 and D-002.

## D-006 — Cross-entity repository behaviour deferred to its milestone (M1)

The generic repository handles timestamps, validation, soft delete/restore and purge. Cascades
(contact delete → dependents), birthday reminders, `lastInteractionAt` and search-index updates
belong to M2, M3, M4 and M6, and are added inside repository transactions then.

## D-007 — Dexie tables typed as `Table<T, string>` (M1)

Repositories always assign UUIDs, so tables are typed with explicit string keys instead of Dexie's
`EntityTable` (whose optional-id insert type doesn't fit a generic repository).

## D-008 — Text on accent backgrounds (M1)

To meet WCAG AA (§6.10) on bright accents like the default teal, text and icons on accent fills use
`--on-accent`. That's black or white, whichever contrasts more (`domain/color.ts`). The full contrast
audit of accent-colored _text_ on each theme is in M8.

## D-009 — Theme bootstrap without inline script (M1)

Settings live in IndexedDB (async). To avoid a theme flash under a strict CSP (`script-src 'self'`),
the resolved theme is mirrored to `localStorage['kin.theme']` (a per-device convenience only) and
applied by `public/theme-boot.js` before React mounts. IndexedDB stays authoritative.

## D-010 — CSP delivered by `<meta>` at build time (M1)

There is no server, so the §11 CSP is injected as a `<meta http-equiv>` in the production build only
(Vite dev needs inline HMR scripts). Added `worker-src`, `manifest-src`, `object-src 'none'`,
`base-uri` and `form-action` on top of the spec's directives. When a host is chosen, the CSP should also be
sent as an HTTP header (adds `frame-ancestors`).

## D-011 — Tooling versions (M1)

- React 18 and React Router v6 as specified. `npm audit` reports moderate advisories for all of
  react-router ≤ 7.17 (open redirect via backslash in `<Link>`/`navigate`, and an SSR-only issue). Kin
  only navigates to internal paths and has no SSR, so we stay on v6. Revisit: moving to v7 (library mode) is nearly a drop-in change.
- Vitest 5 (instead of 3) to clear a critical advisory in its worker pool. Tailwind v4 via
  `@tailwindcss/vite`, with theme tokens mapped in `@theme inline`.

## D-012 — Right-rail width between 1000 and 1279px (M1)

§6.1/§6.2 give a 350px rail and say it hides under 1000px, but 88 + 600 + 350 > 1000. The rail is 290px
from 1000 to 1279px and 350px from 1280px up.

## D-013 — Theme toggle cycles explicit themes (M1)

The left-nav toggle cycles Light → Dim → Lights out. "Follow system" is chosen in Settings › Display.

## D-014 — Birthday reminder lands with contacts (M2)

The §8.2 AC (a birthday creates, updates and removes a yearly `birthday` reminder) is contact-save behaviour, so it
ships in M2 inside `saveContact`'s transaction. The reminder's `title` stores the contact's full name. The Reminders UI
(M4) renders `source: 'birthday'` reminders with a localized label. `dueDate` is only recomputed when the birthday
itself changes, so a reminder already advanced by "Done" is kept.

## D-015 — Auto-generated reminders are purged, not trashed (M2)

Removing a birthday hard-deletes its auto reminder. Sending a system-generated record to Trash would be confusing,
and the reminder can be regenerated from the contact.

## D-016 — Cascade restore matches the tombstone timestamp (M2)

`deleteContact` stamps the contact and its dependents (fields, addresses, relationships from/to, reminders,
important dates, gifts, debts, tasks, pets) with one `deletedAt`. `restoreContact` restores only rows carrying
that exact stamp, so items deleted separately before stay in Trash. Moments are shared by several contacts and aren't
cascaded. Purging a contact removes its id from moments' `contactIds`.

## D-017 — Deferred contact features (M2)

- Duplicate detection and merge (§8.2) are in M7 ("duplicate detection & merge").
- Contact-list filters by tag and group come with tags (M3) and groups (M5).
- Profile meta "relationship counts" and groups come in M5. "Export vCard" in the ⋯ menu comes in M7.

## D-018 — Image sizes and encoding (M2)

Avatars are cropped square to ≤ 400×400 and banners to 3:1 at ≤ 1500×500. Output is WebP (q 0.85), falling back to JPEG where the
browser can't encode WebP. Small sources are never upscaled. Replacing or removing an image deletes the old blob.

## D-019 — `src/lib/` for browser-only helpers (M2)

Canvas/`createImageBitmap` code isn't pure (so not `domain/`) and isn't UI. It lives in `src/lib/`.
Crop geometry itself is pure and lives in `domain/crop.ts`.

## D-020 — Contact list is always virtualized (M2)

§6.9 asks for virtualization above 200 items. The list always uses `@tanstack/react-virtual` (window scroller)
so there is one code path. The mobile A–Z jump uses `scrollToIndex`.

## D-021 — `useLiveQuery` re-exported from `db/repositories` (M2)

UI may combine repository reads in a live query by importing `useLiveQuery` from `@/db/repositories`. Importing
`dexie-react-hooks` directly from UI code is now a lint error.

## D-022 — Trash scope in M2 (M2)

Trash lists contacts, with restore and delete forever. Other entity types get Trash rows when their UI lands.
Expired items (> 30 days) of every table are purged on app start.

## D-023 — "Mark as deceased" from the menu (M2)

The profile menu toggles `isDeceased` without a date. The date of death can be set in the edit form. Unmarking clears
both. Deceased contacts show "In memoriam" and drop the "turns N" countdown.

## D-024 — Composer opens over the current page, not as a route (M3)

"Desktop modal over current route" (§6.5) is implemented with a Zustand store (`useComposer`). Nav button, FAB, `n`,
profile "Log moment" and Edit open it in place. `/compose` stays as a deep link (manifest shortcut, later the share
target): it opens the composer over Home (`?contact=`, `?text=` prefill). On mobile the same `<dialog>` is full-screen.

## D-025 — Composer edits readable text; tokens are produced on save (M3)

The textarea shows `@Élise Aubert` / `#family`. The composer tracks which display strings stand for which ids, and
`draftToBody` turns them into `@[…](contact:id)` / `#[…](tag:id)` tokens on save (longest match first, word-bounded).
Editing a display string turns it back into plain text. `contactIds` = mentions ∪ people added with the explicit picker.
"Create contact" in `@` suggestions creates a minimal contact immediately.

## D-026 — Photo thumbnails (M3)

Each moment photo is stored at ≤ 1600px with a ≤ 600px feed thumbnail as a separate blob with id `<photoId>:thumb`
(no schema change). Feeds load thumbnails; the moment page loads full size. Purging a moment deletes both.

## D-027 — Pinning (M3)

`isPinned` is a flag on the moment, so a pinned moment is pinned on every profile it appears on. Several pinned
moments are allowed; profile timelines list all pinned ones first.

## D-028 — `lastInteractionAt` (M3)

The newest `happenedAt` among live moments that mention the contact (any kind). It's recomputed inside the same
transaction whenever a moment is saved, re-dated, deleted, restored or purged, so stay-in-touch (M4) stays correct.

## D-029 — Tag delete and merge (M3)

Deleting a tag removes it from every record's `tagIds` and hard-deletes the tag. Body tokens stay and render as plain
`#name` text, so nothing people wrote is lost. Merging re-points `tagIds` and rewrites body tokens to the target tag.

## D-030 — Moment card details (M3)

- Moments with no people (e.g. journal) show "You" with a kind icon as the avatar.
- Timestamps use `Intl.RelativeTimeFormat` narrow style ("2h ago", "hace 2 h") under a week, then "Mar 18".
- If the date wasn't changed in the composer, the moment gets the exact save time (not the time the composer opened).
- Life events show only under "All" on Home (there's no Life events tab in §6.1). The newest one appears in the profile meta row.
- Bodies are rendered as React nodes from `parseBody`: there is no `dangerouslySetInnerHTML` anywhere (§11).

## D-031 — Moments in Trash (M3)

Deleted moments appear in Settings › Trash next to contacts, with restore and delete forever. Expired ones are purged
with their photos on app start.

## D-032 — Stay-in-touch reminders are real records (M4)

Instead of being computed on the fly, each contact with `stayInTouchDays` has one `source: 'stay-in-touch'` reminder,
synced in the same transaction as contact saves and `lastInteractionAt` changes. Its due date is last interaction (or the date the
contact was added, if there's none) + N days. That way snooze, badges, notifications, the service worker and ICS treat it like any
other reminder. There's none for archived or deceased contacts. "Log" opens the composer, and logging a moment moves it forward.
"Done" means "I reached out elsewhere" and snoozes it for one full period.

## D-033 — Reminder groups (M4)

§6.7 groups are rolling: Today, This week (next 6 days), This month (within 30 days), Later. Anything before today
is Overdue. A snoozed reminder groups by its snooze date.

## D-034 — Badge and banner (M4)

The nav badge, the OS app badge (`setAppBadge`) and the in-app banner count open reminders due today or earlier (stay-in-touch
included). The banner hides on `/reminders`. Dismissing it lasts for that day and count (`sessionStorage`).

## D-035 — Notification rule (M4)

A reminder is notified once per effective due date: when it's due and `lastNotifiedAt` is before that date. This covers
overdue ones never shown (the app wasn't opened). Snoozing or editing the date re-arms it. Page and service worker share
`db/repositories/reminderCheck.ts`. The service worker includes the locale files so periodic-sync notifications are translated.

## D-036 — Recurrence anchoring (M4)

Manual monthly and yearly reminders advance from their current due date with month-end clamping, so Jan 31 → Feb 28 → Mar 28
(no anchor day is stored in the v1 schema). Birthdays and important dates are always recomputed from their partial date, so
Feb 29 birthdays return to Feb 29 in leap years. "Done" on an overdue recurring reminder jumps to the first occurrence after today.

## D-037 — Editing auto reminders (M4)

Birthday, important-date and stay-in-touch reminders are derived, so Edit opens their source (contact edit or Details)
and they can't be deleted directly. Manual reminders are soft-deleted with an Undo toast. Deleting an important date
soft-deletes it and purges its reminder. `ensureAutoReminders()` runs on app start to repair missing or stale auto reminders.

## D-038 — ICS export (M4)

One VEVENT per reminder: an all-day event with a 09:00 alarm, or a floating local time (30 min) when `dueTime` is set, with an RRULE from
the recurrence. Files are saved with the File System Access API when available, otherwise `<a download>`. Available per
reminder (⋯ menu) and as "Export recurring" (Reminders page, Settings › Notifications).

## D-039 — E2E browser (M4)

Playwright runs the full Chromium build (`channel: 'chromium'`, new headless) instead of the headless shell, because the
shell always denies notification permission and the notification flow is part of the §8.5 checks.

## D-040 — Right rail split (M4)

"Upcoming" lists the next 5 birthdays and reminders due today or later, excluding stay-in-touch. Those appear only in "Reach out"
(due ones, max 3, ordered by due date, never by any score).

## D-041 — Relationship direction and inverses (M5)

A row `from → to` with type T reads "to is from's T" (Élise → Marc `parent` = Marc is Élise's parent). The profile lists
rows where the contact is `from`, so each row reads "Marc · Parent". Saving creates or updates both rows in one transaction,
linked via `inverseId`. Deleting either side soft-deletes both (§8.3 AC), and Undo restores both. Self-links and exact
duplicates are rejected. The dialog shows a "Marc is Élise's parent" preview so the direction is never ambiguous.
`neighbour` is grouped under "Other" (§8.3 lists only Family, Love, Friends, Work, Other).

## D-042 — Contact tags and groups (M5)

Tags and group memberships are edited from Profile › Details as chips with an add combobox that can create new ones
(not from the contact form). The Contacts list gained Tag and Group filters, which closes the M2 deferral in D-017.

## D-043 — Groups (M5)

Deleting a group soft-deletes it with Undo. Contacts keep the id until the 30-day purge removes it from `groupIds`.
A group's timeline is every moment mentioning any member. Member counts come from the `*groupIds` multi-entry index.

## D-044 — Money (M5)

Balances are per currency (no exchange rates), summed in minor units to avoid float drift. Positive means they owe you.
The right-rail Money card shows only while unsettled debts exist: totals owed each way plus up to 5 people.
The default currency is a new Settings option.

## D-045 — Profile sub-records (M5)

Gifts, debts, tasks and pets are soft-deleted with an Undo toast. They don't get Trash rows (they go to Trash only
through their contact) and are purged after 30 days like everything else. Gift links must be http(s). Gift photos
(`photoBlobId`) aren't editable yet, but existing values are kept.

## D-046 — Boolean indexes (M5)

IndexedDB can't index booleans, so the `isStarred` and `isArchived` indexes in the v1 schema never match. Starred queries
filter instead, which is fine at the spec's data sizes. A future schema version could index them as 0/1.
