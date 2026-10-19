/// <reference lib="webworker" />
import i18next from 'i18next';
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { db } from '@/db/db';
import { runReminderCheck } from '@/db/repositories/reminderCheck';
import { notificationFor } from '@/features/reminders/notify';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

declare const self: ServiceWorkerGlobalScope;

// Precache the full app shell and static assets so the app loads offline (SPEC §9).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation fallback. No runtime caching: there are no external origins.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// ── Web Share Target (SPEC §9) ───────────────────────────────────────────────
// Shared files are parked in a cache for the Data page to import; shared text opens the composer.
const SHARE_CACHE = 'kin-share'; // keep in sync with features/data/sharedFiles.ts

registerRoute(
  ({ url, request }) => url.pathname === '/share-target' && request.method === 'POST',
  async ({ request }) => {
    const form = await request.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length) {
      const cache = await caches.open(SHARE_CACHE);
      await Promise.all(
        files.map((f, i) =>
          cache.put(
            `/share-target/file/${Date.now()}-${i}`,
            new Response(f, {
              headers: { 'content-type': f.type, 'x-file-name': encodeURIComponent(f.name) },
            }),
          ),
        ),
      );
      return Response.redirect('/settings/data?shared=1', 303);
    }
    const text = ['title', 'text', 'url']
      .map((k) => form.get(k))
      .filter((v): v is string => typeof v === 'string' && !!v.trim())
      .join('\n');
    return Response.redirect(`/compose${text ? `?text=${encodeURIComponent(text)}` : ''}`, 303);
  },
  'POST',
);

// Update flow: the page asks the waiting SW to activate only when the user clicks "Reload".
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

clientsClaim();

// ── Reminders (SPEC §8.5) ───────────────────────────────────────────────────

interface PeriodicSyncEvent extends ExtendableEvent {
  tag: string;
}

/** Periodic Background Sync (installed Chromium): read IndexedDB and notify due reminders. */
async function checkReminders(): Promise<void> {
  const locale = ((await db.settings.get('locale'))?.value as string | undefined) ?? 'en';
  const i18n = i18next.createInstance();
  await i18n.init({
    lng: locale,
    fallbackLng: 'en',
    resources: { en: { translation: en }, es: { translation: es } },
    interpolation: { escapeValue: false },
  });
  const canNotify = Notification.permission === 'granted';
  const count = await runReminderCheck(
    new Date(),
    canNotify
      ? async (items) => {
          for (const n of items) {
            const { title, options } = notificationFor(n, i18n.t, locale);
            await self.registration.showNotification(title, options);
          }
        }
      : undefined,
  );
  const nav = self.navigator as WorkerNavigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  await (count ? nav.setAppBadge?.(count) : nav.clearAppBadge?.())?.catch(() => {});
}

self.addEventListener('periodicsync', ((event: PeriodicSyncEvent) => {
  if (event.tag === 'check-reminders') event.waitUntil(checkReminders());
}) as EventListener);

/** Focus an open window (or open one) at the reminder's page or contact. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(
    (event.notification.data as { url?: string } | null)?.url ?? '/reminders',
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (client) {
        await client.focus();
        await client.navigate(url).catch(() => {});
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
