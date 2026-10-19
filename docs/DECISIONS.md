# Decisions

Spec ambiguities resolved during implementation (SPEC §0). Newest last.

## D-001 — `Tag.nameLower` field (M1)

SPEC §5.2 indexes `tags` by `&nameLower`, but the §5.1 `Tag` interface has no such field. Added
`nameLower: string` to `Tag`. `tagRepo` derives it from `name` (trim + lowercase); callers never set it.

## D-002 — `Relationship.inverseId` field (M1)

§5.1 says inverse relationships are "linked via inverseId", but the interface omits it. Added
`inverseId?: string`. The auto-inverse logic lands in M5.

## D-003 — Offline E2E scope in M1 (M1)

The §9 AC ("go offline, reload, create a contact and a moment") needs the M2/M3 UI. In M1, the
offline E2E test checks: app shell, lazy-loaded route and deep-link reload offline; data written to IndexedDB
through the UI (settings) persists across offline reloads; zero foreign-origin requests. The full
AC gets added to `tests/e2e/offline.spec.ts` in M3.

## D-004 — Unique tag names vs. soft delete (M1)

The `&nameLower` unique index also covers soft-deleted tags. Re-creating a tag whose name matches a
soft-deleted tag restores that tag (same id, new name casing and color) instead of failing.

## D-005 — Zod schemas are the source of truth for types (M1)

Entity types in `domain/types.ts` are `z.infer<>` of the schemas in `domain/schemas/`, so validation
and types can't drift. They match §5.1 apart from D-001 and D-002.

## D-006 — Cross-entity repository behaviour deferred to its milestone (M1)

The generic repository handles timestamps, validation, soft delete/restore and purge. Cascades
(contact delete → dependents), birthday reminders, `lastInteractionAt` and search-index updates
belong to M2, M3, M4 and M6, and are added inside repository transactions then.

## D-007 — Dexie tables typed as `Table<T, string>` (M1)

Repositories always assign UUIDs, so tables are typed with explicit string keys instead of Dexie's
`EntityTable` (whose optional-id insert type doesn't fit a generic repository).

## D-008 — Text on accent backgrounds (M1)

To meet WCAG AA (§6.10) on bright accents like the default teal, text and icons on accent fills use
`--on-accent`. That's black or white, whichever contrasts more (`domain/color.ts`). The full contrast
audit of accent-colored _text_ on each theme is in M8.

## D-009 — Theme bootstrap without inline script (M1)

Settings live in IndexedDB (async). To avoid a theme flash under a strict CSP (`script-src 'self'`),
the resolved theme is mirrored to `localStorage['kin.theme']` (a per-device convenience only) and
applied by `public/theme-boot.js` before React mounts. IndexedDB stays authoritative.

## D-010 — CSP delivered by `<meta>` at build time (M1)

There is no server, so the §11 CSP is injected as a `<meta http-equiv>` in the production build only
(Vite dev needs inline HMR scripts). Added `worker-src`, `manifest-src`, `object-src 'none'`,
`base-uri` and `form-action` on top of the spec's directives. When a host is chosen, the CSP should also be
sent as an HTTP header (adds `frame-ancestors`).

## D-011 — Tooling versions (M1)

- React 18 and React Router v6 as specified. `npm audit` reports moderate advisories for all of
  react-router ≤ 7.17 (open redirect via backslash in `<Link>`/`navigate`, and an SSR-only issue). Kin
  only navigates to internal paths and has no SSR, so we stay on v6. Revisit: moving to v7 (library mode) is nearly a drop-in change.
- Vitest 5 (instead of 3) to clear a critical advisory in its worker pool. Tailwind v4 via
  `@tailwindcss/vite`, with theme tokens mapped in `@theme inline`.

## D-012 — Right-rail width between 1000 and 1279px (M1)

§6.1/§6.2 give a 350px rail and say it hides under 1000px, but 88 + 600 + 350 > 1000. The rail is 290px
from 1000 to 1279px and 350px from 1280px up.

## D-013 — Theme toggle cycles explicit themes (M1)

The left-nav toggle cycles Light → Dim → Lights out. "Follow system" is chosen in Settings › Display.
