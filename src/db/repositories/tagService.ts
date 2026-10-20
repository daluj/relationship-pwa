import { replaceEntity } from '@/domain/momentText';
import type { Tag } from '@/domain/types';
import { db } from '../db';
import { nowIso } from './createRepository';
import { tagRepo } from './entities';
import { DuplicateError, RecordNotFoundError } from './errors';
import { indexContact, indexMoment, reindexForTag, searchTables } from './searchService';

/** Existing tag with that name (case-insensitive) or a new one — used by the composer's `#`. */
export async function findOrCreateTag(name: string): Promise<Tag> {
  return (await tagRepo.findByName(name)) ?? tagRepo.create({ name: name.trim() });
}

/** Merge `fromId` into `intoId`: re-point moments and contacts, then remove the source tag (features §8.8). */
export async function mergeTags(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) return;
  await db.transaction('rw', searchTables(), async () => {
    const into = await tagRepo.get(intoId);
    if (!into) throw new RecordNotFoundError('tag', intoId);
    const now = nowIso();
    const swap = (ids: string[]) => [...new Set(ids.map((id) => (id === fromId ? intoId : id)))];
    await db.moments
      .where('tagIds')
      .equals(fromId)
      .modify((m) => {
        m.tagIds = swap(m.tagIds);
        m.body = replaceEntity(m.body, 'tag', fromId, intoId, into.name);
        m.updatedAt = now;
      });
    await db.contacts
      .where('tagIds')
      .equals(fromId)
      .modify((c) => {
        c.tagIds = swap(c.tagIds);
        c.updatedAt = now;
      });
    await db.tags.delete(fromId);
    await reindexForTag(intoId);
  });
}

/**
 * Delete a tag and remove it from every record (features §8.8). Body tokens stay and render as plain text,
 * so the words people wrote aren't lost.
 */
export async function deleteTag(id: string): Promise<void> {
  await db.transaction('rw', searchTables(), async () => {
    const affectedMoments = await db.moments.where('tagIds').equals(id).primaryKeys();
    const affectedContacts = await db.contacts.where('tagIds').equals(id).primaryKeys();
    const now = nowIso();
    const drop = (r: { tagIds: string[]; updatedAt: string }) => {
      r.tagIds = r.tagIds.filter((t) => t !== id);
      r.updatedAt = now;
    };
    await db.moments.where('tagIds').equals(id).modify(drop);
    await db.contacts.where('tagIds').equals(id).modify(drop);
    await db.tags.delete(id);
    for (const m of affectedMoments) await indexMoment(m);
    for (const c of affectedContacts) await indexContact(c);
  });
}

/** Rename a tag; bodies keep their id tokens, the index picks up the new name (features §8.8 AC). */
export async function renameTag(id: string, name: string): Promise<Tag> {
  return db.transaction('rw', searchTables(), async () => {
    const clash = await tagRepo.findByName(name);
    if (clash && clash.id !== id) throw new DuplicateError('tag', name);
    const tag = await tagRepo.update(id, { name: name.trim() });
    await reindexForTag(id);
    return tag;
  });
}

export async function listTags(): Promise<Tag[]> {
  const tags = await tagRepo.list();
  return tags.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
}
