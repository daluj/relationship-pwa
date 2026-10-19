import { test as base, expect } from '@playwright/test';

/** Fails any test that makes a request to another origin (SPEC §1.2, §15). */
export const test = base.extend<{ foreignRequests: string[] }>({
  foreignRequests: [
    async ({ page, baseURL }, use) => {
      const origin = new URL(baseURL!).origin;
      const foreign: string[] = [];
      page.on('request', (req) => {
        const url = new URL(req.url());
        if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin)
          foreign.push(req.url());
      });
      await use(foreign);
      expect(foreign, 'requests to foreign origins').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Waits until a service worker controls the page (precache done). */
export async function waitForServiceWorker(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    }
  });
}
