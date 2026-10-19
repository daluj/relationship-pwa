/**
 * Deterministic dataset generator for performance tests (SPEC §13), e.g. 2,000 contacts and 20,000 moments.
 *
 *   npx tsx scripts/seed.ts --contacts 2000 --moments 20000 > seed.json
 *
 * Output uses the backup shape `{ app, schemaVersion, exportedAt, data }` (SPEC §8.9). Imports are relative
 * (no `@/` alias) so Node and Playwright can load it directly.
 */
import { fullName } from '../src/domain/contact';
import { mentionToken } from '../src/domain/momentText';
import { contactDocument, indexTokens, momentDocument } from '../src/domain/search';
import type { Contact, Moment, SearchIndexEntry } from '../src/domain/types';

const FIRST = [
  'Élise',
  'Marc',
  'Zoé',
  'José',
  'Chloé',
  'Ana',
  'Bruno',
  'Inès',
  'Lucas',
  'Noémie',
  'Hugo',
  'Sofía',
  'Mateo',
  'Léa',
  'Eliot',
  'Camille',
  'Nicolás',
  'Iris',
  'Óscar',
  'Maya',
];
const LAST = [
  'Aubert',
  'Dupont',
  'Martin',
  'López',
  'García',
  'Moreau',
  'Rossi',
  'Fernández',
  'Laurent',
  'Petit',
  'Bernard',
  'Ruiz',
  'Lefèvre',
  'Navarro',
];
const CITIES = [
  'Lyon',
  'Paris',
  'Madrid',
  'Barcelona',
  'Lisbon',
  'Berlin',
  'Nantes',
  'Sevilla',
  'Bordeaux',
  'Porto',
];
const COMPANIES = ['Le Petit Sud', 'Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay'];
const OPENERS = [
  'Coffee with',
  'Dinner with',
  'Long call with',
  'Walked with',
  'Drinks with',
  'Lunch with',
  'Ran into',
];
const TOPICS = [
  'her new job',
  'moving apartments',
  'the wedding plans',
  'a trip to the coast',
  'his back pain',
  'the book club',
  'their kids',
  'a concert next month',
  'learning the piano',
];
const KINDS: Moment['kind'][] = ['activity', 'note', 'call', 'journal', 'life-event'];

/** mulberry32 — tiny deterministic PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuid(r: () => number): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export interface Dataset {
  contacts: Contact[];
  moments: Moment[];
  searchIndex: SearchIndexEntry[];
}

export function generateDataset({ contacts = 2000, moments = 20000, seed = 42 } = {}): Dataset {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const base = Date.UTC(2026, 9, 1);
  const iso = (offsetDays: number) => new Date(base - offsetDays * 86_400_000).toISOString();

  const people: Contact[] = Array.from({ length: contacts }, (_, i) => ({
    id: uuid(r),
    createdAt: iso(800),
    updatedAt: iso(800),
    firstName: pick(FIRST),
    lastName: pick(LAST),
    ...(r() < 0.3 && { company: pick(COMPANIES) }),
    ...(r() < 0.2 && { nickname: `p${i}` }),
    isStarred: r() < 0.05,
    isArchived: r() < 0.03,
    tagIds: [],
    groupIds: [],
  }));

  const notes: Moment[] = Array.from({ length: moments }, () => {
    const who = Array.from({ length: 1 + Math.floor(r() * 2) }, () => pick(people));
    const mentions = who.map((c) => mentionToken(c.id, fullName(c))).join(' and ');
    const at = iso(Math.floor(r() * 700));
    const kind = pick(KINDS);
    return {
      id: uuid(r),
      createdAt: at,
      updatedAt: at,
      kind,
      body: `${pick(OPENERS)} ${mentions}. We talked about ${pick(TOPICS)}.`,
      happenedAt: at,
      contactIds: [...new Set(who.map((c) => c.id))],
      tagIds: [],
      photoBlobIds: [],
      isStarred: false,
      ...(r() < 0.6 && { location: pick(CITIES) }),
    };
  });

  const names = new Map(people.map((c) => [c.id, fullName(c)]));
  const searchIndex: SearchIndexEntry[] = [
    ...people.map((c) => ({
      entity: 'contact' as const,
      entityId: c.id,
      tokens: indexTokens(contactDocument(c, [], [], [])),
    })),
    ...notes.map((m) => ({
      entity: 'moment' as const,
      entityId: m.id,
      tokens: indexTokens(
        momentDocument(m, { contact: (id) => names.get(id), tag: () => undefined }),
      ),
    })),
  ];
  return { contacts: people, moments: notes, searchIndex };
}

// CLI
if (process.argv[1]?.endsWith('seed.ts')) {
  const arg = (name: string, def: number) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? Number(process.argv[i + 1]) : def;
  };
  const { contacts, moments } = generateDataset({
    contacts: arg('contacts', 2000),
    moments: arg('moments', 20000),
    seed: arg('seed', 42),
  });
  process.stdout.write(
    JSON.stringify({
      app: 'kin',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: { contacts, moments },
    }),
  );
}
