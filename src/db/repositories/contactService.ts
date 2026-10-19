import type { Table } from 'dexie';
import type { Address, BaseRecord, Contact, ContactField } from '@/domain/types';
import { db } from '../db';
import { blobRepo } from './blobRepo';
import { nowIso, type CreateInput } from './createRepository';
import { addressRepo, contactFieldRepo, contactRepo } from './entities';
import { syncBirthdayReminder, syncStayInTouchReminder } from './reminderService';
import {
  indexContact,
  reindexMomentsForContact,
  removeContactFromIndex,
  searchTables,
} from './searchService';
import { fullName } from '@/domain/contact';
import { RecordNotFoundError } from './errors';

/** Days a soft-deleted record stays in Trash before it is purged (SPEC §5.1). */
export const TRASH_RETENTION_DAYS = 30;

export interface NewImage {
  data: Blob;
  mime: string;
  width: number;
  height: number;
}

type FieldDraft = Pick<ContactField, 'type' | 'value'> &
  Partial<Pick<ContactField, 'id' | 'label' | 'isPrimary'>>;
type AddressDraft = Omit<Address, keyof BaseRecord | 'contactId'> & { id?: string };

export interface ContactDraft {
  contact: Omit<CreateInput<Contact, 'isStarred' | 'isArchived' | 'tagIds' | 'groupIds'>, 'id'>;
  fields: FieldDraft[];
  addresses: AddressDraft[];
  /** `undefined` keeps the current image, `null` removes it. */
  avatar?: NewImage | null;
  banner?: NewImage | null;
}

/** Tables holding records that belong to one contact via `contactId`. */
const dependentTables = () =>
  [
    db.contactFields,
    db.addresses,
    db.reminders,
    db.importantDates,
    db.gifts,
    db.debts,
    db.tasks,
    db.pets,
  ] as Table<BaseRecord & { contactId?: string }, string>[];

async function storeImage(img: NewImage | null | undefined, currentId: string | undefined) {
  if (img === undefined) return currentId;
  if (currentId) await blobRepo.delete(currentId);
  return img ? (await blobRepo.put({ ...img, size: img.data.size })).id : undefined;
}

/** Diff a list of child drafts against stored rows: update kept, create new, soft-delete removed. */
async function syncChildren<
  T extends BaseRecord & { contactId: string },
  D extends { id?: string },
>(
  contactId: string,
  table: Table<T, string>,
  drafts: D[],
  repo: {
    create: (input: never) => Promise<T>;
    update: (id: string, patch: never) => Promise<T>;
    softDelete: (id: string) => Promise<void>;
  },
): Promise<void> {
  const current = (await table.where('contactId').equals(contactId).toArray()).filter(
    (r) => !r.deletedAt,
  );
  const keep = new Set(drafts.map((d) => d.id).filter(Boolean));
  for (const row of current) if (!keep.has(row.id)) await repo.softDelete(row.id);
  for (const { id, ...rest } of drafts) {
    if (id && current.some((r) => r.id === id)) await repo.update(id, rest as never);
    else await repo.create({ ...rest, contactId } as never);
  }
}

const saveTables = () => [
  db.contacts,
  db.contactFields,
  db.addresses,
  db.reminders,
  db.blobs,
  ...searchTables(),
];

/** Create or update a contact together with its fields, addresses and images, atomically. */
export async function saveContact(id: string | undefined, draft: ContactDraft): Promise<Contact> {
  return db.transaction('rw', saveTables(), async () => {
    const before = id ? await contactRepo.get(id) : undefined;
    if (id && !before) throw new RecordNotFoundError('contact', id);

    const avatarBlobId = await storeImage(draft.avatar, before?.avatarBlobId);
    const bannerBlobId = await storeImage(draft.banner, before?.bannerBlobId);
    const data = { ...draft.contact, avatarBlobId, bannerBlobId };

    const contact = before
      ? await contactRepo.update(before.id, {
          // Explicitly clear optional fields the form left empty.
          ...Object.fromEntries(optionalContactKeys.map((k) => [k, undefined])),
          ...data,
        })
      : await contactRepo.create(data);

    await syncChildren(contact.id, db.contactFields, draft.fields, contactFieldRepo);
    await syncChildren(contact.id, db.addresses, draft.addresses, addressRepo);
    await syncBirthdayReminder(contact, before?.birthday);
    await syncStayInTouchReminder(contact);
    await indexContact(contact.id);
    if (before && fullName(before) !== fullName(contact))
      await reindexMomentsForContact(contact.id);
    return contact;
  });
}

/** Optional Contact fields edited by the contact form. */
const optionalContactKeys = [
  'lastName',
  'nickname',
  'gender',
  'pronouns',
  'bannerColor',
  'birthday',
  'isBirthdayYearKnown',
  'howWeMet',
  'bio',
  'jobTitle',
  'company',
  'foodPreferences',
  'deceasedDate',
  'stayInTouchDays',
] as const satisfies readonly (keyof Contact)[];

/** Archive/unarchive or mark deceased — also starts/stops the stay-in-touch reminder. */
export async function updateContactStatus(
  id: string,
  patch: Partial<Pick<Contact, 'isArchived' | 'isDeceased' | 'deceasedDate'>>,
): Promise<Contact> {
  return db.transaction('rw', [db.contacts, db.reminders], async () => {
    const c = await contactRepo.update(id, patch);
    await syncStayInTouchReminder(c);
    return c;
  });
}

/** Soft-delete a contact and its dependents with one shared tombstone timestamp (SPEC §5.2). */
export async function deleteContact(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.contacts, db.relationships, ...dependentTables(), ...searchTables()],
    async () => {
      const contact = await db.contacts.get(id);
      if (!contact) throw new RecordNotFoundError('contact', id);
      if (contact.deletedAt) return;
      await removeContactFromIndex(id);
      const now = nowIso();
      const tombstone = (r: BaseRecord) => {
        r.deletedAt = now;
        r.updatedAt = now;
      };
      await db.contacts.update(id, { deletedAt: now, updatedAt: now });
      for (const table of dependentTables()) {
        await table
          .where('contactId')
          .equals(id)
          .filter((r) => !r.deletedAt)
          .modify(tombstone);
      }
      await db.relationships
        .filter((r) => !r.deletedAt && (r.fromContactId === id || r.toContactId === id))
        .modify(tombstone);
    },
  );
}

/** Restore a contact and exactly the dependents its delete tombstoned (same `deletedAt`). */
export async function restoreContact(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.contacts, db.relationships, ...dependentTables(), ...searchTables()],
    async () => {
      const contact = await db.contacts.get(id);
      if (!contact) throw new RecordNotFoundError('contact', id);
      const stamp = contact.deletedAt;
      if (!stamp) return;
      const now = nowIso();
      const revive = (r: BaseRecord) => {
        delete r.deletedAt;
        r.updatedAt = now;
      };
      await db.contacts.where('id').equals(id).modify(revive);
      for (const table of dependentTables()) {
        await table
          .where('contactId')
          .equals(id)
          .filter((r) => r.deletedAt === stamp)
          .modify(revive);
      }
      await db.relationships
        .filter((r) => r.deletedAt === stamp && (r.fromContactId === id || r.toContactId === id))
        .modify(revive);
      await indexContact(id);
    },
  );
}

/** Permanently delete a contact, its dependents and images, and unlink it from moments. */
export async function purgeContact(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.contacts, db.relationships, db.moments, db.blobs, ...dependentTables(), ...searchTables()],
    async () => {
      const contact = await db.contacts.get(id);
      if (!contact) return;
      await removeContactFromIndex(id);
      const blobIds = [contact.avatarBlobId, contact.bannerBlobId];
      const gifts = await db.gifts.where('contactId').equals(id).toArray();
      blobIds.push(...gifts.map((g) => g.photoBlobId));
      await db.blobs.bulkDelete(blobIds.filter((b): b is string => !!b));

      for (const table of dependentTables()) await table.where('contactId').equals(id).delete();
      await db.relationships.filter((r) => r.fromContactId === id || r.toContactId === id).delete();
      await db.moments
        .where('contactIds')
        .equals(id)
        .modify((m) => {
          m.contactIds = m.contactIds.filter((c) => c !== id);
        });
      await db.contacts.delete(id);
    },
  );
}

/** Contacts currently in Trash, most recently deleted first. */
export async function listTrashedContacts(): Promise<Contact[]> {
  const rows = await db.contacts.where('deletedAt').above('').toArray();
  return rows.sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
}

export const contactDetails = {
  fields: (contactId: string) =>
    db.contactFields
      .where('contactId')
      .equals(contactId)
      .filter((r) => !r.deletedAt)
      .toArray(),
  addresses: (contactId: string) =>
    db.addresses
      .where('contactId')
      .equals(contactId)
      .filter((r) => !r.deletedAt)
      .toArray(),
};
