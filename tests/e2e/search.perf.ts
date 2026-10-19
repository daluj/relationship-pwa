import { generateDataset } from '../../scripts/seed';
import { expect, test } from './fixtures';

// Runs in its own Playwright project after all other tests, so timings aren't skewed by parallel workers.
test.use({ viewport: { width: 1366, height: 900 } });

test('search returns in < 100 ms with 2,000 contacts and 20,000 moments (SPEC §8.6 AC)', async ({
  page,
}) => {
  test.setTimeout(120_000);
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
