import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import { seedBackup } from './backupFixture';

// features §8.13: search filters, saved searches, bulk actions and Year in review.
test.use({ viewport: { width: 1366, height: 900 } });
test.beforeEach(async ({ page }) => {
  // Force the <a download> path so Playwright can capture files.
  await page.addInitScript(() => {
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined;
  });
});

const ids = {
  lise: randomUUID(),
  marc: randomUUID(),
  zoe: randomUUID(),
  hugo: randomUUID(),
  family: randomUUID(),
  bookClub: randomUUID(),
};
const tag = (id: string, name: string) => ({ id, name, nameLower: name });
const moment = (body: string, happenedAt: string, extra: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  kind: 'note',
  body,
  happenedAt,
  ...extra,
});

const data = () => ({
  contacts: [
    {
      id: ids.lise,
      firstName: 'Élise',
      lastInteractionAt: '2026-10-20T10:00:00.000Z',
      groupIds: [ids.bookClub],
    },
    { id: ids.marc, firstName: 'Marc', lastInteractionAt: '2026-01-02T10:00:00.000Z' },
    { id: ids.zoe, firstName: 'Zoé' },
    { id: ids.hugo, firstName: 'Hugo', isArchived: true },
  ],
  tags: [tag(ids.family, 'family')],
  groups: [{ id: ids.bookClub, name: 'Book club' }],
  moments: [
    moment('Lyon call one', '2026-03-10T10:00:00.000Z', {
      kind: 'call',
      contactIds: [ids.marc],
      tagIds: [ids.family],
    }),
    moment('Lyon call two', '2026-03-20T10:00:00.000Z', { kind: 'call', contactIds: [ids.marc] }),
    moment('Lyon note', '2026-03-15T10:00:00.000Z', {
      contactIds: [ids.lise],
      tagIds: [ids.family],
    }),
    moment('Paris call', '2026-06-01T10:00:00.000Z', { kind: 'call' }),
    moment('Recent chat', '2026-10-20T10:00:00.000Z', { contactIds: [ids.lise] }),
    moment('Old chat', '2026-01-02T10:00:00.000Z', { contactIds: [ids.marc] }),
  ],
});

const results = (page: import('@playwright/test').Page) => page.getByTestId('search-results');

test('filters narrow search by kind, date range, tag, group and combine with text (AC-1, AC-3)', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));
  await seedBackup(page, data());
  await page.goto('/search');

  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('checkbox', { name: 'Call' }).click();
  await expect(page.getByRole('checkbox', { name: 'Call' })).toBeChecked();
  await page.getByLabel('From', { exact: true }).fill('2026-03-01');
  await page.getByLabel('To', { exact: true }).fill('2026-03-31');
  await page.getByRole('tab', { name: 'Moments' }).click();
  await expect(results(page).getByTestId('moment-card')).toHaveCount(2);
  await expect(results(page)).toContainText('Lyon call two');
  await expect(results(page)).not.toContainText('Lyon note');
  await expect(results(page)).not.toContainText('Paris call'); // outside the range

  // Text AND tag.
  await page.getByRole('checkbox', { name: 'Call' }).click();
  await expect(page.getByRole('checkbox', { name: 'Call' })).not.toBeChecked();
  await page.getByLabel('Tag').selectOption({ label: '#family' });
  await page.getByRole('searchbox', { name: 'Search' }).fill('lyon');
  await expect(results(page).getByTestId('moment-card')).toHaveCount(2); // call one + note, both tagged
  await expect(results(page)).not.toContainText('Lyon call two');

  // Group filter: moments mentioning a member of Book club.
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('searchbox', { name: 'Search' }).fill('');
  await page.getByLabel('Group').selectOption({ label: 'Book club' });
  await page.getByRole('tab', { name: 'Moments' }).click();
  await expect(results(page).getByTestId('moment-card')).toHaveCount(2); // Lyon note + Recent chat
  await expect(results(page)).toContainText('Recent chat');
});

test('"not contacted in 90 days" lists stale people by name, not archived (AC-2)', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));
  await seedBackup(page, data());
  await page.goto('/search');
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByLabel('Not contacted in').selectOption('90');
  const names = results(page).getByTestId('contact-name');
  await expect(names).toHaveText(['Marc', 'Zoé']); // Élise is recent, Hugo is archived
  await expect(results(page).getByTestId('moment-card')).toHaveCount(0);
});

test('saved search: save, run again, rename, delete with undo, survive export → import (AC-4)', async ({
  page,
}) => {
  await seedBackup(page, data());
  await page.goto('/search?kinds=call&from=2026-03-01&to=2026-03-31');
  await expect(results(page).getByTestId('moment-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Save search' }).click();
  const dialog = page.getByRole('dialog', { name: 'Save this search' });
  await dialog.getByLabel('Name').fill('March calls');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved “March calls”')).toBeVisible();

  await page.goto('/search');
  const list = page.getByRole('region', { name: 'Saved searches' });
  await list.getByRole('link', { name: 'March calls' }).click();
  await expect(results(page).getByTestId('moment-card')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Filters' })).toContainText('3');

  // Export, wipe and restore.
  await page.goto('/settings/data');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full backup (.json)' }).click();
  const file = await (await dl).path();
  expect(JSON.parse(await fs.readFile(file!, 'utf8')).data.savedSearches).toHaveLength(1);
  await page.getByRole('button', { name: 'Delete all data' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete everything?' });
  await confirm.getByLabel('Type DELETE').fill('DELETE');
  await confirm.getByRole('button', { name: 'Delete all data' }).click();
  await expect(confirm).toBeHidden();
  await page.goto('/settings/data');
  await page.getByLabel('Choose file').setInputFiles(file!);
  await page
    .getByRole('dialog', { name: 'Restore backup' })
    .getByRole('button', { name: 'Restore' })
    .click();
  await expect(page.getByText(/Restored: \d+ added/)).toBeVisible();

  await page.goto('/search');
  const restored = page.getByRole('region', { name: 'Saved searches' });
  await expect(restored.getByRole('link', { name: 'March calls' })).toBeVisible();

  // Rename, then delete and undo.
  await restored.getByRole('button', { name: 'Options for March calls' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const rename = page.getByRole('dialog', { name: 'Rename' });
  await rename.getByLabel('Name').fill('Spring calls');
  await rename.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(restored.getByRole('link', { name: 'Spring calls' })).toBeVisible();
  await restored.getByRole('button', { name: 'Options for Spring calls' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('region', { name: 'Saved searches' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('link', { name: 'Spring calls' })).toBeVisible();
});

test('bulk tag three contacts, then undo with one click (AC-5, AC-7)', async ({ page }) => {
  await seedBackup(page, data());
  await page.goto('/contacts');
  await page.getByRole('button', { name: 'Select' }).click();
  await expect(page.getByRole('status').filter({ hasText: '0 selected' })).toBeVisible();

  await page.getByRole('checkbox', { name: 'Select Élise' }).click();
  await page.getByRole('checkbox', { name: 'Select Marc' }).click();
  await page.getByRole('checkbox', { name: 'Select Zoé' }).click({ modifiers: ['Shift'] });
  await expect(page.getByRole('status').filter({ hasText: '3 selected' })).toBeVisible();

  await page.getByRole('button', { name: 'Tags' }).click();
  await page.getByRole('menuitem', { name: 'Add #family' }).click();
  await expect(page.getByText('Tagged 3 contacts #family')).toBeVisible();
  await expect(page.getByRole('toolbar')).toHaveCount(0); // selection mode ended

  await page.goto(`/contacts?tag=${ids.family}`);
  await expect(page.getByTestId('contact-name')).toHaveText(['Élise', 'Marc', 'Zoé']);

  // Undo from the toast brings back the previous state.
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('button', { name: /Select all/ }).click();
  await page.getByRole('button', { name: 'Tags' }).click();
  await page.getByRole('menuitem', { name: 'Remove #family' }).click();
  await expect(page.getByText(/Removed #family from 3 contacts/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('contact-name')).toHaveText(['Élise', 'Marc', 'Zoé']);
});

test('bulk archive and Trash apply to the selection; Escape leaves selection mode (AC-6, AC-7)', async ({
  page,
}) => {
  await seedBackup(page, data());
  await page.goto('/contacts');
  await page.getByRole('button', { name: 'Select' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('toolbar')).toHaveCount(0);

  await page.getByRole('button', { name: 'Select' }).click();
  const zoe = page.getByRole('checkbox', { name: 'Select Zoé' });
  await zoe.focus();
  await page.keyboard.press('Space');
  await expect(zoe).toBeChecked();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.getByText('Archived 1 contact')).toBeVisible();
  await expect(page.getByTestId('contact-name').filter({ hasText: 'Zoé' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: 'Select Marc' }).click();
  await page.getByRole('button', { name: 'Move to Trash' }).click();
  await expect(page.getByText('1 contact moved to Trash')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).last().click();
  await expect(page.getByTestId('contact-name').filter({ hasText: 'Marc' })).toBeVisible();
});

test('Year in review shows plain counts, ignores deleted records, and has an empty state (AC-8)', async ({
  page,
}) => {
  await seedBackup(page, {
    ...data(),
    moments: [
      ...data().moments,
      moment('Gone', '2026-04-01T10:00:00.000Z', {
        kind: 'call',
        deletedAt: '2026-05-01T00:00:00.000Z',
      }),
      moment('Last year', '2025-04-01T10:00:00.000Z'),
    ],
    gifts: [
      { id: randomUUID(), contactId: ids.lise, name: 'Book', status: 'given', date: '2026-02-02' },
    ],
  });
  await page.goto('/review/2026');
  await expect(page.getByRole('heading', { name: '6 moments' })).toBeVisible();
  const moments = page.getByRole('region', { name: '6 moments' });
  await expect(moments.getByText('Call', { exact: true }).locator('..')).toContainText('3');
  const people = page.getByRole('region', { name: 'People' });
  await expect(people).toContainText('People you wrote about2'); // Élise and Marc
  await expect(people).toContainText('New contacts4');
  await expect(page.getByRole('region', { name: 'Also this year' })).toContainText('Gifts given1');

  await page.getByLabel('Year', { exact: true }).selectOption('2025');
  await expect(page).toHaveURL(/\/review\/2025$/);
  await expect(page.getByRole('heading', { name: '1 moment' })).toBeVisible();

  await page.goto('/review/2010');
  await expect(page.getByText('Nothing recorded in 2010 yet.')).toBeVisible();
  await page.goto('/review/nonsense');
  await expect(page).toHaveURL(/\/review\/\d{4}$/);
});
