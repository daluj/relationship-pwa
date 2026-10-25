// @vitest-environment node
// Node's Blob survives fake-indexeddb's structured clone (jsdom's doesn't), so photo bytes round-trip.
import { db } from '@/db/db';
import {
  contactRepo,
  deleteAllData,
  deleteContact,
  exportBackup,
  giftRepo,
  giftsFor,
  importBackup,
  purgeContact,
  purgeExpiredTrash,
  saveGift,
  thumbId,
} from '@/db/repositories';
import { parseBackup } from '@/domain/backup';
import { resetDb } from './helpers';

beforeEach(resetDb);

const img = (text = 'x') => ({
  data: new Blob([text], { type: 'image/webp' }),
  mime: 'image/webp',
  width: 10,
  height: 10,
});
const photo = (text?: string) => ({ image: img(text), thumb: img(`${text ?? 'x'}-thumb`) });
const draft = (contactId: string) => ({ contactId, name: 'Book', status: 'idea' as const });

describe('gift photos (features §8.12 AC-4, AC-5)', () => {
  it('adds, replaces and removes a photo, deleting old blobs each time', async () => {
    const c = await contactRepo.create({ firstName: 'Élise' });
    const g = await saveGift(undefined, draft(c.id), photo('one'));
    const first = g.photoBlobId!;
    expect(await db.blobs.get(first)).toBeTruthy();
    expect(await db.blobs.get(thumbId(first))).toBeTruthy();

    const replaced = await saveGift(g.id, draft(c.id), photo('two'));
    expect(replaced.photoBlobId).not.toBe(first);
    expect(await db.blobs.get(first)).toBeUndefined();
    expect(await db.blobs.get(thumbId(first))).toBeUndefined();
    expect(await db.blobs.count()).toBe(2);

    // undefined keeps the photo (e.g. editing only the name)
    const kept = await saveGift(g.id, { ...draft(c.id), name: 'Novel' });
    expect(kept.photoBlobId).toBe(replaced.photoBlobId);
    expect(await db.blobs.count()).toBe(2);

    const removed = await saveGift(g.id, draft(c.id), null);
    expect(removed.photoBlobId).toBeUndefined();
    expect(await db.blobs.count()).toBe(0);
  });

  it('purging the contact removes gift photos and thumbnails (cascade)', async () => {
    const c = await contactRepo.create({ firstName: 'Élise' });
    await saveGift(undefined, draft(c.id), photo());
    await deleteContact(c.id);
    expect(await db.blobs.count()).toBe(2); // kept while in Trash so Undo works
    await purgeContact(c.id);
    expect(await db.blobs.count()).toBe(0);
  });

  it('expired deleted gifts take their photos with them', async () => {
    const c = await contactRepo.create({ firstName: 'Élise' });
    const g = await saveGift(undefined, draft(c.id), photo());
    await giftRepo.softDelete(g.id);
    await purgeExpiredTrash(new Date(Date.now() + 40 * 86_400_000));
    expect(await db.gifts.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
  });

  it('survives a JSON export → import round trip with photos', async () => {
    const c = await contactRepo.create({ firstName: 'Élise' });
    const g = await saveGift(undefined, draft(c.id), photo('bytes'));
    const file = await exportBackup();
    await deleteAllData();
    await importBackup(parseBackup(JSON.parse(await file.text())), 'replace');

    const [restored] = await giftsFor(c.id);
    expect(restored!.photoBlobId).toBe(g.photoBlobId);
    const full = await db.blobs.get(restored!.photoBlobId!);
    const thumb = await db.blobs.get(thumbId(restored!.photoBlobId!));
    expect(await full!.data.text()).toBe('bytes');
    expect(await thumb!.data.text()).toBe('bytes-thumb');
  });
});
