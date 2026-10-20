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
  return page.url();
}

/** Types into a composer textarea and picks the first @/# suggestion. */
async function mention(page: Page, box: ReturnType<Page['getByRole']>, query: string) {
  await box.pressSequentially(query);
  await expect(page.getByRole('listbox')).toBeVisible();
  await box.press('Enter');
}

test('log a moment with @mention: shows on Home and profile instantly (ui §6.5 AC)', async ({
  page,
}) => {
  const profile = await createContact(page, 'Élise', 'Aubert');
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'What happened?' });
  await box.pressSequentially('Coffee with ');
  await mention(page, box, '@eli');
  await box.pressSequentially('she might move back to Lyon ');
  await mention(page, box, '#family');
  await expect(box).toHaveValue('Coffee with @Élise Aubert she might move back to Lyon #family ');
  await page.getByRole('radio', { name: 'Activity' }).click();
  await page.getByRole('combobox', { name: 'Activity type' }).selectOption('coffee');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  const card = page.getByTestId('moment-card').first();
  await expect(card).toContainText('she might move back to Lyon');
  await expect(card.getByRole('link', { name: '@Élise Aubert' })).toBeVisible();
  await expect(card.getByText('Coffee', { exact: true })).toBeVisible();

  await page.goto(profile);
  await expect(page.getByText(/Last spoke (now|today)/)).toBeVisible();
  await expect(page.getByTestId('moment-card')).toContainText('she might move back to Lyon');

  // Tag page via the #tag link; rename re-renders bodies (features §8.8 AC).
  await page.getByRole('link', { name: '#family' }).click();
  await expect(page.getByRole('heading', { name: '#family', level: 1 })).toBeVisible();
  await expect(page.getByText('1 moment')).toBeVisible();
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('famille');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: '#famille', level: 1 })).toBeVisible();
  await expect(
    page.getByTestId('moment-card').getByRole('link', { name: '#famille' }),
  ).toBeVisible();
});

test('a moment with 3 contacts is on all 3 profiles; delete + undo (features §8.4 AC)', async ({
  page,
}) => {
  const profiles = [
    await createContact(page, 'Ana'),
    await createContact(page, 'Bruno'),
    await createContact(page, 'Chloé'),
  ];
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'What happened?' });
  await box.pressSequentially('Dinner with ');
  await mention(page, box, '@ana');
  await mention(page, box, '@bru');
  await mention(page, box, '@chl');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('moment-card')).toHaveCount(1);

  for (const p of profiles) {
    await page.goto(p);
    await expect(page.getByTestId('moment-card')).toContainText('Dinner with');
  }

  await page.getByTestId('moment-card').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Moment deleted')).toBeVisible();
  await expect(page.getByTestId('moment-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('moment-card')).toHaveCount(1);

  await page.getByTestId('moment-card').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('moment-card')).toHaveCount(0);
  for (const p of profiles) {
    await page.goto(p);
    await expect(page.getByText(/No moments with .* yet/)).toBeVisible();
  }
  await page.goto('/settings/trash');
  await expect(page.getByRole('heading', { name: 'Moments' })).toBeVisible();
});

test('`n` opens the modal composer; Esc on a dirty draft asks first; photos; detail page', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('n');
  const dialog = page.getByRole('dialog', { name: 'Log moment' });
  await expect(dialog).toBeVisible();
  const box = dialog.getByRole('combobox', { name: 'What happened?' });
  await expect(box).toBeFocused();
  await box.pressSequentially('Draft'); // real typing = user activation, so Esc is cancellable
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Discard this moment?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(box).toHaveValue('Draft');

  await box.fill('Beach day');
  await dialog.getByRole('radio', { name: 'Journal' }).click();
  await dialog.getByRole('radio', { name: 'Great' }).click();
  await dialog.locator('input[type=file]').setInputFiles([PHOTO, PHOTO]);
  await expect(dialog.getByRole('button', { name: /Remove photo/ })).toHaveCount(2);
  await box.press('Control+Enter');
  await expect(dialog).toBeHidden();

  const card = page.getByTestId('moment-card').first();
  await expect(card).toContainText('Beach day');
  await expect(card).toContainText('Mood: Great');
  await expect(card.getByRole('img', { name: /Photo \d of 2/ })).toHaveCount(2);

  await card.getByText('Beach day').click();
  await expect(page).toHaveURL(/\/moment\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Moment', level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Photo 1 of 2' })).toBeVisible();
});

test('kind tabs filter; change date re-sorts the feed; edit keeps mentions', async ({ page }) => {
  await createContact(page, 'Marc');
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'What happened?' });
  await box.fill('First note');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('moment-card')).toHaveCount(1);
  await page.getByRole('radio', { name: 'Call' }).click();
  await box.pressSequentially('Called ');
  await mention(page, box, '@marc');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('moment-card')).toHaveCount(2);
  await expect(page.getByTestId('moment-card').first()).toContainText('Called');

  await page.getByRole('tab', { name: 'Calls' }).click();
  await expect(page.getByTestId('moment-card')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Notes' }).click();
  await expect(page.getByTestId('moment-card')).toHaveCount(1);
  await expect(page.getByTestId('moment-card')).toContainText('First note');
  await page.getByRole('tab', { name: 'All', exact: true }).click();
  await expect(page.getByTestId('moment-card')).toHaveCount(2); // wait for the live query to switch tabs

  // Move the call into the past → it sorts below the note.
  const call = page.getByTestId('moment-card').first();
  await call.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Change date' }).click();
  await page.getByRole('dialog').getByLabel('Date and time').fill('2020-01-01T09:00');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('moment-card').first()).toContainText('First note');
  await expect(page.getByTestId('moment-card').last()).toContainText('Jan 1, 2020');

  // Edit via the modal: the mention survives as a mention.
  await page.getByTestId('moment-card').last().getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit moment' });
  await expect(dialog.getByRole('combobox', { name: 'What happened?' })).toHaveValue(
    'Called @Marc',
  );
  await dialog.getByRole('combobox', { name: 'What happened?' }).press('End');
  await dialog.getByRole('combobox', { name: 'What happened?' }).pressSequentially(' back');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByTestId('moment-card').last().getByRole('link', { name: '@Marc' }),
  ).toBeVisible();
  await expect(page.getByTestId('moment-card').last()).toContainText('back');
});

test('mobile: FAB opens a full-screen composer', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'What happened?' })).toBeHidden(); // inline composer is desktop-only
  await page.getByRole('button', { name: 'Log moment' }).click();
  const dialog = page.getByRole('dialog', { name: 'Log moment' });
  const box = await dialog.boundingBox();
  expect(box?.width).toBe(375);
  expect(box?.height).toBe(812);
  await dialog.getByRole('combobox', { name: 'What happened?' }).fill('From my phone');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('moment-card')).toContainText('From my phone');
});
