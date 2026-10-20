import { fullName } from './contact';
import { normalizeText } from './fuzzy';
import type { Contact, ContactField } from './types';

export const normalizeName = (s: string) => normalizeText(s).replace(/\s+/g, ' ').trim();
export const normalizeEmail = (s: string) => s.trim().toLowerCase();
/** Digits only; numbers shorter than 7 digits are too ambiguous to match on. */
export const normalizePhone = (s: string) => s.replace(/\D/g, '');

const phonesMatch = (a: string, b: string) => {
  if (a.length < 7 || b.length < 7) return false;
  // Ignore country/trunk prefixes: compare the last 9 digits (or the shorter number).
  const n = Math.min(9, a.length, b.length);
  return a.slice(-n) === b.slice(-n);
};

export interface DuplicateCandidate {
  name: string;
  emails: string[];
  phones: string[];
}

export type DuplicateReason = 'name' | 'email' | 'phone';

/** Something to compare against: an existing contact with its fields. */
export interface KnownContact {
  contact: Contact;
  fields: Pick<ContactField, 'type' | 'value'>[];
}

export const candidateOf = (
  name: string,
  fields: Pick<ContactField, 'type' | 'value'>[],
): DuplicateCandidate => ({
  name,
  emails: fields.filter((f) => f.type === 'email').map((f) => f.value),
  phones: fields.filter((f) => f.type === 'phone' || f.type === 'whatsapp').map((f) => f.value),
});

/**
 * Possible duplicates (features §8.2): same normalized full name, email or phone.
 * Returns matches with the reason, strongest first (email/phone before name).
 */
export function findDuplicates(
  c: DuplicateCandidate,
  known: KnownContact[],
): { contact: Contact; reason: DuplicateReason }[] {
  const name = normalizeName(c.name);
  const emails = new Set(c.emails.map(normalizeEmail).filter(Boolean));
  const phones = c.phones.map(normalizePhone).filter((p) => p.length >= 7);
  const out: { contact: Contact; reason: DuplicateReason }[] = [];
  for (const k of known) {
    const kEmails = k.fields.filter((f) => f.type === 'email').map((f) => normalizeEmail(f.value));
    const kPhones = k.fields
      .filter((f) => f.type === 'phone' || f.type === 'whatsapp')
      .map((f) => normalizePhone(f.value));
    let reason: DuplicateReason | undefined;
    if (kEmails.some((e) => emails.has(e))) reason = 'email';
    else if (kPhones.some((p) => phones.some((q) => phonesMatch(p, q)))) reason = 'phone';
    else if (name && normalizeName(fullName(k.contact)) === name) reason = 'name';
    if (reason) out.push({ contact: k.contact, reason });
  }
  const rank = { email: 0, phone: 1, name: 2 };
  return out.sort((a, b) => rank[a.reason] - rank[b.reason]);
}
