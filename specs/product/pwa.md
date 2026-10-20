# PWA requirements

> Section numbers (§n) are stable IDs carried over from the original single-file spec and are
> cited throughout the code (`// features §8.5`). Never renumber; add new subsections at the end.

## 9. PWA requirements

- `manifest.webmanifest`: name, short_name, description, `start_url: "/"`, `display: "standalone"`, `theme_color`/`background_color` per theme (update `<meta name="theme-color">` on theme change), icons 192/512 + maskable, `shortcuts` (Log moment → `/compose`, Reminders, Search), `share_target` (text → composer prefill; files → import), `file_handlers` for `.vcf`/`.json`.
- Service worker (Workbox `injectManifest`):
  - Precache full app shell and all static assets (app must load fully offline after first visit).
  - SPA navigation fallback to `index.html`.
  - No runtime caching of external origins (there are none).
  - Update flow: on new SW waiting, show toast "Update available — Reload"; never auto-reload mid-composition.
  - Periodic sync handler for reminders (§8.5) and `notificationclick` → focus/open `/reminders` or the contact.
- Custom in-app **Install** prompt (`beforeinstallprompt`) in left nav "More" and onboarding; iOS instructions sheet ("Share → Add to Home Screen").
- Lighthouse PWA/installability checks pass; performance ≥ 90 on mobile.
- **AC:** Playwright test: load app, go offline (`context.setOffline(true)`), reload, create a contact and a moment, reload again — data persists and UI works.
