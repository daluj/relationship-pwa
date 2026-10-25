# UI and routes

> Section numbers (§n) are stable IDs carried over from the original single-file spec and are
> cited throughout the code (`// features §8.5`). Never renumber; add new subsections at the end.

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

### 6.11 Memory recall
Profile header gains a "Before you meet" button (desktop) and ⋯ menu entry. Profile › Timeline has an **All / Milestones** toggle (`aria-pressed` buttons). Home shows an "On this day" region above the feed on the All tab. The brief is a stack of headed sections (About, Coming up, Open tasks, Money, Gifts, Recent moments) reusing the moment card.

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
| `/c/:id/brief` | Before you meet |
| `/reminders` | Reminders |
| `/tasks` | Tasks |
| `/search?q=` | Search |
| `/tags/:id` | Tag timeline |
| `/groups`, `/groups/:id` | Groups |
| `/starred` | Starred |
| `/settings/*` | Settings, incl. `/settings/data`, `/settings/trash` |
| `/onboarding` | First-run |
