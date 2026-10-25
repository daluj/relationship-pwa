import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

// WCAG 2.1 AA audit (ui §6.10) of the main screens in all three themes, with demo data loaded.
test.use({ viewport: { width: 1366, height: 900 } });
test.describe.configure({ mode: 'serial' });

const themes = ['Light', 'Dim', 'Lights out'] as const;

async function setup(page: Page) {
  await page.goto('/settings/data');
  await page.getByRole('button', { name: /Explore with demo data/ }).click();
  await expect(page.getByRole('button', { name: 'Remove demo data' })).toBeVisible();
  await page.goto('/contacts');
  await page.getByTestId('contact-name').filter({ hasText: 'Élise Aubert' }).click();
  return new URL(page.url()).pathname; // /c/<id>
}

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes
      .slice(0, 3)
      .map((n) => `${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`),
  }));
}

for (const theme of themes) {
  test(`no WCAG 2.1 AA violations — ${theme} theme`, async ({ page }) => {
    test.setTimeout(120_000);
    const profile = await setup(page);
    await page.goto('/settings');
    await page.getByRole('radio', { name: theme, exact: true }).click();
    const pages = [
      '/',
      '/contacts',
      profile,
      `${profile}/details`,
      `${profile}/brief`,
      `${profile}/money`,
      `${profile}/gifts`,
      '/reminders',
      '/search?q=eli',
      '/groups',
      '/tasks',
      '/starred',
      '/settings',
      '/settings/data',
      '/settings/about',
    ];
    const found: Record<string, unknown> = {};
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);
      const v = await audit(page);
      if (v.length) found[path] = v;
    }
    // Overlays: composer and a dialog.
    await page.goto('/');
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'Log moment' })).toBeVisible();
    const composer = await audit(page);
    if (composer.length) found['composer'] = composer;
    console.log('A11Y', JSON.stringify(found));
    expect(found).toEqual({});
  });
}

test('onboarding has no WCAG 2.1 AA violations', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('kin.onboarded'));
  await page.goto('/onboarding');
  expect(await audit(page)).toEqual([]);
  await page.getByRole('button', { name: 'Get started' }).click();
  expect(await audit(page)).toEqual([]);
});

test('lock screen has no WCAG 2.1 AA violations', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Turn on' }).click();
  await page.getByLabel('PIN (4–6 digits)').fill('2468');
  await page.getByLabel('Repeat PIN').fill('2468');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('lock-status')).toHaveText('· On'); // committed before reloading
  await page.reload();
  await expect(page.getByTestId('lock-screen')).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('mobile layout has no WCAG 2.1 AA violations (bottom tabs, FAB, drawer)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const profile = await setup(page);
  for (const path of ['/', '/contacts', profile, '/reminders']) {
    await page.goto(path);
    await page.waitForTimeout(300);
    expect(await audit(page), path).toEqual([]);
  }
  await page.getByRole('button', { name: 'Open menu' }).click();
  expect(await audit(page), 'drawer').toEqual([]);
});
