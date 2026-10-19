/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

// Precache the full app shell and static assets so the app loads offline (SPEC §9).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation fallback. No runtime caching: there are no external origins.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Update flow: the page asks the waiting SW to activate only when the user clicks "Reload".
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

clientsClaim();

// Periodic sync + notificationclick handlers arrive in M4 (SPEC §8.5).
