# Changelog

## Phase 10 — Memory recall (2026-10-25)

- "Before you meet" (`/c/:id/brief`): recent moments, open tasks, net balance per currency, gift ideas and recent gifts, how you met,
  and upcoming dates on one screen. Sections with nothing in them are left out.
- Home › "On this day": moments from earlier years on today's date, grouped by year (Feb 29 shows on Feb 28 in non-leap years).
- Profile › Timeline › Milestones: how you met, relationship start dates, life events, important dates, given gifts and the first
  logged moment, oldest first.
- Nothing is stored or ranked: all three are derived from existing records (D-069). English and Spanish.
- Tests: domain, repository and component tests, E2E with a mocked date and offline reload, an axe sweep of the brief, and a perf
  test for "On this day" with 20k moments. New `tests/e2e/backupFixture.ts` seeds dated data through the Restore flow.
- Not verified in this environment: the Firefox and WebKit E2E projects (browsers not installed) and one Chromium download-filename
  test (`data.spec.ts` vCard export), which also fails on `main` here.

## M8 — Polish (2026-10-19)

- Onboarding (language, theme, persistent storage, notifications, first contacts or demo data). It opens only when the database is
  empty and onboarding was never completed. Load and remove demo data from Settings › Your data.
- Keyboard shortcuts with a `?` help dialog: n, /, g h, g r, g c, j/k, s, Enter.
- Settings: storage usage and persistence (with the iOS note), and an app lock with a PIN (PBKDF2) and optional passkey (WebAuthn,
  verified on the device). It is clearly labelled as a screen lock, not encryption, and locks out after 5 wrong PINs.
- Install prompt (More menu, onboarding, iOS instructions). About page with privacy details and a local diagnostics log. The update
  toast waits while the composer is open.
- Accessibility: axe finds zero WCAG 2.1 AA violations across the main screens in all three themes, plus onboarding, the lock screen
  and mobile. Accent text uses a computed `--accent-text` (≥ 4.5:1). Fixed accessible-name mismatches in the nav and cards.
- Every screen except Home is lazy-loaded (main bundle 204 KB gzipped). Lighthouse on mobile: Performance 94, Accessibility 100,
  Best practices 100. Chromium reports the app as installable (apart from the test's incognito context).
- The offline and layout E2E tests pass in Chromium, Firefox and WebKit.
- Fixed: the onboarding gate race after "Delete all data", and explicit `undefined` overriding repository defaults.
- Follow-up: service-worker registration errors go to the diagnostics log; the WebKit E2E flake was traced to WebKit reporting
  its own cancelled `sw.js` fetch (D-068); M8 decisions D-061–D-068; README rewritten; `npm run lighthouse`.

## M7 — Import / export (2026-10-19)

- Settings › Your data: full JSON backup (optionally without photos, streamed), vCard and CSV export, import by file picker or
  drag-and-drop, and "Delete all data" with typed confirmation. Shows the last backup date.
- Restore a backup by merging (newer wins) or replacing everything (typed confirmation). Validated, migratable, and all-or-nothing.
  The round-trip AC (export → delete all → import = identical counts and content) is checked in unit and E2E tests.
- vCard import (2.1/3.0/4.0 from iOS, Google, Outlook) and export (all contacts, or one from the profile ⋯ menu).
  Inline photos become avatars and NOTE becomes a note moment.
- CSV import with a column-mapping step (Google/Outlook headers auto-detected) and CSV export.
- Import preview with per-row Import / Merge / Skip and duplicate warnings (vs existing contacts and within the file).
- Duplicate detection when creating a contact ("Save and merge"), and "Merge with…" on profiles (§8.2 merge rules).
- Backup nudge after 30 days without an export. Web Share Target (files → import, text → composer) and file handlers
  for .vcf/.json/.csv.
- Fixed: contact fields and addresses didn't keep their entered order (found by the CSV export test).
- Faster start-up: repairing automatic reminders no longer locks every contact. The first search after launch went from
  about 130 ms to about 40 ms with 2k contacts and 20k moments (the perf test had started failing on this machine).

## Fix — Reminders "Done" wording (2026-10-19)

- Done on a stay-in-touch reminder said "Snoozed until …". Done there means "I was in touch", so it now says
  "Done. Next check-in: …" and the row no longer shows a snooze label. Explicit snoozes show "Snoozed" next to the date
  instead of repeating it.
- Dates in reminder rows and toasts include the year when it isn't this year (e.g. a birthday's "Next: Thu, Mar 18, 2027").
- Found while hunting intermittent test failures:
  - A reminder could be notified twice when two checks overlapped (an effect re-run, another tab, or the service
    worker). Reminders are now claimed in one transaction before they're shown, so each is notified exactly once.
  - Composer `@`/`#` suggestions (and the people/tag/group pickers) could close by themselves if you clicked away and
    back within 150 ms. Enter then added a newline instead of picking the person. Stale blur timers are now ignored.
  - Notifications now wait briefly for the service worker after a reload instead of silently skipping.
- E2E: the notification test records the app's `showNotification` calls (Chromium's `getNotifications()` is unreliable
  headless) and runs on a mocked clock. The full suite passed 4×, and the formerly flaky tests 20× each.

## M6 — Search (2026-10-19)

- Client-side full-text index (`searchIndex`) with accent- and case-insensitive tokens for contacts (names, nickname, work, notes,
  fields, addresses, tags) and moments (body with current names, location, tags). It's updated in the same transaction as every write
  and rebuilt on start when needed.
- Query: tokenize, intersect, prefix on the last token. People rank above moments. "eli" finds "Élise", and "lyon coffee" finds
  a moment containing both words (§8.6 ACs).
- Search page (`/search?q=`): pill search box, Top / People / Moments / Tags tabs, archived badge, live results,
  paged moments, recent searches, and trending tags when the query is empty. The right-rail box opens it.
- Performance: measured in Chromium with 2,000 contacts and 20,000 moments, about 35 ms typical and about 70 ms cold (AC < 100 ms). The
  first version took up to 120 ms on broad queries; adaptive "newest N" loading fixed that.
- `scripts/seed.ts`: deterministic dataset generator (also used by the perf E2E).
- Fixed: right after load, `@` / "Add person" could offer only "Create contact" and create a duplicate. Suggestions now wait
  for data. E2E tests now fail on uncaught page errors, and the perf test runs in an isolated project.
- Tests: tokenizer and query parsing, index maintenance across every write path, ranking and paging, the search page E2E,
  and the perf E2E.

## M5 — Relationships, gifts, debts, tasks, pets, groups, starred (2026-10-19)

- Relationships in Profile › Details, grouped Family / Love / Friends / Work / Other. Pick or create a person, set type and
  since date. The inverse is created and kept in sync, and deleting one side deletes both (§8.3 AC). The profile shows a
  "1 family · 2 friends" row that links to the list.
- Gifts tab grouped Ideas / Bought / Given / Received (occasion, safe link, price and currency, date, notes, move between statuses).
- Money tab with per-currency running balance ("Owes you €15.00" / "You owe €20.00"), settle and unsettle with date
  (§8.7 AC). The right-rail Money card shows only while unsettled debts exist.
- Tasks: profile tab and global `/tasks` checklist (Open/Done, quick add with due date and person, overdue highlight).
- Pets, plus tag and group chips with create-on-the-fly, in Profile › Details. The groups a contact belongs to show in the profile meta.
- Groups (`/groups`, `/groups/:id`): emoji and color banner, description, members (add/remove, inline create),
  group timeline, edit, delete with Undo. Contacts list gains Tag and Group filters.
- Starred (`/starred`): starred people row and starred moments feed. Settings has a default currency.
- Tests: relationship inverses and grouping, money balances and settling, groups (membership, timeline, purge),
  starred, plus E2E for each area.

## M4 — Reminders (2026-10-19)

- Reminders page (`/reminders`): Upcoming (Today / This week / This month / Later), Overdue with count, Done. Each item has
  Done, Snooze (tomorrow, next week, pick a date) and a ⋯ menu (edit, add to calendar, mark not done, delete with Undo).
- Manual reminders with optional time, person, notes and recurrence (daily, weekly, monthly or yearly, every N).
  `domain/recurrence.ts` handles month-end clamping and Feb 29 → Feb 28.
- Automatic reminders kept in sync transactionally: birthdays (yearly), important dates (yearly, N days before), and stay
  in touch (due N days after the last interaction; logging a moment clears it). They're repaired on app start.
- Important dates in Profile › Details (add, edit, delete) and a Profile › Reminders tab (upcoming + done, add).
- Right rail: Upcoming (next 5) and Reach out (due stay-in-touch, max 3, "Log" button). The nav badge counts due reminders.
- Notifications: in-app banner on open; system notifications when permitted (once per due date); OS app badge;
  Periodic Background Sync (`check-reminders`, 12h) handled in the service worker, which reads IndexedDB; notification click
  focuses or opens the right page. Settings › Notifications explains plainly how delivery works.
- `.ics` export per reminder and for all recurring ones.
- Tests: recurrence, grouping and notification rules, ICS output, the reminder service (incl. the §8.5 AC with a mocked date),
  and E2E with a mocked clock for the birthday AC, manual reminders, stay in touch, important dates with ICS download, and system
  notifications. Lint caught a missing `;` escape in ICS text, now fixed.

## M3 — Moments (2026-10-19)

- Composer ("What happened?") inline on Home (desktop), as a modal on desktop and a full-screen sheet on mobile; opened by
  the nav button, FAB, `n`, profile "Log moment" or `/compose`. Kind chips (Activity, Note, Call, Journal, Life event)
  with kind-specific fields (activity type, call direction and duration, life-event type, mood), date/time, location, up to 4
  photos (resized client-side with thumbnails). Ctrl/⌘+Enter saves; Esc asks before discarding a dirty draft.
- `@` and `#` autocomplete as an ARIA combobox: fuzzy, accent-insensitive contact matching with "Create contact",
  and tag matching with create-on-Enter. An explicit people picker sits alongside.
- Mentions and tags are stored as id tokens, so renaming a contact or tag re-renders every moment (§8.4, §8.8 AC).
- Home feed with All · Activities · Notes · Calls · Journal tabs, infinite scroll in pages of 30, virtualized.
- Moment card (§6.4): primary and stacked avatars, kind line, linked body, X-style photo grid, "with …" line,
  Star / Pin / Edit / Delete (with Undo), and ⋯ Copy text / Change date. Moment page `/moment/:id`.
- Profile Timeline (pinned first) and a life-event meta line. `lastInteractionAt` is kept in sync transactionally.
- Tag page `/tags/:id` with rename, recolor, merge and delete. Deleted moments appear in Trash.
- Fixed while testing: the caret was placed after a completion asynchronously; Ctrl/⌘+Enter saved twice; nested
  dialogs closed their parent; the composer was stamped with the time it opened.
- Tests: tokens, triggers, fuzzy matching, timestamps, moment and tag services (incl. the 3-contact AC), composer
  autocomplete and moment card component tests, and moment E2E flows. The offline E2E test now covers the full §9 AC.

## M2 — Contacts (2026-10-19)

- Contacts list (`/contacts`): A–Z (locale-aware), recently interacted and recently added sorts; All, Starred and Archived
  filters; star toggle; window-virtualized rows; mobile A–Z jump.
- Contact form (`/contacts/new`, `/c/:id/edit`, lazy-loaded): React Hook Form + Zod with only first name required.
  Covers nickname, bio, gender, pronouns, birthday (year optional), contact fields, addresses, how we met (incl.
  introduced by), work, food preferences, stay-in-touch frequency, and deceased. Unsaved changes ask before being discarded.
- Avatar (square) and banner (3:1) upload with a pan/zoom cropper, resized client-side and stored as WebP/JPEG blobs.
  Initials avatars use a deterministic, AA-contrast color.
- Profile (`/c/:id`, `/c/:id/:tab`): X-style banner and overlapping avatar, actions, ⋯ menu (star, archive,
  mark deceased, delete), and a meta row (city, birthday with "turns N in …", how you met, last interaction).
  Sticky route-driven tabs, with the **Details** tab working (`tel:`/`mailto:`/safe social links).
- `saveContact` saves the contact, fields, addresses and images in one transaction and syncs the yearly birthday reminder (§8.2 AC).
- Delete moves the contact to Trash with an Undo toast. It cascades to dependents with one tombstone, and restore brings
  back exactly those. Trash page (`/settings/trash`) has restore and delete forever (with confirmation), and items are purged after 30 days.
- Tests: domain (partial dates, names, links, crop), contact service, form model, a profile tabs component test,
  and contact E2E flows. The offline E2E test now creates a contact offline.

## M1 — Foundation (2026-10-19)

- Vite 6 + React 18 + TypeScript (strict) + Tailwind 4 project, with ESLint rules enforcing the tech-stack §4 layering.
- React Router v6 data router with every ui §7 route registered (placeholder screens).
- Responsive X-style layout shell: 3 columns on desktop, icon-only nav on tablet (right rail hidden under 1000px), and top bar + bottom tabs + FAB on mobile, with safe-area insets.
- Themes: Light / Dim / Lights out, 6 accents, 5 font sizes, saved in Dexie and following `prefers-color-scheme`; `theme-color` meta kept in sync.
- i18n scaffold (i18next) with complete `en` and `es` shell strings.
- Dexie schema v1 (data-model §5.2), generic repository (timestamps, Zod validation, soft delete/restore), per-entity repositories, settings and blob repositories, and live-query hooks.
- PWA: hand-written manifest with icons and shortcuts, Workbox `injectManifest` SW that precaches the app shell with SPA navigation fallback, and an "Update available" toast.
- Tests: repository and schema unit tests (fake-indexeddb); Playwright E2E for offline reload, data persistence and responsive layout.
