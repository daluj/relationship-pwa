import { expect, test } from './fixtures';

test.use({ viewport: { width: 1366, height: 900 } });

test.describe('onboarding (SPEC §8.1)', () => {
  test.use({ onboarded: false });

  test('first run: welcome → language → theme → storage → notifications → demo data; never shown again', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: 'Welcome to Kin' })).toBeVisible();
    await expect(page.getByText(/Everything stays on this device/)).toBeVisible();
    await page.getByRole('button', { name: 'Get started' }).click();

    await expect(page.getByText('Step 1 of 5')).toBeVisible();
    await page.getByLabel('Español').click(); // live-query controlled
    await expect(page.getByText('Elige tu idioma')).toBeVisible(); // switches immediately
    await page.getByLabel('English').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Dim').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dim');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('button', { name: 'Keep my data' }).click();
    await expect(page.getByRole('status')).toHaveText(/Done|didn't allow|doesn't support/);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText(/There is no server/)).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('button', { name: /Explore with demo data/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('moment-card').first()).toBeVisible();
    await page.goto('/contacts');
    await expect(page.getByTestId('contact-name')).toHaveCount(15);

    // Done: Home no longer redirects, even after a reload.
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);

    // "Remove demo data" in Settings › Your data.
    await page.goto('/settings/data');
    await page.getByRole('button', { name: 'Remove demo data' }).click();
    await expect(page.getByText('Demo data removed')).toBeVisible();
    await page.goto('/contacts');
    await expect(page.getByText('No contacts yet')).toBeVisible();
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/); // empty again, but onboarding was completed
  });

  test('not shown when data already exists; deep links are never redirected', async ({ page }) => {
    await page.goto('/contacts/new');
    await expect(page).toHaveURL(/\/contacts\/new$/);
    await page.getByLabel('First name').fill('Ana');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/c\//);
    await page.evaluate(() => localStorage.removeItem('kin.onboarded'));
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  });
});

test('keyboard shortcuts (SPEC §6.9): ?, g c, g h, /, n, j/k, s, Enter', async ({ page }) => {
  await page.goto('/settings/data');
  await page.getByRole('button', { name: /Explore with demo data/ }).click();
  await expect(page.getByRole('button', { name: 'Remove demo data' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByTestId('moment-card').first()).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 5 } });

  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(help).toContainText('Star the focused moment');
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();

  await page.keyboard.press('g');
  await page.keyboard.press('c');
  await expect(page).toHaveURL(/\/contacts$/);
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await expect(page).toHaveURL(/\/$/);

  await page.keyboard.press('/');
  await expect(page.getByRole('complementary').getByRole('searchbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } });

  await page.keyboard.press('j');
  const first = page.getByTestId('moment-card').first();
  await expect(first).toBeFocused();
  await page.keyboard.press('j');
  await expect(page.getByTestId('moment-card').nth(1)).toBeFocused();
  await page.keyboard.press('k');
  await expect(first).toBeFocused();
  await page.keyboard.press('s');
  await expect(first.getByRole('button', { name: 'Star' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/moment\//);

  await page.keyboard.press('n');
  await expect(page.getByRole('dialog', { name: 'Log moment' })).toBeVisible();
});

test('app lock: PIN on open, wrong PIN, lockout, unlock; turning it off needs the PIN (SPEC §8.10)', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.getByText(/does not encrypt your data/)).toBeVisible();
  await page.getByRole('button', { name: 'Turn on' }).click();
  const set = page.getByRole('dialog', { name: 'Set a PIN' });
  await set.getByLabel('PIN (4–6 digits)').fill('2468');
  await set.getByLabel('Repeat PIN').fill('2469');
  await set.getByRole('button', { name: 'Save' }).click();
  await expect(set.getByRole('alert')).toHaveText("The PINs don't match.");
  await set.getByLabel('Repeat PIN').fill('2468');
  await set.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('lock-status')).toHaveText('· On');

  // Reopening the app shows the lock screen and nothing behind it.
  await page.reload();
  await expect(page.getByTestId('lock-screen')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  const pin = page.getByLabel('Enter your PIN');
  await pin.fill('1111');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong PIN.');
  await pin.fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  // "Lock now", then five wrong attempts trigger a cool-down.
  await page.getByRole('button', { name: 'Lock now' }).click();
  for (let i = 0; i < 5; i++) {
    await pin.fill('0000');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(pin).toHaveValue('');
  }
  await expect(page.getByRole('alert')).toHaveText(/Too many attempts. Try again in \d+ s./);
  await expect(pin).toBeDisabled();
  await page.evaluate(() => localStorage.removeItem('kin.lockAttempts')); // skip the 30 s wait
  await page.reload();
  await pin.fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();

  await page.getByRole('button', { name: 'Turn off' }).click();
  const off = page.getByRole('dialog', { name: 'Turn off app lock' });
  await off.getByLabel('Current PIN').fill('9999');
  await off.getByRole('button', { name: 'Turn off' }).click();
  await expect(off.getByRole('alert')).toHaveText('Wrong PIN.');
  await off.getByLabel('Current PIN').fill('2468');
  await off.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByTestId('lock-status')).toHaveText('· Off');
  await page.reload();
  await expect(page.getByTestId('lock-screen')).toHaveCount(0);
});

test.describe('settings', () => {
  test.use({ expectedPageErrors: /Synthetic test failure/ });

  test('storage usage and persistence; About shows privacy and diagnostics (SPEC §8.10, §11)', async ({
    page,
  }) => {
    await page.goto('/settings/data');
    await expect(page.getByTestId('storage-usage')).toHaveText(
      /Using .+ of about .+ available to Kin\./,
    );
    await expect(page.getByTestId('storage-persisted')).toHaveText(/Persistent storage: (on|off)/);

    await page.goto('/settings/about#privacy');
    await expect(page.getByTestId('app-version')).toHaveText(/Version \d+\.\d+\.\d+/);
    await expect(page.getByText(/no analytics, no ads and no third-party scripts/)).toBeVisible();
    await expect(page.getByTestId('diagnostics-empty')).toBeVisible();
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('Synthetic test failure');
      });
    });
    await page.reload();
    await expect(page.getByTestId('diagnostics-log')).toContainText(
      'Error: Synthetic test failure',
    );
    await page.getByRole('button', { name: 'Clear log' }).click();
    await expect(page.getByTestId('diagnostics-empty')).toBeVisible();
  });
});
