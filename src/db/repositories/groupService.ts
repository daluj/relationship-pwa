import type { Contact, Group, Moment } from '@/domain/types';
import { db } from '../db';
import { nowIso } from './createRepository';
import { groupRepo } from './entities';

export type GroupDraft = Pick<Group, 'name' | 'description' | 'emoji' | 'bannerColor'>;

export const saveGroup = (id: string | undefined, draft: GroupDraft) =>
  id ? groupRepo.update(id, draft) : groupRepo.create(draft);

/** Soft delete; memberships stay so Undo restores them. Purged groups are removed from contacts. */
export const deleteGroup = (id: string) => groupRepo.softDelete(id);
export const restoreGroup = (id: string) => groupRepo.restore(id);

export async function listGroups(): Promise<Group[]> {
  return (await groupRepo.list()).sort((a, b) => a.name.localeCompare(b.name));
}

async function setMembership(contactId: string, groupId: string, member: boolean) {
  await db.contacts
    .where('id')
    .equals(contactId)
    .modify((c) => {
      const has = c.groupIds.includes(groupId);
      if (member === has) return;
      c.groupIds = member ? [...c.groupIds, groupId] : c.groupIds.filter((g) => g !== groupId);
      c.updatedAt = nowIso();
    });
}

export const addToGroup = (contactId: string, groupId: string) =>
  setMembership(contactId, groupId, true);
export const removeFromGroup = (contactId: string, groupId: string) =>
  setMembership(contactId, groupId, false);

export async function groupMembers(groupId: string): Promise<Contact[]> {
  return db.contacts
    .where('groupIds')
    .equals(groupId)
    .filter((c) => !c.deletedAt)
    .toArray();
}

/** Group timeline: moments mentioning any member, newest first (ui §6.7). */
export async function groupTimeline(groupId: string): Promise<Moment[]> {
  const ids = (await groupMembers(groupId)).map((c) => c.id);
  if (!ids.length) return [];
  const moments = await db.moments
    .where('contactIds')
    .anyOf(ids)
    .distinct()
    .filter((m) => !m.deletedAt)
    .toArray();
  return moments.sort((a, b) => b.happenedAt.localeCompare(a.happenedAt));
}

/** Member counts for the groups list. */
export async function groupMemberCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await db.contacts.each((c) => {
    if (c.deletedAt) return;
    for (const g of c.groupIds) counts[g] = (counts[g] ?? 0) + 1;
  });
  return counts;
}
