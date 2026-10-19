# Kin

A private, offline-first personal CRM that runs as a PWA. Every record stays in IndexedDB on your device.
No server, no accounts, no telemetry. See [SPEC.md](SPEC.md) for the full specification.

## Development

```bash
npm install
npx playwright install chromium   # once, for E2E
npm run dev
```

| Script             | What it does                         |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Dev server (service worker disabled) |
| `npm run build`    | Typecheck + production build         |
| `npm run preview`  | Serve the build on :4173             |
| `npm run test`     | Unit/repository tests                |
| `npm run test:e2e` | Playwright E2E (builds first)        |
| `npm run verify`   | Everything above, in order           |

Project conventions live in [CLAUDE.md](CLAUDE.md); design decisions in [docs/DECISIONS.md](docs/DECISIONS.md).
