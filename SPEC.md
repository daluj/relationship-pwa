# Kin — Offline-First Personal CRM (PWA)

> Product & technical specification for implementation with Claude Code.
> Inspired by the feature set of Monica (monicahq.com), an open-source personal CRM. UI layout patterned on X.com.
> Working name: **Kin** (placeholder — rename freely).

---

## 0. How to use this document (for Claude Code)

- Treat this file as the source of truth. Implement milestone by milestone (§14); do not skip ahead.
- At the start of each milestone, re-read the relevant sections and list the files you will create or change.
- Every feature has **acceptance criteria (AC)**. A milestone is done only when all its ACs pass and tests are green.
- When the spec is ambiguous, choose the simplest option consistent with §1 principles, and record the decision in `docs/DECISIONS.md`.
- Do not add a backend, accounts, analytics, or any network call that sends user data anywhere.

---

## 1. Product overview

### 1.1 What it is
A private "memory backup" for the people in your life: friends, family, colleagues, neighbours. You record what's happening in their lives, how you know them, important dates, conversations, gifts, debts and promises, and the app reminds you to get back in touch.

### 1.2 Principles
1. **Offline-first, local-only.** All data lives in IndexedDB on the device. The app works with no network after first load.
2. **Private by design.** No server, no telemetry, no third-party scripts at runtime, no ads. Nothing leaves the device unless the user exports it.
3. **Nobody is a lead.** No scoring or ranking people. No gamification.
4. **Data ownership.** Full export/import at any time (JSON, vCard, CSV).
5. **Fast and familiar.** UI borrows X.com's layout and interaction patterns so it feels instantly usable — but it is a private journal, not a social network: no followers, no public feed, no sharing.

### 1.3 The X.com metaphor mapping

| X.com concept | Kin equivalent |
|---|---|
| Home timeline | **Home**: reverse-chronological stream of *your own* logged moments (activities, notes, calls, journal entries) across all contacts |
| Compose "What is happening?!" | **Compose "What happened?"** — log a moment; `@mention` contacts, `#tag` it |
| Post | **Moment** (activity / note / call / journal entry) |
| Profile page | **Contact profile** (banner, avatar, name, relationship line, "how you met" as bio, tabs) |
| Notifications | **Reminders** due / upcoming, birthdays, "stay in touch" nudges |
| Explore / Search | **Search** across contacts, moments, tags |
| Lists | **Groups** (Family, Work, Book club…) |
| Bookmarks | **Starred** contacts and moments |
| Messages | Not used (no messaging). Slot repurposed for **Tasks** |
| "Who to follow" (right rail) | **"Reach out"** — contacts you haven't logged anything with for a while (based on user-set stay-in-touch frequency only, never ranking) |
| "Trends" (right rail) | **Upcoming** — next birthdays & reminders |

**Branding constraint:** do not use X's logo, name, bird/X marks, or brand colors verbatim. Copy the *layout and interaction patterns*, not the brand. Use an original logo and an accent color of our own (default: teal `#14B8A6`; user-configurable).

---

## 2. Scope

### 2.1 In scope (v1)
Contacts, contact fields, relationships, moments (activities, notes, calls, journal), reminders (incl. auto birthdays and stay-in-touch), important dates, life events, gifts, debts, tasks, tags, groups, pets, addresses, photos/avatars, search, import/export, PWA install + offline, local notifications (best effort), themes, i18n scaffolding (en + es).

### 2.2 Out of scope (v1)
Accounts/login, cloud sync, multi-user/sharing, server API, AI features, native apps, email sending, calendar provider integration (only `.ics` export).

### 2.3 Future (design for, don't build)
Optional end-to-end-encrypted sync (keep every record with `id` UUID, `updatedAt`, `deletedAt` tombstone so sync can be added later), custom record templates, connecting people to non-person records (companies, homes, vehicles).

---

## 3. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | |
| Framework | React 18 + Vite | |
| Routing | React Router v6 (data router) | |
| Styling | Tailwind CSS + CSS variables for theme tokens | |
| IndexedDB | **Dexie.js** + `dexie-react-hooks` (`useLiveQuery`) | Reactive queries; schema versioning |
| PWA | `vite-plugin-pwa` (Workbox, `injectManifest` strategy) | Custom SW for notification logic |
| State | Dexie is the store; Zustand only for ephemeral UI state (compose modal, toasts) | |
| Forms | React Hook Form + Zod | Zod schemas shared with import validation |
| Dates | date-fns | Store dates as ISO strings |
| IDs | `crypto.randomUUID()` | |
| Icons | lucide-react | Outline style, ~24px, like X |
| Images | Store as `Blob` in IndexedDB; resize client-side via `<canvas>` / `createImageBitmap` | Avatars ≤ 400px, photos ≤ 1600px, WebP/JPEG |
| vCard | Hand-written parser/serializer for vCard 3.0/4.0 (or `ical.js` if it saves time) | |
| CSV | `papaparse` | |
| i18n | `i18next` + `react-i18next` | `en`, `es` |
| Testing | Vitest + Testing Library + `fake-indexeddb`; Playwright for E2E incl. offline mode | |
| Lint/format | ESLint + Prettier | |

No runtime CDN requests: self-host fonts (system font stack by default, like X: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`).

---

## 4. Architecture

```
src/
  app/            # router, layout shell, providers
  db/             # Dexie schema, migrations, repositories, seed
    schema.ts
    repositories/ # contactRepo.ts, momentRepo.ts, reminderRepo.ts …
  domain/         # pure TS: types, zod schemas, recurrence, search, vcard, csv
  features/
    home/ compose/ contacts/ profile/ reminders/ search/
    groups/ starred/ tasks/ settings/ import-export/
  components/     # shared UI: Avatar, Button, Tabs, Modal, Toast, Composer…
  sw/             # service worker source (sw.ts)
  i18n/
  styles/
tests/
  unit/ e2e/
docs/DECISIONS.md
```

Rules:
- UI never calls Dexie directly; it uses repository functions and `useLiveQuery` hooks exported from `db/repositories`.
- All writes go through repositories, which set `createdAt`/`updatedAt`, validate with Zod, and soft-delete via `deletedAt`.
- `domain/` has zero React/Dexie imports (pure, unit-testable).

---

## 5. Data model (IndexedDB via Dexie)

All records share:

```ts
interface BaseRecord {
  id: string;          // UUID v4
  createdAt: string;   // ISO datetime
  updatedAt: string;   // ISO datetime
  deletedAt?: string;  // soft delete (tombstone); hidden from UI; purged from Trash after 30 days
}
```

### 5.1 Entities

```ts
interface Contact extends BaseRecord {
  firstName: string;
  lastName?: string;
  nickname?: string;            // shown like an @handle: "@lise"
  gender?: string;              // free text
  pronouns?: string;
  avatarBlobId?: string;
  bannerBlobId?: string;
  bannerColor?: string;         // fallback banner
  birthday?: PartialDate;       // year optional
  isBirthdayYearKnown?: boolean;
  howWeMet?: { text?: string; date?: PartialDate; place?: string; introducedById?: string };
  bio?: string;                 // short summary line
  jobTitle?: string;
  company?: string;
  foodPreferences?: string;
  isStarred: boolean;
  isArchived: boolean;          // "inactive" contacts
  isDeceased?: boolean;
  deceasedDate?: PartialDate;
  stayInTouchDays?: number;     // e.g. 30 → nudge if no moment in 30 days
  lastInteractionAt?: string;   // denormalized; updated when a moment mentions the contact
  tagIds: string[];
  groupIds: string[];
}

type PartialDate = { year?: number; month: number; day: number }; // month 1–12

interface ContactField extends BaseRecord {   // phones, emails, socials…
  contactId: string;
  type: 'phone' | 'email' | 'website' | 'whatsapp' | 'telegram' | 'signal'
      | 'instagram' | 'linkedin' | 'x' | 'facebook' | 'other';
  label?: string;               // "Work", "Personal"
  value: string;
  isPrimary?: boolean;
}

interface Address extends BaseRecord {
  contactId: string;
  label?: string;
  street?: string; city?: string; region?: string; postalCode?: string; country?: string;
  isCurrent: boolean;
}

interface Relationship extends BaseRecord {
  fromContactId: string;
  toContactId: string;
  type: RelationshipType;       // stored from "from" perspective
  since?: PartialDate;
  notes?: string;
}
// Creating A→B "parent" auto-creates the inverse B→A "child" (linked via inverseId).
type RelationshipType =
  | 'partner' | 'spouse' | 'ex-partner' | 'date'
  | 'parent' | 'child' | 'sibling' | 'grandparent' | 'grandchild'
  | 'uncle-aunt' | 'nephew-niece' | 'cousin' | 'in-law' | 'godparent' | 'godchild'
  | 'friend' | 'best-friend' | 'colleague' | 'boss' | 'subordinate' | 'mentor' | 'protege'
  | 'neighbour' | 'other';

interface Moment extends BaseRecord {          // the "post"
  kind: 'activity' | 'note' | 'call' | 'journal' | 'life-event';
  body: string;                 // markdown-lite text with @mentions and #tags
  happenedAt: string;           // ISO datetime (user-editable, defaults to now)
  contactIds: string[];         // resolved from @mentions + explicit picker
  tagIds: string[];
  // kind-specific:
  activityType?: 'meal' | 'coffee' | 'drinks' | 'trip' | 'event' | 'sport' | 'visit' | 'other';
  location?: string;
  callDirection?: 'incoming' | 'outgoing';
  callDurationMin?: number;
  lifeEventType?: 'new-job' | 'moved' | 'engaged' | 'married' | 'baby' | 'graduated'
                | 'new-pet' | 'retired' | 'loss' | 'health' | 'other';
  mood?: 1 | 2 | 3 | 4 | 5;    // journal only, optional
  photoBlobIds: string[];       // up to 4, displayed in X-style grid
  isPinned?: boolean;           // pinned to top of a contact profile
  isStarred: boolean;
}

interface Reminder extends BaseRecord {
  contactId?: string;
  title: string;
  notes?: string;
  dueDate: string;              // ISO date (+ optional time)
  dueTime?: string;             // "HH:mm"
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceInterval?: number;  // every N units
  source: 'manual' | 'birthday' | 'important-date' | 'stay-in-touch';
  sourceId?: string;            // e.g. ImportantDate id
  completedAt?: string;         // for non-recurring; recurring advance dueDate instead
  lastNotifiedAt?: string;
  snoozedUntil?: string;
}

interface ImportantDate extends BaseRecord {   // anniversaries, name days…
  contactId: string;
  label: string;
  date: PartialDate;
  remind: boolean;
  remindDaysBefore?: number;
}

interface Gift extends BaseRecord {
  contactId: string;
  name: string;
  status: 'idea' | 'bought' | 'given' | 'received';
  occasion?: string;
  url?: string;
  price?: number; currency?: string;
  date?: string;
  notes?: string;
  photoBlobId?: string;
}

interface Debt extends BaseRecord {
  contactId: string;
  direction: 'i-owe' | 'they-owe';
  amount: number; currency: string;
  reason?: string;
  date: string;
  settledAt?: string;
}

interface Task extends BaseRecord {
  contactId?: string;
  title: string;
  notes?: string;
  dueDate?: string;
  completedAt?: string;
}

interface Pet extends BaseRecord {
  contactId: string;
  name: string;
  species?: string;
  notes?: string;
}

interface Tag extends BaseRecord { name: string; color?: string }      // unique, case-insensitive
interface Group extends BaseRecord { name: string; description?: string; emoji?: string; bannerColor?: string }

interface BlobRecord {           // images; no BaseRecord timestamps needed beyond createdAt
  id: string; createdAt: string;
  mime: string; width: number; height: number; size: number;
  data: Blob;
}

interface Setting { key: string; value: unknown }   // theme, accent, locale, currency, notification prefs…
```

### 5.2 Dexie schema (version 1)

```ts
db.version(1).stores({
  contacts:       'id, firstName, lastName, nickname, isStarred, isArchived, lastInteractionAt, *tagIds, *groupIds, updatedAt, deletedAt',
  contactFields:  'id, contactId, type, value, deletedAt',
  addresses:      'id, contactId, deletedAt',
  relationships:  'id, fromContactId, toContactId, type, deletedAt',
  moments:        'id, kind, happenedAt, *contactIds, *tagIds, isStarred, deletedAt, [kind+happenedAt]',
  reminders:      'id, contactId, dueDate, source, sourceId, completedAt, deletedAt',
  importantDates: 'id, contactId, deletedAt',
  gifts:          'id, contactId, status, deletedAt',
  debts:          'id, contactId, direction, settledAt, deletedAt',
  tasks:          'id, contactId, dueDate, completedAt, deletedAt',
  pets:           'id, contactId, deletedAt',
  tags:           'id, &nameLower, deletedAt',
  groups:         'id, name, deletedAt',
  blobs:          'id',
  settings:       'key',
  searchIndex:    '[entity+entityId], *tokens',   // see §8.6
});
```

- Every schema change = new `db.version(n)` with an `.upgrade()` migration. Never edit a released version.
- Deleting a contact soft-deletes its dependent records in one Dexie transaction; restoring from Trash restores them.

---

## 6. UI specification (X.com-style)

### 6.1 Layout — desktop (≥ 1280px)
Three columns, centered, max width ~1265px:

1. **Left nav (275px)**: logo; nav items with 26px icon + 20px label — Home, Search, Reminders (badge count), Tasks, Groups, Starred, Contacts, Profile→"Me" card (optional), Settings, "More". Big pill **"Log moment"** button (accent color, full width). Bottom: theme toggle.
2. **Center column (600px)**, bordered left/right (1px `--border`): sticky translucent header with blur (`backdrop-filter`) showing page title and optional tabs ("For you / Following" pattern → Home uses **All · Activities · Notes · Calls · Journal**).
3. **Right rail (350px)**: sticky search box (pill), cards with rounded 16px corners on `--surface-2`: **Upcoming** (next 5 birthdays/reminders), **Reach out** (stay-in-touch overdue, max 3, each with "Log" button where X has "Follow"), small footer links (About, Export data, Privacy).

### 6.2 Layout — tablet (768–1279px)
Left nav collapses to icons only (88px); right rail hidden below 1000px.

### 6.3 Layout — mobile (< 768px)
- Top bar: avatar/menu (opens drawer with full nav), centered logo, settings icon.
- Single column feed.
- **Bottom tab bar**: Home · Search · Reminders · Contacts (Tasks/Groups/Starred in drawer).
- **Floating action button** (bottom right, accent, "+" with feather-like icon) opens composer full-screen.
- Pull-to-refresh is not needed (data is local and live).
- Respect safe-area insets (`env(safe-area-inset-*)`).

### 6.4 Moment card (the "post")
```
[Avatar 40px] Élise Aubert  @lise · 2h            [⋯]
              ☕ Coffee · Le Petit Sud
              She's thinking about moving back to Lyon. Ask
              about the job in March. #family
              [photo grid: 1 / 2 / 2x2 like X]
              💬 with @marc        ⭐ Star     📌 Pin    🗑
```
- Primary avatar = first mentioned contact; multiple contacts → stacked avatars.
- Kind shown as a small icon + label line above body (coffee, phone, notebook, sparkle for life event).
- Timestamp relative (2h, 3d, "Mar 18") with full datetime on hover/long-press.
- `@mentions` and `#tags` rendered as accent-colored links.
- Action row icons (18px, muted; hover = accent tint circle): **Star**, **Pin to profile**, **Edit**, **Delete** (overflow menu `⋯` also holds "Copy text", "Change date").
- Click card → moment detail page (`/moment/:id`) with full text and linked contacts.

### 6.5 Composer
- Inline at top of Home ("What happened?") and as modal (desktop) / full-screen sheet (mobile).
- Kind selector chips: Activity · Note · Call · Journal · Life event (changes extra fields shown).
- Textarea auto-grows; `@` opens contact autocomplete (fuzzy, keyboard navigable; "Create contact 'X'" option at bottom); `#` opens tag autocomplete (creates new tag on enter).
- Toolbar icons (like X's media/GIF/poll row): Photo, Date/time, Location, Mood (journal), Kind-specific (call duration/direction, activity type, life-event type).
- Character counter not required; soft limit 5000 chars.
- "Save" pill button disabled until body non-empty or at least one contact selected.
- Keyboard: `n` opens composer; `Ctrl/⌘+Enter` saves; `Esc` closes (confirm discard if dirty).
- **AC:** saving a moment mentioning @lise updates Élise's `lastInteractionAt`, shows on Home and on her profile instantly without reload.

### 6.6 Contact profile (`/c/:id`)
X profile layout:
- **Banner** (3:1, image or color) and **avatar** (134px desktop / 80px mobile, overlapping banner, 4px border in `--bg`).
- Top-right buttons: **Log moment** (pill, outlined) and **Edit profile**; `⋯` menu: Star, Archive, Mark deceased, Export vCard, Delete.
- Name (20px bold), `@nickname` (muted), bio line, then meta row with icons: relationship to you / groups, city, birthday ("Born March 18 · turns 39 in 7 months"), "Met 2014 · Lyon", last interaction ("Last spoke today").
- "Relationships" row like "Following / Followers": e.g. **3** family · **2** friends — clicking opens relationships list.
- **Tabs** (sticky): **Timeline** · **Details** · **Reminders** · **Gifts** · **Money** · **Tasks**
  - *Timeline*: pinned moment first, then all moments mentioning this contact, newest first.
  - *Details*: contact fields (tap to call/email/open via `tel:`, `mailto:`, URLs), addresses, important dates, how we met, food preferences, pets, relationships (with add), tags, groups, custom notes.
  - *Reminders*: upcoming + completed for this contact; add.
  - *Gifts*: grouped Ideas / Bought / Given / Received.
  - *Money*: debts with running balance ("You owe €20" / "Owes you €35"), settle action.
  - *Tasks*: open/closed tasks for this contact.

### 6.7 Other screens
- **Contacts** (`/contacts`): list like X's "Following" list — avatar, name, @nickname, bio snippet, star button. Sort: A–Z, recently interacted, recently added. Filters: tag, group, starred, archived. Alphabet jump on mobile. "New contact" button.
- **Reminders** (`/reminders`): tabs **Upcoming** · **Overdue** · **Done**. Grouped by Today / This week / This month / Later. Items with contact avatar; actions: Done, Snooze (1d, 1w, custom), Edit. Unread/overdue count badges the nav item.
- **Search** (`/search`): pill search bar; tabs **Top** · **People** · **Moments** · **Tags**; recent searches (local); empty state shows tags as "trends".
- **Groups** (`/groups`, `/groups/:id`): like X Lists — banner color + emoji, name, member count, member list, group timeline (moments mentioning any member).
- **Starred** (`/starred`): starred contacts row (horizontal avatars) + starred moments feed.
- **Tasks** (`/tasks`): simple checklist, filter open/done, optional contact and due date.
- **Trash** (`/settings/trash`): soft-deleted items, restore / delete forever.
- **Settings** (`/settings`): Display (theme, accent, font size), Language, Default currency, Notifications, Data (export, import, storage usage, persistence status, clear all data with typed confirmation), About.

### 6.8 Theming
Three themes like X: **Light** (`#FFFFFF` bg), **Dim** (`#15202B`-ish navy), **Lights out** (`#000000`). Default follows `prefers-color-scheme` (dark → Lights out). Tokens on `:root[data-theme=…]`:
`--bg, --surface-1, --surface-2, --text, --text-muted, --border, --accent, --accent-hover, --danger, --success`.
Accent choices (6 swatches) and font size (5 steps, base 15px like X).

### 6.9 Interaction details
- Hover on rows/cards: subtle bg `--surface-1`.
- Toasts bottom-center (accent bg) with Undo for deletes (5s).
- Skeletons are unnecessary for local data; render immediately. Use virtualized lists (`@tanstack/react-virtual`) for feeds and contact lists > 200 items.
- Keyboard shortcuts (show list on `?`): `n` compose, `/` search, `g h` home, `g r` reminders, `g c` contacts, `j/k` move between cards, `s` star focused card.

### 6.10 Accessibility
WCAG 2.1 AA: semantic landmarks, focus rings, all icon buttons with `aria-label`, color contrast ≥ 4.5:1 in all three themes, reduced-motion support, composer autocomplete as ARIA combobox.

---

## 7. Routes

| Path | Screen |
|---|---|
| `/` | Home feed |
| `/compose` | Composer (mobile full-screen; desktop modal over current route) |
| `/moment/:id` | Moment detail |
| `/contacts` | Contacts list |
| `/contacts/new` | New contact form |
| `/c/:id` and `/c/:id/:tab` | Contact profile |
| `/c/:id/edit` | Edit contact |
| `/reminders` | Reminders |
| `/tasks` | Tasks |
| `/search?q=` | Search |
| `/tags/:id` | Tag timeline |
| `/groups`, `/groups/:id` | Groups |
| `/starred` | Starred |
| `/settings/*` | Settings, incl. `/settings/data`, `/settings/trash` |
| `/onboarding` | First-run |

---

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

---

## 9. PWA requirements

- `manifest.webmanifest`: name, short_name, description, `start_url: "/"`, `display: "standalone"`, `theme_color`/`background_color` per theme (update `<meta name="theme-color">` on theme change), icons 192/512 + maskable, `shortcuts` (Log moment → `/compose`, Reminders, Search), `share_target` (text → composer prefill; files → import), `file_handlers` for `.vcf`/`.json`.
- Service worker (Workbox `injectManifest`):
  - Precache full app shell and all static assets (app must load fully offline after first visit).
  - SPA navigation fallback to `index.html`.
  - No runtime caching of external origins (there are none).
  - Update flow: on new SW waiting, show toast "Update available — Reload"; never auto-reload mid-composition.
  - Periodic sync handler for reminders (§8.5) and `notificationclick` → focus/open `/reminders` or the contact.
- Custom in-app **Install** prompt (`beforeinstallprompt`) in left nav "More" and onboarding; iOS instructions sheet ("Share → Add to Home Screen").
- Lighthouse PWA/installability checks pass; performance ≥ 90 on mobile.
- **AC:** Playwright test: load app, go offline (`context.setOffline(true)`), reload, create a contact and a moment, reload again — data persists and UI works.

---

## 10. Performance targets
- First load JS ≤ 250 KB gzipped (code-split routes: settings, import/export, profile editing lazy).
- Interaction latency < 100 ms for feed scroll, compose save, search with dataset of 2k contacts / 20k moments / 500 photos.
- Images: resized and compressed on import; feed thumbnails generated (≤ 600px) and stored as separate blobs; object URLs revoked on unmount.

---

## 11. Security & privacy
- Strict CSP: `default-src 'self'; img-src 'self' blob: data:; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (adjust only if Tailwind build requires).
- Sanitize all rendered user text (no `dangerouslySetInnerHTML` except through a tiny, tested renderer for mentions/tags/line breaks/links). Links open with `rel="noopener noreferrer"`.
- No analytics, no error reporting service. Errors logged to an in-app local log viewable in Settings › About › Diagnostics (exportable by user).

---

## 12. Internationalization
- All strings via i18next keys; `en` and `es` complete.
- Dates/numbers/currencies via `Intl` with user locale; week start configurable.
- Relative timestamps localized ("2 h", "hace 3 d").

---

## 13. Testing strategy
- **Unit (Vitest):** recurrence, partial dates/birthday age, mention/tag tokenization and rendering, search tokenizer, vCard parse/serialize (fixtures from iOS, Google, Outlook), CSV mapping, merge logic, relationship inverses, JSON import migrations.
- **Repository tests** with `fake-indexeddb`: transactions, soft delete/restore cascades, denormalized `lastInteractionAt`.
- **Component tests:** composer autocomplete, moment card, profile tabs.
- **E2E (Playwright):** onboarding, create contact → log moment → appears on profile, reminder lifecycle, export/import round trip, offline reload, theme switching, mobile viewport (bottom bar + FAB).
- Seed generator script `scripts/seed.ts` for perf datasets.

---

## 14. Milestones

1. **M1 — Foundation:** Vite + React + TS + Tailwind, routing, layout shell (3-column desktop / tablet / mobile bottom bar), themes, i18n scaffold, Dexie schema v1 + repositories + tests, PWA precache + offline reload E2E.
2. **M2 — Contacts:** list, create/edit, avatar/banner, contact fields, addresses, profile page with tabs (Details working), star/archive, delete + Trash.
3. **M3 — Moments:** composer (all kinds, @mentions, #tags, photos), Home feed with kind tabs, profile Timeline, moment detail, pin/star, tags pages.
4. **M4 — Reminders:** manual + recurring, birthdays, important dates, stay-in-touch, Reminders page, badges, right rail Upcoming/Reach out, notifications (in-app, system, periodic sync where supported), ICS export.
5. **M5 — Relationships, gifts, debts, tasks, pets, groups, starred.**
6. **M6 — Search:** index, search page, right-rail search box, perf test.
7. **M7 — Import/export:** JSON backup/restore, vCard, CSV, duplicate detection & merge, backup nudge, file handlers/share target.
8. **M8 — Polish:** onboarding + demo data, settings (storage, app lock), keyboard shortcuts, accessibility audit, Lighthouse, update flow.

Each milestone ends with: tests green, `npm run build` succeeds, a short entry in `docs/CHANGELOG.md`.

---

## 15. Definition of done (v1)
- All ACs in §8–§9 pass.
- Works fully offline after first load on Chrome (desktop & Android), Safari iOS (installed), Firefox desktop.
- Installable; shortcuts work; data survives reloads and app restarts.
- Export/import round trip lossless.
- No network requests after load (verified in Playwright by asserting zero non-same-origin requests).
