import type { BaseRecord } from '@/domain/types';
import type { Table } from 'dexie';
import { db } from '../db';
import { purgeContact, TRASH_RETENTION_DAYS } from './contactService';
import { purgeExpiredMergeSnapshots } from './mergeService';
import { purgeMoment } from './momentService';
import { deleteGiftPhotoBlobs } from './profileItems';

const softDeletableTables = () =>
  [
    db.contacts,
    db.contactFields,
    db.addresses,
    db.relationships,
    db.moments,
    db.reminders,
    db.importantDates,
    db.gifts,
    db.debts,
    db.tasks,
    db.pets,
    db.tags,
    db.groups,
  ] as Table<BaseRecord, string>[];

/** Purge everything that has been in Trash longer than the retention period. Runs on app start. */
export async function purgeExpiredTrash(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 86_400_000).toISOString();
  // Records that own blobs go through their purge functions so images are removed too.
  const contacts = await db.contacts.where('deletedAt').below(cutoff).primaryKeys();
  for (const id of contacts) await purgeContact(id);
  const moments = await db.moments.where('deletedAt').below(cutoff).primaryKeys();
  for (const id of moments) await purgeMoment(id);
  // Purged groups leave no dangling memberships.
  const groups = await db.groups.where('deletedAt').below(cutoff).primaryKeys();
  if (groups.length) {
    await db.contacts
      .where('groupIds')
      .anyOf(groups)
      .modify((c) => {
        c.groupIds = c.groupIds.filter((g) => !groups.includes(g));
      });
  }
  // Expired gifts take their photo (and thumbnail) with them.
  const gifts = await db.gifts.where('deletedAt').below(cutoff).toArray();
  await deleteGiftPhotoBlobs(gifts.flatMap((g) => (g.photoBlobId ? [g.photoBlobId] : [])));
  let purged = contacts.length + moments.length + (await purgeExpiredMergeSnapshots(now));
  for (const table of softDeletableTables()) {
    purged += await table.where('deletedAt').below(cutoff).delete();
  }
  return purged;
}
