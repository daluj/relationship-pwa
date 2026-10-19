import { test as base, expect } from '@playwright/test';

/** Fails any test that makes a request to another origin (SPEC §1.2, §15). */
export const test = base.extend<{
  foreignRequests: string[];
  pageErrors: string[];
  onboarded: boolean;
  skipOnboarding: void;
  /** Page errors a test triggers on purpose (e.g. the diagnostics log test). */
  expectedPageErrors: RegExp | null;
}>({
  expectedPageErrors: [null, { option: true }],
  /**
   * Most tests start from an empty database, which would open onboarding on Home (SPEC §8.1). Mark it
   * done by default; onboarding tests use `test.use({ onboarded: false })`.
   */
  onboarded: [true, { option: true }],
  skipOnboarding: [
    async ({ page, onboarded }, use) => {
      if (onboarded) await page.addInitScript(() => localStorage.setItem('kin.onboarded', '1'));
      await use();
    },
    { auto: true },
  ],
  /** Uncaught exceptions / unhandled rejections in the app fail the test. */
  pageErrors: [
    async ({ page, expectedPageErrors }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => {
        if (!expectedPageErrors?.test(e.message))
          errors.push(`${e.name}: ${e.message}\n${e.stack ?? ''}`);
      });
      await use(errors);
      expect(errors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
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
