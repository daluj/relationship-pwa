import { db } from '@/db/db';
import {
  addressRepo,
  contactDetails,
  contactFieldRepo,
  contactRepo,
  deleteContact,
  giftRepo,
  listTrashedContacts,
  momentRepo,
  purgeContact,
  purgeExpiredTrash,
  relationshipRepo,
  reminderRepo,
  restoreContact,
  saveContact,
  type ContactDraft,
} from '@/db/repositories';
import { resetDb } from './helpers';

beforeEach(resetDb);
afterEach(() => vi.useRealTimers());

const draft = (
  over: Partial<ContactDraft['contact']> = {},
  rest: Partial<ContactDraft> = {},
): ContactDraft => ({
  contact: { firstName: 'Élise', lastName: 'Aubert', ...over },
  fields: [],
  addresses: [],
  ...rest,
});

const image = () => ({
  data: new Blob(['img'], { type: 'image/webp' }),
  mime: 'image/webp',
  width: 400,
  height: 400,
});

const birthdayReminders = async (contactId: string) =>
  (await db.reminders.where('sourceId').equals(contactId).toArray()).filter(
    (r) => r.source === 'birthday',
  );

describe('saveContact', () => {
  it('creates a contact with fields, addresses and an avatar atomically', async () => {
    const c = await saveContact(
      undefined,
      draft(
        {},
        {
          fields: [{ type: 'email', value: 'lise@example.com', isPrimary: true }],
          addresses: [{ city: 'Lyon', isCurrent: true }],
          avatar: image(),
        },
      ),
    );
    expect(c.avatarBlobId).toBeDefined();
    expect(await db.blobs.count()).toBe(1);
    expect((await contactFieldRepo.list())[0]).toMatchObject({
      contactId: c.id,
      value: 'lise@example.com',
    });
    expect((await addressRepo.list())[0]).toMatchObject({ contactId: c.id, city: 'Lyon' });
  });

  it('rolls back everything when validation fails', async () => {
    await expect(
      saveContact(
        undefined,
        draft({}, { fields: [{ type: 'email', value: '' }], avatar: image() }),
      ),
    ).rejects.toThrow();
    expect(await db.contacts.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
  });

  it('updates, clears removed optional fields, and diffs child rows', async () => {
    const c = await saveContact(
      undefined,
      draft(
        { nickname: 'lise', bio: 'Old friend' },
        {
          fields: [
            { type: 'phone', value: '1' },
            { type: 'email', value: 'a@b.c' },
          ],
        },
      ),
    );
    const [phone] = (await contactFieldRepo.list()).filter((f) => f.type === 'phone');
    const updated = await saveContact(
      c.id,
      draft(
        { nickname: 'lili' },
        {
          fields: [
            { id: phone!.id, type: 'phone', value: '2' },
            { type: 'website', value: 'example.com' },
          ],
        },
      ),
    );
    expect(updated.nickname).toBe('lili');
    expect(updated).not.toHaveProperty('bio');
    const live = await contactFieldRepo.list();
    expect(live.map((f) => `${f.type}:${f.value}`).sort()).toEqual([
      'phone:2',
      'website:example.com',
    ]);
    expect(live.find((f) => f.type === 'phone')?.id).toBe(phone!.id);
    expect((await contactFieldRepo.listDeleted()).map((f) => f.type)).toEqual(['email']);
  });

  it('keeps contact fields and addresses in the order they were entered', async () => {
    const values = ['+1 111', 'a@example.com', '+2 222', 'b@example.com', '+3 333'];
    const c = await saveContact(
      undefined,
      draft(
        {},
        {
          fields: values.map((value) => ({ type: value.includes('@') ? 'email' : 'phone', value })),
          addresses: [
            { city: 'Lyon', isCurrent: true },
            { city: 'Paris', isCurrent: false },
            { city: 'Nantes', isCurrent: false },
          ],
        },
      ),
    );
    expect((await contactDetails.fields(c.id)).map((f) => f.value)).toEqual(values);
    expect((await contactDetails.addresses(c.id)).map((a) => a.city)).toEqual([
      'Lyon',
      'Paris',
      'Nantes',
    ]);
    // Re-saving in a new order (e.g. after removing one) keeps the new order.
    const stored = await contactDetails.fields(c.id);
    await saveContact(
      c.id,
      draft(
        {},
        { fields: [stored[4]!, stored[0]!].map(({ id, type, value }) => ({ id, type, value })) },
      ),
    );
    expect((await contactDetails.fields(c.id)).map((f) => f.value)).toEqual(['+3 333', '+1 111']);
  });

  it('replaces and removes images, deleting old blobs', async () => {
    const c = await saveContact(undefined, draft({}, { avatar: image(), banner: image() }));
    const replaced = await saveContact(c.id, draft({}, { avatar: image() }));
    expect(replaced.avatarBlobId).not.toBe(c.avatarBlobId);
    expect(replaced.bannerBlobId).toBe(c.bannerBlobId);
    expect(await db.blobs.get(c.avatarBlobId!)).toBeUndefined();
    const removed = await saveContact(c.id, draft({}, { avatar: null, banner: null }));
    expect(removed.avatarBlobId).toBeUndefined();
    expect(await db.blobs.count()).toBe(0);
  });
});

describe('birthday reminder (SPEC §8.2 AC)', () => {
  it('is created yearly on create, updated on edit, removed when cleared', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-01T12:00:00'));

    const c = await saveContact(undefined, draft({ birthday: { month: 3, day: 18, year: 1987 } }));
    let [r] = await birthdayReminders(c.id);
    expect(r).toMatchObject({
      contactId: c.id,
      recurrence: 'yearly',
      source: 'birthday',
      dueDate: '2027-03-18',
      title: 'Élise Aubert',
    });

    await saveContact(c.id, draft({ firstName: 'Lise', birthday: { month: 6, day: 2 } }));
    const all = await birthdayReminders(c.id);
    expect(all).toHaveLength(1);
    [r] = all;
    expect(r).toMatchObject({ dueDate: '2026-06-02', title: 'Lise Aubert' });

    await saveContact(c.id, draft({ birthday: undefined }));
    expect(await birthdayReminders(c.id)).toHaveLength(0);
  });

  it('keeps an advanced dueDate when the birthday itself did not change', async () => {
    const c = await saveContact(undefined, draft({ birthday: { month: 3, day: 18 } }));
    const [r] = await birthdayReminders(c.id);
    await reminderRepo.update(r!.id, { dueDate: '2099-03-18' });
    await saveContact(c.id, draft({ bio: 'x', birthday: { month: 3, day: 18 } }));
    expect((await reminderRepo.get(r!.id))?.dueDate).toBe('2099-03-18');
  });
});

describe('delete / restore / purge (SPEC §5.2)', () => {
  async function seed() {
    const a = await saveContact(
      undefined,
      draft(
        { birthday: { month: 1, day: 2 } },
        {
          fields: [{ type: 'phone', value: '1' }],
          addresses: [{ city: 'Lyon', isCurrent: true }],
        },
      ),
    );
    const b = await contactRepo.create({ firstName: 'Marc' });
    await relationshipRepo.create({ fromContactId: a.id, toContactId: b.id, type: 'friend' });
    await giftRepo.create({ contactId: a.id, name: 'Book' });
    const m = await momentRepo.create({ kind: 'note', body: 'hi', contactIds: [a.id, b.id] });
    return { a, b, m };
  }

  it('soft-deletes dependents in one go and restores exactly them', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { a } = await seed();
    // Deleted earlier on its own — must stay deleted after the contact is restored.
    const extra = await giftRepo.create({ contactId: a.id, name: 'Old gift' });
    await giftRepo.softDelete(extra.id);

    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    await deleteContact(a.id);
    expect(await contactRepo.get(a.id)).toBeUndefined();
    expect(await contactFieldRepo.count()).toBe(0);
    expect(await addressRepo.count()).toBe(0);
    expect(await relationshipRepo.count()).toBe(0);
    expect(await giftRepo.count()).toBe(0);
    expect(await birthdayReminders(a.id).then((r) => r.every((x) => x.deletedAt))).toBe(true);
    expect((await listTrashedContacts()).map((c) => c.id)).toEqual([a.id]);

    await restoreContact(a.id);
    expect(await contactRepo.get(a.id)).toBeDefined();
    expect(await contactFieldRepo.count()).toBe(1);
    expect(await addressRepo.count()).toBe(1);
    expect(await relationshipRepo.count()).toBe(1);
    expect((await giftRepo.list()).map((g) => g.name)).toEqual(['Book']);
    expect(await listTrashedContacts()).toEqual([]);
  });

  it('purge removes the contact, dependents and blobs, and unlinks moments', async () => {
    const { a, b, m } = await seed();
    await saveContact(a.id, draft({}, { avatar: image() }));
    await purgeContact(a.id);
    expect(await db.contacts.get(a.id)).toBeUndefined();
    expect(await db.contactFields.count()).toBe(0);
    expect(await db.relationships.count()).toBe(0);
    expect(await db.gifts.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
    expect((await momentRepo.get(m.id))?.contactIds).toEqual([b.id]);
    expect(await contactRepo.get(b.id)).toBeDefined();
  });

  it('purgeExpiredTrash purges only items deleted more than 30 days ago', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { a } = await seed();
    await deleteContact(a.id);
    const t = await giftRepo.create({
      contactId: (await contactRepo.create({ firstName: 'X' })).id,
      name: 'g',
    });
    await giftRepo.softDelete(t.id);

    vi.setSystemTime(new Date('2026-01-20T00:00:00Z'));
    expect(await purgeExpiredTrash()).toBe(0);
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
    expect(await purgeExpiredTrash()).toBeGreaterThanOrEqual(2);
    expect(await db.contacts.get(a.id)).toBeUndefined();
    expect(await db.gifts.get(t.id)).toBeUndefined();
  });
});
