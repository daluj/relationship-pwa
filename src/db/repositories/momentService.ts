import Dexie from 'dexie';
import { extractIds } from '@/domain/momentText';
import type { Moment, MomentKind } from '@/domain/types';
import { db } from '../db';
import { blobRepo } from './blobRepo';
import { nowIso } from './createRepository';
import type { NewImage } from './contactService';
import { momentRepo } from './entities';
import { RecordNotFoundError } from './errors';
import { syncStayInTouchReminder } from './reminderService';
import { indexMoment, removeMomentFromIndex, searchTables } from './searchService';

/** Blob id of the feed thumbnail stored next to a full-size photo (SPEC §10). */
export const thumbId = (photoId: string) => `${photoId}:thumb`;

export type MomentPhotoDraft = { existingId: string } | { image: NewImage; thumb: NewImage };

type KindFields = Pick<
  Moment,
  'activityType' | 'location' | 'callDirection' | 'callDurationMin' | 'lifeEventType' | 'mood'
>;

export interface MomentDraft extends KindFields {
  kind: MomentKind;
  /** Body with tokens (see domain/momentText). */
  body: string;
  happenedAt: string;
  /** People added with the explicit picker; @mentions are merged in automatically. */
  contactIds: string[];
  photos: MomentPhotoDraft[];
}

/** Fields that only make sense for some kinds (SPEC §5.1); others are cleared on save. */
function kindFields(d: MomentDraft): KindFields {
  return {
    location: d.location?.trim() || undefined,
    activityType: d.kind === 'activity' ? d.activityType : undefined,
    callDirection: d.kind === 'call' ? d.callDirection : undefined,
    callDurationMin: d.kind === 'call' ? d.callDurationMin : undefined,
    lifeEventType: d.kind === 'life-event' ? d.lifeEventType : undefined,
    mood: d.kind === 'journal' ? d.mood : undefined,
  };
}

const tables = () => [db.moments, db.contacts, db.blobs, db.reminders, ...searchTables()];

/** Denormalized `Contact.lastInteractionAt` = newest live moment mentioning them (SPEC §5.1). */
export async function refreshLastInteraction(contactIds: Iterable<string>): Promise<void> {
  for (const id of new Set(contactIds)) {
    const contact = await db.contacts.get(id);
    if (!contact) continue;
    let latest: string | undefined;
    await db.moments
      .where('contactIds')
      .equals(id)
      .each((m) => {
        if (!m.deletedAt && (!latest || m.happenedAt > latest)) latest = m.happenedAt;
      });
    if (latest === contact.lastInteractionAt) continue;
    const { lastInteractionAt: _, ...rest } = contact;
    const updated = { ...rest, ...(latest && { lastInteractionAt: latest }), updatedAt: nowIso() };
    await db.contacts.put(updated);
    await syncStayInTouchReminder(updated); // logging a moment clears "stay in touch" (SPEC §8.5)
  }
}

async function deletePhotoBlobs(ids: string[]) {
  await db.blobs.bulkDelete(ids.flatMap((id) => [id, thumbId(id)]));
}

/** Create or update a moment with its photos; keeps mentions, tags and lastInteractionAt in sync. */
export async function saveMoment(id: string | undefined, draft: MomentDraft): Promise<Moment> {
  return db.transaction('rw', tables(), async () => {
    const before = id ? await momentRepo.get(id) : undefined;
    if (id && !before) throw new RecordNotFoundError('moment', id);

    const photoBlobIds: string[] = [];
    for (const p of draft.photos) {
      if ('existingId' in p) {
        photoBlobIds.push(p.existingId);
      } else {
        const full = await blobRepo.put({ ...p.image, size: p.image.data.size });
        await blobRepo.put({ ...p.thumb, size: p.thumb.data.size, id: thumbId(full.id) });
        photoBlobIds.push(full.id);
      }
    }
    if (before)
      await deletePhotoBlobs(before.photoBlobIds.filter((b) => !photoBlobIds.includes(b)));

    const mentioned = extractIds(draft.body);
    const data = {
      kind: draft.kind,
      body: draft.body,
      happenedAt: draft.happenedAt,
      contactIds: [...new Set([...mentioned.contactIds, ...draft.contactIds])],
      tagIds: mentioned.tagIds,
      photoBlobIds,
      ...kindFields(draft),
    };
    const moment = before
      ? await momentRepo.update(before.id, data)
      : await momentRepo.create(data);
    await refreshLastInteraction([...(before?.contactIds ?? []), ...moment.contactIds]);
    await indexMoment(moment.id);
    return moment;
  });
}

async function patch(id: string, change: Partial<Moment>, refresh = false): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    const m = await momentRepo.update(id, change);
    if (refresh) await refreshLastInteraction(m.contactIds);
  });
}

export const setMomentStarred = (id: string, isStarred: boolean) => patch(id, { isStarred });
export const setMomentPinned = (id: string, isPinned: boolean) =>
  patch(id, { isPinned: isPinned || undefined });
/** "Change date" — re-sorts feeds and may change lastInteractionAt (SPEC §8.4). */
export const setMomentDate = (id: string, happenedAt: string) => patch(id, { happenedAt }, true);

export async function deleteMoment(id: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    await momentRepo.softDelete(id);
    await removeMomentFromIndex(id);
    const m = await momentRepo.get(id, { includeDeleted: true });
    await refreshLastInteraction(m?.contactIds ?? []);
  });
}

export async function restoreMoment(id: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    await momentRepo.restore(id);
    await indexMoment(id);
    const m = await momentRepo.get(id);
    await refreshLastInteraction(m?.contactIds ?? []);
  });
}

/** Permanently delete a moment and its photos. */
export async function purgeMoment(id: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    const m = await db.moments.get(id);
    if (!m) return;
    await deletePhotoBlobs(m.photoBlobIds);
    await db.moments.delete(id);
    await removeMomentFromIndex(id);
    await refreshLastInteraction(m.contactIds);
  });
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Home feed, newest first; `limit` grows as the user scrolls (SPEC §8.4: pages of 30). */
export function feed({ kind, limit }: { kind?: MomentKind; limit: number }): Promise<Moment[]> {
  const coll = kind
    ? db.moments
        .where('[kind+happenedAt]')
        .between([kind, Dexie.minKey], [kind, Dexie.maxKey])
        .reverse()
    : db.moments.orderBy('happenedAt').reverse();
  return coll
    .filter((m) => !m.deletedAt)
    .limit(limit)
    .toArray();
}

const newestFirst = (a: Moment, b: Moment) => b.happenedAt.localeCompare(a.happenedAt);

/** Profile timeline: pinned moments first, then newest first (SPEC §6.6). */
export async function momentsForContact(contactId: string): Promise<Moment[]> {
  const list = await db.moments
    .where('contactIds')
    .equals(contactId)
    .filter((m) => !m.deletedAt)
    .toArray();
  return list.sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned) || newestFirst(a, b));
}

export async function momentsForTag(tagId: string): Promise<Moment[]> {
  const list = await db.moments
    .where('tagIds')
    .equals(tagId)
    .filter((m) => !m.deletedAt)
    .toArray();
  return list.sort(newestFirst);
}

export async function listTrashedMoments(): Promise<Moment[]> {
  const rows = await db.moments.where('deletedAt').above('').toArray();
  return rows.sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
}
