// Search filters (features §8.13). Text still goes through domain/search; these narrow the results.
import type { Contact, Moment, MomentKind, SearchFilters } from './types';
import { momentKinds } from './schemas';

/** Filters that only apply to moments. */
export const hasMomentFilters = (f: SearchFilters): boolean =>
  !!(f.kinds?.length || f.from || f.to);

export const hasAnyFilter = (f: SearchFilters): boolean =>
  hasMomentFilters(f) || !!(f.tagIds?.length || f.groupIds?.length || f.notContactedDays);

const startOfLocalDay = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

/** `[start, end)` ISO instants covering whole local days `from`..`to` inclusive (AC-1). */
export function dayRange(from?: string, to?: string): { start?: string; end?: string } {
  const start = from ? startOfLocalDay(from).toISOString() : undefined;
  let end: string | undefined;
  if (to) {
    const d = startOfLocalDay(to);
    d.setDate(d.getDate() + 1);
    end = d.toISOString();
  }
  return { start, end };
}

/** Instant before which a contact counts as "not contacted" for `days` (AC-2). */
export const staleCutoff = (now: Date, days: number): string =>
  new Date(now.getTime() - days * 86_400_000).toISOString();

/** Moment filters; `memberIds` are the contacts of the selected groups (any group matches). */
export function momentMatchesFilters(
  m: Moment,
  f: SearchFilters,
  memberIds?: ReadonlySet<string>,
): boolean {
  if (f.notContactedDays) return false; // a people-only filter
  if (f.kinds?.length && !f.kinds.includes(m.kind)) return false;
  const { start, end } = dayRange(f.from, f.to);
  if (start && m.happenedAt < start) return false;
  if (end && m.happenedAt >= end) return false;
  if (f.tagIds?.length && !f.tagIds.every((t) => m.tagIds.includes(t))) return false;
  if (f.groupIds?.length && !m.contactIds.some((id) => memberIds?.has(id))) return false;
  return true;
}

/** Contact filters. Moment-only filters (kind, dates) exclude every contact. */
export function contactMatchesFilters(c: Contact, f: SearchFilters, now: Date): boolean {
  if (hasMomentFilters(f)) return false;
  if (f.tagIds?.length && !f.tagIds.every((t) => c.tagIds.includes(t))) return false;
  if (f.groupIds?.length && !f.groupIds.some((g) => c.groupIds.includes(g))) return false;
  if (f.notContactedDays) {
    if (c.isArchived || c.isDeceased) return false;
    const cutoff = staleCutoff(now, f.notContactedDays);
    if (c.lastInteractionAt && c.lastInteractionAt >= cutoff) return false;
  }
  return true;
}

// ── URL params ───────────────────────────────────────────────────────────────

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

export function filtersFromParams(p: URLSearchParams): SearchFilters {
  const f: SearchFilters = {};
  const kinds = list(p.get('kinds')).filter((k): k is MomentKind =>
    (momentKinds as readonly string[]).includes(k),
  );
  if (kinds.length) f.kinds = kinds;
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const from = p.get('from');
  const to = p.get('to');
  if (from && date.test(from)) f.from = from;
  if (to && date.test(to)) f.to = to;
  const tagIds = list(p.get('tags'));
  if (tagIds.length) f.tagIds = tagIds;
  const groupIds = list(p.get('groups'));
  if (groupIds.length) f.groupIds = groupIds;
  const stale = Number(p.get('stale'));
  if (Number.isInteger(stale) && stale > 0) f.notContactedDays = stale;
  return f;
}

/** Writes the filters into `base` (existing filter params are replaced). */
export function filtersToParams(f: SearchFilters, base = new URLSearchParams()): URLSearchParams {
  const next = new URLSearchParams(base);
  for (const k of ['kinds', 'from', 'to', 'tags', 'groups', 'stale']) next.delete(k);
  if (f.kinds?.length) next.set('kinds', f.kinds.join(','));
  if (f.from) next.set('from', f.from);
  if (f.to) next.set('to', f.to);
  if (f.tagIds?.length) next.set('tags', f.tagIds.join(','));
  if (f.groupIds?.length) next.set('groups', f.groupIds.join(','));
  if (f.notContactedDays) next.set('stale', String(f.notContactedDays));
  return next;
}
