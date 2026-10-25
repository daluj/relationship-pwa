# Mission

> Part of Kin's constitution (with [tech-stack.md](tech-stack.md) and [roadmap.md](roadmap.md)). Read this before
> writing any feature spec. Section numbers (§n) are stable IDs cited in code (`// mission §1`); never renumber.

Kin is a private, offline-first personal CRM: a memory backup for the people in your life, running entirely on your
own device as an installable PWA.

## Audience

- **Primary:** one person keeping track of friends, family and colleagues, on their own phone and computer, who does not
  want that information on anyone's server.
- **Secondary:** developers reading the code, so it should stay idiomatic, layered and well-tested (see tech-stack §4).

## What success looks like

- Everything a user records survives offline use, reloads, app restarts and a full export/import round trip.
- The app feels instantly familiar (X.com-style layout) yet is plainly a private journal: no social features, no scoring.
- Nothing ever leaves the device unless the user exports it.

## 1. Product overview

### 1.1 What it is

A private "memory backup" for the people in your life: friends, family, colleagues, neighbours. You record what's happening in their lives, how you know them, important dates, conversations, gifts, debts and promises, and the app reminds you to get back in touch.

### 1.2 Principles

1. **Offline-first, local-only.** All data lives in IndexedDB on the device. The app works with no network after first load.
2. **Private by design.** No server, no telemetry, no third-party scripts at runtime, no ads. Nothing leaves the device unless the user exports it.
3. **Nobody is a lead.** No scoring or ranking people. No gamification of people. Progress bars and a review streak are allowed for the user's own goals only (D-069).
4. **Data ownership.** Full export/import at any time (JSON, vCard, CSV).
5. **Fast and familiar.** UI borrows X.com's layout and interaction patterns so it feels instantly usable — but it is a private journal, not a social network: no followers, no public feed, no sharing.

### 1.3 The X.com metaphor mapping

| X.com concept                 | Kin equivalent                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Home timeline                 | **Home**: reverse-chronological stream of _your own_ logged moments (activities, notes, calls, journal entries) across all contacts     |
| Compose "What is happening?!" | **Compose "What happened?"** — log a moment; `@mention` contacts, `#tag` it                                                             |
| Post                          | **Moment** (activity / note / call / journal entry)                                                                                     |
| Profile page                  | **Contact profile** (banner, avatar, name, relationship line, "how you met" as bio, tabs)                                               |
| Notifications                 | **Reminders** due / upcoming, birthdays, "stay in touch" nudges                                                                         |
| Explore / Search              | **Search** across contacts, moments, tags                                                                                               |
| Lists                         | **Groups** (Family, Work, Book club…)                                                                                                   |
| Bookmarks                     | **Starred** contacts and moments                                                                                                        |
| Messages                      | Not used (no messaging). Slot repurposed for **Tasks**                                                                                  |
| "Who to follow" (right rail)  | **"Reach out"** — contacts you haven't logged anything with for a while (based on user-set stay-in-touch frequency only, never ranking) |
| "Trends" (right rail)         | **Upcoming** — next birthdays & reminders                                                                                               |

**Branding constraint:** do not use X's logo, name, bird/X marks, or brand colors verbatim. Copy the _layout and interaction patterns_, not the brand. Use an original logo and an accent color of our own (default: teal `#14B8A6`; user-configurable).

## 2. Scope

### 2.1 In scope (v1)

Contacts, contact fields, relationships, moments (activities, notes, calls, journal), reminders (incl. auto birthdays and stay-in-touch), important dates, life events, gifts, debts, tasks, tags, groups, pets, addresses, photos/avatars, search, import/export, PWA install + offline, local notifications (best effort), themes, i18n scaffolding (en + es).

### 2.2 Out of scope (v1)

Accounts/login, cloud sync, multi-user/sharing, server API, AI features, native apps, email sending, calendar provider integration (only `.ics` export).

### 2.3 Future (design for, don't build)

Optional end-to-end-encrypted sync (keep every record with `id` UUID, `updatedAt`, `deletedAt` tombstone so sync can be added later), custom record templates, connecting people to non-person records (companies, homes, vehicles).
