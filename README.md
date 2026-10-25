# Kin

A private, offline-first personal CRM that runs as a PWA — a memory backup for the people in your life.
Every record stays in IndexedDB on your device: no server, no accounts, no analytics, no third-party scripts.
Built with spec-driven development: [specs/](specs/README.md) holds the mission, tech stack, roadmap, product
reference and per-feature specs.

## Features

- **Contacts** with photos, contact info, addresses, birthdays, how you met, relationships (with automatic inverses), pets,
  tags and groups; duplicate detection and merge; Trash with restore.
- **Moments** — an X-style timeline of activities, notes, calls, journal entries and life events, with `@mentions`, `#tags`
  and photos.
- **Reminders** — one-off and recurring, automatic birthdays, important dates and "stay in touch" nudges; in-app, system
  and periodic background notifications where supported; `.ics` export.
- **Gifts, money (balances per currency), tasks, starred** and a fast client-side **search**.
- **Import/export** — full JSON backup and restore, vCard, CSV (Google/Outlook) and `.ics` calendars (birthdays and
  anniversaries), merge undo, share target and file handlers.
- **Recall and organisation** — "Before you meet" briefs, "On this day", milestones, saved searches, bulk actions, year in
  review and a print view of a profile.
- **Polish** — onboarding with demo data, keyboard shortcuts (`?`), app lock (PIN / passkey), three themes, English,
  Spanish, French, German and Portuguese, WCAG 2.1 AA.

  _Languages:_ French, German and Portuguese (European) were drafted by Claude and are waiting for review by native speakers;
  corrections are welcome.

Kin works fully offline after the first visit. Browsers can clear website storage, so install the app, allow persistent
storage and export backups regularly (Settings › Your data).

## Development

```bash
npm install
npx playwright install chromium firefox webkit   # once, for E2E
npm run dev
```

| Script               | What it does                                                            |
| -------------------- | ----------------------------------------------------------------------- |
| `npm run dev`        | Dev server (service worker disabled)                                    |
| `npm run build`      | Typecheck + production build                                            |
| `npm run preview`    | Serve the build on :4173                                                |
| `npm run test`       | Unit, repository and component tests (Vitest)                           |
| `npm run test:e2e`   | Playwright E2E: Chromium (all), Firefox/WebKit (offline + layout), perf |
| `npm run verify`     | Typecheck, lint, unit, build, E2E — run before every commit             |
| `npm run lighthouse` | Lighthouse mobile audit of a running `npm run preview`                  |

Large test datasets: `npx tsx scripts/seed.ts --contacts 2000 --moments 20000 > seed.json` (backup format, importable
from Settings › Your data).

### Quality bars

- Unit + E2E suites green, including the spec acceptance criteria (offline reload, backup round trip, reminders, search
  < 100 ms at 2k contacts / 20k moments).
- axe-core: no WCAG 2.1 AA violations across the main screens in all three themes.
- Lighthouse (mobile): Performance ≥ 90 (currently 94), Accessibility 100, Best practices 100.
- First-load JS ≤ 250 KB gzipped (currently ~204 KB).

## Spec-driven workflow

Every feature goes through the same loop, each step backed by a Claude Code skill in `.claude/skills/`:

1. **Spec**: `/feature-spec` takes the next phase from [specs/roadmap.md](specs/roadmap.md), opens a `phase-N-<name>`
   branch, interviews you, and writes `specs/YYYY-MM-DD-<name>/` (`requirements.md`, `plan.md`, `validation.md`).
2. **Implement**: `/implement-feature` works through `plan.md`, tests included.
3. **Validate and replan**: `/validate-feature` checks `validation.md`, reviews the branch and updates the roadmap.
4. **Record**: `/changelog` adds the entry to [CHANGELOG.md](CHANGELOG.md).

Agent instructions live in [AGENTS.md](AGENTS.md) (imported by `CLAUDE.md`), project-wide decisions in
[specs/decisions.md](specs/decisions.md), and unscheduled ideas in [backlog/](backlog/README.md).
