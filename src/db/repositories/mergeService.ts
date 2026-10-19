import type { Table } from 'dexie';
import { fullName } from '@/domain/contact';
import { normalizeEmail, normalizePhone } from '@/domain/duplicates';
import { replaceEntity } from '@/domain/momentText';
import type { Contact } from '@/domain/types';
import { db } from '../db';
import { deleteContact } from './contactService';
import { nowIso } from './createRepository';
import { contactRepo } from './entities';
import { RecordNotFoundError, ValidationError } from './errors';
import { refreshLastInteraction } from './momentService';
import { syncBirthdayReminder, syncStayInTouchReminder } from './reminderService';
import { indexContact, indexMoment, searchTables } from './searchService';

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
  ...searchTables(),
];

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
 * Merge `secondaryId` into `primaryId` (SPEC §8.2): the primary keeps its values and gains anything it is
 * missing; fields, addresses, relationships, moments (incl. mention tokens), reminders, important dates,
 * gifts, debts, tasks and pets move over (exact duplicates are dropped); the secondary is soft-deleted.
 */
export async function mergeContacts(primaryId: string, secondaryId: string): Promise<Contact> {
  if (primaryId === secondaryId) {
    throw new ValidationError('merge', [{ code: 'custom', path: [], message: 'same contact' }]);
  }
  return db.transaction('rw', mergeTables(), async () => {
    const primary = await contactRepo.get(primaryId);
    const secondary = await contactRepo.get(secondaryId);
    if (!primary) throw new RecordNotFoundError('contact', primaryId);
    if (!secondary) throw new RecordNotFoundError('contact', secondaryId);
    const now = nowIso();

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
    return (await contactRepo.get(primaryId))!;
  });
}
