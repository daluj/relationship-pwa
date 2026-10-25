import * as s from '@/domain/schemas';
import { normalizeTagName } from '@/domain/tags';
import type {
  Address,
  Contact,
  ContactField,
  Debt,
  Gift,
  Group,
  ImportantDate,
  MergeSnapshot,
  Moment,
  Pet,
  Relationship,
  Reminder,
  SavedSearch,
  Tag,
  Task,
} from '@/domain/types';
import { db } from '../db';
import { createRepository, nowIso, type CreateInput } from './createRepository';
import { DuplicateError } from './errors';

// Per-entity repositories. Cross-entity behaviour (cascading soft delete, inverse relationships,
// birthday reminders, lastInteractionAt, search index) lands with the milestone that owns it (roadmap §14).

export const contactRepo = createRepository<
  Contact,
  'isStarred' | 'isArchived' | 'tagIds' | 'groupIds'
>({
  entity: 'contact',
  table: db.contacts,
  schema: s.contactSchema,
  defaults: () => ({ isStarred: false, isArchived: false, tagIds: [], groupIds: [] }),
});

export const contactFieldRepo = createRepository<ContactField>({
  entity: 'contactField',
  table: db.contactFields,
  schema: s.contactFieldSchema,
});

export const addressRepo = createRepository<Address, 'isCurrent'>({
  entity: 'address',
  table: db.addresses,
  schema: s.addressSchema,
  defaults: () => ({ isCurrent: true }),
});

export const relationshipRepo = createRepository<Relationship>({
  entity: 'relationship',
  table: db.relationships,
  schema: s.relationshipSchema,
});

export const momentRepo = createRepository<
  Moment,
  'happenedAt' | 'contactIds' | 'tagIds' | 'photoBlobIds' | 'isStarred'
>({
  entity: 'moment',
  table: db.moments,
  schema: s.momentSchema,
  defaults: () => ({
    happenedAt: nowIso(),
    contactIds: [],
    tagIds: [],
    photoBlobIds: [],
    isStarred: false,
  }),
});

export const reminderRepo = createRepository<Reminder, 'recurrence' | 'source'>({
  entity: 'reminder',
  table: db.reminders,
  schema: s.reminderSchema,
  defaults: () => ({ recurrence: 'none', source: 'manual' }),
});

export const importantDateRepo = createRepository<ImportantDate, 'remind'>({
  entity: 'importantDate',
  table: db.importantDates,
  schema: s.importantDateSchema,
  defaults: () => ({ remind: true }),
});

export const giftRepo = createRepository<Gift, 'status'>({
  entity: 'gift',
  table: db.gifts,
  schema: s.giftSchema,
  defaults: () => ({ status: 'idea' }),
});

export const debtRepo = createRepository<Debt, 'date'>({
  entity: 'debt',
  table: db.debts,
  schema: s.debtSchema,
  defaults: () => ({ date: nowIso() }),
});

export const taskRepo = createRepository<Task>({
  entity: 'task',
  table: db.tasks,
  schema: s.taskSchema,
});

export const petRepo = createRepository<Pet>({
  entity: 'pet',
  table: db.pets,
  schema: s.petSchema,
});

export const savedSearchRepo = createRepository<SavedSearch>({
  entity: 'savedSearch',
  table: db.savedSearches,
  schema: s.savedSearchSchema,
});

export const mergeSnapshotRepo = createRepository<MergeSnapshot>({
  entity: 'mergeSnapshot',
  table: db.mergeSnapshots,
  schema: s.mergeSnapshotSchema,
});

export const groupRepo = createRepository<Group>({
  entity: 'group',
  table: db.groups,
  schema: s.groupSchema,
});

const baseTagRepo = createRepository<Tag, 'nameLower'>({
  entity: 'tag',
  table: db.tags,
  schema: s.tagSchema,
  prepare: (t) => ({ ...t, nameLower: normalizeTagName(t.name ?? '') }),
});

/**
 * Tag names are unique case-insensitively (`&nameLower`). The unique index also covers
 * soft-deleted tags, so re-creating a deleted name revives that tag (DECISIONS D-004).
 */
export const tagRepo = {
  ...baseTagRepo,

  async findByName(name: string): Promise<Tag | undefined> {
    const tag = await db.tags.where('nameLower').equals(normalizeTagName(name)).first();
    return tag && !tag.deletedAt ? tag : undefined;
  },

  async create(input: CreateInput<Tag, 'nameLower'>): Promise<Tag> {
    return db.transaction('rw', db.tags, async () => {
      const existing = await db.tags
        .where('nameLower')
        .equals(normalizeTagName(input.name))
        .first();
      if (!existing) return baseTagRepo.create(input);
      if (!existing.deletedAt) throw new DuplicateError('tag', input.name);
      await baseTagRepo.restore(existing.id);
      return baseTagRepo.update(existing.id, { name: input.name, color: input.color });
    });
  },

  async update(id: string, patch: Parameters<typeof baseTagRepo.update>[1]): Promise<Tag> {
    if (patch.name !== undefined) {
      const clash = await db.tags.where('nameLower').equals(normalizeTagName(patch.name)).first();
      if (clash && clash.id !== id) throw new DuplicateError('tag', patch.name);
    }
    return baseTagRepo.update(id, patch);
  },
};
