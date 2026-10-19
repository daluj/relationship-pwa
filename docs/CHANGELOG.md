# Changelog

## M1 — Foundation (2026-10-19)

- Vite 6 + React 18 + TypeScript (strict) + Tailwind 4 project, with ESLint rules enforcing the SPEC §4 layering.
- React Router v6 data router with every SPEC §7 route registered (placeholder screens).
- Responsive X-style layout shell: 3 columns on desktop, icon-only nav on tablet (right rail hidden under 1000px), and top bar + bottom tabs + FAB on mobile, with safe-area insets.
- Themes: Light / Dim / Lights out, 6 accents, 5 font sizes, saved in Dexie and following `prefers-color-scheme`; `theme-color` meta kept in sync.
- i18n scaffold (i18next) with complete `en` and `es` shell strings.
- Dexie schema v1 (SPEC §5.2), generic repository (timestamps, Zod validation, soft delete/restore), per-entity repositories, settings and blob repositories, and live-query hooks.
- PWA: hand-written manifest with icons and shortcuts, Workbox `injectManifest` SW that precaches the app shell with SPA navigation fallback, and an "Update available" toast.
- Tests: repository and schema unit tests (fake-indexeddb); Playwright E2E for offline reload, data persistence and responsive layout.
