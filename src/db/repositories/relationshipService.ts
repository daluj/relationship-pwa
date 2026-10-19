import { inverseOf } from '@/domain/relationships';
import type { Relationship } from '@/domain/types';
import { db } from '../db';
import { nowIso } from './createRepository';
import { relationshipRepo } from './entities';
import { DuplicateError, RecordNotFoundError, ValidationError } from './errors';

export type RelationshipDraft = Pick<
  Relationship,
  'fromContactId' | 'toContactId' | 'type' | 'since' | 'notes'
>;

const live = (r: Relationship) => !r.deletedAt;

/**
 * Create or edit a relationship together with its inverse, linked both ways via `inverseId`
 * (SPEC §8.3). Editing keeps both rows in sync.
 */
export async function saveRelationship(
  id: string | undefined,
  draft: RelationshipDraft,
): Promise<Relationship> {
  if (draft.fromContactId === draft.toContactId) {
    throw new ValidationError('relationship', [
      { code: 'custom', path: ['toContactId'], message: 'self' },
    ]);
  }
  return db.transaction('rw', db.relationships, async () => {
    const existing = await db.relationships
      .where('fromContactId')
      .equals(draft.fromContactId)
      .filter(
        (r) =>
          live(r) && r.toContactId === draft.toContactId && r.type === draft.type && r.id !== id,
      )
      .first();
    if (existing) throw new DuplicateError('relationship', draft.type);

    const inverseDraft = {
      fromContactId: draft.toContactId,
      toContactId: draft.fromContactId,
      type: inverseOf(draft.type),
      since: draft.since,
      notes: draft.notes,
    };
    if (!id) {
      const forward = await relationshipRepo.create(draft);
      const inverse = await relationshipRepo.create({ ...inverseDraft, inverseId: forward.id });
      return relationshipRepo.update(forward.id, { inverseId: inverse.id });
    }
    const before = await relationshipRepo.get(id);
    if (!before) throw new RecordNotFoundError('relationship', id);
    const forward = await relationshipRepo.update(id, draft);
    if (before.inverseId && (await relationshipRepo.get(before.inverseId))) {
      await relationshipRepo.update(before.inverseId, inverseDraft);
    } else {
      const inverse = await relationshipRepo.create({ ...inverseDraft, inverseId: id });
      return relationshipRepo.update(id, { inverseId: inverse.id });
    }
    return forward;
  });
}

/** Deleting one side deletes the inverse (SPEC §8.3 AC). */
export async function deleteRelationship(id: string): Promise<void> {
  await db.transaction('rw', db.relationships, async () => {
    const r = await db.relationships.get(id);
    if (!r) return;
    const now = nowIso();
    const ids = [id, r.inverseId].filter((x): x is string => !!x);
    await db.relationships
      .where('id')
      .anyOf(ids)
      .modify((x) => {
        if (!x.deletedAt) {
          x.deletedAt = now;
          x.updatedAt = now;
        }
      });
  });
}

/** Restore both sides (Undo). */
export async function restoreRelationship(id: string): Promise<void> {
  await db.transaction('rw', db.relationships, async () => {
    const r = await db.relationships.get(id);
    if (!r) return;
    const now = nowIso();
    await db.relationships
      .where('id')
      .anyOf([id, r.inverseId].filter((x): x is string => !!x))
      .modify((x) => {
        delete x.deletedAt;
        x.updatedAt = now;
      });
  });
}

/** Relationships shown on a contact's profile (rows where they are `from`). */
export const relationshipsFor = (contactId: string) =>
  db.relationships.where('fromContactId').equals(contactId).filter(live).toArray();
