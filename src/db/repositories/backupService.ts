import type { Table } from 'dexie';
import {
  BACKUP_SCHEMA_VERSION,
  backupTables,
  type BackupTable,
  type ParsedBackup,
} from '@/domain/backup';
import type { BaseRecord, BlobRecord } from '@/domain/types';
import { base64ToBlob, blobToBase64 } from '@/lib/base64';
import { db } from '../db';
import { nowIso } from './createRepository';
import { rebuildSearchIndex } from './searchService';
import { settingsRepo } from './settingsRepo';

const tableOf = (name: Exclude<BackupTable, 'blobs'>) =>
  db.table(name) as Table<Record<string, unknown>, string>;

/**
 * Full JSON backup (SPEC §8.9), streamed into a Blob part by part — records are serialized one by one
 * from cursors and blobs base64-encoded individually, so large datasets never need one giant string.
 */
export async function exportBackup({ includePhotos = true } = {}): Promise<Blob> {
  const exportedAt = nowIso();
  const parts: BlobPart[] = [
    `{"app":"kin","schemaVersion":${BACKUP_SCHEMA_VERSION},"exportedAt":${JSON.stringify(exportedAt)},"includesPhotos":${includePhotos},"data":{`,
  ];
  for (const [i, name] of backupTables.entries()) {
    parts.push(`${i ? ',' : ''}${JSON.stringify(name)}:[`);
    let first = true;
    await tableOf(name).each((row) => {
      parts.push((first ? '' : ',') + JSON.stringify(row));
      first = false;
    });
    parts.push(']');
  }
  parts.push(',"blobs":[');
  if (includePhotos) {
    const ids = await db.blobs.toCollection().primaryKeys();
    for (const [i, id] of ids.entries()) {
      const b = await db.blobs.get(id);
      if (!b) continue;
      const { data, ...meta } = b;
      parts.push((i ? ',' : '') + JSON.stringify({ ...meta, base64: await blobToBase64(data) }));
    }
  }
  parts.push(']}}');
  await settingsRepo.set('lastBackupAt', exportedAt);
  return new Blob(parts, { type: 'application/json' });
}

export interface ImportSummary {
  added: number;
  updated: number;
  skipped: number;
}

const toBlobRecord = (b: Record<string, unknown>): BlobRecord => {
  const { base64, ...meta } = b as unknown as Omit<BlobRecord, 'data'> & { base64: string };
  return { ...meta, data: base64ToBlob(base64, meta.mime) };
};

/**
 * Restore a parsed backup (SPEC §8.9):
 * - `replace`: wipe everything, then load the backup (typed confirmation in the UI);
 * - `merge`: by id — records missing locally are added, newer `updatedAt` wins; local settings are kept.
 * The search index is rebuilt afterwards.
 */
export async function importBackup(
  backup: ParsedBackup,
  mode: 'replace' | 'merge',
): Promise<ImportSummary> {
  const summary: ImportSummary = { added: 0, updated: 0, skipped: 0 };
  const blobs = (backup.blobs as Record<string, unknown>[]).map(toBlobRecord);
  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      await Promise.all(db.tables.map((t) => t.clear()));
      for (const name of backupTables) {
        const rows = backup[name] as Record<string, unknown>[];
        await tableOf(name).bulkPut(rows);
        summary.added += rows.length;
      }
      await db.blobs.bulkPut(blobs);
      return;
    }
    for (const name of backupTables) {
      if (name === 'settings') continue;
      const rows = backup[name] as (BaseRecord & Record<string, unknown>)[];
      const existing = await tableOf(name).bulkGet(rows.map((r) => r.id));
      const put: Record<string, unknown>[] = [];
      rows.forEach((row, i) => {
        const cur = existing[i] as BaseRecord | undefined;
        if (!cur) {
          put.push(row);
          summary.added++;
        } else if (row.updatedAt > cur.updatedAt) {
          put.push(row);
          summary.updated++;
        } else summary.skipped++;
      });
      await tableOf(name).bulkPut(put);
    }
    const haveBlobs = new Set(await db.blobs.toCollection().primaryKeys());
    await db.blobs.bulkPut(blobs.filter((b) => !haveBlobs.has(b.id)));
  });
  await rebuildSearchIndex();
  return summary;
}

/** "Delete all data" (SPEC §8.10): every table, including settings and the search index. */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

/** Record counts per table (for import previews and the round-trip check). */
export async function recordCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const name of [...backupTables, 'blobs'] as const) out[name] = await db.table(name).count();
  return out;
}

/**
 * Roughly when the user's data started, for the backup nudge: the oldest `updatedAt` among contacts.
 * One indexed read (no full scan, so app start stays fast with large datasets); never earlier than the
 * true start, so the nudge can only be late, never early.
 */
export async function dataSince(): Promise<string | undefined> {
  return (await db.contacts.orderBy('updatedAt').first())?.updatedAt;
}
