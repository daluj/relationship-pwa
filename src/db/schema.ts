import Dexie, { type Table } from 'dexie';
import type {
  Address,
  BlobRecord,
  Contact,
  ContactField,
  Debt,
  Gift,
  Group,
  ImportantDate,
  Moment,
  Pet,
  Relationship,
  Reminder,
  SearchIndexEntry,
  Setting,
  Tag,
  Task,
} from '@/domain/types';

export const DB_NAME = 'kin';

/** SPEC §5.2. Tables are typed with explicit string keys: repositories always assign UUIDs.
 * Never edit a released version: add `this.version(n).stores(...).upgrade(...)`. */
export class KinDB extends Dexie {
  contacts!: Table<Contact, string>;
  contactFields!: Table<ContactField, string>;
  addresses!: Table<Address, string>;
  relationships!: Table<Relationship, string>;
  moments!: Table<Moment, string>;
  reminders!: Table<Reminder, string>;
  importantDates!: Table<ImportantDate, string>;
  gifts!: Table<Gift, string>;
  debts!: Table<Debt, string>;
  tasks!: Table<Task, string>;
  pets!: Table<Pet, string>;
  tags!: Table<Tag, string>;
  groups!: Table<Group, string>;
  blobs!: Table<BlobRecord, string>;
  settings!: Table<Setting, string>;
  searchIndex!: Table<SearchIndexEntry, [string, string]>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      contacts:
        'id, firstName, lastName, nickname, isStarred, isArchived, lastInteractionAt, *tagIds, *groupIds, updatedAt, deletedAt',
      contactFields: 'id, contactId, type, value, deletedAt',
      addresses: 'id, contactId, deletedAt',
      relationships: 'id, fromContactId, toContactId, type, deletedAt',
      moments:
        'id, kind, happenedAt, *contactIds, *tagIds, isStarred, deletedAt, [kind+happenedAt]',
      reminders: 'id, contactId, dueDate, source, sourceId, completedAt, deletedAt',
      importantDates: 'id, contactId, deletedAt',
      gifts: 'id, contactId, status, deletedAt',
      debts: 'id, contactId, direction, settledAt, deletedAt',
      tasks: 'id, contactId, dueDate, completedAt, deletedAt',
      pets: 'id, contactId, deletedAt',
      tags: 'id, &nameLower, deletedAt',
      groups: 'id, name, deletedAt',
      blobs: 'id',
      settings: 'key',
      searchIndex: '[entity+entityId], *tokens',
    });
  }
}

export const SCHEMA_VERSION = 1;
