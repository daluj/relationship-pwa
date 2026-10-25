// Per-contact collections shown on profile tabs (features §8.7): gifts, debts, tasks, pets, tags.
import type { Debt, Gift, Pet, Task } from '@/domain/types';
import { db } from '../db';
import { blobRepo } from './blobRepo';
import type { NewImage } from './contactService';
import { nowIso } from './createRepository';
import { contactRepo, debtRepo, giftRepo, petRepo, taskRepo } from './entities';
import { indexContact, searchTables } from './searchService';

export const giftsFor = (contactId: string): Promise<Gift[]> =>
  db.gifts
    .where('contactId')
    .equals(contactId)
    .filter((r) => !r.deletedAt)
    .toArray();
export const debtsFor = (contactId: string): Promise<Debt[]> =>
  db.debts
    .where('contactId')
    .equals(contactId)
    .filter((r) => !r.deletedAt)
    .toArray();
export const tasksFor = (contactId: string): Promise<Task[]> =>
  db.tasks
    .where('contactId')
    .equals(contactId)
    .filter((r) => !r.deletedAt)
    .toArray();
export const petsFor = (contactId: string): Promise<Pet[]> =>
  db.pets
    .where('contactId')
    .equals(contactId)
    .filter((r) => !r.deletedAt)
    .toArray();

export type GiftDraft = Omit<Gift, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type DebtDraft = Omit<Debt, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'settledAt'>;
export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'completedAt'>;
export type PetDraft = Omit<Pet, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** Blob id of the thumbnail stored next to a full-size image (D-026). */
const thumbOf = (photoId: string) => `${photoId}:thumb`;

/** `undefined` keeps the gift's photo, `null` removes it, an image replaces it (features §8.12). */
export type GiftPhotoChange = { image: NewImage; thumb: NewImage } | null | undefined;

/** Deletes a gift photo and its thumbnail. */
export const deleteGiftPhotoBlobs = (photoIds: string[]) =>
  db.blobs.bulkDelete(photoIds.flatMap((id) => [id, thumbOf(id)]));

export async function saveGift(id: string | undefined, d: GiftDraft, photo?: GiftPhotoChange) {
  return db.transaction('rw', [db.gifts, db.blobs], async () => {
    const current = id ? await giftRepo.get(id) : undefined;
    let photoBlobId = d.photoBlobId ?? current?.photoBlobId;
    if (photo !== undefined) {
      if (current?.photoBlobId) await deleteGiftPhotoBlobs([current.photoBlobId]);
      photoBlobId = undefined;
      if (photo) {
        const full = await blobRepo.put({ ...photo.image, size: photo.image.data.size });
        await blobRepo.put({
          ...photo.thumb,
          size: photo.thumb.data.size,
          id: thumbOf(full.id),
        });
        photoBlobId = full.id;
      }
    }
    const draft = { ...d, photoBlobId };
    return id ? giftRepo.update(id, draft) : giftRepo.create(draft);
  });
}
export const saveDebt = (id: string | undefined, d: DebtDraft) =>
  id ? debtRepo.update(id, d) : debtRepo.create(d);
export const saveTask = (id: string | undefined, d: TaskDraft) =>
  id ? taskRepo.update(id, d) : taskRepo.create(d);
export const savePet = (id: string | undefined, d: PetDraft) =>
  id ? petRepo.update(id, d) : petRepo.create(d);

/** Settling removes a debt from the balance and records when (features §8.7 AC). */
export const settleDebt = (id: string, settled: boolean) =>
  debtRepo.update(id, { settledAt: settled ? nowIso() : undefined });

export const setTaskDone = (id: string, done: boolean) =>
  taskRepo.update(id, { completedAt: done ? nowIso() : undefined });

/** All live tasks for the global Tasks page. */
export const listTasks = () => taskRepo.list();

/** All unsettled debts (right-rail Money card). */
export const listOpenDebts = () => db.debts.filter((d) => !d.deletedAt && !d.settledAt).toArray();

export const setContactTags = (contactId: string, tagIds: string[]) =>
  db.transaction('rw', searchTables(), async () => {
    const c = await contactRepo.update(contactId, { tagIds: [...new Set(tagIds)] });
    await indexContact(contactId);
    return c;
  });

/** Starred contacts and moments (ui §6.7 Starred). Booleans aren't indexable, so these filter. */
export const starredContacts = () =>
  db.contacts.filter((c) => c.isStarred && !c.deletedAt && !c.isArchived).toArray();
export const starredMoments = async () =>
  (await db.moments.filter((m) => m.isStarred && !m.deletedAt).toArray()).sort((a, b) =>
    b.happenedAt.localeCompare(a.happenedAt),
  );
