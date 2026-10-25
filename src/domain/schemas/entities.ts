import { z } from 'zod';
import {
  baseRecordSchema,
  isoDateOrDateTime,
  isoDateTime,
  partialDateSchema,
  uuid,
} from './common';

// data-model §5.1. Zod schemas are the single source of truth; TS types are inferred from them.

export const contactSchema = baseRecordSchema.extend({
  firstName: z.string().trim().min(1),
  lastName: z.string().optional(),
  nickname: z.string().optional(),
  gender: z.string().optional(),
  pronouns: z.string().optional(),
  avatarBlobId: z.string().optional(),
  bannerBlobId: z.string().optional(),
  bannerColor: z.string().optional(),
  birthday: partialDateSchema.optional(),
  isBirthdayYearKnown: z.boolean().optional(),
  howWeMet: z
    .object({
      text: z.string().optional(),
      date: partialDateSchema.optional(),
      place: z.string().optional(),
      introducedById: uuid.optional(),
    })
    .optional(),
  bio: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  foodPreferences: z.string().optional(),
  isStarred: z.boolean(),
  isArchived: z.boolean(),
  isDeceased: z.boolean().optional(),
  deceasedDate: partialDateSchema.optional(),
  stayInTouchDays: z.number().int().positive().optional(),
  lastInteractionAt: isoDateTime.optional(),
  tagIds: z.array(uuid),
  groupIds: z.array(uuid),
});

export const contactFieldTypes = [
  'phone',
  'email',
  'website',
  'whatsapp',
  'telegram',
  'signal',
  'instagram',
  'linkedin',
  'x',
  'facebook',
  'other',
] as const;

export const contactFieldSchema = baseRecordSchema.extend({
  contactId: uuid,
  type: z.enum(contactFieldTypes),
  label: z.string().optional(),
  value: z.string().min(1),
  isPrimary: z.boolean().optional(),
  /** Display order as entered (not indexed; DECISIONS D-058). */
  position: z.number().int().nonnegative().optional(),
});

export const addressSchema = baseRecordSchema.extend({
  contactId: uuid,
  label: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  isCurrent: z.boolean(),
  position: z.number().int().nonnegative().optional(),
});

export const relationshipTypes = [
  'partner',
  'spouse',
  'ex-partner',
  'date',
  'parent',
  'child',
  'sibling',
  'grandparent',
  'grandchild',
  'uncle-aunt',
  'nephew-niece',
  'cousin',
  'in-law',
  'godparent',
  'godchild',
  'friend',
  'best-friend',
  'colleague',
  'boss',
  'subordinate',
  'mentor',
  'protege',
  'neighbour',
  'other',
] as const;

export const relationshipSchema = baseRecordSchema.extend({
  fromContactId: uuid,
  toContactId: uuid,
  type: z.enum(relationshipTypes),
  inverseId: uuid.optional(), // DECISIONS D-002
  since: partialDateSchema.optional(),
  notes: z.string().optional(),
});

export const momentKinds = ['activity', 'note', 'call', 'journal', 'life-event'] as const;

export const momentSchema = baseRecordSchema.extend({
  kind: z.enum(momentKinds),
  body: z.string().max(5000),
  happenedAt: isoDateTime,
  contactIds: z.array(uuid),
  tagIds: z.array(uuid),
  activityType: z
    .enum(['meal', 'coffee', 'drinks', 'trip', 'event', 'sport', 'visit', 'other'])
    .optional(),
  location: z.string().optional(),
  callDirection: z.enum(['incoming', 'outgoing']).optional(),
  callDurationMin: z.number().nonnegative().optional(),
  lifeEventType: z
    .enum([
      'new-job',
      'moved',
      'engaged',
      'married',
      'baby',
      'graduated',
      'new-pet',
      'retired',
      'loss',
      'health',
      'other',
    ])
    .optional(),
  mood: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  photoBlobIds: z.array(z.string()).max(4),
  isPinned: z.boolean().optional(),
  isStarred: z.boolean(),
});

export const reminderSchema = baseRecordSchema.extend({
  contactId: uuid.optional(),
  title: z.string().trim().min(1),
  notes: z.string().optional(),
  dueDate: isoDateOrDateTime,
  dueTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']),
  recurrenceInterval: z.number().int().positive().optional(),
  source: z.enum(['manual', 'birthday', 'important-date', 'stay-in-touch']),
  sourceId: z.string().optional(),
  completedAt: isoDateTime.optional(),
  lastNotifiedAt: isoDateTime.optional(),
  snoozedUntil: isoDateOrDateTime.optional(),
});

export const importantDateSchema = baseRecordSchema.extend({
  contactId: uuid,
  label: z.string().trim().min(1),
  date: partialDateSchema,
  remind: z.boolean(),
  remindDaysBefore: z.number().int().nonnegative().optional(),
});

export const giftSchema = baseRecordSchema.extend({
  contactId: uuid,
  name: z.string().trim().min(1),
  status: z.enum(['idea', 'bought', 'given', 'received']),
  occasion: z.string().optional(),
  url: z.string().url().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  date: isoDateOrDateTime.optional(),
  notes: z.string().optional(),
  photoBlobId: z.string().optional(),
});

export const debtSchema = baseRecordSchema.extend({
  contactId: uuid,
  direction: z.enum(['i-owe', 'they-owe']),
  amount: z.number().positive(),
  currency: z.string().length(3),
  reason: z.string().optional(),
  date: isoDateOrDateTime,
  settledAt: isoDateTime.optional(),
});

export const taskSchema = baseRecordSchema.extend({
  contactId: uuid.optional(),
  title: z.string().trim().min(1),
  notes: z.string().optional(),
  dueDate: isoDateOrDateTime.optional(),
  completedAt: isoDateTime.optional(),
});

export const petSchema = baseRecordSchema.extend({
  contactId: uuid,
  name: z.string().trim().min(1),
  species: z.string().optional(),
  notes: z.string().optional(),
});

export const tagSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1),
  nameLower: z.string().min(1), // DECISIONS D-001 — derived by the repository
  color: z.string().optional(),
});

export const groupSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  emoji: z.string().optional(),
  bannerColor: z.string().optional(),
});

export const searchFiltersSchema = z.object({
  kinds: z.array(z.enum(momentKinds)).optional(),
  /** Inclusive local dates, `YYYY-MM-DD`. */
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  tagIds: z.array(z.string()).optional(),
  groupIds: z.array(z.string()).optional(),
  notContactedDays: z.number().int().positive().optional(),
});

/** A named query plus filters (features §8.13). */
export const savedSearchSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1),
  query: z.string(),
  filters: searchFiltersSchema,
});

export const blobRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: isoDateTime,
  mime: z.string().regex(/^image\//),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  size: z.number().int().nonnegative(),
  data: z.instanceof(Blob),
});

export const settingSchema = z.object({ key: z.string().min(1), value: z.unknown() });

export const searchIndexEntrySchema = z.object({
  entity: z.enum(['contact', 'moment', 'tag']),
  entityId: z.string(),
  tokens: z.array(z.string()),
});
