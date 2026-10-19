import {
  blobRepo,
  contactRepo,
  DuplicateError,
  momentRepo,
  RecordNotFoundError,
  reminderRepo,
  settingsRepo,
  tagRepo,
  ValidationError,
} from '@/db/repositories';
import { resetDb } from './helpers';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

beforeEach(resetDb);
afterEach(() => vi.useRealTimers());

describe('createRepository (via contactRepo)', () => {
  it('creates with UUID, timestamps and defaults', async () => {
    const c = await contactRepo.create({ firstName: 'Élise' });
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(c.createdAt).toMatch(ISO);
    expect(c.updatedAt).toBe(c.createdAt);
    expect(c).toMatchObject({ isStarred: false, isArchived: false, tagIds: [], groupIds: [] });
    expect(await contactRepo.get(c.id)).toEqual(c);
  });

  it('explicit undefined in the input does not override defaults', async () => {
    const c = await contactRepo.create({ firstName: 'A', isStarred: undefined, tagIds: undefined });
    expect(c).toMatchObject({ isStarred: false, tagIds: [] });
  });

  it('validates with Zod — only firstName is required', async () => {
    await expect(contactRepo.create({ firstName: '   ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(
      contactRepo.create({ firstName: 'A', birthday: { month: 2, day: 30 } }),
    ).rejects.toThrow(/birthday/);
    expect(await contactRepo.count()).toBe(0);
  });

  it('update bumps updatedAt, keeps createdAt, and re-validates', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
    const c = await contactRepo.create({ firstName: 'Marc' });
    vi.setSystemTime(new Date('2026-01-02T10:00:00Z'));
    const u = await contactRepo.update(c.id, { nickname: 'marc' });
    expect(u.createdAt).toBe('2026-01-01T10:00:00.000Z');
    expect(u.updatedAt).toBe('2026-01-02T10:00:00.000Z');
    expect(u.nickname).toBe('marc');
    await expect(contactRepo.update(c.id, { firstName: '' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect((await contactRepo.get(c.id))?.firstName).toBe('Marc');
  });

  it('update on a missing id throws RecordNotFoundError', async () => {
    await expect(contactRepo.update(crypto.randomUUID(), { bio: 'x' })).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );
  });

  it('soft delete hides the record (tombstone), restore brings it back', async () => {
    const a = await contactRepo.create({ firstName: 'A' });
    const b = await contactRepo.create({ firstName: 'B' });
    await contactRepo.softDelete(a.id);

    expect(await contactRepo.get(a.id)).toBeUndefined();
    expect((await contactRepo.get(a.id, { includeDeleted: true }))?.deletedAt).toMatch(ISO);
    expect((await contactRepo.list()).map((c) => c.id)).toEqual([b.id]);
    expect((await contactRepo.listDeleted()).map((c) => c.id)).toEqual([a.id]);
    expect(await contactRepo.count()).toBe(1);

    await contactRepo.restore(a.id);
    const restored = await contactRepo.get(a.id);
    expect(restored).toBeDefined();
    expect(restored).not.toHaveProperty('deletedAt');
    expect(await contactRepo.count()).toBe(2);
  });

  it('purge removes permanently', async () => {
    const a = await contactRepo.create({ firstName: 'A' });
    await contactRepo.purge(a.id);
    expect(await contactRepo.get(a.id, { includeDeleted: true })).toBeUndefined();
  });
});

describe('entity repositories', () => {
  it('moment defaults happenedAt to now and photo/contact arrays to empty', async () => {
    const m = await momentRepo.create({ kind: 'note', body: 'Hello' });
    expect(m.happenedAt).toMatch(ISO);
    expect(m).toMatchObject({ contactIds: [], tagIds: [], photoBlobIds: [], isStarred: false });
    await expect(
      momentRepo.create({ kind: 'note', body: 'x', photoBlobIds: ['1', '2', '3', '4', '5'] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('reminder defaults to a manual non-recurring reminder', async () => {
    const r = await reminderRepo.create({ title: 'Call mum', dueDate: '2026-10-20' });
    expect(r).toMatchObject({ recurrence: 'none', source: 'manual' });
    await expect(reminderRepo.create({ title: 'x', dueDate: 'tomorrow' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe('tagRepo', () => {
  it('derives nameLower and enforces case-insensitive uniqueness', async () => {
    const t = await tagRepo.create({ name: 'Family' });
    expect(t.nameLower).toBe('family');
    await expect(tagRepo.create({ name: 'FAMILY' })).rejects.toBeInstanceOf(DuplicateError);
    expect((await tagRepo.findByName('family'))?.id).toBe(t.id);
  });

  it('rename keeps nameLower in sync and rejects clashes', async () => {
    const a = await tagRepo.create({ name: 'work' });
    await tagRepo.create({ name: 'books' });
    expect((await tagRepo.update(a.id, { name: 'Job' })).nameLower).toBe('job');
    await expect(tagRepo.update(a.id, { name: 'Books' })).rejects.toBeInstanceOf(DuplicateError);
  });

  it('re-creating a soft-deleted name revives the same tag', async () => {
    const t = await tagRepo.create({ name: 'travel' });
    await tagRepo.softDelete(t.id);
    expect(await tagRepo.findByName('travel')).toBeUndefined();
    const revived = await tagRepo.create({ name: 'Travel', color: '#f00' });
    expect(revived.id).toBe(t.id);
    expect(revived).toMatchObject({ name: 'Travel', color: '#f00' });
    expect(revived.deletedAt).toBeUndefined();
  });
});

describe('settingsRepo', () => {
  it('returns defaults until set, then persists', async () => {
    expect(await settingsRepo.get('theme')).toBe('system');
    await settingsRepo.set('theme', 'dim');
    await settingsRepo.set('accent', 'pink');
    expect(await settingsRepo.getAll()).toMatchObject({
      theme: 'dim',
      accent: 'pink',
      fontSize: 15,
    });
  });
});

describe('blobRepo', () => {
  it('stores and reads image blobs', async () => {
    const data = new Blob(['x'], { type: 'image/webp' });
    const b = await blobRepo.put({ mime: 'image/webp', width: 10, height: 10, size: 1, data });
    expect((await blobRepo.get(b.id))?.mime).toBe('image/webp');
    await expect(
      blobRepo.put({ mime: 'text/plain', width: 1, height: 1, size: 1, data }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
