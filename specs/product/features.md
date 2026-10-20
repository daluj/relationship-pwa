# Features and acceptance criteria

> Section numbers (§n) are stable IDs carried over from the original single-file spec and are
> cited throughout the code (`// features §8.5`). Never renumber; add new subsections at the end.

Every **AC** here must be covered by an automated test (see tech-stack §13).

## 8. Features & acceptance criteria

### 8.1 Onboarding (first run)
- Welcome screen explaining: data stays on this device; install the app; export regularly.
- Steps: choose language → theme → request persistent storage (`navigator.storage.persist()`) → optional notification permission → add first contacts (manual or import vCard/CSV) or load demo data.
- **AC:** onboarding shown only when DB is empty and `settings.onboarded` is unset. "Load demo data" creates ~15 contacts with moments, reminders, gifts, relationships; a "Remove demo data" button exists in Settings.

### 8.2 Contacts
- Create/edit with only `firstName` required. Avatar upload with crop to square; banner upload with 3:1 crop.
- Initials avatar with deterministic color when no photo.
- Duplicate detection on create and import: same normalized name, email or phone → show "Possible duplicate" with **Merge** option.
- **Merge**: pick primary, union of fields, relationships, moments (rewrite `contactIds`), reminders, gifts, debts, tasks; secondary soft-deleted.
- Archive hides from lists/right rail but keeps in search with "Archived" badge.
- **AC:** creating a contact with a birthday auto-creates a yearly `birthday` reminder; editing the birthday updates it; removing it deletes the reminder.

### 8.3 Relationships
- Add from profile Details: pick contact (or create inline) + type + since.
- Inverse auto-created (parent↔child, grandparent↔grandchild, uncle-aunt↔nephew-niece, godparent↔godchild, boss↔subordinate, mentor↔protege; symmetric types mirror).
- Profile meta shows counts; Details shows grouped list ("Family", "Love", "Friends", "Work", "Other").
- **AC:** deleting one side deletes the inverse.

### 8.4 Moments (timeline)
- Kinds per §5.1; composer per §6.5.
- Mention parsing: `@nickname` or `@First Last` resolved at compose time via autocomplete; stored as `contactIds` plus a stable token in body (`@[Élise Aubert](contact:uuid)`), rendered as a link. Renaming a contact updates rendered name automatically.
- `#tag` stored similarly (`#[family](tag:uuid)`).
- Home filters by kind tab; infinite scroll (virtualized, 30 per page via Dexie `offset/limit` on `happenedAt` index).
- Editing a moment's date re-sorts the feed.
- Life events also appear in profile meta (e.g. "Moved to Lyon · Jun 2026").
- **AC:** a moment with 3 mentioned contacts appears on all 3 profiles; deleting it shows Undo toast and removes it from all.

### 8.5 Reminders & notifications
- Manual reminders with recurrence; auto reminders from birthdays, important dates (with `remindDaysBefore`), and stay-in-touch.
- **Stay in touch**: if `stayInTouchDays` set and `now - lastInteractionAt > stayInTouchDays`, contact appears in right-rail "Reach out" and in Reminders › Overdue as source `stay-in-touch`. Logging a moment with them clears it.
- Recurring reminder "Done" advances `dueDate` to next occurrence (pure function in `domain/recurrence.ts`, handle Feb 29 → Feb 28 in non-leap years, month-end clamping).
- **Notifications (best effort, be honest in UI):**
  - On app open and on `visibilitychange`, compute due reminders and show in-app banner + badge.
  - If permission granted, show system notification via `registration.showNotification()` for reminders due today not yet notified (`lastNotifiedAt`).
  - Where supported (installed Chromium), register **Periodic Background Sync** (`periodicSync.register('check-reminders', { minInterval: 12h })`); SW reads IndexedDB and notifies. Feature-detect; never rely on it.
  - Set app badge with `navigator.setAppBadge(count)` where supported.
  - Settings page states clearly: "Notifications are delivered when the app is opened, or periodically on supported browsers. There is no server."
  - Offer **Export to calendar (.ics)** for reminders (individual and all recurring) so users can rely on their OS calendar for alerts.
- **AC:** with system date mocked, a birthday reminder due today shows in Reminders › Today and increments the nav badge; completing a yearly reminder moves it to next year.

### 8.6 Search
- Client-side full-text index stored in `searchIndex` table: for each contact (names, nickname, company, fields, tags, notes) and moment (body, location, tag names), store lowercase, diacritic-stripped tokens (`normalize('NFD')`, strip combining marks) and prefixes ≥ 2 chars.
- Index updated inside the same repository transaction as writes.
- Query: tokenize, intersect results, rank people above moments; prefix match on last token.
- **AC:** searching "eli" finds "Élise"; searching "lyon coffee" finds a moment containing both words; results return < 100 ms with 2,000 contacts and 20,000 moments (perf test with generated data).

### 8.7 Gifts, debts, tasks, pets, important dates
- CRUD from the contact profile tabs; gifts and tasks also have global views (Tasks page; gifts via filter in search "Tags/Gifts" not required).
- Debts: per-contact balance by currency; global balance summary in Settings › Data? No — show a small "Money" summary card on the right rail only if any unsettled debts exist.
- **AC:** settling a debt removes it from balance and shows it as settled with date.

### 8.8 Tags & groups
- Tags: create inline (composer, contact edit), rename, recolor, merge, delete (removes from records).
- Groups: create, add/remove members from group page or contact profile; group timeline.
- **AC:** renaming a tag updates rendering everywhere without rewriting moment bodies (tokens reference tag id).

### 8.9 Import / export
- **Export JSON (full backup):** single `.json` file `{ app: "kin", schemaVersion, exportedAt, data: { contacts: [...], ... , blobs: [{id, mime, base64}] } }`. Option to exclude photos. Uses streaming/chunking to avoid memory spikes for large datasets.
- **Import JSON:** validate with Zod; if schemaVersion older, run migrations; modes: *Replace all* (typed confirmation) or *Merge* (by `id`, newer `updatedAt` wins).
- **vCard import (3.0/4.0, multi-contact files):** FN/N, NICKNAME, BDAY, TEL, EMAIL, ADR, ORG, TITLE, URL, NOTE (→ a note moment), PHOTO (base64 or skip URLs). Show preview table with duplicate warnings and per-row include/merge/skip before committing.
- **vCard export:** single contact (profile menu) or all.
- **CSV import:** column-mapping step (auto-detect common headers incl. Google Contacts and Outlook exports); CSV export of contacts.
- **ICS export:** reminders.
- **Backup nudge:** if no export in 30 days and data exists, show a dismissible banner "Back up your data" (important because browsers may evict storage).
- Use File System Access API `showSaveFilePicker` when available, otherwise `<a download>`. Import via file input and drag-and-drop; also register as **share target / file handler** in the manifest for `.vcf` and `.json` (Chromium).
- **AC:** export → clear all data → import yields identical record counts and identical contact/moment content (round-trip test).

### 8.10 Settings & storage
- Show storage usage (`navigator.storage.estimate()`) and persistence status (`navigator.storage.persisted()`), with a "Request persistent storage" button.
- iOS note in UI: data may be cleared by Safari if the site is not added to the Home Screen and unused for a while — prompt to install and back up.
- "Delete all data" requires typing `DELETE`.
- Optional **app lock**: 4–6 digit PIN or passkey (WebAuthn, local only) gating the UI on open; *document clearly that this is a UI lock, not encryption* (encryption at rest is a future item).
