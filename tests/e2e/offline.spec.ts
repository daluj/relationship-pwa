import { expect, test, waitForServiceWorker } from './fixtures';

// SPEC §9 AC: after first load the app works fully offline; settings, a contact and a moment
// created offline survive reloads.
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

  // Create a contact offline (lazy form chunk is precached), reload, still there (SPEC §9 AC, part 1).
  await page.goto('/contacts/new');
  await page.getByLabel('First name').fill('Offline Olga');
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByRole('heading', { name: 'Offline Olga', level: 2 })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Offline Olga', level: 2 })).toBeVisible();
  await page.goto('/contacts');
  await expect(page.getByRole('link', { name: /Offline Olga/ })).toBeVisible();

  // …and a moment mentioning her (SPEC §9 AC, part 2), then reload again.
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'What happened?' });
  await box.pressSequentially('Tea with @olga');
  await box.press('Enter');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('moment-card')).toContainText('Tea with');
  await page.reload();
  await expect(
    page.getByTestId('moment-card').getByRole('link', { name: '@Offline Olga' }),
  ).toBeVisible();
});
