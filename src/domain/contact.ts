import { onColor } from './color';
import type { Contact } from './types';

type Named = Pick<Contact, 'firstName' | 'lastName'>;

export function fullName(c: Named): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
}

export function initials(c: Named): string {
  const letters = [c.firstName, c.lastName]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .map((s) => Array.from(s.trim())[0]!.toLocaleUpperCase());
  return letters.slice(0, 2).join('');
}

/** Muted, theme-neutral palette for initials avatars and fallback banners. */
export const avatarPalette = [
  '#0F766E',
  '#1D4ED8',
  '#7C3AED',
  '#BE185D',
  '#B45309',
  '#15803D',
  '#B91C1C',
  '#475569',
] as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic avatar color per contact id (features §8.2). */
export function avatarColors(id: string): { bg: string; fg: string } {
  const bg = avatarPalette[hash(id) % avatarPalette.length]!;
  return { bg, fg: onColor(bg) };
}

/** First letter for A–Z grouping; non-letters group under "#". */
export function sortLetter(c: Named): string {
  const ch = Array.from(c.firstName.trim())[0] ?? '';
  const base = ch.normalize('NFD').replace(/\p{M}/gu, '').toLocaleUpperCase();
  return /^[A-Z]$/.test(base) ? base : '#';
}

export type ContactSort = 'az' | 'recent-interaction' | 'recently-added';

export function sortContacts(list: Contact[], sort: ContactSort, locale: string): Contact[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  const byName = (a: Contact, b: Contact) => collator.compare(fullName(a), fullName(b));
  const copy = [...list];
  switch (sort) {
    case 'az':
      return copy.sort(byName);
    case 'recent-interaction':
      return copy.sort(
        (a, b) =>
          (b.lastInteractionAt ?? '').localeCompare(a.lastInteractionAt ?? '') || byName(a, b),
      );
    case 'recently-added':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

/** Entered order for contact fields/addresses: `position`, then creation time (older data). */
export const byPosition = (
  a: { position?: number; createdAt: string },
  b: { position?: number; createdAt: string },
) =>
  (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
  a.createdAt.localeCompare(b.createdAt);
