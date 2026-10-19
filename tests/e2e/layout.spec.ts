import { expect, test } from './fixtures';

const leftNav = (page: import('@playwright/test').Page) =>
  page.locator('header').filter({ has: page.getByRole('button', { name: 'Log moment' }) });
const rail = (page: import('@playwright/test').Page) => page.getByRole('complementary');
const bottomBar = (page: import('@playwright/test').Page) => page.locator('nav.fixed');

test.describe('responsive shell (SPEC §6.1–6.3)', () => {
  test('desktop ≥1280: 275px nav with labels, 600px center, right rail', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await expect(leftNav(page)).toBeVisible();
    expect((await leftNav(page).boundingBox())?.width).toBe(275);
    await expect(leftNav(page).getByText('Reminders', { exact: true })).toBeVisible();
    expect((await page.getByTestId('center-column').boundingBox())?.width).toBe(600);
    await expect(rail(page)).toBeVisible();
    await expect(rail(page).getByRole('heading', { name: 'Upcoming' })).toBeVisible();
    await expect(rail(page).getByRole('heading', { name: 'Reach out' })).toBeVisible();
    await expect(bottomBar(page)).toBeHidden();
  });

  test('tablet: icon-only nav; right rail only from 1000px', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/');
    expect((await leftNav(page).boundingBox())?.width).toBe(88);
    await expect(leftNav(page).getByText('Reminders', { exact: true })).toBeHidden();
    await expect(rail(page)).toBeVisible();

    await page.setViewportSize({ width: 900, height: 900 });
    await expect(rail(page)).toBeHidden();
    await expect(leftNav(page)).toBeVisible();
    await expect(bottomBar(page)).toBeHidden();
  });

  test('mobile: top bar, bottom tabs, FAB, drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(leftNav(page)).toBeHidden();
    await expect(rail(page)).toBeHidden();
    await expect(bottomBar(page)).toBeVisible();
    for (const name of ['Home', 'Search', 'Reminders', 'Contacts']) {
      await expect(bottomBar(page).getByRole('link', { name })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Log moment' })).toBeVisible(); // FAB

    await bottomBar(page).getByRole('link', { name: 'Contacts' }).click();
    await expect(page).toHaveURL(/\/contacts$/);

    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('dialog');
    await drawer.getByRole('link', { name: 'Tasks' }).click();
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(drawer).toBeHidden();

    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(375); // no horizontal scroll
  });
});

test('themes and language switch and persist across reloads', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Lights out' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'lights-out');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');

  await page.getByRole('button', { name: '19px' }).click();
  await expect(page.locator('html')).toHaveCSS('font-size', '19px');

  await page.getByRole('combobox', { name: 'Language' }).selectOption('es');
  await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'lights-out');
  await expect(page.getByRole('link', { name: 'Inicio' }).first()).toBeVisible();

  // Theme toggle in the left nav cycles Lights out → Light.
  await page.getByRole('button', { name: /Cambiar tema/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('every SPEC §7 route renders inside the shell', async ({ page }) => {
  const paths = [
    '/',
    '/compose',
    '/moment/x',
    '/contacts',
    '/contacts/new',
    '/c/x',
    '/c/x/details',
    '/c/x/edit',
    '/reminders',
    '/tasks',
    '/search?q=a',
    '/tags/x',
    '/groups',
    '/groups/x',
    '/starred',
    '/settings',
    '/settings/data',
    '/settings/trash',
    '/settings/about',
    '/onboarding',
  ];
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }), path).not.toHaveText(
      "This page doesn't exist",
    );
  }
  await page.goto('/nope');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("This page doesn't exist");
});
