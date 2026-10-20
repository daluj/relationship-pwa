import type { ParsedContact } from './parsedContact';
import { partialDateFromParts } from './partialDate';
import type { Address, Contact, ContactField, PartialDate } from './types';

/**
 * Hand-written vCard 3.0 / 4.0 reader and 3.0 writer (tech-stack §3, §8.9). Covers what iOS, Google and
 * Outlook export: FN/N, NICKNAME, BDAY, TEL, EMAIL, ADR, ORG, TITLE, URL, NOTE, PHOTO (inline only).
 */

interface Prop {
  name: string;
  params: Record<string, string[]>;
  value: string;
}

/** Unescape a text value (`\n`, `\,`, `\;`, `\\`). */
const unescapeText = (v: string) =>
  v.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

/** Split a structured value on unescaped `;` (or `,`), then unescape each part. */
function splitValue(v: string, sep = ';'): string[] {
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < v.length; i++) {
    const ch = v[i]!;
    if (ch === '\\' && i + 1 < v.length) {
      cur += ch + v[i + 1];
      i++;
    } else if (ch === sep) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map(unescapeText);
}

function decodeQuotedPrintable(v: string, charset = 'utf-8'): string {
  const bytes: number[] = [];
  const s = v.replace(/=\r?\n/g, '');
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(s.charCodeAt(i) & 0xff);
  }
  try {
    return new TextDecoder(charset).decode(new Uint8Array(bytes));
  } catch {
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
}

function parseLine(line: string): Prop | null {
  // Find the first ':' not inside a quoted parameter value.
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuote = !inQuote;
    else if (line[i] === ':' && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [rawName, ...rawParams] = line.slice(0, colon).split(';');
  const name = rawName!.replace(/^.*\./, '').toUpperCase(); // drop "item1." groups
  const params: Record<string, string[]> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    // vCard 2.1/3.0 bare params ("WORK", "PREF") are TYPE values.
    const key = (eq < 0 ? 'TYPE' : p.slice(0, eq)).toUpperCase();
    const vals = (eq < 0 ? p : p.slice(eq + 1)).replace(/"/g, '').split(',');
    params[key] = [...(params[key] ?? []), ...vals.map((x) => x.toLowerCase())];
  }
  let value = line.slice(colon + 1);
  if (params.ENCODING?.includes('quoted-printable'))
    value = decodeQuotedPrintable(value, params.CHARSET?.[0]);
  return { name, params, value };
}

/** Unfold continuation lines (RFC 6350 §3.2) and quoted-printable soft breaks. */
function unfold(text: string): string[] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const prev = out.at(-1);
    if (
      prev !== undefined &&
      /ENCODING=QUOTED-PRINTABLE/i.test(prev.split(':')[0] ?? '') &&
      prev.endsWith('=')
    ) {
      out[out.length - 1] = prev.slice(0, -1) + line;
    } else out.push(line);
  }
  return out;
}

/** BDAY: 1987-03-18, 19870318, --0318, --03-18, Apple's 1604-03-18 (no year), with or without time. */
export function parseBday(
  value: string,
  params: Record<string, string[]> = {},
): PartialDate | undefined {
  const v = value.trim().replace(/T.*$/, '');
  let m = /^--(\d{2})-?(\d{2})$/.exec(v);
  if (m) {
    const pd = partialDateFromParts(String(+m[2]!), String(+m[1]!), '');
    return pd && pd !== 'invalid' ? pd : undefined;
  }
  m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(v);
  if (!m) return undefined;
  const noYear = m[1] === '1604' || !!params['X-APPLE-OMIT-YEAR'];
  const pd = partialDateFromParts(String(+m[3]!), String(+m[2]!), noYear ? '' : m[1]!);
  return pd && pd !== 'invalid' ? pd : undefined;
}

const typeLabels: Record<string, string> = {
  home: 'Home',
  work: 'Work',
  cell: 'Mobile',
  mobile: 'Mobile',
  iphone: 'iPhone',
  main: 'Main',
  fax: 'Fax',
  pager: 'Pager',
  other: 'Other',
};

const labelOf = (params: Record<string, string[]>) =>
  (params.TYPE ?? []).map((t) => typeLabels[t]).find(Boolean);

function parsePhoto(p: Prop): ParsedContact['photo'] {
  const data = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/i.exec(p.value.trim());
  if (data) return { mime: data[1]!.toLowerCase(), base64: data[2]!.replace(/\s/g, '') };
  const enc = p.params.ENCODING?.[0];
  if (enc === 'b' || enc === 'base64') {
    const t = (p.params.TYPE?.[0] ?? p.params.MEDIATYPE?.[0] ?? 'jpeg').replace(/^image\//, '');
    return { mime: `image/${t === 'jpg' ? 'jpeg' : t}`, base64: p.value.replace(/\s/g, '') };
  }
  return undefined; // URL photos are skipped (no network)
}

function toContact(props: Prop[]): ParsedContact | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const all = (n: string) => props.filter((p) => p.name === n);
  const [family = '', given = '', additional = ''] = get('N') ? splitValue(get('N')!.value) : [];
  const fn = get('FN') ? unescapeText(get('FN')!.value).trim() : '';
  const org = get('ORG') ? splitValue(get('ORG')!.value)[0]?.trim() : undefined;
  const emails = all('EMAIL').map((p) => ({
    type: 'email' as const,
    label: labelOf(p.params),
    value: unescapeText(p.value).trim(),
  }));

  let firstName = [given, additional].filter(Boolean).join(' ').trim();
  let lastName = family.trim();
  if (!firstName && fn) {
    const [first, ...rest] = fn.split(/\s+/);
    firstName = first!;
    if (!lastName) lastName = rest.join(' ');
  }
  if (!firstName && org) firstName = org;
  if (!firstName && emails[0]) firstName = emails[0].value.split('@')[0]!;
  if (!firstName) return null;

  const fields: ParsedContact['fields'] = [
    ...all('TEL').map((p) => ({
      type: 'phone' as const,
      label: labelOf(p.params),
      value: unescapeText(p.value).replace(/^tel:/i, '').trim(),
    })),
    ...emails,
    ...all('URL').map((p) => ({
      type: 'website' as const,
      label: labelOf(p.params),
      value: unescapeText(p.value).trim(),
    })),
  ].filter((f) => f.value);

  const addresses = all('ADR')
    .map((p) => {
      const [, ext = '', street = '', city = '', region = '', postalCode = '', country = ''] =
        splitValue(p.value);
      const s = [street, ext].filter(Boolean).join(', ');
      return {
        label: labelOf(p.params),
        street: s || undefined,
        city: city || undefined,
        region: region || undefined,
        postalCode: postalCode || undefined,
        country: country || undefined,
        isCurrent: false,
      };
    })
    .filter((a) => a.street || a.city || a.region || a.postalCode || a.country);
  if (addresses[0]) addresses[0].isCurrent = true;

  const bday = get('BDAY');
  const photo = get('PHOTO');
  const note = get('NOTE') ? unescapeText(get('NOTE')!.value).trim() : undefined;
  return {
    firstName: firstName.trim(),
    lastName: lastName || undefined,
    nickname: get('NICKNAME')
      ? splitValue(get('NICKNAME')!.value, ',')[0]?.trim() || undefined
      : undefined,
    birthday: bday ? parseBday(bday.value, bday.params) : undefined,
    company: org || undefined,
    jobTitle: get('TITLE') ? unescapeText(get('TITLE')!.value).trim() || undefined : undefined,
    note: note || undefined,
    fields,
    addresses,
    photo: photo ? parsePhoto(photo) : undefined,
  };
}

/** Parse every VCARD in a file. Cards without any usable name are skipped. */
export function parseVCards(text: string): ParsedContact[] {
  const out: ParsedContact[] = [];
  let props: Prop[] | null = null;
  for (const line of unfold(text)) {
    const upper = line.trim().toUpperCase();
    if (upper === 'BEGIN:VCARD') props = [];
    else if (upper === 'END:VCARD') {
      const c = props && toContact(props);
      if (c) out.push(c);
      props = null;
    } else if (props && line.trim()) {
      const p = parseLine(line);
      if (p) props.push(p);
    }
  }
  return out;
}

// ── Writer (vCard 3.0, the most widely imported version) ────────────────────

const esc = (v: string) =>
  v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const pad = (n: number) => String(n).padStart(2, '0');
const fieldType: Partial<Record<ContactField['type'], string>> = {
  phone: 'TEL',
  whatsapp: 'TEL',
  email: 'EMAIL',
  website: 'URL',
};

export interface VCardInput {
  contact: Contact;
  fields: Pick<ContactField, 'type' | 'label' | 'value'>[];
  addresses: Pick<Address, 'label' | 'street' | 'city' | 'region' | 'postalCode' | 'country'>[];
  photo?: { mime: string; base64: string };
}

export function serializeVCard({ contact: c, fields, addresses, photo }: VCardInput): string {
  const fn = [c.firstName, c.lastName].filter(Boolean).join(' ');
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(c.lastName ?? '')};${esc(c.firstName)};;;`,
    `FN:${esc(fn)}`,
  ];
  if (c.nickname) lines.push(`NICKNAME:${esc(c.nickname)}`);
  if (c.birthday) {
    const { year, month, day } = c.birthday;
    // vCard 3.0 has no year-less date; Apple's convention is 1604 + X-APPLE-OMIT-YEAR.
    lines.push(
      year
        ? `BDAY:${year}-${pad(month)}-${pad(day)}`
        : `BDAY;X-APPLE-OMIT-YEAR=1604:1604-${pad(month)}-${pad(day)}`,
    );
  }
  for (const f of fields) {
    const prop = fieldType[f.type];
    if (!prop) continue;
    const type = f.label ? `;TYPE=${esc(f.label.toLowerCase())}` : '';
    lines.push(`${prop}${type}:${esc(f.value)}`);
  }
  for (const a of addresses) {
    const type = a.label ? `;TYPE=${esc(a.label.toLowerCase())}` : '';
    lines.push(
      `ADR${type}:;;${[a.street, a.city, a.region, a.postalCode, a.country].map((x) => esc(x ?? '')).join(';')}`,
    );
  }
  if (c.company) lines.push(`ORG:${esc(c.company)}`);
  if (c.jobTitle) lines.push(`TITLE:${esc(c.jobTitle)}`);
  if (c.bio) lines.push(`NOTE:${esc(c.bio)}`);
  if (photo)
    lines.push(
      `PHOTO;ENCODING=b;TYPE=${photo.mime.replace('image/', '').toUpperCase()}:${photo.base64}`,
    );
  lines.push('END:VCARD');
  return lines.map(fold).join('\r\n') + '\r\n';
}
