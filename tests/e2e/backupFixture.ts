import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Records for `seedBackup`; every table is optional and rows get default timestamps. */
export type SeedData = Record<string, Array<Record<string, unknown>>>;

const STAMP = '2026-01-01T00:00:00.000Z';

const defaults: Record<string, Record<string, unknown>> = {
  contacts: { isStarred: false, isArchived: false, tagIds: [], groupIds: [] },
  moments: { contactIds: [], tagIds: [], photoBlobIds: [], isStarred: false },
};

/** Builds a Kin backup envelope (features §8.9) from minimal rows. */
export function makeBackup(data: SeedData, schemaVersion = 1) {
  const out: SeedData = {};
  for (const [table, rows] of Object.entries(data)) {
    out[table] = rows.map((r) => ({
      createdAt: STAMP,
      updatedAt: STAMP,
      ...defaults[table],
      ...r,
    }));
  }
  return { app: 'kin', schemaVersion, exportedAt: STAMP, includesPhotos: false, data: out };
}

/** Imports the given rows through Settings › Your data (Merge mode) so e2e tests can start from dated data. */
export async function seedBackup(page: Page, data: SeedData, schemaVersion?: number) {
  await page.goto('/settings/data');
  await page.getByLabel('Choose file').setInputFiles({
    name: 'seed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeBackup(data, schemaVersion))),
  });
  const dialog = page.getByRole('dialog', { name: 'Restore backup' });
  await dialog.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText(/Restored: \d+ added/)).toBeVisible();
}
