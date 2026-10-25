import Dexie from 'dexie';
import { fullName } from '@/domain/contact';
import { fuzzyScore, normalizeText } from '@/domain/fuzzy';
import {
  contactDocument,
  indexTokens,
  isEmptyQuery,
  momentDocument,
  parseQuery,
} from '@/domain/search';
import { momentKinds } from '@/domain/schemas';
import {
  contactMatchesFilters,
  dayRange,
  hasAnyFilter,
  momentMatchesFilters,
} from '@/domain/searchFilters';
import type { Contact, Moment, SearchFilters, Tag } from '@/domain/types';
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
];

/** Bump when tokenization or document contents change; triggers a rebuild on app start. */
export const SEARCH_INDEX_VERSION = 1;
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
  /** Total matching moments (for "load more"); a lower bound of `limit + 1` when filters alone select them. */
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
export async function search(
  q: string,
  momentLimit = 50,
  filters: SearchFilters = {},
  now = new Date(),
): Promise<SearchResults> {
  if (hasAnyFilter(filters)) return filteredSearch(q, momentLimit, filters, now);
  return textSearch(q, momentLimit);
}

/** Ids of contacts and moments matching the text query (all of them, unranked). */
async function textHits(q: string): Promise<{ contactIds: string[]; momentIds: string[] } | null> {
  const parsed = parseQuery(q);
  if (isEmptyQuery(parsed)) return null;

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
  for (const k of hits) {
    const [entity, id] = k.split('|') as [string, string];
    (entity === 'contact' ? contactIds : momentIds).push(id);
  }
  return { contactIds, momentIds };
}

async function textSearch(q: string, momentLimit: number): Promise<SearchResults> {
  const found = await textHits(q);
  if (!found) return { contacts: [], moments: [], momentTotal: 0, tags: [] };
  const { contactIds, momentIds } = found;

  const [contacts, moments, tags] = await Promise.all([
    db.contacts.bulkGet(contactIds),
    newestMoments(momentIds, momentLimit),
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
    momentTotal: momentIds.length,
    tags: tags
      .filter((t) => live(t) && normalizeText(t.name).includes(qNorm))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Tag "trends" for the empty search page: tags by number of moments (ui §6.7). */
/**
 * Text hits that also satisfy the kind and date filters, found from `[kind+happenedAt]` index keys alone,
 * so the full records of every hit don't have to be read just to be thrown away (features §8.13 AC-10).
 */
async function narrowByKindAndDate(ids: string[], f: SearchFilters): Promise<string[]> {
  if (!f.kinds?.length && !f.from && !f.to) return ids;
  const { start, end } = dayRange(f.from, f.to);
  const wanted = new Set(ids);
  const keep: string[] = [];
  for (const kind of f.kinds?.length ? f.kinds : momentKinds) {
    const keys = await db.moments
      .where('[kind+happenedAt]')
      .between([kind, start ?? Dexie.minKey], [kind, end ?? Dexie.maxKey], true, false)
      .primaryKeys();
    for (const id of keys) if (wanted.has(id)) keep.push(id);
  }
  return keep;
}

/**
 * Search with filters (features §8.13). Kind and date filters narrow moments only, "not contacted" narrows
 * people only; tag and group filters apply to both. With no text, the filters alone select the results.
 */
async function filteredSearch(
  q: string,
  momentLimit: number,
  filters: SearchFilters,
  now: Date,
): Promise<SearchResults> {
  const found = await textHits(q);
  const hasText = !!found;
  if (!hasText && q.trim()) return { contacts: [], moments: [], momentTotal: 0, tags: [] };

  const memberIds = filters.groupIds?.length
    ? new Set(
        (await db.contacts.where('groupIds').anyOf(filters.groupIds).primaryKeys()) as string[],
      )
    : undefined;
  const byNewest = (a: Moment, b: Moment) => b.happenedAt.localeCompare(a.happenedAt);
  const wantMoment = (m: Moment) => live(m) && momentMatchesFilters(m, filters, memberIds);
  const wantContact = (c: Contact) => live(c) && contactMatchesFilters(c, filters, now);

  let moments: Moment[];
  let momentTotal: number;
  if (filters.notContactedDays) {
    moments = [];
    momentTotal = 0;
  } else if (found) {
    const candidates = await narrowByKindAndDate(found.momentIds, filters);
    const all = (await db.moments.bulkGet(candidates)).filter(
      (m): m is Moment => !!m && wantMoment(m),
    );
    all.sort(byNewest);
    moments = all.slice(0, momentLimit);
    momentTotal = all.length;
  } else {
    const { start, end } = dayRange(filters.from, filters.to);
    const range = () =>
      start || end
        ? db.moments
            .where('happenedAt')
            .between(start ?? '', end ?? '\uffff', true, false)
            .reverse()
        : db.moments.orderBy('happenedAt').reverse();
    // Without text there is no cheap exact total, so read one extra row: finding it means "there is more".
    const page = await range()
      .filter(wantMoment)
      .limit(momentLimit + 1)
      .toArray();
    moments = page.slice(0, momentLimit);
    momentTotal = page.length > momentLimit ? momentLimit + 1 : page.length;
  }

  let contacts: Contact[];
  if (found) {
    contacts = (await db.contacts.bulkGet(found.contactIds)).filter(
      (c): c is Contact => !!c && wantContact(c),
    );
  } else {
    contacts = await db.contacts.filter(wantContact).toArray();
  }
  const name = q.trim();
  contacts.sort(
    (a, b) =>
      Number(a.isArchived) - Number(b.isArchived) ||
      (name ? fuzzyScore(name, fullName(b)) - fuzzyScore(name, fullName(a)) : 0) ||
      fullName(a).localeCompare(fullName(b)),
  );
  return { contacts, moments, momentTotal, tags: [] };
}

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
