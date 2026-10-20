// @vitest-environment node
// Node's Blob survives fake-indexeddb's structured clone (jsdom's doesn't), so photo bytes round-trip.
import { db } from '@/db/db';
import {
  commitImport,
  contactRepo,
  deleteAllData,
  exportBackup,
  findOrCreateTag,
  giftRepo,
  importBackup,
  knownContacts,
  rebuildSearchIndex,
  mergeContacts,
  momentRepo,
  momentsForContact,
  recordCounts,
  relationshipsFor,
  reminderRepo,
  saveContact,
  saveMoment,
  saveRelationship,
  saveReminder,
  search,
} from '@/db/repositories';
import { BackupError, parseBackup } from '@/domain/backup';
import { autoMap, parseCsvDate, rowsToContacts } from '@/domain/csvMapping';
import { candidateOf, findDuplicates } from '@/domain/duplicates';
import { mentionToken, tagToken } from '@/domain/momentText';
import { resetDb } from './helpers';

beforeEach(resetDb);

const img = () => ({
  data: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/webp' }),
  mime: 'image/webp',
  width: 4,
  height: 4,
});

async function seed() {
  const lise = await saveContact(undefined, {
    contact: { firstName: 'Élise', lastName: 'Aubert', birthday: { month: 3, day: 18 } },
    fields: [{ type: 'email', value: 'lise@example.com' }],
    addresses: [{ city: 'Lyon', isCurrent: true }],
    avatar: img(),
  });
  const marc = await saveContact(undefined, {
    contact: { firstName: 'Marc' },
    fields: [{ type: 'phone', value: '+34 600 11 22 33' }],
    addresses: [],
  });
  const tag = await findOrCreateTag('family');
  await saveRelationship(undefined, {
    fromContactId: lise.id,
    toContactId: marc.id,
    type: 'sibling',
  });
  await saveMoment(undefined, {
    kind: 'activity',
    activityType: 'coffee',
    body: `Coffee with ${mentionToken(lise.id, 'Élise Aubert')} ${tagToken(tag.id, 'family')}`,
    happenedAt: '2026-10-01T10:00:00.000Z',
    contactIds: [marc.id],
    photos: [{ image: img(), thumb: img() }],
  });
  await saveReminder(undefined, {
    title: 'Call',
    contactId: marc.id,
    dueDate: '2026-11-01',
    recurrence: 'weekly',
    recurrenceInterval: 2,
  });
  await giftRepo.create({ contactId: lise.id, name: 'Book', status: 'idea' });
  await rebuildSearchIndex(); // as on app start: also records the index version in settings
  return { lise, marc };
}

async function snapshot() {
  // Canonical JSON (sorted keys): validation may reorder keys, content must be identical.
  const canon = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canon)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
          )
        : v;
  const strip = <T extends object>(rows: T[]) => rows.map((r) => JSON.stringify(canon(r))).sort();
  const blobs = await Promise.all(
    (await db.blobs.toArray()).map(
      async (b) => `${b.id}:${b.mime}:${new Uint8Array(await b.data.arrayBuffer()).join(',')}`,
    ),
  );
  return {
    contacts: strip(await db.contacts.toArray()),
    moments: strip(await db.moments.toArray()),
    others: strip([
      ...(await db.relationships.toArray()),
      ...(await db.reminders.toArray()),
      ...(await db.gifts.toArray()),
      ...(await db.tags.toArray()),
    ]),
    blobs: blobs.sort(),
  };
}

const readJson = async (blob: Blob) => JSON.parse(await blob.text()) as unknown;

describe('JSON backup (features §8.9)', () => {
  it('round trip: export → clear all → import gives identical counts and content (AC)', async () => {
    await seed();
    const before = { counts: await recordCounts(), snap: await snapshot() };
    const file = await exportBackup();
    await deleteAllData();
    expect(Object.values(await recordCounts()).every((n) => n === 0)).toBe(true);

    await importBackup(parseBackup(await readJson(file)), 'replace');
    const after = { counts: await recordCounts(), snap: await snapshot() };
    expect(after.counts).toEqual(before.counts);
    expect(after.snap).toEqual(before.snap);
    expect((await search('eli')).contacts.map((c) => c.firstName)).toEqual(['Élise']); // index rebuilt
  });

  it('can exclude photos', async () => {
    await seed();
    const json = (await readJson(await exportBackup({ includePhotos: false }))) as {
      includesPhotos: boolean;
      data: { blobs: unknown[] };
    };
    expect(json.includesPhotos).toBe(false);
    expect(json.data.blobs).toEqual([]);
  });

  it('merge mode: adds missing records, newer updatedAt wins, keeps local settings', async () => {
    const { lise } = await seed();
    const backup = parseBackup(await readJson(await exportBackup()));
    await contactRepo.update(lise.id, { nickname: 'local-newer' }); // newer than the backup
    const extra = await contactRepo.create({ firstName: 'Local only' });
    await db.contacts.delete((await contactRepo.list()).find((c) => c.firstName === 'Marc')!.id);

    const summary = await importBackup(backup, 'merge');
    expect(summary.added).toBeGreaterThanOrEqual(1);
    expect((await contactRepo.get(lise.id))?.nickname).toBe('local-newer');
    expect(await contactRepo.get(extra.id)).toBeDefined();
    expect((await contactRepo.list()).map((c) => c.firstName).sort()).toEqual([
      'Local only',
      'Marc',
      'Élise',
    ]);
  });

  it('rejects non-Kin files, newer schema versions and invalid records', () => {
    expect(() => parseBackup({ hello: 1 })).toThrow(BackupError);
    const base = { app: 'kin', exportedAt: '2026-10-19T10:00:00.000Z', data: {} };
    expect(() => parseBackup({ ...base, schemaVersion: 99 })).toThrow(/too-new/);
    expect(() =>
      parseBackup({ ...base, schemaVersion: 1, data: { contacts: [{ id: 'x', firstName: '' }] } }),
    ).toThrow(/invalid: contacts\[0\]/);
    expect(parseBackup({ ...base, schemaVersion: 1 }).contacts).toEqual([]);
  });
});

describe('duplicates (features §8.2)', () => {
  it('matches on normalized name, email or phone', async () => {
    await seed();
    const known = await knownContacts();
    const names = (c: ReturnType<typeof candidateOf>) =>
      findDuplicates(c, known).map((d) => `${d.contact.firstName}:${d.reason}`);
    expect(names(candidateOf('elise  AUBERT', []))).toEqual(['Élise:name']);
    expect(names(candidateOf('Someone', [{ type: 'email', value: ' LISE@example.com ' }]))).toEqual(
      ['Élise:email'],
    );
    expect(names(candidateOf('M', [{ type: 'phone', value: '600112233' }]))).toEqual([
      'Marc:phone',
    ]);
    expect(names(candidateOf('Nobody', [{ type: 'phone', value: '123' }]))).toEqual([]);
  });
});

describe('mergeContacts (features §8.2)', () => {
  it('unions data, rewrites moments and relationships, soft-deletes the secondary', async () => {
    const { lise, marc } = await seed();
    const dupe = await saveContact(undefined, {
      contact: { firstName: 'Lise', nickname: 'lili', company: 'Acme' },
      fields: [
        { type: 'email', value: 'LISE@example.com' },
        { type: 'phone', value: '+33 1' },
      ],
      addresses: [{ city: 'Paris', isCurrent: true }],
    });
    await saveRelationship(undefined, {
      fromContactId: dupe.id,
      toContactId: marc.id,
      type: 'sibling',
    }); // duplicate of lise→marc
    await saveRelationship(undefined, {
      fromContactId: dupe.id,
      toContactId: lise.id,
      type: 'friend',
    }); // becomes a self-link
    const m = await saveMoment(undefined, {
      kind: 'note',
      body: `Hi ${mentionToken(dupe.id, 'Lise')}`,
      happenedAt: '2026-10-10T10:00:00.000Z',
      contactIds: [],
      photos: [],
    });
    await giftRepo.create({ contactId: dupe.id, name: 'Scarf', status: 'idea' });

    const merged = await mergeContacts(lise.id, dupe.id);
    expect(merged).toMatchObject({
      firstName: 'Élise',
      lastName: 'Aubert',
      nickname: 'lili',
      company: 'Acme',
    });
    expect(merged.lastInteractionAt).toBe('2026-10-10T10:00:00.000Z');
    expect(await contactRepo.get(dupe.id)).toBeUndefined(); // soft-deleted
    const fields = await db.contactFields
      .where('contactId')
      .equals(lise.id)
      .filter((f) => !f.deletedAt)
      .toArray();
    expect(fields.map((f) => f.value).sort()).toEqual(['+33 1', 'lise@example.com']);
    const addresses = await db.addresses
      .where('contactId')
      .equals(lise.id)
      .filter((a) => !a.deletedAt)
      .toArray();
    expect(addresses.map((a) => [a.city, a.isCurrent]).sort()).toEqual([
      ['Lyon', true],
      ['Paris', false],
    ]);
    expect(
      (await relationshipsFor(lise.id)).map(
        (r) => `${r.type}→${r.toContactId === marc.id ? 'marc' : '?'}`,
      ),
    ).toEqual(['sibling→marc']);
    expect(await relationshipsFor(marc.id)).toHaveLength(1);
    const moment = await momentRepo.get(m.id);
    expect(moment?.contactIds).toEqual([lise.id]);
    expect(moment?.body).toBe(`Hi ${mentionToken(lise.id, 'Élise Aubert')}`);
    expect((await momentsForContact(lise.id)).map((x) => x.id)).toContain(m.id);
    expect(
      (await giftRepo.list())
        .filter((g) => g.contactId === lise.id)
        .map((g) => g.name)
        .sort(),
    ).toEqual(['Book', 'Scarf']);
    expect((await reminderRepo.list()).filter((r) => r.source === 'birthday')).toHaveLength(1);
    expect((await search('lili')).contacts.map((c) => c.id)).toEqual([lise.id]);
  });
});

describe('CSV mapping (features §8.9)', () => {
  it('auto-detects Google Contacts headers', () => {
    const headers = [
      'Name',
      'Given Name',
      'Family Name',
      'Nickname',
      'Birthday',
      'Notes',
      'E-mail 1 - Type',
      'E-mail 1 - Value',
      'Phone 1 - Type',
      'Phone 1 - Value',
      'Organization 1 - Name',
      'Organization 1 - Title',
      'Address 1 - City',
      'Address 1 - Country',
      'Website 1 - Value',
    ];
    expect(autoMap(headers)).toEqual([
      'fullName',
      'firstName',
      'lastName',
      'nickname',
      'birthday',
      'notes',
      'ignore',
      'email',
      'ignore',
      'phone',
      'company',
      'jobTitle',
      'city',
      'country',
      'website',
    ]);
  });
  it('auto-detects Outlook headers', () => {
    const headers = [
      'First Name',
      'Last Name',
      'E-mail Address',
      'E-mail 2 Address',
      'Mobile Phone',
      'Business Phone',
      'Company',
      'Job Title',
      'Home City',
      'Birthday',
      'Web Page',
      'Unknown thing',
    ];
    expect(autoMap(headers)).toEqual([
      'firstName',
      'lastName',
      'email',
      'email',
      'phone',
      'phone',
      'company',
      'jobTitle',
      'city',
      'birthday',
      'website',
      'ignore',
    ]);
  });
  it('builds contacts: full-name split, ::: multi-values, dates, rows without names dropped', () => {
    const mapping = autoMap([
      'Name',
      'E-mail 1 - Value',
      'Phone 1 - Value',
      'Birthday',
      'Address 1 - City',
      'Notes',
    ]);
    const rows = [
      [
        'Zoé Martin',
        'zoe@a.example ::: zoe@b.example',
        '+44 20 ::: +33 1',
        '--07-02',
        'London',
        'Met in Lisbon',
      ],
      ['', '', '', '', '', ''],
      ['', 'anon@example.com', '', '', '', ''],
    ];
    const [zoe, anon, ...rest] = rowsToContacts(rows, mapping);
    expect(rest).toEqual([]);
    expect(zoe).toMatchObject({
      firstName: 'Zoé',
      lastName: 'Martin',
      birthday: { month: 7, day: 2 },
      note: 'Met in Lisbon',
      addresses: [{ city: 'London', isCurrent: true }],
    });
    expect(zoe!.fields.map((f) => f.value)).toEqual([
      '+44 20',
      '+33 1',
      'zoe@a.example',
      'zoe@b.example',
    ]);
    expect(anon!.firstName).toBe('anon');
    expect(parseCsvDate('3/18/1987')).toEqual({ year: 1987, month: 3, day: 18 });
    expect(parseCsvDate('0/0/00')).toBeUndefined();
    expect(parseCsvDate('1987-03-18')).toEqual({ year: 1987, month: 3, day: 18 });
  });
});

describe('commitImport', () => {
  it('imports, merges into an existing contact, skips; NOTE becomes a note moment', async () => {
    const { lise } = await seed();
    const result = await commitImport([
      {
        parsed: {
          firstName: 'Zoé',
          note: 'Loves jazz',
          fields: [{ type: 'email', value: 'zoe@example.com' }],
          addresses: [],
        },
        action: { kind: 'import' },
      },
      {
        parsed: {
          firstName: 'Élise',
          lastName: 'Aubert',
          jobTitle: 'Chef',
          fields: [{ type: 'phone', value: '+34 611' }],
          addresses: [],
        },
        action: { kind: 'merge', into: lise.id },
      },
      { parsed: { firstName: 'Skip me', fields: [], addresses: [] }, action: { kind: 'skip' } },
    ]);
    expect(result).toEqual({ imported: 1, merged: 1, skipped: 1 });
    const names = (await contactRepo.list()).map((c) => c.firstName).sort();
    expect(names).toEqual(['Marc', 'Zoé', 'Élise']);
    expect((await contactRepo.get(lise.id))?.jobTitle).toBe('Chef');
    const zoe = (await contactRepo.list()).find((c) => c.firstName === 'Zoé')!;
    expect((await momentsForContact(zoe.id)).map((m) => [m.kind, m.body])).toEqual([
      ['note', 'Loves jazz'],
    ]);
  });
});
