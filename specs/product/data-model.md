# Data model

> Section numbers (§n) are stable IDs carried over from the original single-file spec and are
> cited throughout the code (`// features §8.5`). Never renumber; add new subsections at the end.

## 5. Data model (IndexedDB via Dexie)

All records share:

```ts
interface BaseRecord {
  id: string;          // UUID v4
  createdAt: string;   // ISO datetime
  updatedAt: string;   // ISO datetime
  deletedAt?: string;  // soft delete (tombstone); hidden from UI; purged from Trash after 30 days
}
```

### 5.1 Entities

```ts
interface Contact extends BaseRecord {
  firstName: string;
  lastName?: string;
  nickname?: string;            // shown like an @handle: "@lise"
  gender?: string;              // free text
  pronouns?: string;
  avatarBlobId?: string;
  bannerBlobId?: string;
  bannerColor?: string;         // fallback banner
  birthday?: PartialDate;       // year optional
  isBirthdayYearKnown?: boolean;
  howWeMet?: { text?: string; date?: PartialDate; place?: string; introducedById?: string };
  bio?: string;                 // short summary line
  jobTitle?: string;
  company?: string;
  foodPreferences?: string;
  isStarred: boolean;
  isArchived: boolean;          // "inactive" contacts
  isDeceased?: boolean;
  deceasedDate?: PartialDate;
  stayInTouchDays?: number;     // e.g. 30 → nudge if no moment in 30 days
  lastInteractionAt?: string;   // denormalized; updated when a moment mentions the contact
  tagIds: string[];
  groupIds: string[];
}

type PartialDate = { year?: number; month: number; day: number }; // month 1–12

interface ContactField extends BaseRecord {   // phones, emails, socials…
  contactId: string;
  type: 'phone' | 'email' | 'website' | 'whatsapp' | 'telegram' | 'signal'
      | 'instagram' | 'linkedin' | 'x' | 'facebook' | 'other';
  label?: string;               // "Work", "Personal"
  value: string;
  isPrimary?: boolean;
}

interface Address extends BaseRecord {
  contactId: string;
  label?: string;
  street?: string; city?: string; region?: string; postalCode?: string; country?: string;
  isCurrent: boolean;
}

interface Relationship extends BaseRecord {
  fromContactId: string;
  toContactId: string;
  type: RelationshipType;       // stored from "from" perspective
  since?: PartialDate;
  notes?: string;
}
// Creating A→B "parent" auto-creates the inverse B→A "child" (linked via inverseId).
type RelationshipType =
  | 'partner' | 'spouse' | 'ex-partner' | 'date'
  | 'parent' | 'child' | 'sibling' | 'grandparent' | 'grandchild'
  | 'uncle-aunt' | 'nephew-niece' | 'cousin' | 'in-law' | 'godparent' | 'godchild'
  | 'friend' | 'best-friend' | 'colleague' | 'boss' | 'subordinate' | 'mentor' | 'protege'
  | 'neighbour' | 'other';

interface Moment extends BaseRecord {          // the "post"
  kind: 'activity' | 'note' | 'call' | 'journal' | 'life-event';
  body: string;                 // markdown-lite text with @mentions and #tags
  happenedAt: string;           // ISO datetime (user-editable, defaults to now)
  contactIds: string[];         // resolved from @mentions + explicit picker
  tagIds: string[];
  // kind-specific:
  activityType?: 'meal' | 'coffee' | 'drinks' | 'trip' | 'event' | 'sport' | 'visit' | 'other';
  location?: string;
  callDirection?: 'incoming' | 'outgoing';
  callDurationMin?: number;
  lifeEventType?: 'new-job' | 'moved' | 'engaged' | 'married' | 'baby' | 'graduated'
                | 'new-pet' | 'retired' | 'loss' | 'health' | 'other';
  mood?: 1 | 2 | 3 | 4 | 5;    // journal only, optional
  photoBlobIds: string[];       // up to 4, displayed in X-style grid
  isPinned?: boolean;           // pinned to top of a contact profile
  isStarred: boolean;
}

interface Reminder extends BaseRecord {
  contactId?: string;
  title: string;
  notes?: string;
  dueDate: string;              // ISO date (+ optional time)
  dueTime?: string;             // "HH:mm"
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceInterval?: number;  // every N units
  source: 'manual' | 'birthday' | 'important-date' | 'stay-in-touch';
  sourceId?: string;            // e.g. ImportantDate id
  completedAt?: string;         // for non-recurring; recurring advance dueDate instead
  lastNotifiedAt?: string;
  snoozedUntil?: string;
}

interface ImportantDate extends BaseRecord {   // anniversaries, name days…
  contactId: string;
  label: string;
  date: PartialDate;
  remind: boolean;
  remindDaysBefore?: number;
}

interface Gift extends BaseRecord {
  contactId: string;
  name: string;
  status: 'idea' | 'bought' | 'given' | 'received';
  occasion?: string;
  url?: string;
  price?: number; currency?: string;
  date?: string;
  notes?: string;
  photoBlobId?: string;
}

interface Debt extends BaseRecord {
  contactId: string;
  direction: 'i-owe' | 'they-owe';
  amount: number; currency: string;
  reason?: string;
  date: string;
  settledAt?: string;
}

interface Task extends BaseRecord {
  contactId?: string;
  title: string;
  notes?: string;
  dueDate?: string;
  completedAt?: string;
}

interface Pet extends BaseRecord {
  contactId: string;
  name: string;
  species?: string;
  notes?: string;
}

interface Tag extends BaseRecord { name: string; color?: string }      // unique, case-insensitive
interface Group extends BaseRecord { name: string; description?: string; emoji?: string; bannerColor?: string }

interface SavedSearch extends BaseRecord {   // Phase 12, db.version(2)
  name: string;
  query: string;                // may be empty when filters alone select the results
  filters: {
    kinds?: MomentKind[];       // moments only
    from?: string; to?: string; // inclusive local dates (YYYY-MM-DD), moments only
    tagIds?: string[];          // all must match (moments and people)
    groupIds?: string[];        // any group matches (moments mentioning a member; people in a group)
    notContactedDays?: number;  // people only
  };
}

interface MergeSnapshot extends BaseRecord {   // Phase 13, db.version(3)
  primaryId: string; secondaryId: string;
  mergedAt: string;
  primaryUpdatedAt: string;     // primary.updatedAt right after the merge; a later edit makes undo unsafe
  secondaryDeletedAt: string;   // the tombstone the merge put on the secondary
  before: Record<string, object[]>; // rows as they were before the merge, by table name
}

interface BlobRecord {           // images; no BaseRecord timestamps needed beyond createdAt
  id: string; createdAt: string;
  mime: string; width: number; height: number; size: number;
  data: Blob;
}

interface Setting { key: string; value: unknown }   // theme, accent, locale, currency, notification prefs…
```

### 5.2 Dexie schema (versions 1–3)

```ts
db.version(1).stores({
  contacts:       'id, firstName, lastName, nickname, isStarred, isArchived, lastInteractionAt, *tagIds, *groupIds, updatedAt, deletedAt',
  contactFields:  'id, contactId, type, value, deletedAt',
  addresses:      'id, contactId, deletedAt',
  relationships:  'id, fromContactId, toContactId, type, deletedAt',
  moments:        'id, kind, happenedAt, *contactIds, *tagIds, isStarred, deletedAt, [kind+happenedAt]',
  reminders:      'id, contactId, dueDate, source, sourceId, completedAt, deletedAt',
  importantDates: 'id, contactId, deletedAt',
  gifts:          'id, contactId, status, deletedAt',
  debts:          'id, contactId, direction, settledAt, deletedAt',
  tasks:          'id, contactId, dueDate, completedAt, deletedAt',
  pets:           'id, contactId, deletedAt',
  tags:           'id, &nameLower, deletedAt',
  groups:         'id, name, deletedAt',
  blobs:          'id',
  settings:       'key',
  searchIndex:    '[entity+entityId], *tokens',   // see §8.6
});
```

```ts
db.version(2).stores({ savedSearches: 'id, name, deletedAt' });   // Phase 12; no data upgrade needed
```

```ts
db.version(3).stores({ mergeSnapshots: 'id, primaryId, secondaryId, mergedAt, deletedAt' });   // Phase 13
```

- Backups carry `schemaVersion` 3; `backupMigrations[2]` adds an empty `mergeSnapshots` for v2 files.
- (v2 note) Backups carried `schemaVersion` 2; `backupMigrations[1]` adds an empty `savedSearches` for older files.
- Every schema change = new `db.version(n)` with an `.upgrade()` migration. Never edit a released version.
- Deleting a contact soft-deletes its dependent records in one Dexie transaction; restoring from Trash restores them.
