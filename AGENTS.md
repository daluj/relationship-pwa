# Kin — offline-first personal CRM (PWA)

Instructions for any coding agent working in this repo. Agent-specific files (`CLAUDE.md`, …) only import this one.

## Spec-driven workflow

[`specs/`](specs/README.md) is the source of truth. Read [mission](specs/mission.md), [tech-stack](specs/tech-stack.md)
and [roadmap](specs/roadmap.md) before any feature work, plus the `specs/product/` sections the work touches.

1. **Spec first.** No feature code without an agreed spec folder `specs/YYYY-MM-DD-<name>/` holding `requirements.md`
   (scope, decisions, context), `plan.md` (numbered task groups) and `validation.md` (automated checks, manual checks,
   definition of done). Interview the user before writing it and stop for review after.
2. **One phase at a time**, on branch `phase-N-<name>`. Do not start the next phase without the user's OK.
3. **Implement from `plan.md`**, ticking tasks as they land. If the plan turns out wrong, update the spec first.
4. **Validate** against `validation.md`: every acceptance criterion (**AC**) has an automated test and `npm run verify`
   is green.
5. **Replan and record**: tick the roadmap, fold lasting requirements back into `specs/product/`, log project-wide
   decisions in `specs/decisions.md`, and add a `CHANGELOG.md` entry. Commit and push only with the user's OK.

When the spec is ambiguous, choose the simplest option consistent with mission §1 principles and record it
(feature `requirements.md` → _Decisions_; project-wide ones also in `specs/decisions.md`).
Cite spec sections in code as `<file> §n` (for example `// features §8.5`); section numbers never change.

## Commands

- `npm run dev`: dev server (the service worker is disabled in dev)
- `npm run test`: unit and repository tests (Vitest + fake-indexeddb)
- `npm run test:e2e`: Playwright, against the production build at :4173
- `npm run verify`: typecheck, lint, unit, build, e2e (run before every commit)

## Architecture rules (enforced by ESLint where possible)

Full list in tech-stack §4.

- `src/domain/`: pure TS (types, Zod schemas, logic). No React or Dexie imports.
- `src/db/`: Dexie schema and repositories. **Only** `db/repositories` is imported by UI code.
- All writes go through repositories. They set `createdAt`/`updatedAt`, validate with Zod, and soft-delete via `deletedAt`.
- Never edit a released `db.version(n)`. Add a new version with `.upgrade()`.
- `src/features/<area>/`: route screens. `src/components/`: shared UI. `src/app/`: router, shell, providers.
- `src/lib/`: browser-only helpers that aren't UI (canvas and image encoding).
- UI composes live reads with `useLiveQuery` imported from `@/db/repositories`, never from `dexie-react-hooks`.
- No backend, accounts or analytics; no network calls that send user data; no CDNs or third-party runtime scripts.
- No X.com branding. Copy the layout only. Accent default `#14B8A6`.
- All user-facing strings go through i18next (`src/i18n/locales/{en,es}.json`), and both locales stay complete.
- Theme colors come only from CSS tokens (`var(--bg)` etc. via Tailwind theme utilities), never hard-coded hex values in components.
