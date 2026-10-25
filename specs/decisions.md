# Decisions

Project-wide decision log: spec ambiguities resolved during implementation, and choices that outlive a single feature.
Newest last; never renumber. A feature spec records its own choices in its `requirements.md` → _Decisions_ and copies
any that affect the whole project here as the next `D-NNN`, tagged with its phase.

Bare `§n` references below point to the stable section numbers in `specs/` (see [README.md](README.md)).

## D-001 — `Tag.nameLower` field (M1)

data-model §5.2 indexes `tags` by `&nameLower`, but the §5.1 `Tag` interface has no such field. Added
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
"Done" means "I reached out elsewhere" and snoozes it for one full period. In the UI this is a check-in ("Done. Next check-in: …"),
never labelled as a snooze.

## D-033 — Reminder groups (M4)

§6.7 groups are rolling: Today, This week (next 6 days), This month (within 30 days), Later. Anything before today
is Overdue. A snoozed reminder groups by its snooze date.

## D-034 — Badge and banner (M4)

The nav badge, the OS app badge (`setAppBadge`) and the in-app banner count open reminders due today or earlier (stay-in-touch
included). The banner hides on `/reminders`. Dismissing it lasts for that day and count (`sessionStorage`).

## D-035 — Notification rule (M4)

A reminder is notified once per effective due date: when it's due and `lastNotifiedAt` is before that date. Checks claim
reminders (stamp `lastNotifiedAt` in one transaction) before showing them, so overlapping checks can't double-notify; if showing
then fails, that notification is skipped rather than repeated. This covers
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

## D-047 — Search index stores words; prefixes come from a range query (M6)

§8.6 suggests storing every prefix of at least 2 characters. Instead the index stores whole normalized words, and the last query token
uses an IndexedDB `startsWith` range on the multi-entry `tokens` index. Matching is the same (exact for earlier tokens,
prefix for the last) with an index about 5× smaller and faster writes. One-letter words aren't indexed (numbers are).
A trailing space makes the last token exact.

## D-048 — Keeping the index in sync (M6)

The writes that change searchable text update the index inside their own transactions: contact save, delete, restore,
purge and tag changes; moment save, delete, restore and purge; and tag rename, merge and delete. Moments are indexed with
current contact names, so renaming a contact re-indexes the moments that mention them. A deleted tag's word stays in the body text,
so it's still findable. `SEARCH_INDEX_VERSION` is stored in settings, and the index is rebuilt in batches on start when it's missing
or outdated (data from M1–M5, or after a tokenizer change). Tag rename now goes through `renameTag()`.

## D-049 — Search ranking and paging (M6)

People come first (archived last, then best name match), then tags, then moments newest first. Moments come 50 at a time.
The newest page is fetched with whichever strategy is cheaper: load and sort few hits, or walk the `happenedAt` index from the newest
end for many hits (n² > limit·N). Measured in Chromium with 2,000 contacts and 20,000 moments: about 35 ms typical. The first
(cold) query is about 35–50 ms since D-060, against the < 100 ms AC.

## D-050 — Measuring search time (M6)

Each search records a `kin-search` `performance.measure` with its duration (local only, never sent anywhere). The Playwright
perf test reads it to check the < 100 ms AC. `scripts/seed.ts` generates the deterministic dataset (`npx tsx scripts/seed.ts`),
using the §8.9 backup format. `tsx` was added as a dev dependency to run it.

## D-051 — Search page details (M6)

Recent searches are a per-device convenience in `localStorage` (max 8), recorded on Enter, on a right-rail search, or on
clicking a result. When the query is empty the page shows recent searches and "Trending tags" (tags by moment count, never
people). The right-rail search box is hidden on `/search`, which has its own.

## D-052 — No "Create …" before data has loaded (M6)

Right after the page loads, the shared contact and tag lookup can still be empty. Offering "Create contact 'marc'" then made
Enter create a duplicate of an existing Marc (found by an intermittent E2E failure). Composer, people picker and chip pickers now
offer suggestions only once their data has loaded (`Lookup.loaded`).

## D-053 — E2E hygiene (M6)

Every E2E test now fails on any uncaught page error (`pageErrors` fixture). The search perf test lives in `*.perf.ts`
and runs in its own Playwright project after all others, so parallel workers don't skew timings (under contention a cold
query measured 130 ms; alone it's about 70 ms).

## D-054 — Backup format and restore (M7)

`{ app: "kin", schemaVersion, exportedAt, includesPhotos, data: { <table>: [...], blobs: [{ id, mime, width, height, size, base64 }] } }`
covers every table except the search index (rebuilt on import), including soft-deleted records and settings. Export is
streamed into a `Blob` part by part (records from cursors, each photo base64-encoded separately). Import validates
everything with the entity Zod schemas, runs `backupMigrations` for older versions, rejects newer versions, and never
partially accepts an invalid file. _Merge_ goes by id with newer `updatedAt` winning and keeps local settings. _Replace_
wipes first and needs "REPLACE" typed. "Delete all data" needs "DELETE" typed (these confirmation words aren't translated).

## D-055 — vCard and CSV (M7)

vCard: the hand-written reader handles 2.1/3.0/4.0 (folding, grouped props, escapes, quoted-printable, Apple's
year-less `1604` BDAY, `--MMDD`, `data:` and `ENCODING=b` photos; URL photos are skipped since there's no network). The writer
produces 3.0 (most widely imported). NOTE becomes a note moment (§8.9), and the bio is exported as NOTE. CSV import uses PapaParse
with an editable column mapping auto-detected from Google and Outlook headers. Google's `:::` multi-values and Outlook's
`M/D/YYYY` dates are understood. CSV export uses Google-style headers and a UTF-8 BOM (so Excel reads it). Files without a
telling extension are recognized by content (`{` → backup, `BEGIN:VCARD` → vCard).

## D-056 — Duplicates and merge (M7)

Possible duplicates = same normalized full name, same email (case-insensitive), or same phone (digits only, the last 9 compared,
7+ digits). They show up when creating a contact ("Save and merge") and in the import preview (default: merge into the
existing contact; a repeat within the same file defaults to skip). The profile ⋯ menu has "Merge with…" with a choice of
which contact to keep. `mergeContacts` keeps the primary's values, fills gaps, unions tags and groups, moves fields, addresses
and dependents (dropping exact duplicates), rewrites moment `contactIds` and mention tokens, re-points relationships (dropping
self-links and duplicates) and "introduced by" links, drops the secondary's auto reminders, and soft-deletes the secondary.

## D-057 — Share target and file handlers (M7)

The manifest declares one POST `share_target` (`/share-target`, multipart). The service worker puts shared files in the `kin-share`
cache and redirects to `/settings/data?shared=1`, where they're imported. Shared text redirects to `/compose?text=`.
`file_handlers` (Chromium, installed) open `/settings/data`, which consumes `window.launchQueue`. Both are feature-detected.

## D-058 — Order of contact fields and addresses (M7)

These rows had no stored order and were read back in key (UUID) order, so two phone numbers could swap places in the profile,
the edit form and exports. Both schemas gain an optional, non-indexed `position` (set on save from the form order), and reads sort by
`position`, then `createdAt` (older data). No Dexie version bump is needed because indexes didn't change.

## D-059 — Backup nudge (M7)

Shown when contacts exist and there has been no export in 30 days (counting from the oldest contact if never exported).
"Not now" hides it for 30 days. It's hidden on the Data page itself. Tracked in settings `lastBackupAt` / `backupNudgeDismissedAt`.

## D-060 — Start-up maintenance must not block reads (M7)

`ensureAutoReminders()` used to open one write transaction over all contacts and query reminders per contact on every
start. A search typed right after launch had to wait for it: the cold query took 120–150 ms with 2k/20k records. It now does a
read-only pass, and only opens a write transaction (touching only the affected contacts) when something is missing or stale.
The cold search is now about 35–50 ms. The backup nudge's "data since" also became one indexed read instead of a scan.

## D-061 — When onboarding shows (M8)

§8.1: shown only when the database is empty and `settings.onboarded` is unset. The gate runs only on Home (`/`, the
`start_url`); deep links like `/contacts/new` or `/settings/data` are never redirected. "Onboarded" is also mirrored in
`localStorage['kin.onboarded']` so the decision doesn't wait for IndexedDB. "Delete all data" clears both, so onboarding
returns. Existing databases without the flag (upgrades from M1–M7) are marked as onboarded silently. The gate reads settings and counts
in one transaction (`onboardingSnapshot`), because separate live queries caused a race after "Delete all data".

## D-062 — Demo data (M8)

About 15 bilingual (en/es) sample people with moments, reminders, gifts, debts, tasks, a pet, an important date, groups and
relationships, created through the normal services so derived data (auto reminders, search index, last interaction) is
consistent. The created ids are stored in `settings.demo`. "Remove demo data" permanently removes exactly those (it never touches
the user's own contacts or pre-existing tags). Available from onboarding and Settings › Your data.

## D-063 — App lock (M8)

§8.10 asks for a screen lock, not encryption, and the UI says so. A 4–6 digit PIN is required (stored only as PBKDF2-SHA256,
210k iterations, random salt; compared in constant time). A passkey is an optional faster unlock: a platform authenticator
with user verification, and the assertion is verified on the device with WebCrypto (challenge, origin, UP/UV flags, ES256 or
RS256 signature over `authenticatorData ‖ SHA-256(clientDataJSON)`). After 5 wrong PINs there's a 30 s cool-down that survives
reloads. It locks on open and after N minutes in the background (default 5). A forgotten PIN can only be recovered by deleting all data,
which is honest because the data isn't encrypted. `localStorage['kin.lock']` mirrors the setting so the lock screen shows before
IndexedDB has loaded.

## D-064 — Keyboard shortcuts (M8)

§6.9's set plus Enter to open the focused moment. Shortcuts are ignored while typing, with modifier keys, or while any dialog or the
composer is open. Moment cards are focusable (`tabIndex=0`) so `j`/`k` move real focus (visible focus ring) and `s` stars the focused
card. `g` waits up to 1 s for its second key.

## D-065 — Accent text contrast (M8)

Accent fills keep the user's accent with `--on-accent` text (D-008). Accent-coloured text, links and icons use `--accent-text`,
computed per theme and accent: the accent is mixed toward black (light) or white (dark) just enough to reach 4.5:1 on every surface of
the theme, including accent-tinted chips. A unit test checks every accent × theme × surface. Light-theme `--success` was darkened
to #00704f (it was 4.43:1 on cards). Danger buttons use `--on-danger` (white on the light red, black on the dark themes' lighter
red, which only reached 3.0:1 with white text). Links inside running text (moment bodies, "with …") are underlined as well as
coloured (WCAG 1.4.1).

## D-066 — Accessible names (M8)

Links and buttons whose text is visible take their name from that text, not an `aria-label` (WCAG 2.5.3). Icon-only nav labels
are visually hidden (`sr-only`) rather than replaced by `aria-label`. The reminders badge number is decorative, and its phrase follows the
label ("Reminders (1 reminder due)"). The avatar link next to a moment's name link is hidden from assistive tech and the tab order. axe-core
(WCAG 2.1 A/AA) runs in E2E across 13 screens × 3 themes, plus the composer, onboarding, lock screen and mobile layout.

## D-067 — Performance and installability checks (M8)

Every screen except Home is a lazy route chunk (all precached, so they still open offline), which leaves the first-load bundle at about
204 KB gzipped (budget 250). What remains is mostly React, the router, Dexie, Zod, i18next and the virtual list that Home needs.
Lighthouse 12 has no PWA category any more, so installability is checked through Chromium's `Page.getInstallabilityErrors` in E2E
(the only error reported is `in-incognito`, inherent to Playwright contexts). Lighthouse on mobile (simulated throttling) scores
Performance 94, Accessibility 100 and Best practices 100. See the README for how to run it.

## D-068 — Cross-browser E2E (M8)

The offline and layout specs also run in Playwright's Firefox and WebKit (§15). Under parallel load, WebKit sometimes reports its own
cancelled fetch of `sw.js` ("Cannot load …/sw.js due to access control checks", no stack) as a page error when a test navigates
mid-request. That one WebKit message is ignored by the page-error check. Registration errors from app code are caught and written to
the diagnostics log. Playwright's WebKit is Safari's engine, not iOS Safari, so behaviour on a real iPhone (installed to the Home Screen)
still needs a manual check.

## D-069 — Memory recall is derived, not stored (Phase 10)

"Before you meet", "On this day" and Milestones are pure functions of existing rows (`domain/recall.ts`), so there is no
schema change and nothing to keep in sync. "On this day" runs one `happenedAt` range query per earlier year (two extra
for Feb 29 on Feb 28), so cost follows the years covered, not the number of moments: about 10–50 ms warm and up to ~100 ms
cold on start-up with 2k contacts / 20k moments in the perf project. Each run records a local `kin-on-this-day`
`performance.measure` (never sent anywhere); the perf test times a warm re-mount of Home, like D-053. A first moment that
is itself a life event is not listed twice in Milestones. The brief avoids "you haven't talked in N days" wording so stay-in-touch
stays the only nudge (mission §1.2).

## D-070 — Capture speed (Phase 11)

Moment templates are code (`domain/momentTemplates.ts`) with labels and starter text in i18n; they never overwrite typed text.
The template picker is a `Menu` (not a native `<select>`) so its options don't appear as extra `option` roles beside the @/#
suggestions listbox. "Log a call" reuses the composer through a `kind`/`callDirection` prefill; `ComposerDialog` focuses a
`[data-autofocus]` control before the text box. Gift photos reuse the moment-photo convention (full image plus
`<id>:thumb`, D-026) and need no schema change; `saveGift(id, draft, photo)` takes `undefined` (keep), `null` (remove) or new
images (replace) and deletes the old blobs in the same transaction. Contact purge and the expiry sweep delete gift photos too.
**Voice dictation was dropped:** the browser speech-recognition APIs send audio to a server, which conflicts with mission §1.2.
It stays in the backlog until an on-device API is widely available.
