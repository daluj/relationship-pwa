import { db } from '@/db/db';

/** Empty every table between tests (faster than deleting the database). */
export async function resetDb(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
