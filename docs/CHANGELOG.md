# Changelog

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

- Vite 6 + React 18 + TypeScript (strict) + Tailwind 4 project, with ESLint rules enforcing the SPEC §4 layering.
- React Router v6 data router with every SPEC §7 route registered (placeholder screens).
- Responsive X-style layout shell: 3 columns on desktop, icon-only nav on tablet (right rail hidden under 1000px), and top bar + bottom tabs + FAB on mobile, with safe-area insets.
- Themes: Light / Dim / Lights out, 6 accents, 5 font sizes, saved in Dexie and following `prefers-color-scheme`; `theme-color` meta kept in sync.
- i18n scaffold (i18next) with complete `en` and `es` shell strings.
- Dexie schema v1 (SPEC §5.2), generic repository (timestamps, Zod validation, soft delete/restore), per-entity repositories, settings and blob repositories, and live-query hooks.
- PWA: hand-written manifest with icons and shortcuts, Workbox `injectManifest` SW that precaches the app shell with SPA navigation fallback, and an "Update available" toast.
- Tests: repository and schema unit tests (fake-indexeddb); Playwright E2E for offline reload, data persistence and responsive layout.
