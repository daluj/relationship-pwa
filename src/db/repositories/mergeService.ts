import type { Table } from 'dexie';
import { fullName } from '@/domain/contact';
import { normalizeEmail, normalizePhone } from '@/domain/duplicates';
import { replaceEntity } from '@/domain/momentText';
import type { Contact, MergeSnapshot } from '@/domain/types';
import { db } from '../db';
import { deleteContact } from './contactService';
import { nowIso } from './createRepository';
import { contactRepo, mergeSnapshotRepo } from './entities';
import { RecordNotFoundError, ValidationError } from './errors';
import { refreshLastInteraction } from './momentService';
import { syncBirthdayReminder, syncStayInTouchReminder } from './reminderService';
import { indexContact, indexMoment, searchTables } from './searchService';
import { TRASH_RETENTION_DAYS } from './contactService';

const mergeTables = () => [
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
  db.blobs,
  db.mergeSnapshots,
  ...searchTables(),
];

/** Tables whose rows belong to a contact through `contactId`, snapshotted for undo. */
const ownedTableNames = [
  'contactFields',
  'addresses',
  'importantDates',
  'gifts',
  'debts',
  'tasks',
  'pets',
  'reminders',
] as const;

const scalarKeys = [
  'lastName',
  'nickname',
  'gender',
  'pronouns',
  'avatarBlobId',
  'bannerBlobId',
  'bannerColor',
  'birthday',
  'isBirthdayYearKnown',
  'howWeMet',
  'bio',
  'jobTitle',
  'company',
  'foodPreferences',
  'stayInTouchDays',
  'deceasedDate',
] as const satisfies readonly (keyof Contact)[];

/**
 * Merge `secondaryId` into `primaryId` (features §8.2): the primary keeps its values and gains anything it is
 * missing; fields, addresses, relationships, moments (incl. mention tokens), reminders, important dates,
 * gifts, debts, tasks and pets move over (exact duplicates are dropped); the secondary is soft-deleted.
 */
export async function mergeContacts(primaryId: string, secondaryId: string): Promise<Contact> {
  return (await merge(primaryId, secondaryId, false)).contact;
}

/** Same merge, but records a snapshot so it can be undone for 30 days (features §8.14). */
export function mergeContactsUndoable(
  primaryId: string,
  secondaryId: string,
): Promise<{ contact: Contact; snapshotId: string }> {
  return merge(primaryId, secondaryId, true) as Promise<{ contact: Contact; snapshotId: string }>;
}

async function merge(
  primaryId: string,
  secondaryId: string,
  snapshot: boolean,
): Promise<{ contact: Contact; snapshotId?: string }> {
  if (primaryId === secondaryId) {
    throw new ValidationError('merge', [{ code: 'custom', path: [], message: 'same contact' }]);
  }
  return db.transaction('rw', mergeTables(), async () => {
    const primary = await contactRepo.get(primaryId);
    const secondary = await contactRepo.get(secondaryId);
    if (!primary) throw new RecordNotFoundError('contact', primaryId);
    if (!secondary) throw new RecordNotFoundError('contact', secondaryId);
    const now = nowIso();
    const before = snapshot ? await captureBefore(primaryId, secondaryId) : undefined;

    // 1. Contact record: fill gaps, union tags/groups.
    const fill = Object.fromEntries(
      scalarKeys
        .filter((k) => primary[k] === undefined && secondary[k] !== undefined)
        .map((k) => [k, secondary[k]]),
    );
    const merged = await contactRepo.update(primaryId, {
      ...fill,
      isStarred: primary.isStarred || secondary.isStarred,
      isDeceased: primary.isDeceased || secondary.isDeceased || undefined,
      tagIds: [...new Set([...primary.tagIds, ...secondary.tagIds])],
      groupIds: [...new Set([...primary.groupIds, ...secondary.groupIds])],
    });
    // Images the primary didn't take are still referenced by the secondary; they go when it's purged.

    // 2. Contact fields and addresses, minus exact duplicates.
    const key = (t: string, v: string) =>
      `${t}|${t === 'email' ? normalizeEmail(v) : t === 'phone' || t === 'whatsapp' ? normalizePhone(v) : v.trim().toLowerCase()}`;
    const have = new Set(
      (
        await db.contactFields
          .where('contactId')
          .equals(primaryId)
          .filter((f) => !f.deletedAt)
          .toArray()
      ).map((f) => key(f.type, f.value)),
    );
    await db.contactFields
      .where('contactId')
      .equals(secondaryId)
      .modify((f) => {
        if (f.deletedAt) return;
        const k = key(f.type, f.value);
        if (have.has(k)) {
          f.deletedAt = now;
        } else {
          have.add(k);
          f.contactId = primaryId;
          if (f.isPrimary) delete f.isPrimary;
        }
        f.updatedAt = now;
      });
    const addrKey = (a: { street?: string; city?: string; country?: string }) =>
      [a.street, a.city, a.country].map((x) => (x ?? '').trim().toLowerCase()).join('|');
    const haveAddr = new Set(
      (
        await db.addresses
          .where('contactId')
          .equals(primaryId)
          .filter((a) => !a.deletedAt)
          .toArray()
      ).map(addrKey),
    );
    const primaryHasCurrent = haveAddr.size > 0;
    await db.addresses
      .where('contactId')
      .equals(secondaryId)
      .modify((a) => {
        if (a.deletedAt) return;
        if (haveAddr.has(addrKey(a))) a.deletedAt = now;
        else {
          haveAddr.add(addrKey(a));
          a.contactId = primaryId;
          if (primaryHasCurrent) a.isCurrent = false;
        }
        a.updatedAt = now;
      });

    // 3. Simple dependents move over.
    const owned = [db.importantDates, db.gifts, db.debts, db.tasks, db.pets] as unknown as Table<
      { contactId: string; updatedAt: string },
      string
    >[];
    for (const table of owned) {
      await table
        .where('contactId')
        .equals(secondaryId)
        .modify((r) => {
          r.contactId = primaryId;
          r.updatedAt = now;
        });
    }

    // 4. Reminders: manual and important-date ones move; the secondary's auto birthday/stay-in-touch go.
    await db.reminders
      .where('contactId')
      .equals(secondaryId)
      .modify((r, ref) => {
        if (r.source === 'birthday' || r.source === 'stay-in-touch') {
          delete (ref as { value?: unknown }).value; // Dexie: deleting ctx.value deletes the row
          return;
        }
        r.contactId = primaryId;
        r.updatedAt = now;
      });

    // 5. Relationships: re-point both directions, then drop self-links and duplicates.
    await db.relationships
      .filter(
        (r) => !r.deletedAt && (r.fromContactId === secondaryId || r.toContactId === secondaryId),
      )
      .modify((r) => {
        if (r.fromContactId === secondaryId) r.fromContactId = primaryId;
        if (r.toContactId === secondaryId) r.toContactId = primaryId;
        r.updatedAt = now;
      });
    const seen = new Set<string>();
    await db.relationships
      .filter((r) => !r.deletedAt && (r.fromContactId === primaryId || r.toContactId === primaryId))
      .modify((r) => {
        const k = `${r.fromContactId}|${r.toContactId}|${r.type}`;
        if (r.fromContactId === r.toContactId || seen.has(k)) {
          r.deletedAt = now;
          r.updatedAt = now;
        } else seen.add(k);
      });

    // 6. Moments: contactIds and mention tokens; "introduced by" links on other contacts.
    const name = fullName(merged);
    const momentIds = await db.moments.where('contactIds').equals(secondaryId).primaryKeys();
    await db.moments
      .where('id')
      .anyOf(momentIds)
      .modify((m) => {
        m.contactIds = [...new Set(m.contactIds.map((c) => (c === secondaryId ? primaryId : c)))];
        m.body = replaceEntity(m.body, 'contact', secondaryId, primaryId, name);
        m.updatedAt = now;
      });
    await db.contacts
      .filter((c) => c.howWeMet?.introducedById === secondaryId)
      .modify((c) => {
        c.howWeMet = { ...c.howWeMet, introducedById: primaryId };
        c.updatedAt = now;
      });

    // 7. Retire the secondary (cascades whatever is left), then refresh derived data.
    await deleteContact(secondaryId);
    const final = (await contactRepo.get(primaryId))!;
    await syncBirthdayReminder(final, primary.birthday);
    await refreshLastInteraction([primaryId]);
    await syncStayInTouchReminder((await contactRepo.get(primaryId))!);
    await indexContact(primaryId);
    for (const id of momentIds) await indexMoment(id);
    const contact = (await contactRepo.get(primaryId))!;
    if (!before) return { contact };
    const retired = (await db.contacts.get(secondaryId))!;
    const record = await mergeSnapshotRepo.create({
      primaryId,
      secondaryId,
      mergedAt: now,
      primaryUpdatedAt: contact.updatedAt,
      secondaryDeletedAt: retired.deletedAt!,
      before,
    });
    return { contact, snapshotId: record.id };
  });
}

/** Rows the merge may change, as they are now: both contacts, their dependents, moments and introducers. */
async function captureBefore(
  primaryId: string,
  secondaryId: string,
): Promise<Record<string, Record<string, unknown>[]>> {
  const ids = [primaryId, secondaryId];
  const rows = (r: unknown[]) => r as Record<string, unknown>[];
  const before: Record<string, Record<string, unknown>[]> = {
    contacts: rows([
      ...(await db.contacts.bulkGet(ids)),
      ...(await db.contacts.filter((c) => c.howWeMet?.introducedById === secondaryId).toArray()),
    ]),
    relationships: rows(
      await db.relationships
        .filter((r) => ids.includes(r.fromContactId) || ids.includes(r.toContactId))
        .toArray(),
    ),
    moments: rows(await db.moments.where('contactIds').anyOf(ids).distinct().toArray()),
  };
  for (const name of ownedTableNames) {
    before[name] = rows(await db.table(name).where('contactId').anyOf(ids).toArray());
  }
  return before;
}

export class MergeUndoError extends Error {
  constructor(readonly code: 'missing' | 'expired' | 'changed') {
    super(code);
    this.name = 'MergeUndoError';
  }
}

/**
 * Put both contacts and everything the merge touched back exactly as it was (features §8.14 AC-4).
 * Refused when the snapshot is gone or older than 30 days, or when either contact changed since the
 * merge (AC-5), because undoing would silently discard those changes.
 */
export async function undoMerge(snapshotId: string, now = new Date()): Promise<void> {
  await db.transaction('rw', mergeTables(), async () => {
    const snap = await db.mergeSnapshots.get(snapshotId);
    if (!snap || snap.deletedAt) throw new MergeUndoError('missing');
    const age = now.getTime() - new Date(snap.mergedAt).getTime();
    if (age > TRASH_RETENTION_DAYS * 86_400_000) throw new MergeUndoError('expired');
    const primary = await db.contacts.get(snap.primaryId);
    const secondary = await db.contacts.get(snap.secondaryId);
    if (
      !primary ||
      primary.deletedAt ||
      primary.updatedAt !== snap.primaryUpdatedAt ||
      !secondary ||
      secondary.deletedAt !== snap.secondaryDeletedAt
    ) {
      throw new MergeUndoError('changed');
    }
    const ids = [snap.primaryId, snap.secondaryId];

    // Rows created by the merge (e.g. a birthday reminder for the primary) go; the originals come back.
    for (const name of ownedTableNames) {
      const kept = new Set((snap.before[name] ?? []).map((r) => r.id as string));
      await db
        .table(name)
        .where('contactId')
        .anyOf(ids)
        .filter((r: { id: string }) => !kept.has(r.id))
        .delete();
    }
    for (const [table, rows] of Object.entries(snap.before)) {
      if (rows.length) await db.table(table).bulkPut(rows);
    }
    await db.mergeSnapshots.delete(snapshotId);

    // Derived data follows the restored rows.
    for (const id of ids) await indexContact(id);
    for (const m of snap.before.moments ?? []) await indexMoment(m.id as string);
  });
}

export interface MergeHistoryEntry {
  id: string;
  mergedAt: string;
  primaryName: string;
  secondaryName: string;
}

/** Merges that can still be undone, newest first. */
export async function listMergeHistory(now = new Date()): Promise<MergeHistoryEntry[]> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 86_400_000).toISOString();
  const snaps = (
    await db.mergeSnapshots.filter((s) => !s.deletedAt && s.mergedAt >= cutoff).toArray()
  ).sort((a, b) => b.mergedAt.localeCompare(a.mergedAt));
  const name = async (id: string) => {
    const c = await db.contacts.get(id);
    return c ? fullName(c) : '?';
  };
  return Promise.all(
    snaps.map(async (s: MergeSnapshot) => ({
      id: s.id,
      mergedAt: s.mergedAt,
      primaryName: await name(s.primaryId),
      secondaryName: await name(s.secondaryId),
    })),
  );
}

/** Drops snapshots past the retention period (run with the Trash sweep). */
export async function purgeExpiredMergeSnapshots(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 86_400_000).toISOString();
  const old = await db.mergeSnapshots.where('mergedAt').below(cutoff).primaryKeys();
  await db.mergeSnapshots.bulkDelete(old);
  return old.length;
}
