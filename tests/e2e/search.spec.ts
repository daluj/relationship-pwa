import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

test.use({ viewport: { width: 1366, height: 900 } });

async function createContact(page: Page, firstName: string, lastName = '') {
  await page.goto('/contacts/new');
  await page.getByLabel('First name').fill(firstName);
  if (lastName) await page.getByLabel('Last name').fill(lastName);
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
}

test('search page: people, moments, tags; recent searches; trends (SPEC §6.7, §8.6)', async ({
  page,
}) => {
  await createContact(page, 'Élise', 'Aubert');
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'What happened?' });
  await box.pressSequentially('Great coffee in Lyon with @eli');
  await box.press('Enter');
  await box.pressSequentially('#travel');
  await box.press('Enter');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('moment-card')).toHaveCount(1);

  // Right-rail search box → search page (and it records a recent search).
  await page.getByRole('complementary').getByRole('searchbox', { name: 'Search' }).fill('eli');
  await page.getByRole('complementary').getByRole('searchbox', { name: 'Search' }).press('Enter');
  await expect(page).toHaveURL(/\/search\?q=eli$/);
  const results = page.getByTestId('search-results');
  await expect(results.getByTestId('contact-name')).toHaveText(['Élise Aubert']);
  await expect(results.getByTestId('moment-card')).toContainText('Great coffee');

  // Typing updates results live; the last word is a prefix.
  const searchBox = page.getByRole('main').getByRole('searchbox', { name: 'Search' });
  await searchBox.fill('lyon cof');
  await expect(page).toHaveURL(/q=lyon\+cof/);
  await expect(results.getByTestId('moment-card')).toHaveCount(1);
  await expect(results.getByTestId('contact-name')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Tags' }).click();
  await searchBox.fill('trav');
  await expect(results.getByRole('link', { name: 'travel' })).toBeVisible();

  await searchBox.fill('zzzz');
  await expect(page.getByText('No results for “zzzz”')).toBeVisible();

  // Empty: recent searches + trending tags.
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(
    page.getByRole('region', { name: 'Recent searches' }).getByRole('link', { name: 'eli' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Trending tags' })).toContainText('#travel');
  await expect(page.getByRole('region', { name: 'Trending tags' })).toContainText('1 moment');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByRole('region', { name: 'Recent searches' })).toHaveCount(0);
});
