import { db } from '@/db/db';
import {
  contactRepo,
  deleteMoment,
  deleteTag,
  feed,
  findOrCreateTag,
  mergeTags,
  momentRepo,
  momentsForContact,
  momentsForTag,
  purgeExpiredTrash,
  purgeMoment,
  restoreMoment,
  saveMoment,
  setMomentDate,
  setMomentPinned,
  tagRepo,
  thumbId,
  type MomentDraft,
} from '@/db/repositories';
import { bodyToPlainText, mentionToken, tagToken } from '@/domain/momentText';
import { resetDb } from './helpers';

beforeEach(resetDb);
afterEach(() => vi.useRealTimers());

const draft = (over: Partial<MomentDraft> = {}): MomentDraft => ({
  kind: 'note',
  body: 'hello',
  happenedAt: '2026-10-01T10:00:00.000Z',
  contactIds: [],
  photos: [],
  ...over,
});
const img = () => ({
  data: new Blob(['x'], { type: 'image/webp' }),
  mime: 'image/webp',
  width: 10,
  height: 10,
});

describe('saveMoment', () => {
  it('resolves @mentions and #tags from tokens and merges explicit people (features §8.4)', async () => {
    const lise = await contactRepo.create({ firstName: 'Élise' });
    const marc = await contactRepo.create({ firstName: 'Marc' });
    const fam = await findOrCreateTag('family');
    const m = await saveMoment(
      undefined,
      draft({
        body: `Coffee with ${mentionToken(lise.id, 'Élise')} ${tagToken(fam.id, 'family')}`,
        contactIds: [marc.id, lise.id],
      }),
    );
    expect(m.contactIds).toEqual([lise.id, marc.id]);
    expect(m.tagIds).toEqual([fam.id]);
  });

  it('updates lastInteractionAt for mentioned contacts (ui §6.5 AC)', async () => {
    const lise = await contactRepo.create({ firstName: 'Élise' });
    await saveMoment(
      undefined,
      draft({ body: mentionToken(lise.id, 'Élise'), happenedAt: '2026-10-01T10:00:00.000Z' }),
    );
    expect((await contactRepo.get(lise.id))?.lastInteractionAt).toBe('2026-10-01T10:00:00.000Z');
    const later = await saveMoment(
      undefined,
      draft({ contactIds: [lise.id], happenedAt: '2026-10-05T10:00:00.000Z' }),
    );
    expect((await contactRepo.get(lise.id))?.lastInteractionAt).toBe('2026-10-05T10:00:00.000Z');

    // Deleting / moving / un-mentioning recomputes it.
    await deleteMoment(later.id);
    expect((await contactRepo.get(lise.id))?.lastInteractionAt).toBe('2026-10-01T10:00:00.000Z');
    await restoreMoment(later.id);
    await setMomentDate(later.id, '2026-09-01T10:00:00.000Z');
    expect((await contactRepo.get(lise.id))?.lastInteractionAt).toBe('2026-10-01T10:00:00.000Z');
    const [first] = await momentsForContact(lise.id);
    await saveMoment(first!.id, draft({ body: 'no one' }));
    expect((await contactRepo.get(lise.id))?.lastInteractionAt).toBe('2026-09-01T10:00:00.000Z');
    await deleteMoment(later.id);
    expect(await contactRepo.get(lise.id)).not.toHaveProperty('lastInteractionAt');
  });

  it('keeps only fields that belong to the kind', async () => {
    const m = await saveMoment(
      undefined,
      draft({
        kind: 'call',
        mood: 4,
        callDirection: 'incoming',
        callDurationMin: 12,
        location: ' ',
      }),
    );
    expect(m).toMatchObject({ kind: 'call', callDirection: 'incoming', callDurationMin: 12 });
    expect(m).not.toHaveProperty('mood');
    expect(m).not.toHaveProperty('location');
  });

  it('stores photos with thumbnails and deletes removed ones', async () => {
    const m = await saveMoment(
      undefined,
      draft({
        photos: [
          { image: img(), thumb: img() },
          { image: img(), thumb: img() },
        ],
      }),
    );
    expect(m.photoBlobIds).toHaveLength(2);
    expect(await db.blobs.count()).toBe(4);
    expect(await db.blobs.get(thumbId(m.photoBlobIds[0]!))).toBeDefined();
    const kept = m.photoBlobIds[1]!;
    const edited = await saveMoment(m.id, draft({ photos: [{ existingId: kept }] }));
    expect(edited.photoBlobIds).toEqual([kept]);
    expect(await db.blobs.count()).toBe(2);
    await purgeMoment(m.id);
    expect(await db.blobs.count()).toBe(0);
  });

  it('rejects more than 4 photos', async () => {
    await expect(
      saveMoment(
        undefined,
        draft({ photos: Array.from({ length: 5 }, () => ({ image: img(), thumb: img() })) }),
      ),
    ).rejects.toThrow();
    expect(await db.blobs.count()).toBe(0);
  });
});

describe('a moment with 3 contacts (features §8.4 AC)', () => {
  it('appears on all 3 profiles and disappears from all on delete; undo restores', async () => {
    const ids = await Promise.all(
      ['A', 'B', 'C'].map(async (n) => (await contactRepo.create({ firstName: n })).id),
    );
    const m = await saveMoment(
      undefined,
      draft({ body: ids.map((id, i) => mentionToken(id, `P${i}`)).join(' ') }),
    );
    for (const id of ids) expect((await momentsForContact(id)).map((x) => x.id)).toEqual([m.id]);
    await deleteMoment(m.id);
    for (const id of ids) expect(await momentsForContact(id)).toEqual([]);
    await restoreMoment(m.id);
    for (const id of ids) expect(await momentsForContact(id)).toHaveLength(1);
  });
});

describe('queries', () => {
  it('feed is newest first, filters kind and soft-deleted, honours limit', async () => {
    await saveMoment(undefined, draft({ body: 'old', happenedAt: '2026-01-01T00:00:00.000Z' }));
    const call = await saveMoment(
      undefined,
      draft({ kind: 'call', body: 'call', happenedAt: '2026-02-01T00:00:00.000Z' }),
    );
    const gone = await saveMoment(
      undefined,
      draft({ body: 'gone', happenedAt: '2026-03-01T00:00:00.000Z' }),
    );
    await deleteMoment(gone.id);
    expect((await feed({ limit: 30 })).map((m) => m.body)).toEqual(['call', 'old']);
    expect((await feed({ limit: 1 })).map((m) => m.body)).toEqual(['call']);
    expect((await feed({ kind: 'call', limit: 30 })).map((m) => m.id)).toEqual([call.id]);
    // Editing the date re-sorts (features §8.4).
    await setMomentDate(call.id, '2025-01-01T00:00:00.000Z');
    expect((await feed({ limit: 30 })).map((m) => m.body)).toEqual(['old', 'call']);
  });

  it('profile timeline puts pinned first', async () => {
    const c = await contactRepo.create({ firstName: 'A' });
    const older = await saveMoment(
      undefined,
      draft({ contactIds: [c.id], happenedAt: '2026-01-01T00:00:00.000Z' }),
    );
    const newer = await saveMoment(
      undefined,
      draft({ contactIds: [c.id], happenedAt: '2026-02-01T00:00:00.000Z' }),
    );
    await setMomentPinned(older.id, true);
    expect((await momentsForContact(c.id)).map((m) => m.id)).toEqual([older.id, newer.id]);
    await setMomentPinned(older.id, false);
    expect(await momentRepo.get(older.id)).not.toHaveProperty('isPinned');
  });
});

describe('tags (features §8.8)', () => {
  it('rename changes rendering without rewriting bodies', async () => {
    const tag = await findOrCreateTag('family');
    const m = await saveMoment(undefined, draft({ body: `hi ${tagToken(tag.id, 'family')}` }));
    await tagRepo.update(tag.id, { name: 'Familia' });
    const stored = await momentRepo.get(m.id);
    expect(stored?.body).toBe(m.body);
    const renamed = await tagRepo.get(tag.id);
    expect(bodyToPlainText(stored!.body, { tag: () => renamed?.name })).toBe('hi #Familia');
  });

  it('findOrCreateTag is case-insensitive', async () => {
    const a = await findOrCreateTag('Work');
    expect((await findOrCreateTag('work')).id).toBe(a.id);
  });

  it('merge re-points moments, contacts and body tokens', async () => {
    const a = await findOrCreateTag('fam');
    const b = await findOrCreateTag('family');
    const m = await saveMoment(
      undefined,
      draft({ body: `${tagToken(a.id, 'fam')} ${tagToken(b.id, 'family')}` }),
    );
    const c = await contactRepo.create({ firstName: 'X', tagIds: [a.id] });
    await mergeTags(a.id, b.id);
    const after = await momentRepo.get(m.id);
    expect(after?.tagIds).toEqual([b.id]);
    expect(after?.body).toBe(`${tagToken(b.id, 'family')} ${tagToken(b.id, 'family')}`);
    expect((await contactRepo.get(c.id))?.tagIds).toEqual([b.id]);
    expect(await db.tags.get(a.id)).toBeUndefined();
    expect((await momentsForTag(b.id)).map((x) => x.id)).toEqual([m.id]);
  });

  it('delete removes the tag from records but keeps the words', async () => {
    const tag = await findOrCreateTag('travel');
    const m = await saveMoment(undefined, draft({ body: `Lisbon ${tagToken(tag.id, 'travel')}` }));
    await deleteTag(tag.id);
    const after = await momentRepo.get(m.id);
    expect(after?.tagIds).toEqual([]);
    expect(bodyToPlainText(after!.body)).toBe('Lisbon #travel');
    expect(await tagRepo.get(tag.id)).toBeUndefined();
  });
});

it('purgeExpiredTrash removes expired moments and their photos', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  const m = await saveMoment(undefined, draft({ photos: [{ image: img(), thumb: img() }] }));
  await deleteMoment(m.id);
  vi.setSystemTime(new Date('2026-02-15T00:00:00Z'));
  await purgeExpiredTrash();
  expect(await db.moments.get(m.id)).toBeUndefined();
  expect(await db.blobs.count()).toBe(0);
});
