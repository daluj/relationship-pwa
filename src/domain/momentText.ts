/**
 * Moment body tokens (features §8.4): mentions and tags are stored as stable tokens that reference ids,
 *   `@[Élise Aubert](contact:<uuid>)`   `#[family](tag:<uuid>)`
 * so renaming a contact or tag changes how bodies render without rewriting them (§8.8 AC).
 */

export type EntityKind = 'contact' | 'tag';

export type Segment =
  | { type: 'text'; text: string }
  | { type: 'link'; href: string; text: string }
  | { type: 'mention'; id: string; name: string }
  | { type: 'tag'; id: string; name: string };

const TOKEN = /([@#])\[([^\]\n]*)\]\((contact|tag):([0-9a-fA-F-]{36})\)/g;
const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]]/gi;

/** Token-safe display name: brackets would break the token grammar. */
const clean = (name: string) => name.replace(/[[\]\n]/g, ' ').trim();

export const mentionToken = (id: string, name: string) => `@[${clean(name)}](contact:${id})`;
export const tagToken = (id: string, name: string) => `#[${clean(name)}](tag:${id})`;

function linkify(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    out.push({ type: 'link', href: m[0], text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

/** Splits a body into renderable segments. Text is never interpreted as HTML (tech-stack §11). */
export function parseBody(body: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    const [, sigil, name, kind, id] = m as unknown as [string, string, string, EntityKind, string];
    if (m.index > last) out.push(...linkify(body.slice(last, m.index)));
    if ((sigil === '@') === (kind === 'contact')) {
      out.push({ type: kind === 'contact' ? 'mention' : 'tag', id: id.toLowerCase(), name });
    } else {
      out.push({ type: 'text', text: m[0] });
    }
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(...linkify(body.slice(last)));
  return out;
}

export function extractIds(body: string): { contactIds: string[]; tagIds: string[] } {
  const contactIds = new Set<string>();
  const tagIds = new Set<string>();
  for (const s of parseBody(body)) {
    if (s.type === 'mention') contactIds.add(s.id);
    if (s.type === 'tag') tagIds.add(s.id);
  }
  return { contactIds: [...contactIds], tagIds: [...tagIds] };
}

/** Plain text with current names (for copy, search, previews). */
export function bodyToPlainText(
  body: string,
  names: {
    contact?: (id: string) => string | undefined;
    tag?: (id: string) => string | undefined;
  } = {},
): string {
  return parseBody(body)
    .map((s) => {
      if (s.type === 'mention') return `@${names.contact?.(s.id) ?? s.name}`;
      if (s.type === 'tag') return `#${names.tag?.(s.id) ?? s.name}`;
      return s.text;
    })
    .join('');
}

/** Rewrites references to `fromId` (e.g. merging tags) and refreshes the stored fallback name. */
export function replaceEntity(
  body: string,
  kind: EntityKind,
  fromId: string,
  toId: string,
  toName: string,
): string {
  return body.replace(TOKEN, (match, _sigil: string, _name: string, k: string, id: string) =>
    k === kind && id.toLowerCase() === fromId.toLowerCase()
      ? kind === 'contact'
        ? mentionToken(toId, toName)
        : tagToken(toId, toName)
      : match,
  );
}

// ── Composer draft ⇄ tokens ──────────────────────────────────────────────────
// The composer edits readable text ("@Élise Aubert", "#family") and tracks which display strings
// stand for which entity. Tokens are produced on save; an edited display string becomes plain text.

export interface DraftEntity {
  kind: EntityKind;
  id: string;
  /** Exactly as shown in the textarea, including the sigil. */
  display: string;
}

export const displayFor = (kind: EntityKind, name: string) =>
  `${kind === 'contact' ? '@' : '#'}${clean(name)}`;

/** Tokens → editable text + entity list (current names win over stored fallbacks). */
export function bodyToDraft(
  body: string,
  names: {
    contact?: (id: string) => string | undefined;
    tag?: (id: string) => string | undefined;
  } = {},
): { text: string; entities: DraftEntity[] } {
  const entities = new Map<string, DraftEntity>();
  let text = '';
  for (const s of parseBody(body)) {
    if (s.type === 'mention' || s.type === 'tag') {
      const kind: EntityKind = s.type === 'mention' ? 'contact' : 'tag';
      const display = displayFor(
        kind,
        (kind === 'contact' ? names.contact : names.tag)?.(s.id) ?? s.name,
      );
      entities.set(`${kind}:${s.id}`, { kind, id: s.id, display });
      text += display;
    } else {
      text += s.text;
    }
  }
  return { text, entities: [...entities.values()] };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Editable text + entities → stored body with tokens. */
export function draftToBody(text: string, entities: DraftEntity[]): string {
  // Longest display first so "@Ana López" wins over "@Ana".
  const sorted = [...entities].sort((a, b) => b.display.length - a.display.length);
  if (sorted.length === 0) return text;
  const re = new RegExp(
    `(${sorted.map((e) => escapeRe(e.display)).join('|')})(?![\\p{L}\\p{N}_])`,
    'gu',
  );
  const byDisplay = new Map(sorted.map((e) => [e.display, e]));
  return text.replace(re, (display) => {
    const e = byDisplay.get(display)!;
    const name = display.slice(1);
    return e.kind === 'contact' ? mentionToken(e.id, name) : tagToken(e.id, name);
  });
}

// ── Autocomplete trigger ─────────────────────────────────────────────────────

export interface Trigger {
  sigil: '@' | '#';
  query: string;
  /** Index of the sigil in the text. */
  start: number;
}

/**
 * Detects an active `@query` / `#query` immediately before the caret. `@` queries may contain single
 * spaces ("@Élise Au") so full names can be typed; `#` queries can't.
 */
export function findTrigger(text: string, caret: number): Trigger | null {
  const before = text.slice(0, caret);
  const m = /(?:^|[\s(])([@#])([^\s@#]*(?: [^\s@#]+)?)$/u.exec(before);
  if (!m) return null;
  const sigil = m[1] as '@' | '#';
  const query = m[2] ?? '';
  if (sigil === '#' && query.includes(' ')) return null;
  if (query.length > 40) return null;
  return { sigil, query, start: caret - query.length - 1 };
}

/** Replaces the trigger with `display` + a trailing space; returns new text and caret. */
export function applyCompletion(text: string, trigger: Trigger, caret: number, display: string) {
  const next = `${text.slice(0, trigger.start)}${display} ${text.slice(caret).replace(/^ /, '')}`;
  return { text: next, caret: trigger.start + display.length + 1 };
}
