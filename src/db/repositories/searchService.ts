import { fullName } from '@/domain/contact';
import { fuzzyScore, normalizeText } from '@/domain/fuzzy';
import {
  contactDocument,
  goalDocument,
  indexTokens,
  isEmptyQuery,
  momentDocument,
  parseQuery,
} from '@/domain/search';
import type { Contact, Goal, Moment, Tag } from '@/domain/types';
import { db } from '../db';

/**
 * Client-side full-text index (features §8.6). Rows are `{ entity, entityId, tokens }` with a multi-entry
 * index on tokens. Writers call these inside their own transactions, which must include
 * `searchTables()`, so the index never drifts from the data.
 */
export const searchTables = () => [
  db.searchIndex,
  db.contacts,
  db.contactFields,
  db.addresses,
  db.tags,
  db.moments,
  db.goals,
];

/** Bump when tokenization or document contents change; triggers a rebuild on app start. */
export const SEARCH_INDEX_VERSION = 2;
const VERSION_KEY = 'searchIndexVersion';

const live = <T extends { deletedAt?: string }>(r: T | undefined): r is T => !!r && !r.deletedAt;

export async function indexContact(id: string): Promise<void> {
  const c = await db.contacts.get(id);
  if (!live(c)) return removeContactFromIndex(id);
  const [fields, addresses, tags] = await Promise.all([
    db.contactFields
      .where('contactId')
      .equals(id)
      .filter((f) => !f.deletedAt)
      .toArray(),
    db.addresses
      .where('contactId')
      .equals(id)
      .filter((a) => !a.deletedAt)
      .toArray(),
    db.tags.bulkGet(c.tagIds),
  ]);
  const tagNames = tags.filter(live).map((t) => t.name);
  await db.searchIndex.put({
    entity: 'contact',
    entityId: id,
    tokens: indexTokens(contactDocument(c, fields, addresses, tagNames)),
  });
}

export async function indexMoment(id: string): Promise<void> {
  const m = await db.moments.get(id);
  if (!live(m)) return removeMomentFromIndex(id);
  const [contacts, tags] = await Promise.all([
    db.contacts.bulkGet(m.contactIds),
    db.tags.bulkGet(m.tagIds),
  ]);
  const cName = new Map(contacts.filter(live).map((c) => [c.id, fullName(c)]));
  const tName = new Map(tags.filter(live).map((t) => [t.id, t.name]));
  const text = momentDocument(m, { contact: (x) => cName.get(x), tag: (x) => tName.get(x) });
  await db.searchIndex.put({ entity: 'moment', entityId: id, tokens: indexTokens(text) });
}

export async function indexGoal(id: string): Promise<void> {
  const g = await db.goals.get(id);
  if (!live(g)) return removeGoalFromIndex(id);
  await db.searchIndex.put({
    entity: 'goal',
    entityId: id,
    tokens: indexTokens(goalDocument(g)),
  });
}

export const removeGoalFromIndex = (id: string) => db.searchIndex.delete(['goal', id]);
export const removeContactFromIndex = (id: string) => db.searchIndex.delete(['contact', id]);
export const removeMomentFromIndex = (id: string) => db.searchIndex.delete(['moment', id]);

/** After a rename: moments render (and are indexed with) current names. */
export async function reindexMomentsForContact(contactId: string): Promise<void> {
  const ids = await db.moments.where('contactIds').equals(contactId).primaryKeys();
  for (const id of ids) await indexMoment(id);
}

export async function reindexForTag(tagId: string): Promise<void> {
  for (const id of await db.moments.where('tagIds').equals(tagId).primaryKeys())
    await indexMoment(id);
  for (const id of await db.contacts.where('tagIds').equals(tagId).primaryKeys())
    await indexContact(id);
}

/** Full rebuild in batches (first run after upgrade, or when SEARCH_INDEX_VERSION changes). */
export async function rebuildSearchIndex(): Promise<void> {
  await db.searchIndex.clear();
  const contactIds = await db.contacts.toCollection().primaryKeys();
  const momentIds = await db.moments.toCollection().primaryKeys();
  const goalIds = await db.goals.toCollection().primaryKeys();
  const BATCH = 500;
  for (let i = 0; i < contactIds.length; i += BATCH) {
    await db.transaction('rw', searchTables(), async () => {
      for (const id of contactIds.slice(i, i + BATCH)) await indexContact(id);
    });
  }
  for (let i = 0; i < momentIds.length; i += BATCH) {
    await db.transaction('rw', searchTables(), async () => {
      for (const id of momentIds.slice(i, i + BATCH)) await indexMoment(id);
    });
  }
  await db.transaction('rw', searchTables(), async () => {
    for (const id of goalIds) await indexGoal(id);
  });
  await db.settings.put({ key: VERSION_KEY, value: SEARCH_INDEX_VERSION });
}

export async function ensureSearchIndex(): Promise<void> {
  const v = (await db.settings.get(VERSION_KEY))?.value;
  if (v !== SEARCH_INDEX_VERSION) await rebuildSearchIndex();
}

// ── Query ────────────────────────────────────────────────────────────────────

export interface SearchResults {
  contacts: Contact[];
  /** The newest `momentLimit` matching moments. */
  moments: Moment[];
  goals: Goal[];
  /** Total matching moments (for "load more"). */
  momentTotal: number;
  tags: Tag[];
}

const keyOf = (pk: [string, string]) => `${pk[0]}|${pk[1]}`;

/**
 * Newest `limit` moments among `ids`, picking the cheaper strategy (features §8.6 < 100 ms):
 * - few hits: load them and sort;
 * - many hits: walk the `happenedAt` index from the newest end and stop once `limit` hits are found.
 *   With n hits among N moments that touches about limit·N/n keys, so it wins when n² > limit·N.
 */
async function newestMoments(ids: string[], limit: number): Promise<Moment[]> {
  const byNewest = (a: Moment, b: Moment) => b.happenedAt.localeCompare(a.happenedAt);
  const total = await db.moments.count();
  if (ids.length <= limit || ids.length * ids.length <= limit * total) {
    return (await db.moments.bulkGet(ids)).filter(live).sort(byNewest).slice(0, limit);
  }
  const wanted = new Set(ids);
  const ordered: string[] = [];
  await db.moments
    .orderBy('happenedAt')
    .reverse()
    .until(() => ordered.length >= limit)
    .eachPrimaryKey((id) => {
      if (wanted.has(id)) ordered.push(id);
    });
  return (await db.moments.bulkGet(ordered)).filter(live);
}

/**
 * Tokenize, intersect matches (exact for all but the last token, prefix for the last), rank people
 * above moments (features §8.6). People: best name match first; moments: newest first.
 */
export async function search(q: string, momentLimit = 50): Promise<SearchResults> {
  const parsed = parseQuery(q);
  if (isEmptyQuery(parsed))
    return { contacts: [], moments: [], goals: [], momentTotal: 0, tags: [] };

  const sets: Set<string>[] = [];
  for (const t of parsed.exact) {
    const keys = (await db.searchIndex.where('tokens').equals(t).primaryKeys()) as [
      string,
      string,
    ][];
    sets.push(new Set(keys.map(keyOf)));
  }
  if (parsed.prefix) {
    const keys = (await db.searchIndex.where('tokens').startsWith(parsed.prefix).primaryKeys()) as [
      string,
      string,
    ][];
    sets.push(new Set(keys.map(keyOf)));
  }
  sets.sort((a, b) => a.size - b.size);
  const [smallest, ...rest] = sets;
  const hits = [...smallest!].filter((k) => rest.every((s) => s.has(k)));

  const contactIds: string[] = [];
  const momentIds: string[] = [];
  const goalIds: string[] = [];
  for (const k of hits) {
    const [entity, id] = k.split('|') as [string, string];
    (entity === 'contact' ? contactIds : entity === 'goal' ? goalIds : momentIds).push(id);
  }

  const [contacts, moments, goals, tags] = await Promise.all([
    db.contacts.bulkGet(contactIds),
    newestMoments(momentIds, momentLimit),
    db.goals.bulkGet(goalIds),
    db.tags.toArray(),
  ]);
  const name = q.trim();
  const qNorm = normalizeText(name);
  return {
    contacts: contacts
      .filter(live)
      .sort(
        (a, b) =>
          Number(a.isArchived) - Number(b.isArchived) ||
          fuzzyScore(name, fullName(b)) - fuzzyScore(name, fullName(a)) ||
          fullName(a).localeCompare(fullName(b)),
      ),
    moments,
    goals: goals.filter(live).sort((a, b) => a.title.localeCompare(b.title)),
    momentTotal: momentIds.length,
    tags: tags
      .filter((t) => live(t) && normalizeText(t.name).includes(qNorm))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Tag "trends" for the empty search page: tags by number of moments (ui §6.7). */
export async function trendingTags(limit = 10): Promise<{ tag: Tag; count: number }[]> {
  const tags = (await db.tags.toArray()).filter(live);
  const counts = await Promise.all(
    tags.map(async (tag) => ({
      tag,
      count: await db.moments
        .where('tagIds')
        .equals(tag.id)
        .filter((m) => !m.deletedAt)
        .count(),
    })),
  );
  return counts
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name))
    .slice(0, limit);
}
