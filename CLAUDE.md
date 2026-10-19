# Kin — offline-first personal CRM (PWA)

`SPEC.md` is the source of truth. Read the relevant sections before changing anything.

## Workflow

- Work one milestone at a time (SPEC §14). Do not start the next milestone without the user's OK.
- At the start of a milestone, list the files you will create or change.
- When the spec is ambiguous, choose the simplest option consistent with SPEC §1 and log it in `docs/DECISIONS.md`.
- A milestone is done when its ACs pass, `npm run verify` is green, and `docs/CHANGELOG.md` has an entry.

## Commands

- `npm run dev`: dev server (the service worker is disabled in dev)
- `npm run test`: unit and repository tests (Vitest + fake-indexeddb)
- `npm run test:e2e`: Playwright, against the production build at :4173
- `npm run verify`: typecheck, lint, unit, build, e2e (run before every commit)

## Architecture rules (enforced by ESLint where possible)

- `src/domain/`: pure TS (types, Zod schemas, logic). No React or Dexie imports.
- `src/db/`: Dexie schema and repositories. **Only** `db/repositories` is imported by UI code.
- All writes go through repositories. They set `createdAt`/`updatedAt`, validate with Zod, and soft-delete via `deletedAt`.
- Never edit a released `db.version(n)`. Add a new version with `.upgrade()`.
- `src/features/<area>/`: route screens. `src/components/`: shared UI. `src/app/`: router, shell, providers.
- `src/lib/`: browser-only helpers that aren't UI (canvas and image encoding).
- UI composes live reads with `useLiveQuery` imported from `@/db/repositories`, never from `dexie-react-hooks`.
- No network calls that send user data, no analytics, no CDNs, no third-party runtime scripts.
- No X.com branding. Copy the layout only. Accent default `#14B8A6`.
- All user-facing strings go through i18next (`src/i18n/locales/{en,es}.json`), and both locales stay complete.
- Theme colors come only from CSS tokens (`var(--bg)` etc. via Tailwind theme utilities), never hard-coded hex values in components.
