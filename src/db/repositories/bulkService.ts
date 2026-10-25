// Bulk actions on contacts (features §8.13). One transaction, one undo token.
import { db } from '../db';
import { deleteContact, restoreContact, updateContactStatus } from './contactService';
import { addToGroup, removeFromGroup } from './groupService';
import { setContactTags } from './profileItems';

export type BulkAction =
  | { type: 'add-tag'; tagId: string }
  | { type: 'remove-tag'; tagId: string }
  | { type: 'add-group'; groupId: string }
  | { type: 'remove-group'; groupId: string }
  | { type: 'archive'; archived: boolean }
  | { type: 'trash' };

/** Prior state of the contacts a bulk action touched, enough to put them back exactly. */
export interface BulkUndo {
  action: BulkAction;
  before: { id: string; tagIds: string[]; groupIds: string[]; isArchived: boolean }[];
}

/** Applies `action` to the live contacts in `ids`; returns the undo token and how many changed. */
export async function bulkUpdateContacts(
  ids: string[],
  action: BulkAction,
): Promise<{ changed: number; undo: BulkUndo }> {
  return db.transaction('rw', db.tables, async () => {
    const contacts = (await db.contacts.bulkGet(ids)).filter((c) => c && !c.deletedAt);
    const before: BulkUndo['before'] = [];
    for (const c of contacts) {
      if (!c) continue;
      const snapshot = {
        id: c.id,
        tagIds: c.tagIds,
        groupIds: c.groupIds,
        isArchived: c.isArchived,
      };
      switch (action.type) {
        case 'add-tag':
          if (c.tagIds.includes(action.tagId)) continue;
          await setContactTags(c.id, [...c.tagIds, action.tagId]);
          break;
        case 'remove-tag':
          if (!c.tagIds.includes(action.tagId)) continue;
          await setContactTags(
            c.id,
            c.tagIds.filter((t) => t !== action.tagId),
          );
          break;
        case 'add-group':
          if (c.groupIds.includes(action.groupId)) continue;
          await addToGroup(c.id, action.groupId);
          break;
        case 'remove-group':
          if (!c.groupIds.includes(action.groupId)) continue;
          await removeFromGroup(c.id, action.groupId);
          break;
        case 'archive':
          if (c.isArchived === action.archived) continue;
          await updateContactStatus(c.id, { isArchived: action.archived });
          break;
        case 'trash':
          await deleteContact(c.id);
          break;
      }
      before.push(snapshot);
    }
    return { changed: before.length, undo: { action, before } };
  });
}

/** Reverts a bulk action for the contacts it changed. */
export async function undoBulkUpdate({ action, before }: BulkUndo): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const prev of before) {
      switch (action.type) {
        case 'add-tag':
        case 'remove-tag':
          await setContactTags(prev.id, prev.tagIds);
          break;
        case 'add-group':
          await removeFromGroup(prev.id, action.groupId);
          break;
        case 'remove-group':
          await addToGroup(prev.id, action.groupId);
          break;
        case 'archive':
          await updateContactStatus(prev.id, { isArchived: prev.isArchived });
          break;
        case 'trash':
          await restoreContact(prev.id);
          break;
      }
    }
  });
}
