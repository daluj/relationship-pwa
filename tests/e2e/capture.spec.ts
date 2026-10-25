import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import { seedBackup } from './backupFixture';

// features §8.12: templates, "Log a call" and gift photos.
const PHOTO = path.resolve('public/icons/icon-512.png');
test.use({ viewport: { width: 1366, height: 900 } });
test.beforeEach(async ({ page }) => {
  // Force the <a download> path so Playwright can capture files.
  await page.addInitScript(() => {
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined;
  });
});

const contactId = randomUUID();
const contact = { id: contactId, firstName: 'Élise', lastName: 'Aubert' };

test('template fills kind, type and text, then saves a coffee activity (AC-1, AC-2)', async ({
  page,
}) => {
  await seedBackup(page, { contacts: [contact] });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  await page.keyboard.press('n');
  const dialog = page.getByRole('dialog', { name: 'Log moment' });
  await dialog.getByRole('button', { name: 'Template' }).click();
  await dialog.getByRole('menuitem', { name: 'Coffee' }).click();
  const box = dialog.getByRole('combobox', { name: 'What happened?' });
  await expect(box).toHaveValue('Coffee with ');
  await expect(dialog.getByRole('combobox', { name: 'Activity type' })).toHaveValue('coffee');
  await box.pressSequentially('@eli');
  await box.press('Enter');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  const card = page.getByTestId('moment-card').first();
  await expect(card).toContainText('Coffee with');
  await expect(card.getByRole('link', { name: '@Élise Aubert' })).toBeVisible();

  // A second template keeps what was typed.
  await page.keyboard.press('n');
  await box.fill('Already typed');
  await dialog.getByRole('button', { name: 'Template' }).click();
  await dialog.getByRole('menuitem', { name: 'Visit' }).click();
  await expect(box).toHaveValue('Already typed');
  await expect(dialog.getByRole('combobox', { name: 'Activity type' })).toHaveValue('visit');
});

test('Log a call from the profile opens a call for that person and updates last spoke (AC-3)', async ({
  page,
}) => {
  await seedBackup(page, { contacts: [contact] });
  await page.goto(`/c/${contactId}`);
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Log a call' }).click();
  const dialog = page.getByRole('dialog', { name: 'Log moment' });
  await expect(dialog.getByRole('radio', { name: 'Call' })).toHaveAttribute('aria-checked', 'true');
  const direction = dialog.getByRole('combobox', { name: 'Call direction' });
  await expect(direction).toBeFocused();
  await expect(dialog.getByRole('group', { name: 'People in this moment' })).toContainText('Élise');
  await direction.selectOption('outgoing');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('moment-card').first()).toContainText('Outgoing call');
  await expect(page.getByText(/Last spoke/)).toBeVisible();
});

test('gift photo: add, replace, remove, and survive export → import (AC-4, AC-5)', async ({
  page,
}) => {
  await seedBackup(page, { contacts: [contact] });
  await page.goto(`/c/${contactId}/gifts`);
  await page.getByRole('button', { name: 'Add gift' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add gift' });
  await dialog.getByLabel('Gift', { exact: true }).fill('Cookbook');
  await dialog.getByLabel('Choose photo file').setInputFiles(PHOTO);
  await expect(dialog.getByRole('button', { name: 'Remove photo' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();
  const row = page.getByTestId('gift-row').filter({ hasText: 'Cookbook' });
  await expect(row.getByRole('img', { name: 'Photo of Cookbook' })).toBeVisible();

  // Export, wipe, restore: the photo comes back.
  await page.goto('/settings/data');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full backup (.json)' }).click();
  const file = await (await dl).path();
  const json = JSON.parse(await fs.readFile(file!, 'utf8')) as {
    data: { blobs: { id: string }[] };
  };
  expect(json.data.blobs.some((b) => b.id.endsWith(':thumb'))).toBe(true);

  await page.getByRole('button', { name: 'Delete all data' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete everything?' });
  await confirm.getByLabel('Type DELETE').fill('DELETE');
  await confirm.getByRole('button', { name: 'Delete all data' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto('/settings/data');
  await page.getByLabel('Choose file').setInputFiles(file!);
  await page
    .getByRole('dialog', { name: 'Restore backup' })
    .getByRole('button', { name: 'Restore' })
    .click();
  await expect(page.getByText(/Restored: \d+ added/)).toBeVisible();
  await page.goto(`/c/${contactId}/gifts`);
  await expect(
    page.getByTestId('gift-row').filter({ hasText: 'Cookbook' }).getByRole('img'),
  ).toBeVisible();

  // Replace the photo, then remove it.
  const openEdit = async () => {
    await page.getByRole('button', { name: /More options: Cookbook/ }).click();
    await page.getByRole('menuitem', { name: 'Edit gift' }).click();
    return page.getByRole('dialog', { name: 'Edit gift' });
  };
  const edit = await openEdit();
  await edit.getByLabel('Choose photo file').setInputFiles(PHOTO);
  await expect(edit.locator('img')).toBeVisible(); // preview of the new, not yet saved, photo
  await edit.getByRole('button', { name: 'Save' }).click();
  const giftImg = page.getByTestId('gift-row').filter({ hasText: 'Cookbook' }).getByRole('img');
  await expect(giftImg).toBeVisible();

  const remove = await openEdit();
  await remove.getByRole('button', { name: 'Remove photo' }).click();
  await remove.getByRole('button', { name: 'Save' }).click();
  await expect(giftImg).toHaveCount(0);
});
