import { fullName } from './contact';
import type { ParsedContact } from './parsedContact';
import { partialDateFromParts } from './partialDate';
import type { Address, Contact, ContactField, PartialDate } from './types';

/** Kin fields a CSV column can be mapped to (SPEC §8.9 column-mapping step). */
export const csvTargets = [
  'ignore',
  'firstName',
  'lastName',
  'fullName',
  'nickname',
  'email',
  'phone',
  'company',
  'jobTitle',
  'birthday',
  'street',
  'city',
  'region',
  'postalCode',
  'country',
  'notes',
  'website',
] as const;
export type CsvTarget = (typeof csvTargets)[number];

// Header patterns for Google Contacts, Outlook and generic exports (English + Spanish).
const rules: [RegExp, CsvTarget][] = [
  [/ - (type|label)$/i, 'ignore'],
  [/^(given name|first name|firstname|nombre)$/i, 'firstName'],
  [/^(family name|last name|lastname|surname|apellidos?)$/i, 'lastName'],
  [/^(name|full name|display name|nombre completo)$/i, 'fullName'],
  [/^(nickname|apodo)$/i, 'nickname'],
  [/^(e-?mail|correo)( \d+)?( - value| address)?$|^e-mail \d address$/i, 'email'],
  [
    /^(phone|tel[eé]fono)( \d+)?( - value)?$|^(mobile|home|business|primary|other|car|company main) phone( \d)?$/i,
    'phone',
  ],
  [/^(organization( \d+)? - name|organization name|company|empresa)$/i, 'company'],
  [/^(organization( \d+)? - title|organization title|job title|title|puesto)$/i, 'jobTitle'],
  [/^(birthday|cumpleaños)$/i, 'birthday'],
  [/^(address \d+ - street|(home|business|other) street|street)$/i, 'street'],
  [/^(address \d+ - city|(home|business|other) city|city|ciudad)$/i, 'city'],
  [/^(address \d+ - region|(home|business|other) state|region|state|provincia)$/i, 'region'],
  [
    /^(address \d+ - postal code|(home|business|other) postal code|postal code|zip|código postal)$/i,
    'postalCode',
  ],
  [/^(address \d+ - country|(home|business|other) country(\/region)?|country|país)$/i, 'country'],
  [/^(notes?|notas)$/i, 'notes'],
  [/^(website( \d+)?( - value)?|web page|url)$/i, 'website'],
];

/** Best-guess target for each header; unknown columns are ignored. */
export function autoMap(headers: string[]): CsvTarget[] {
  return headers.map((h) => rules.find(([re]) => re.test(h.trim()))?.[1] ?? 'ignore');
}

/** CSV birthdays: ISO `YYYY-MM-DD`, Google's `--MM-DD` (no year), Outlook's `M/D/YYYY`. */
export function parseCsvDate(v: string): PartialDate | undefined {
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  let pd: PartialDate | null | 'invalid' = null;
  if (m) pd = partialDateFromParts(String(+m[3]!), String(+m[2]!), m[1]!);
  else if ((m = /^--(\d{1,2})-(\d{1,2})$/.exec(s)))
    pd = partialDateFromParts(String(+m[2]!), String(+m[1]!), '');
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s))) {
    const y = m[3]!.length === 2 ? '' : m[3]!; // Outlook writes 0/0/00 for "no birthday"
    pd = partialDateFromParts(String(+m[2]!), String(+m[1]!), y);
  }
  return pd && pd !== 'invalid' ? pd : undefined;
}

/** Google packs several values in one cell separated by " ::: ". */
const multi = (v: string) =>
  v
    .split(':::')
    .map((x) => x.trim())
    .filter(Boolean);

/** Turn mapped CSV rows into contacts to preview; rows without any name are dropped. */
export function rowsToContacts(rows: string[][], mapping: CsvTarget[]): ParsedContact[] {
  const out: ParsedContact[] = [];
  for (const row of rows) {
    const values = (t: CsvTarget) =>
      mapping.flatMap((m, i) => (m === t && row[i]?.trim() ? [row[i]!.trim()] : []));
    const first = (t: CsvTarget) => values(t)[0];
    let firstName = first('firstName');
    let lastName = first('lastName');
    const full = first('fullName');
    if (!firstName && full) {
      const [f, ...rest] = full.split(/\s+/);
      firstName = f;
      lastName ??= rest.join(' ') || undefined;
    }
    const emails = values('email').flatMap(multi);
    if (!firstName && emails[0]) firstName = emails[0].split('@')[0];
    if (!firstName) continue;
    const address = {
      street: first('street'),
      city: first('city'),
      region: first('region'),
      postalCode: first('postalCode'),
      country: first('country'),
    };
    out.push({
      firstName,
      lastName: lastName || undefined,
      nickname: first('nickname'),
      company: first('company'),
      jobTitle: first('jobTitle'),
      birthday: first('birthday') ? parseCsvDate(first('birthday')!) : undefined,
      note: values('notes').join('\n') || undefined,
      fields: [
        ...values('phone')
          .flatMap(multi)
          .map((value) => ({ type: 'phone' as const, value })),
        ...emails.map((value) => ({ type: 'email' as const, value })),
        ...values('website')
          .flatMap(multi)
          .map((value) => ({ type: 'website' as const, value })),
      ],
      addresses: Object.values(address).some(Boolean) ? [{ ...address, isCurrent: true }] : [],
    });
  }
  return out;
}

export const csvExportHeaders = [
  'First Name',
  'Last Name',
  'Nickname',
  'E-mail',
  'Phone',
  'Company',
  'Job Title',
  'Birthday',
  'Street',
  'City',
  'Region',
  'Postal Code',
  'Country',
  'Notes',
];

/** One CSV row per contact (Google-style headers, re-importable by Kin). */
export function contactToCsvRow(
  c: Contact,
  fields: Pick<ContactField, 'type' | 'value'>[],
  address?: Pick<Address, 'street' | 'city' | 'region' | 'postalCode' | 'country'>,
): string[] {
  const join = (t: ContactField['type']) =>
    fields
      .filter((f) => f.type === t)
      .map((f) => f.value)
      .join(' ::: ');
  const b = c.birthday;
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    c.firstName,
    c.lastName ?? '',
    c.nickname ?? '',
    join('email'),
    join('phone'),
    c.company ?? '',
    c.jobTitle ?? '',
    b
      ? b.year
        ? `${b.year}-${pad(b.month)}-${pad(b.day)}`
        : `--${pad(b.month)}-${pad(b.day)}`
      : '',
    address?.street ?? '',
    address?.city ?? '',
    address?.region ?? '',
    address?.postalCode ?? '',
    address?.country ?? '',
    c.bio ?? '',
  ];
}

export const displayName = (p: Pick<ParsedContact, 'firstName' | 'lastName'>) => fullName(p);
