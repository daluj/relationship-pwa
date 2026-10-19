import { replaceEntity } from '@/domain/momentText';
import type { Tag } from '@/domain/types';
import { db } from '../db';
import { nowIso } from './createRepository';
import { tagRepo } from './entities';
import { RecordNotFoundError } from './errors';

/** Existing tag with that name (case-insensitive) or a new one — used by the composer's `#`. */
export async function findOrCreateTag(name: string): Promise<Tag> {
  return (await tagRepo.findByName(name)) ?? tagRepo.create({ name: name.trim() });
}

/** Merge `fromId` into `intoId`: re-point moments and contacts, then remove the source tag (SPEC §8.8). */
export async function mergeTags(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) return;
  await db.transaction('rw', [db.tags, db.moments, db.contacts], async () => {
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
  });
}

/**
 * Delete a tag and remove it from every record (SPEC §8.8). Body tokens stay and render as plain text,
 * so the words people wrote aren't lost.
 */
export async function deleteTag(id: string): Promise<void> {
  await db.transaction('rw', [db.tags, db.moments, db.contacts], async () => {
    const now = nowIso();
    const drop = (r: { tagIds: string[]; updatedAt: string }) => {
      r.tagIds = r.tagIds.filter((t) => t !== id);
      r.updatedAt = now;
    };
    await db.moments.where('tagIds').equals(id).modify(drop);
    await db.contacts.where('tagIds').equals(id).modify(drop);
    await db.tags.delete(id);
  });
}

export async function listTags(): Promise<Tag[]> {
  const tags = await tagRepo.list();
  return tags.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
}
