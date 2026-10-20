# Tech stack

> Part of Kin's constitution (with [mission.md](mission.md) and [roadmap.md](roadmap.md)). Feature specs must stay
> within this stack; a new dependency needs the user's approval and an entry in [decisions.md](decisions.md).
> Section numbers (§n) are stable IDs cited in code (`// tech-stack §11`); never renumber.

## Versions in use

Node 24 (`.nvmrc`) · TypeScript ~5.8 (strict) · React 18.3 · Vite 6 · React Router 6.30 (data router) · Tailwind CSS 4
(`@tailwindcss/vite`) · Dexie 4 + dexie-react-hooks · Zod 3 · React Hook Form 7 · Zustand 5 · i18next 23 /
react-i18next 15 · date-fns 4 · lucide-react · @tanstack/react-virtual 3 · PapaParse 5 · vite-plugin-pwa 1 (Workbox 7,
`injectManifest`) · Vitest 5 + Testing Library + fake-indexeddb + jsdom · Playwright 1.64 (Chromium, Firefox, WebKit)

- @axe-core/playwright · ESLint 9 + Prettier 3 · Lighthouse 12 (via `npm run lighthouse`).

`package.json` is authoritative for exact versions.

## Commands

| Command              | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev`        | Dev server (service worker disabled)                            |
| `npm run test`       | Unit, repository and component tests (Vitest + fake-indexeddb)  |
| `npm run test:e2e`   | Playwright against the production build on :4173                |
| `npm run verify`     | typecheck → lint → unit → build → e2e; the gate for every merge |
| `npm run lighthouse` | Lighthouse mobile audit of a running `npm run preview`          |

## 3. Tech stack

| Concern     | Choice                                                                                | Notes                                       |
| ----------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| Language    | TypeScript (strict)                                                                   |                                             |
| Framework   | React 18 + Vite                                                                       |                                             |
| Routing     | React Router v6 (data router)                                                         |                                             |
| Styling     | Tailwind CSS + CSS variables for theme tokens                                         |                                             |
| IndexedDB   | **Dexie.js** + `dexie-react-hooks` (`useLiveQuery`)                                   | Reactive queries; schema versioning         |
| PWA         | `vite-plugin-pwa` (Workbox, `injectManifest` strategy)                                | Custom SW for notification logic            |
| State       | Dexie is the store; Zustand only for ephemeral UI state (compose modal, toasts)       |                                             |
| Forms       | React Hook Form + Zod                                                                 | Zod schemas shared with import validation   |
| Dates       | date-fns                                                                              | Store dates as ISO strings                  |
| IDs         | `crypto.randomUUID()`                                                                 |                                             |
| Icons       | lucide-react                                                                          | Outline style, ~24px, like X                |
| Images      | Store as `Blob` in IndexedDB; resize client-side via `<canvas>` / `createImageBitmap` | Avatars ≤ 400px, photos ≤ 1600px, WebP/JPEG |
| vCard       | Hand-written parser/serializer for vCard 3.0/4.0 (or `ical.js` if it saves time)      |                                             |
| CSV         | `papaparse`                                                                           |                                             |
| i18n        | `i18next` + `react-i18next`                                                           | `en`, `es`                                  |
| Testing     | Vitest + Testing Library + `fake-indexeddb`; Playwright for E2E incl. offline mode    |                                             |
| Lint/format | ESLint + Prettier                                                                     |                                             |

No runtime CDN requests: self-host fonts (system font stack by default, like X: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`).

## 4. Architecture

```
src/
  app/            # router, layout shell, providers
  db/             # Dexie schema, migrations, repositories, seed
    schema.ts
    repositories/ # contactRepo.ts, momentRepo.ts, reminderRepo.ts …
  domain/         # pure TS: types, zod schemas, recurrence, search, vcard, csv
  features/       # one folder per area: home/ compose/ contacts/ profile/ moments/ reminders/ search/
                  # groups/ starred/ tasks/ tags/ gifts/ money/ relationships/ data/ settings/ onboarding/ lock/
  components/     # shared UI: Avatar, Button, Tabs, Modal, Toast, Composer…
  lib/            # browser-only non-UI helpers (canvas/image encoding)
  sw/             # service worker source (sw.ts)
  i18n/           # locales/{en,es}.json
  styles/         # themes.css (tokens per theme), index.css
tests/
  unit/ e2e/
scripts/          # seed.ts, generate-icons.ts, lighthouse.mjs
specs/            # mission, tech stack, roadmap, decisions, product reference, feature specs
```

Rules (enforced by ESLint where possible):

- UI never calls Dexie directly; it uses repository functions and `useLiveQuery` hooks exported from `db/repositories`
  (never from `dexie-react-hooks`).
- All writes go through repositories, which set `createdAt`/`updatedAt`, validate with Zod, and soft-delete via `deletedAt`.
- `domain/` has zero React/Dexie imports (pure, unit-testable).
- Cross-entity writes live in `db/repositories/*Service.ts` and run in one Dexie transaction; the search index updates
  in the same transaction as each write.
- Never edit a released `db.version(n)`; add a new version with `.upgrade()`.
- All user-facing strings go through i18next, and both locales stay complete.
- Theme colours come only from CSS tokens (Tailwind theme utilities), never hex values in components.

## 10. Performance targets

- First load JS ≤ 250 KB gzipped (code-split routes: settings, import/export, profile editing lazy).
- Interaction latency < 100 ms for feed scroll, compose save, search with dataset of 2k contacts / 20k moments / 500 photos.
- Images: resized and compressed on import; feed thumbnails generated (≤ 600px) and stored as separate blobs; object URLs revoked on unmount.

## 11. Security & privacy

- Strict CSP: `default-src 'self'; img-src 'self' blob: data:; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (adjust only if Tailwind build requires).
- Sanitize all rendered user text (no `dangerouslySetInnerHTML` except through a tiny, tested renderer for mentions/tags/line breaks/links). Links open with `rel="noopener noreferrer"`.
- No analytics, no error reporting service. Errors logged to an in-app local log viewable in Settings › About › Diagnostics (exportable by user).

## 12. Internationalization

- All strings via i18next keys; `en` and `es` complete.
- Dates/numbers/currencies via `Intl` with user locale; week start configurable.
- Relative timestamps localized ("2 h", "hace 3 d").

## 13. Testing strategy

- **Unit (Vitest):** recurrence, partial dates/birthday age, mention/tag tokenization and rendering, search tokenizer, vCard parse/serialize (fixtures from iOS, Google, Outlook), CSV mapping, merge logic, relationship inverses, JSON import migrations.
- **Repository tests** with `fake-indexeddb`: transactions, soft delete/restore cascades, denormalized `lastInteractionAt`.
- **Component tests:** composer autocomplete, moment card, profile tabs.
- **E2E (Playwright):** onboarding, create contact → log moment → appears on profile, reminder lifecycle, export/import round trip, offline reload, theme switching, mobile viewport (bottom bar + FAB).
- Seed generator script `scripts/seed.ts` for perf datasets.
