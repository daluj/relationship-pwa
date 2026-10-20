import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const PHOTO = path.resolve('public/icons/icon-512.png');
const IOS_VCF = path.resolve('tests/fixtures/ios.vcf');

test.use({ viewport: { width: 1366, height: 900 } });
test.beforeEach(async ({ page }) => {
  // Force the <a download> path so Playwright can capture files.
  await page.addInitScript(() => {
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined;
  });
});

async function createContact(page: Page, firstName: string, lastName = '', email = '') {
  await page.goto('/contacts/new');
  await page.getByLabel('First name').fill(firstName);
  if (lastName) await page.getByLabel('Last name').fill(lastName);
  if (email) {
    await page.getByRole('button', { name: 'Add contact info' }).click();
    await page.getByLabel('Type').selectOption('email');
    await page.getByLabel('Value', { exact: true }).fill(email);
  }
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
  return page.url();
}

async function download(page: Page, click: () => Promise<void>) {
  const d = page.waitForEvent('download');
  await click();
  const file = await d;
  return {
    name: file.suggestedFilename(),
    path: (await file.path())!,
    text: await fs.readFile((await file.path())!, 'utf8'),
  };
}

test('backup round trip: export → delete all → restore gives the same data (features §8.9 AC)', async ({
  page,
}) => {
  // Data: a contact with a photo and a moment.
  await page.goto('/contacts/new');
  await page.getByLabel('First name').fill('Élise');
  await page.getByLabel('Profile photo').setInputFiles(PHOTO);
  await page
    .getByRole('dialog', { name: 'Crop photo' })
    .getByRole('button', { name: 'Apply' })
    .click();
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page).toHaveURL(/\/c\//);
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'What happened?' });
  await box.pressSequentially('Coffee with @eli');
  await box.press('Enter');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('moment-card')).toHaveCount(1);

  await page.goto('/settings/data');
  await expect(page.getByTestId('last-backup')).toHaveText("You haven't made a backup yet.");
  const backup = await download(page, () =>
    page.getByRole('button', { name: 'Full backup (.json)' }).click(),
  );
  expect(backup.name).toMatch(/^kin-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const json = JSON.parse(backup.text) as {
    app: string;
    data: { contacts: unknown[]; moments: unknown[]; blobs: unknown[] };
  };
  expect(json.app).toBe('kin');
  expect(json.data.contacts).toHaveLength(1);
  expect(json.data.blobs.length).toBeGreaterThan(0);
  await expect(page.getByTestId('last-backup')).toHaveText(/Last backup (now|today)/);

  // Delete everything (typed confirmation).
  await page.getByRole('button', { name: 'Delete all data' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete everything?' });
  await expect(confirm.getByRole('button', { name: 'Delete all data' })).toBeDisabled();
  await confirm.getByLabel('Type DELETE').fill('DELETE');
  await confirm.getByRole('button', { name: 'Delete all data' }).click();
  // Everything is gone, so the app starts over with onboarding (features §8.1).
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: 'Welcome to Kin' })).toBeVisible();

  // Restore with "Replace everything".
  await page.goto('/settings/data');
  await page.getByLabel('Choose file').setInputFiles(backup.path);
  const dialog = page.getByRole('dialog', { name: 'Restore backup' });
  await expect(dialog).toContainText('1 contacts · 1 moments');
  await dialog.getByText('Replace everything').click();
  await expect(dialog.getByRole('button', { name: 'Restore' })).toBeDisabled();
  await dialog.getByLabel('Type REPLACE').fill('REPLACE');
  await dialog.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText(/Restored: \d+ added/)).toBeVisible();

  await page.goto('/');
  await expect(page.getByTestId('moment-card')).toContainText('Coffee with');
  await expect(page.getByTestId('moment-card').getByRole('link', { name: '@Élise' })).toBeVisible();
  await page.getByTestId('moment-card').getByRole('link', { name: '@Élise' }).click();
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible(); // photo restored
});

test('vCard import: preview with duplicate warning, merge and import; NOTE becomes a moment', async ({
  page,
}) => {
  const existing = await createContact(page, 'Élise', 'Aubert', 'lise@example.com');
  // The fixture's PHOTO is a stub; swap in a real image so the avatar path is exercised.
  const realPhoto = (await fs.readFile(PHOTO)).toString('base64');
  const vcfText = (await fs.readFile(IOS_VCF, 'utf8')).replace(
    /PHOTO;ENCODING=b;TYPE=JPEG:[\s\S]*?\r\nEND:VCARD/,
    `PHOTO;ENCODING=b;TYPE=PNG:${realPhoto}\r\nEND:VCARD`,
  );
  await page.goto('/settings/data');
  await page
    .getByLabel('Choose file')
    .setInputFiles({ name: 'contacts.vcf', mimeType: 'text/vcard', buffer: Buffer.from(vcfText) });
  const rows = page.getByTestId('import-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Possible duplicate of Élise Aubert (same email)');
  await expect(rows.nth(0).getByRole('combobox')).toHaveValue(/^merge:/);
  await expect(rows.nth(1).getByRole('combobox')).toHaveValue('import');
  await page.getByRole('button', { name: 'Import 2 contacts' }).click();
  await expect(page.getByText('1 imported, 1 merged, 0 skipped')).toBeVisible();
  await expect(page).toHaveURL(/\/contacts$/);
  await expect(page.getByTestId('contact-name')).toHaveText(['Élise Aubert', 'Marc']); // É sorts as E

  await page.goto(existing);
  await expect(page.getByText('@lise', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('moment-card')).toContainText("Met at Marc's wedding.");
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible(); // avatar from the vCard photo

  // Export this contact back as a vCard from the profile menu.
  await page.getByRole('button', { name: 'More options' }).click();
  const vcf = await download(page, () =>
    page.getByRole('menuitem', { name: 'Export vCard' }).click(),
  );
  expect(vcf.name).toBe('Élise Aubert.vcf');
  expect(vcf.text).toContain('FN:Élise Aubert');
  expect(vcf.text).toContain('EMAIL:lise@example.com');
});

test('CSV import with column mapping (Google headers) and CSV export', async ({
  page,
}, testInfo) => {
  const csv = testInfo.outputPath('google.csv');
  await fs.writeFile(
    csv,
    '\uFEFFName,Given Name,Family Name,E-mail 1 - Type,E-mail 1 - Value,Phone 1 - Value,Birthday,Mystery\n' +
      'Zoé Martin,Zoé,Martin,* Home,zoe@example.com,+44 20 ::: +33 1,--07-02,x\n' +
      ',,,,,,,\n',
  );
  await page.goto('/settings/data');
  await page.getByLabel('Choose file').setInputFiles(csv);
  await expect(page.getByRole('heading', { name: 'Match columns' })).toBeVisible();
  await expect(page.getByLabel('Kin field: E-mail 1 - Value')).toHaveValue('email');
  await expect(page.getByLabel('Kin field: E-mail 1 - Type')).toHaveValue('ignore');
  await expect(page.getByLabel('Kin field: Mystery')).toHaveValue('ignore');
  await page.getByLabel('Kin field: Mystery').selectOption('notes');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('import-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Import 1 contact' }).click();
  await expect(page.getByTestId('contact-name')).toHaveText(['Zoé Martin']);

  await page.goto('/settings/data');
  const out = await download(page, () =>
    page.getByRole('button', { name: 'Contacts (.csv)' }).click(),
  );
  expect(out.text).toContain('First Name,Last Name');
  expect(out.text).toContain('Zoé,Martin,,zoe@example.com,+44 20 ::: +33 1');
  expect(out.text).toContain('--07-02');
});

test('duplicate warning on create → Save and merge; Merge with… from the profile', async ({
  page,
}) => {
  const elise = await createContact(page, 'Élise', 'Aubert', 'lise@example.com');
  await page.goto('/contacts/new');
  await page.getByLabel('First name').fill('Lise');
  await page.getByRole('button', { name: 'Add contact info' }).click();
  await page.getByLabel('Type').selectOption('email');
  await page.getByLabel('Value', { exact: true }).fill('LISE@example.com');
  const warning = page.getByTestId('duplicate-warning');
  await expect(warning).toContainText('Élise Aubert is already in your contacts (same email).');
  await page.getByLabel('Nickname').fill('lili');
  await warning.getByRole('button', { name: 'Save and merge' }).click();
  await expect(page).toHaveURL(elise);
  await expect(page.getByText('@lili', { exact: true })).toBeVisible();
  await page.goto('/contacts');
  await expect(page.getByTestId('contact-name')).toHaveText(['Élise Aubert']);

  const marc = await createContact(page, 'Marc');
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Merge with…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Merge contacts' });
  await dialog.getByRole('button', { name: 'Add person' }).click();
  await dialog.getByRole('combobox', { name: 'Search people' }).fill('eli');
  await expect(page.getByRole('option', { name: /Create contact/ })).toHaveCount(0);
  await dialog.getByRole('combobox', { name: 'Search people' }).press('Enter');
  await dialog.getByLabel(/Élise Aubert/).check();
  await dialog.getByRole('button', { name: 'Merge' }).click();
  await expect(page).toHaveURL(elise);
  await page.goto('/contacts');
  await expect(page.getByTestId('contact-name')).toHaveText(['Élise Aubert']);
  await page.goto(marc);
  await expect(page.getByText("This contact doesn't exist or was deleted.")).toBeVisible();
});

test('backup nudge after 30 days without a backup; "Not now" hides it', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-01T10:00:00'));
  await createContact(page, 'Ana');
  await page.goto('/');
  const nudge = page.getByRole('region', { name: 'Back up your data' });
  await expect(nudge).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-10-05T10:00:00'));
  await page.reload();
  await expect(nudge).toBeVisible();
  await nudge.getByRole('button', { name: 'Not now' }).click();
  await expect(nudge).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  await expect(nudge).toHaveCount(0);
});

test('share target: shared .vcf files open the import preview; shared text opens the composer (pwa §9)', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // controlled by the SW
  const vcf = await fs.readFile(IOS_VCF, 'utf8');
  const fileRedirect = await page.evaluate(async (text) => {
    const form = new FormData();
    form.append('files', new File([text], 'contacts.vcf', { type: 'text/vcard' }));
    const res = await fetch('/share-target', { method: 'POST', body: form });
    return new URL(res.url).pathname + new URL(res.url).search;
  }, vcf);
  expect(fileRedirect).toBe('/settings/data?shared=1');
  await page.goto('/settings/data?shared=1');
  await expect(page.getByTestId('import-row')).toHaveCount(2);

  const textRedirect = await page.evaluate(async () => {
    const form = new FormData();
    form.append('text', 'Remember to call Ana');
    const res = await fetch('/share-target', { method: 'POST', body: form });
    return new URL(res.url).pathname + new URL(res.url).search;
  });
  expect(textRedirect).toBe('/compose?text=Remember%20to%20call%20Ana');
  await page.goto(textRedirect);
  await expect(
    page
      .getByRole('dialog', { name: 'Log moment' })
      .getByRole('combobox', { name: 'What happened?' }),
  ).toHaveValue('Remember to call Ana');
});

test('bad import files show a clear error', async ({ page }, testInfo) => {
  const bad = testInfo.outputPath('not-kin.json');
  await fs.writeFile(bad, '{"hello":"world"}');
  await page.goto('/settings/data');
  await page.getByLabel('Choose file').setInputFiles(bad);
  await expect(page.getByRole('alert')).toHaveText("This isn't a Kin backup file.");
  const txt = testInfo.outputPath('notes.txt');
  await fs.writeFile(txt, 'hi');
  await page.getByLabel('Choose file').setInputFiles(txt);
  await expect(page.getByRole('alert')).toHaveText(
    "That file type isn't supported. Use .json, .vcf or .csv.",
  );
});
