import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import { seedBackup } from './backupFixture';

// features §8.14: .ics import, merge undo, new locales, print view, live region.
test.use({ viewport: { width: 1366, height: 900 } });

const GOOGLE_ICS = path.resolve('tests/fixtures/google.ics');
const APPLE_ICS = path.resolve('tests/fixtures/apple.ics');

const lise = randomUUID();
const dupe = randomUUID();
const marc = randomUUID();

test('.ics import: preview with skip reasons, match an existing contact, create a new one (AC-1, AC-2)', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));
  await seedBackup(page, { contacts: [{ id: marc, firstName: 'Marc' }] });
  await page.goto('/settings/data');
  await page.getByLabel('Choose file').setInputFiles(GOOGLE_ICS);

  await expect(page.getByRole('heading', { name: 'Import from calendar' })).toBeVisible();
  const rows = page.getByTestId('ics-row');
  await expect(rows).toHaveCount(4);
  // The birthday is matched to the existing Marc by name.
  await expect(rows.nth(0).getByRole('combobox')).toHaveValue(`contact:${marc}`);
  // An anniversary has no person in its title, so it starts as Skip.
  await expect(rows.nth(1).getByRole('combobox')).toHaveValue('skip');
  // Timed and one-off events are listed with a reason and nothing to choose.
  await expect(rows.nth(2)).toContainText('Skipped: it has a time');
  await expect(rows.nth(3)).toContainText('Skipped: it does not repeat every year');
  await expect(rows.nth(2).getByRole('combobox')).toHaveCount(0);

  await page.getByRole('button', { name: 'Import 1' }).click();
  await expect(page.getByText('Added 1 birthdays and 0 dates (0 new contacts)')).toBeVisible();

  // The birthday and its reminder exist through the normal flow.
  await page.goto(`/c/${marc}`);
  await expect(page.getByText(/Born March 18, 1987/)).toBeVisible();
  await page.goto('/reminders');
  await expect(page.getByTestId('reminder-row').getByText('Marc turns 40')).toBeVisible();

  // A second file creates a contact that doesn't exist yet and leaves unknown rows untouched.
  await page.goto('/settings/data');
  await page.getByLabel('Choose file').setInputFiles(APPLE_ICS);
  const apple = page.getByTestId('ics-row');
  await expect(apple.nth(0).getByRole('combobox')).toHaveValue('create'); // Cumpleaños de Zoé
  await expect(apple.nth(1)).toContainText('Skipped: the date or title could not be read'); // Feb 30
  await page.getByRole('button', { name: 'Import 1' }).click();
  await expect(page.getByText('Added 1 birthdays and 0 dates (1 new contacts)')).toBeVisible();
  await page.goto('/contacts');
  await expect(page.getByTestId('contact-name')).toHaveText(['Marc', 'Zoé']);
});

test('.ics anniversary needs a person; choosing one adds an important date (AC-1)', async ({
  page,
}) => {
  await seedBackup(page, { contacts: [{ id: marc, firstName: 'Marc' }] });
  await page.goto('/settings/data');
  await page.getByLabel('Choose file').setInputFiles(GOOGLE_ICS);
  const row = page.getByTestId('ics-row').nth(1);
  await row.getByRole('button', { name: 'Add person' }).click();
  await row.getByRole('combobox', { name: 'Search people' }).fill('marc');
  await row.getByRole('combobox', { name: 'Search people' }).press('Enter');
  await expect(row.getByRole('combobox').first()).toHaveValue(`contact:${marc}`);
  await page.getByRole('button', { name: 'Import 2' }).click();
  await expect(page.getByText('Added 1 birthdays and 1 dates (0 new contacts)')).toBeVisible();
  await page.goto(`/c/${marc}/details`);
  await expect(
    page.getByTestId('center-column').getByText('Wedding anniversary, Élise & Marc').first(),
  ).toBeVisible();
});

test('merge → Undo from the toast and from Settings › Your data (AC-4, AC-5)', async ({ page }) => {
  await seedBackup(page, {
    contacts: [
      { id: lise, firstName: 'Élise', lastName: 'Aubert' },
      { id: dupe, firstName: 'Lise', nickname: 'lili' },
    ],
    gifts: [{ id: randomUUID(), contactId: dupe, name: 'Scarf', status: 'idea' }],
  });
  const merge = async () => {
    await page.goto(`/c/${dupe}`);
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Merge with…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Merge contacts' });
    await dialog.getByRole('button', { name: 'Add person' }).click();
    await dialog.getByRole('combobox', { name: 'Search people' }).fill('elis');
    await dialog.getByRole('combobox', { name: 'Search people' }).press('Enter');
    await dialog.getByLabel(/Élise Aubert/).check();
    await dialog.getByRole('button', { name: 'Merge', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(lise));
  };

  // Undo from the toast right after merging.
  await merge();
  await expect(page.getByText('Contacts merged')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Merge undone')).toBeVisible();
  await page.goto('/contacts');
  await expect(page.getByTestId('contact-name')).toHaveText(['Élise Aubert', 'Lise']);
  await page.goto(`/c/${dupe}/gifts`);
  await expect(page.getByTestId('gift-row')).toContainText('Scarf');

  // Merge again and undo later from Settings › Your data.
  await merge();
  await page.goto('/contacts');
  await expect(page.getByTestId('contact-name')).toHaveText(['Élise Aubert']);
  await page.goto(`/c/${lise}/gifts`);
  await expect(page.getByTestId('gift-row')).toContainText('Scarf');
  await page.goto('/settings/data');
  const recent = page.getByRole('region', { name: 'Recent merges' });
  await expect(recent).toContainText('Lise merged into Élise Aubert');
  await recent.getByRole('button', { name: /Undo merge/ }).click();
  await expect(page.getByText('Merge undone')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recent merges' })).toHaveCount(0);
  await page.goto('/contacts');
  await expect(page.getByTestId('contact-name')).toHaveText(['Élise Aubert', 'Lise']);

  // Merge again; editing the kept contact afterwards makes Undo refuse with a clear message.
  await merge();
  await page.goto(`/c/${lise}/edit`);
  await page.getByLabel('Short bio').fill('Edited after the merge');
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page).toHaveURL(new RegExp(`/c/${lise}$`));
  await page.goto('/settings/data');
  await page
    .getByRole('region', { name: 'Recent merges' })
    .getByRole('button', { name: /Undo merge/ })
    .click();
  await expect(
    page.getByText("Can't undo: one of these contacts was changed after the merge."),
  ).toBeVisible();
});

test('French, German and Portuguese work, persist across reloads, and set the page language (AC-6)', async ({
  page,
}) => {
  await page.goto('/settings');
  let current = 'Language'; // the select's label changes with the language
  const cases = [
    ['fr', 'Réglages', 'Langue'],
    ['de', 'Einstellungen', 'Sprache'],
    ['pt', 'Definições', 'Idioma'],
  ] as const;
  for (const [code, heading, label] of cases) {
    await page.getByRole('combobox', { name: current }).selectOption(code);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', code);
    await page.reload();
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    await expect(page.getByRole('combobox', { name: label })).toHaveValue(code);
    current = label;
  }
  // Dates and numbers follow the language too: the date field month names are localized.
  await page.goto('/contacts/new');
  await expect(page.getByRole('combobox', { name: 'Mês' }).first()).toContainText('janeiro');
});

test('Print profile hides the app chrome and prints a light sheet with the latest 10 moments (AC-7)', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('kin.theme', 'lights-out'));
  await seedBackup(page, {
    contacts: [
      {
        id: lise,
        firstName: 'Élise',
        lastName: 'Aubert',
        bio: 'Climber and baker',
        foodPreferences: 'Vegetarian',
        birthday: { month: 3, day: 18, year: 1987 },
      },
      { id: marc, firstName: 'Marc' },
    ],
    contactFields: [
      { id: randomUUID(), contactId: lise, type: 'email', value: 'lise@example.com' },
    ],
    relationships: [{ id: randomUUID(), fromContactId: lise, toContactId: marc, type: 'friend' }],
    moments: Array.from({ length: 12 }, (_, i) => ({
      id: randomUUID(),
      kind: 'note',
      body: `Printed moment ${String(i + 1).padStart(2, '0')}`,
      happenedAt: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
      contactIds: [lise],
    })),
  });
  await page.goto(`/c/${lise}`);
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Print profile' }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${lise}/print$`));

  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeHidden(); // screen-only controls
  const sheet = page.getByTestId('print-sheet');
  await expect(sheet.getByRole('heading', { name: 'Élise Aubert', level: 1 })).toBeVisible();
  await expect(sheet).toContainText('lise@example.com');
  await expect(sheet).toContainText('Vegetarian');
  await expect(sheet).toContainText('Marc · Friend');
  await expect(sheet).toContainText('Printed moment 12');
  await expect(sheet).toContainText('Printed moment 03');
  await expect(sheet).not.toContainText('Printed moment 02'); // only the latest 10
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(255, 255, 255)'); // light even though the app theme is dark
});

test('the shared live region speaks search result counts without moving focus (AC-8)', async ({
  page,
}) => {
  await seedBackup(page, {
    contacts: [
      { id: lise, firstName: 'Élise' },
      { id: marc, firstName: 'Élie' },
    ],
  });
  await page.goto('/search');
  const box = page.getByRole('main').getByRole('searchbox', { name: 'Search' });
  await box.fill('eli');
  const region = page.locator('[role="status"].sr-only');
  await expect(region).toHaveText('2 results');
  await expect(box).toBeFocused();
  await box.fill('elise');
  await expect(region).toHaveText('1 result');
  await expect(region).toHaveAttribute('aria-live', 'polite');
});
