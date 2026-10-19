import { fullName } from './contact';
import { normalizeText } from './fuzzy';
import { bodyToPlainText } from './momentText';
import type { Address, Contact, ContactField, Moment } from './types';

/**
 * Search tokens (SPEC §8.6): lowercase, diacritics stripped (NFD + remove combining marks),
 * split on anything that isn't a letter or digit.
 */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Unique tokens to store for a document; 1-letter words are dropped (numbers kept). */
export function indexTokens(text: string): string[] {
  return [...new Set(tokenize(text).filter((t) => t.length >= 2 || /\d/.test(t)))];
}

/** Searchable text of a contact: names, nickname, work, notes, fields, addresses, tags (§8.6). */
export function contactDocument(
  c: Contact,
  fields: Pick<ContactField, 'value' | 'label'>[],
  addresses: Pick<Address, 'street' | 'city' | 'region' | 'country' | 'label'>[],
  tagNames: string[],
): string {
  return [
    fullName(c),
    c.nickname,
    c.company,
    c.jobTitle,
    c.bio,
    c.foodPreferences,
    c.howWeMet?.text,
    c.howWeMet?.place,
    ...fields.flatMap((f) => [f.value, f.label]),
    ...addresses.flatMap((a) => [a.street, a.city, a.region, a.country, a.label]),
    ...tagNames,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Searchable text of a moment: body (with current names), location, tag names (§8.6). */
export function momentDocument(
  m: Pick<Moment, 'body' | 'location' | 'tagIds'>,
  names: { contact: (id: string) => string | undefined; tag: (id: string) => string | undefined },
): string {
  return [bodyToPlainText(m.body, names), m.location, ...m.tagIds.map(names.tag)]
    .filter(Boolean)
    .join(' ');
}

export interface ParsedQuery {
  /** Tokens that must match a stored word exactly. */
  exact: string[];
  /** The last token, matched as a prefix (≥ 2 chars) while the user is still typing it. */
  prefix?: string;
}

/** Tokenize a query; the last token is a prefix unless the query ends in whitespace (§8.6). */
export function parseQuery(q: string): ParsedQuery {
  const tokens = [...new Set(tokenize(q))];
  if (!tokens.length) return { exact: [] };
  const last = tokens.at(-1)!;
  if (/\s$/.test(q) || last.length < 2) return { exact: tokens };
  return { exact: tokens.slice(0, -1), prefix: last };
}

export const isEmptyQuery = (p: ParsedQuery) => p.exact.length === 0 && !p.prefix;
