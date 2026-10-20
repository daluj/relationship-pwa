// Per-contact collections shown on profile tabs (features §8.7): gifts, debts, tasks, pets, tags.
import type { Debt, Gift, Pet, Task } from '@/domain/types';
import { db } from '../db';
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

export const saveGift = (id: string | undefined, d: GiftDraft) =>
  id ? giftRepo.update(id, d) : giftRepo.create(d);
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
