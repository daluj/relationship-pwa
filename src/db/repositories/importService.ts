import type { KnownContact } from '@/domain/duplicates';
import type { ParsedContact } from '@/domain/parsedContact';
import { db } from '../db';
import { contactDetails, saveContact, type NewImage } from './contactService';
import { mergeContacts } from './mergeService';
import { saveMoment } from './momentService';

/** Live contacts with their fields — what imports and the contact form check duplicates against. */
export async function knownContacts(): Promise<KnownContact[]> {
  const contacts = await db.contacts.filter((c) => !c.deletedAt).toArray();
  const fields = await db.contactFields.filter((f) => !f.deletedAt).toArray();
  const byContact = new Map<string, KnownContact['fields']>();
  for (const f of fields) byContact.set(f.contactId, [...(byContact.get(f.contactId) ?? []), f]);
  return contacts.map((contact) => ({ contact, fields: byContact.get(contact.id) ?? [] }));
}

export type RowAction = { kind: 'import' } | { kind: 'skip' } | { kind: 'merge'; into: string };

export interface CommitOptions {
  /** Turns an inline vCard photo into an avatar (canvas work happens in the UI layer). */
  preparePhoto?: (photo: NonNullable<ParsedContact['photo']>) => Promise<NewImage | undefined>;
}

/**
 * Save previewed contacts (features §8.9): "import" creates a contact; "merge" creates it and merges it into
 * the chosen existing contact; NOTE becomes a note moment with that person.
 */
export async function commitImport(
  rows: { parsed: ParsedContact; action: RowAction }[],
  opts: CommitOptions = {},
): Promise<{ imported: number; merged: number; skipped: number }> {
  const result = { imported: 0, merged: 0, skipped: 0 };
  for (const { parsed: p, action } of rows) {
    if (action.kind === 'skip') {
      result.skipped++;
      continue;
    }
    const avatar =
      p.photo && opts.preparePhoto
        ? await opts.preparePhoto(p.photo).catch(() => undefined)
        : undefined;
    const contact = await saveContact(undefined, {
      contact: {
        firstName: p.firstName,
        lastName: p.lastName,
        nickname: p.nickname,
        birthday: p.birthday,
        isBirthdayYearKnown: p.birthday ? p.birthday.year !== undefined : undefined,
        company: p.company,
        jobTitle: p.jobTitle,
      },
      fields: p.fields.map((f) => ({ type: f.type, label: f.label, value: f.value })),
      addresses: p.addresses,
      ...(avatar && { avatar }),
    });
    if (p.note) {
      await saveMoment(undefined, {
        kind: 'note',
        body: p.note,
        happenedAt: new Date().toISOString(),
        contactIds: [contact.id],
        photos: [],
      });
    }
    if (action.kind === 'merge') {
      await mergeContacts(action.into, contact.id);
      result.merged++;
    } else result.imported++;
  }
  return result;
}

/** Contacts with fields, addresses and avatar blob, for vCard/CSV export (live contacts only). */
export async function contactsForExport(ids?: string[]) {
  const contacts = ids
    ? (await db.contacts.bulkGet(ids)).filter(
        (c): c is NonNullable<typeof c> => !!c && !c.deletedAt,
      )
    : await db.contacts.filter((c) => !c.deletedAt).toArray();
  return Promise.all(
    contacts.map(async (contact) => ({
      contact,
      fields: await contactDetails.fields(contact.id),
      addresses: (await contactDetails.addresses(contact.id)).sort(
        (a, b) => Number(b.isCurrent) - Number(a.isCurrent),
      ),
      avatar: contact.avatarBlobId ? await db.blobs.get(contact.avatarBlobId) : undefined,
    })),
  );
}
