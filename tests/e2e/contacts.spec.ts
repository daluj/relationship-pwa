import path from 'node:path';
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const PHOTO = path.resolve('public/icons/icon-512.png');

async function createContact(page: Page, firstName: string, lastName = '') {
  await page.goto('/contacts/new');
  await page.getByLabel('First name').fill(firstName);
  if (lastName) await page.getByLabel('Last name').fill(lastName);
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
}

test('create a full contact and see it on the profile (features §8.2, §6.6)', async ({ page }) => {
  await page.goto('/contacts');
  await expect(page.getByText('No contacts yet')).toBeVisible();
  await page.getByRole('link', { name: 'New contact' }).click();
  await expect(page).toHaveURL(/\/contacts\/new$/);

  // Only firstName is required.
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByRole('alert').filter({ hasText: 'Required' })).toBeVisible();

  await page.getByLabel('First name').fill('Élise');
  await page.getByLabel('Last name').fill('Aubert');
  await page.getByLabel('Nickname').fill('@lise');
  await page.getByLabel('Short bio').fill('Old friend from Lyon.');

  const birthday = page.getByRole('group', { name: 'Birthday' });
  await birthday.getByPlaceholder('Day').fill('18');
  await birthday.getByRole('combobox').selectOption({ label: 'March' });
  await birthday.getByPlaceholder(/Year/).fill('1987');

  await page.getByRole('button', { name: 'Add contact info' }).click();
  await page.getByLabel('Value', { exact: true }).fill('+34 600 11 22 33');
  await page.getByLabel('Primary').check();

  await page.getByRole('button', { name: 'Add address' }).click();
  await page.getByLabel('City').fill('Lyon');
  await page.getByLabel('Country').fill('France');

  // Avatar upload with square crop.
  await page.getByLabel('Profile photo').setInputFiles(PHOTO);
  const cropper = page.getByRole('dialog', { name: 'Crop photo' });
  await expect(cropper).toBeVisible();
  await cropper.getByRole('slider').fill('1.5');
  await cropper.getByRole('button', { name: 'Apply' }).click();
  await expect(cropper).toBeHidden();

  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);

  await expect(page.getByRole('heading', { name: 'Élise Aubert', level: 2 })).toBeVisible();
  await expect(page.getByText('@lise', { exact: true })).toBeVisible();
  await expect(page.getByText('Old friend from Lyon.')).toBeVisible();
  await expect(page.getByText('Lyon, France')).toBeVisible();
  await expect(page.getByText(/Born March 18, 1987 · turns \d+/)).toBeVisible();
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Timeline' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('tab', { name: 'Details' }).click();
  await expect(page).toHaveURL(/\/details$/);
  await expect(page.getByRole('link', { name: '+34 600 11 22 33' })).toHaveAttribute(
    'href',
    'tel:+34600112233',
  );
  await expect(page.getByRole('tabpanel').getByText('March 18, 1987')).toBeVisible();

  // Data survives a reload.
  await page.reload();
  await expect(page.getByRole('link', { name: '+34 600 11 22 33' })).toBeVisible();
});

test('edit a contact; cleared fields disappear', async ({ page }) => {
  await createContact(page, 'Marc', 'Dupont');
  await page.getByRole('link', { name: 'Edit profile' }).click();
  await expect(page.getByLabel('First name')).toHaveValue('Marc');
  await page.getByLabel('Nickname').fill('marco');
  await page.getByLabel('Job title').fill('Chef');
  await page.getByLabel('Company').fill('Le Petit Sud');
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByText('@marco', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Details' }).click();
  await expect(page.getByText('Chef at Le Petit Sud')).toBeVisible();

  await page.getByRole('link', { name: 'Edit profile' }).click();
  await page.getByLabel('Nickname').fill('');
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByRole('heading', { name: 'Marc Dupont', level: 2 })).toBeVisible();
  await expect(page.getByText('@marco')).toHaveCount(0);
});

test('list: sort, star filter, archive', async ({ page }) => {
  await createContact(page, 'Zoé');
  await createContact(page, 'ana');
  await createContact(page, 'Bruno');

  await page.goto('/contacts');
  const names = page.getByTestId('contact-name');
  await expect(names).toHaveText(['ana', 'Bruno', 'Zoé']);
  await page.getByRole('combobox', { name: 'Sort' }).selectOption('recently-added');
  await expect(names).toHaveText(['Bruno', 'ana', 'Zoé']);

  const star = page.getByRole('button', { name: 'Star Zoé' });
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Starred' }).click();
  await expect(names).toHaveText(['Zoé']);

  // Archive from the profile menu → hidden from All, shown under Archived.
  await page.getByRole('tab', { name: 'All' }).click();
  await page.getByRole('link', { name: /Bruno/ }).click();
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await expect(page.getByText('Bruno archived')).toBeVisible();
  await page.goto('/contacts');
  await expect(names).toHaveText(['ana', 'Zoé']);
  await page.getByRole('tab', { name: 'Archived' }).click();
  await expect(names).toHaveText(['Bruno']);
});

test('delete with undo, restore from Trash, delete forever', async ({ page }) => {
  await createContact(page, 'Lise');
  const profileUrl = page.url();

  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Delete contact' }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  await expect(page.getByText('Lise moved to Trash')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('main li').getByText('Lise')).toBeVisible();

  await page.goto(profileUrl);
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Delete contact' }).click();
  await expect(page.getByText('No contacts yet')).toBeVisible();

  await page.goto('/settings/trash');
  await expect(page.getByText(/Deleted .* · removed in 30 days/)).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('Trash is empty.')).toBeVisible();
  await page.goto(profileUrl);
  await expect(page.getByRole('heading', { name: 'Lise', level: 2 })).toBeVisible();

  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Delete contact' }).click();
  await expect(page).toHaveURL(/\/contacts$/); // let the delete commit before navigating
  await page.goto('/settings/trash');
  await page.getByRole('button', { name: 'Delete forever' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete forever' }).click();
  await expect(page.getByText('Trash is empty.')).toBeVisible();
  await page.goto(profileUrl);
  await expect(page.getByText("This contact doesn't exist or was deleted.")).toBeVisible();
});

test('mobile profile: 80px avatar, no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await createContact(page, 'Élise', 'Aubert');
  await expect(page.getByRole('heading', { name: 'Élise Aubert', level: 2 })).toBeVisible();
  const avatar = page
    .locator('main span[aria-hidden]')
    .filter({ hasText: 'ÉA' })
    .locator('visible=true');
  expect((await avatar.boundingBox())?.width).toBe(80);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
