import type { z } from 'zod';
import type * as s from './schemas';

export type { BaseRecord, PartialDate } from './schemas';

export type Contact = z.infer<typeof s.contactSchema>;
export type ContactField = z.infer<typeof s.contactFieldSchema>;
export type ContactFieldType = ContactField['type'];
export type Address = z.infer<typeof s.addressSchema>;
export type Relationship = z.infer<typeof s.relationshipSchema>;
export type RelationshipType = Relationship['type'];
export type Moment = z.infer<typeof s.momentSchema>;
export type MomentKind = Moment['kind'];
export type Reminder = z.infer<typeof s.reminderSchema>;
export type ImportantDate = z.infer<typeof s.importantDateSchema>;
export type Gift = z.infer<typeof s.giftSchema>;
export type Debt = z.infer<typeof s.debtSchema>;
export type Task = z.infer<typeof s.taskSchema>;
export type Pet = z.infer<typeof s.petSchema>;
export type Tag = z.infer<typeof s.tagSchema>;
export type Group = z.infer<typeof s.groupSchema>;
export type SearchFilters = z.infer<typeof s.searchFiltersSchema>;
export type SavedSearch = z.infer<typeof s.savedSearchSchema>;
export type BlobRecord = z.infer<typeof s.blobRecordSchema>;
export type Setting = z.infer<typeof s.settingSchema>;
export type SearchIndexEntry = z.infer<typeof s.searchIndexEntrySchema>;
