# Roadmap

> Part of Kin's constitution (with [mission.md](mission.md) and [tech-stack.md](tech-stack.md)).
> Phases are small: each one fits a focused session and ships independently. The next phase to spec is the first one
> with unchecked items. Replan here (add, split, reorder phases) after validating each phase, before the next spec.
> Ideas that are not yet scheduled live in [`backlog/`](../backlog/).

Status key: `[x]` done and validated · `[ ]` to do. Each completed phase links its changelog entry; phases from Phase 9
onwards also link their feature spec folder (`specs/YYYY-MM-DD-<name>/`).

## 14. Milestones

### Phase 1 (M1) — Foundation · complete · [changelog](../CHANGELOG.md#m1--foundation-2026-10-19)

- [x] Vite + React + TS + Tailwind, routing
- [x] Layout shell: 3-column desktop, tablet, mobile bottom bar
- [x] Themes and i18n scaffold
- [x] Dexie schema v1, repositories and tests
- [x] PWA precache and offline-reload E2E

### Phase 2 (M2) — Contacts · complete · [changelog](../CHANGELOG.md#m2--contacts-2026-10-19)

- [x] Contacts list, create/edit form
- [x] Avatar and banner, contact fields, addresses
- [x] Profile page with tabs (Details working)
- [x] Star/archive, delete and Trash

### Phase 3 (M3) — Moments · complete · [changelog](../CHANGELOG.md#m3--moments-2026-10-19)

- [x] Composer: all kinds, @mentions, #tags, photos
- [x] Home feed with kind tabs, profile Timeline, moment detail
- [x] Pin/star, tag pages

### Phase 4 (M4) — Reminders · complete · [changelog](../CHANGELOG.md#m4--reminders-2026-10-19)

- [x] Manual and recurring reminders; birthdays, important dates, stay-in-touch
- [x] Reminders page, badges, right rail Upcoming / Reach out
- [x] Notifications: in-app, system, periodic sync where supported
- [x] ICS export

### Phase 5 (M5) — Relationships, gifts, debts, tasks, pets, groups, starred · complete · [changelog](../CHANGELOG.md#m5--relationships-gifts-debts-tasks-pets-groups-starred-2026-10-19)

- [x] Relationships with automatic inverses
- [x] Gifts, debts (money), tasks, pets
- [x] Groups and Starred pages

### Phase 6 (M6) — Search · complete · [changelog](../CHANGELOG.md#m6--search-2026-10-19)

- [x] Search index, search page, right-rail search box
- [x] Performance test (2k contacts / 20k moments)

### Phase 7 (M7) — Import / export · complete · [changelog](../CHANGELOG.md#m7--import--export-2026-10-19)

- [x] JSON backup/restore, vCard, CSV
- [x] Duplicate detection and merge
- [x] Backup nudge, file handlers and share target

### Phase 8 (M8) — Polish · complete · [changelog](../CHANGELOG.md#m8--polish-2026-10-19)

- [x] Onboarding and demo data
- [x] Settings: storage, app lock
- [x] Keyboard shortcuts, accessibility audit, Lighthouse, update flow

### Phase 9 — v1 release check

**Goal:** confirm the §15 definition of done on real devices, which automated tests cannot fully cover.

- [ ] iPhone, Safari: install to the Home Screen, go offline, reload, create a contact and a moment, restart the app
- [ ] Android, Chrome: install, app shortcuts, share target and `.vcf` file handler, periodic reminder notification
- [ ] Desktop Chrome and Firefox: offline after first load, export → delete all → import round trip
- [ ] Record any device-specific findings in [decisions.md](decisions.md) and fix or schedule them

### Phase 10 — Memory recall · [spec](2026-10-25-memory-recall/)

**Goal:** make the stored memories easy to get back at the moment they matter. No scoring or ranking of people.

- [x] Contact "Before you meet" view: recent moments, open tasks, unsettled debts, gifts and notes on one screen
- [x] Home "On this day" panel with moments from past years
- [x] Per-contact relationship timeline with life events and milestones

### Phase 11 — Capture speed · [spec](2026-10-25-capture-speed/)

**Goal:** log a moment in as few taps as possible.

- [x] Quick "log a call" shortcut and built-in moment templates (Coffee, Meal, Call, Gift given, Visit)
- ~~Voice dictation~~ dropped: browser speech recognition sends audio to a server (mission §1.2); stays in the backlog
- [x] Editable photo attachments on gifts (closes the `photoBlobId` gap in D-045)

### Phase 12 — Organisation depth · [spec](2026-10-25-organisation-depth/)

**Goal:** find and manage people and moments at scale.

- [x] Search filters (kind, tag, group, date range, "not contacted in N days") and saved searches (Dexie v2)
- [x] Bulk actions on contacts: tag, group, archive
- [x] Year in review page with plain counts (no scores, no rankings)

### Phase 13 — Backlog polish · [spec](2026-10-25-backlog-polish/)

**Goal:** clear the small items from the backlog.

- [x] Calendar `.ics` import of birthdays and important dates
- [x] Undo for contact merge (Dexie v3 snapshots)
- [x] New locales: fr, de, pt
- [x] Print / PDF view of a contact profile
- [x] Screen-reader announcements for live updates

Phases 10–13 ship together on branch `phase-10-13-recall-capture-organise` and one PR. Phase 9 (real-device check) stays open; it needs hardware and does not block them.

## 15. Definition of done (v1)

- [x] All ACs in features §8 and pwa §9 pass (automated: `npm run verify`).
- [ ] Works fully offline after first load on Chrome (desktop & Android), Safari iOS (installed), Firefox desktop.
      _Automated in Chromium, Firefox and WebKit; real-device check is Phase 9._
- [ ] Installable; shortcuts work; data survives reloads and app restarts. _Chromium installability automated; Phase 9._
- [x] Export/import round trip lossless.
- [x] No network requests after load (verified in Playwright by asserting zero non-same-origin requests).
