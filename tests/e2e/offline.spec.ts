import { expect, test, waitForServiceWorker } from './fixtures';

// SPEC §9 AC (M1 subset, see docs/DECISIONS.md D-003): after first load the app works fully
// offline, and data written to IndexedDB survives offline reloads.
test('app shell and data survive offline reloads', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  await waitForServiceWorker(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();

  // Lazy-loaded route chunk must be precached too.
  await page.getByRole('link', { name: 'Settings' }).first().click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  // Write data while offline.
  // Settings are controlled by a live query, so assert the applied result rather than using check().
  await page.getByRole('radio', { name: 'Dim' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dim');
  await page.getByRole('button', { name: 'Pink' }).click();
  await expect(page.getByRole('button', { name: 'Pink' })).toHaveAttribute('aria-pressed', 'true');

  // Reload a deep link offline: served by the SPA navigation fallback.
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Dim' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Pink' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dim');

  await page.goto('/reminders');
  await expect(page.getByRole('heading', { name: 'Reminders', level: 1 })).toBeVisible();
});
