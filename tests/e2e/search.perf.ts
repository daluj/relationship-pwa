import { generateDataset } from '../../scripts/seed';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Runs in its own Playwright project after all other tests, so timings aren't skewed by parallel workers.
test.use({ viewport: { width: 1366, height: 900 } });

async function loadDataset(page: Page) {
  const data = generateDataset({ contacts: 2000, moments: 20000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();

  // Bulk-load straight into IndexedDB (the app already created the schema).
  await page.evaluate(async (d) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('kin');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['contacts', 'moments', 'searchIndex', 'settings'], 'readwrite');
      for (const c of d.contacts) tx.objectStore('contacts').put(c);
      for (const m of d.moments) tx.objectStore('moments').put(m);
      for (const s of d.searchIndex) tx.objectStore('searchIndex').put(s);
      tx.objectStore('settings').put({ key: 'searchIndexVersion', value: 1 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, data);
}

test('search returns in < 100 ms with 2,000 contacts and 20,000 moments (features §8.6 AC)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loadDataset(page);
  await page.goto('/search');
  const box = page.getByRole('main').getByRole('searchbox', { name: 'Search' });
  const timings: Record<string, number> = {};
  for (const q of ['eli', 'lyon coffee', 'marc dupont', 'wedding plans', 'gar']) {
    await page.evaluate(() => performance.clearMeasures('kin-search'));
    await box.fill(q);
    await expect(page.getByTestId('search-results')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => performance.getEntriesByName('kin-search').length))
      .toBeGreaterThan(0);
    timings[q] = await page.evaluate(
      (query) =>
        Math.max(
          ...performance
            .getEntriesByName('kin-search')
            .filter((e) => (e as PerformanceMeasure).detail?.q === query)
            .map((e) => e.duration),
        ),
      q,
    );
  }
  console.log('search timings (ms):', timings);
  for (const [q, ms] of Object.entries(timings)) expect(ms, `"${q}"`).toBeLessThan(100);
  await expect(
    page.getByTestId('search-results').getByTestId('contact-name').first(),
  ).toBeVisible();
});

test('On this day returns in < 100 ms with 2,000 contacts and 20,000 moments (features §8.11)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loadDataset(page);
  await page.goto('/');
  const count = () => page.evaluate(() => performance.getEntriesByName('kin-on-this-day').length);
  await expect.poll(count).toBeGreaterThan(0);
  // The first run overlaps start-up work (D-060, D-053), so re-mount Home and time that run.
  const before = await count();
  await page.getByRole('navigation').getByRole('link', { name: 'Search' }).first().click();
  await page.getByRole('navigation').getByRole('link', { name: 'Home' }).first().click();
  await expect.poll(count).toBeGreaterThan(before);
  const ms = await page.evaluate(
    () => performance.getEntriesByName('kin-on-this-day').at(-1)!.duration,
  );
  console.log('on this day (ms):', ms);
  expect(ms).toBeLessThan(100);
});

test('filtered search returns in < 100 ms with 2,000 contacts and 20,000 moments (features §8.13 AC-10)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loadDataset(page);
  await page.goto('/search');
  const count = () => page.evaluate(() => performance.getEntriesByName('kin-search').length);
  const last = () =>
    page.evaluate(() => performance.getEntriesByName('kin-search').at(-1)!.duration);
  const timings: Record<string, number> = {};
  const step = async (name: string, act: () => Promise<unknown>) => {
    const before = await count();
    await act();
    await expect.poll(count).toBeGreaterThan(before);
    await expect(page.getByTestId('search-results')).toBeVisible();
    await page.waitForTimeout(150); // let the final query of the step settle
    timings[name] = await last();
  };

  await step('text', () => page.getByRole('main').getByRole('searchbox').fill('lyon'));
  await page.getByRole('button', { name: 'Filters' }).click();
  await step('text + kind', () => page.getByRole('checkbox', { name: 'Activity' }).click());
  await step('text + kind + from', () =>
    page
      .getByLabel('From', { exact: true })
      .fill(new Date(Date.now() - 200 * 86_400_000).toISOString().slice(0, 10)),
  );
  await step('kind + date, no text', () => page.getByRole('main').getByRole('searchbox').fill(''));
  await step('not contacted', async () => {
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByLabel('Not contacted in').selectOption('90');
  });
  console.log('filtered search timings (ms):', timings);
  for (const [name, ms] of Object.entries(timings)) expect(ms, name).toBeLessThan(100);
});
