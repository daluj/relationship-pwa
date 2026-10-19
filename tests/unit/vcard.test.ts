import google4 from '../fixtures/google4.vcf?raw';
import ios from '../fixtures/ios.vcf?raw';
import outlook21 from '../fixtures/outlook21.vcf?raw';
import { parseBday, parseVCards, serializeVCard } from '@/domain/vcard';
import type { Contact } from '@/domain/types';

const fixtures: Record<string, string> = {
  'ios.vcf': ios,
  'google4.vcf': google4,
  'outlook21.vcf': outlook21,
};
const fixture = (name: string) => fixtures[name]!;

describe('parseVCards (SPEC §8.9)', () => {
  it('reads an iOS 3.0 export: groups, escapes, folding, Apple year-less BDAY, inline photo', () => {
    const [lise, marc] = parseVCards(fixture('ios.vcf'));
    expect(lise).toMatchObject({
      firstName: 'Élise',
      lastName: 'Aubert',
      nickname: 'lise',
      company: 'Le Petit Sud',
      jobTitle: 'Chef',
      birthday: { month: 3, day: 18 },
      note: "Met at Marc's wedding.\nLoves jazz, hates mornings.",
    });
    expect(lise!.birthday).not.toHaveProperty('year');
    expect(lise!.fields).toEqual([
      { type: 'phone', label: 'Mobile', value: '+34 600 11 22 33' },
      { type: 'phone', label: 'Home', value: '+33 4 72 00 00 00' },
      { type: 'email', label: undefined, value: 'lise@example.com' },
    ]);
    expect(lise!.addresses).toEqual([
      {
        label: 'Home',
        street: '12 Rue de la Ré, 2e',
        city: 'Lyon',
        region: undefined,
        postalCode: '69002',
        country: 'France',
        isCurrent: true,
      },
    ]);
    expect(lise!.photo?.mime).toBe('image/jpeg');
    expect(lise!.photo?.base64).toMatch(/^\/9j\/4AAQ.*\/\/8$/);
    expect(marc).toMatchObject({ firstName: 'Marc', birthday: { year: 1985, month: 11, day: 2 } });
  });

  it('reads a 4.0 card: quoted multi-type params, tel: URIs, --MMDD, data: URI photo, URL', () => {
    const [zoe] = parseVCards(fixture('google4.vcf'));
    expect(zoe).toMatchObject({
      firstName: 'Zoé',
      lastName: 'Martin',
      birthday: { month: 7, day: 2 },
    });
    expect(zoe!.fields).toEqual([
      { type: 'phone', label: 'Mobile', value: '+44-20-7946-0000' },
      { type: 'email', label: 'Work', value: 'zoe@work.example' },
      { type: 'website', label: undefined, value: 'https://zoe.example' },
    ]);
    expect(zoe!.photo).toEqual({ mime: 'image/png', base64: 'iVBORw0KGgo=' });
  });

  it('reads 2.1 quoted-printable, skips URL photos, falls back to email for the name, skips nameless cards', () => {
    const cards = parseVCards(fixture('outlook21.vcf'));
    expect(cards.map((c) => c.firstName)).toEqual(['José', 'only-email']);
    expect(cards[0]).toMatchObject({ lastName: 'López', company: 'Contoso' });
    expect(cards[0]!.fields.map((f) => [f.type, f.label, f.value])).toEqual([
      ['phone', 'Work', '(555) 010-9999'],
      ['email', undefined, 'jose@outlook.example'],
    ]);
    expect(cards[0]!.photo).toBeUndefined();
  });

  it('parses BDAY variants', () => {
    expect(parseBday('19870318')).toEqual({ year: 1987, month: 3, day: 18 });
    expect(parseBday('1987-03-18T00:00:00Z')).toEqual({ year: 1987, month: 3, day: 18 });
    expect(parseBday('--03-18')).toEqual({ month: 3, day: 18 });
    expect(parseBday('1987-02-30')).toBeUndefined();
    expect(parseBday('soon')).toBeUndefined();
  });
});

describe('serializeVCard', () => {
  const contact = {
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    firstName: 'Élise',
    lastName: 'Aubert',
    nickname: 'lise',
    birthday: { month: 3, day: 18 },
    company: 'Le Petit Sud; Lyon',
    jobTitle: 'Chef',
    bio: 'Line 1\nLine 2, with comma',
    isStarred: false,
    isArchived: false,
    tagIds: [],
    groupIds: [],
  } satisfies Contact;

  it('round-trips through the parser', () => {
    const text = serializeVCard({
      contact,
      fields: [
        { type: 'phone', label: 'Mobile', value: '+34 600' },
        { type: 'email', value: 'lise@example.com' },
        { type: 'instagram', value: '@lise' }, // no vCard 3.0 equivalent → omitted
      ],
      addresses: [{ label: 'Home', street: '12 Rue', city: 'Lyon', country: 'France' }],
      photo: { mime: 'image/webp', base64: 'AAAA' },
    });
    expect(text.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(text).toContain('BDAY;X-APPLE-OMIT-YEAR=1604:1604-03-18');
    const [back] = parseVCards(text);
    expect(back).toMatchObject({
      firstName: 'Élise',
      lastName: 'Aubert',
      nickname: 'lise',
      birthday: { month: 3, day: 18 },
      company: 'Le Petit Sud; Lyon',
      jobTitle: 'Chef',
      note: 'Line 1\nLine 2, with comma',
      photo: { mime: 'image/webp', base64: 'AAAA' },
    });
    expect(back!.fields.map((f) => f.value)).toEqual(['+34 600', 'lise@example.com']);
    expect(back!.addresses[0]).toMatchObject({ street: '12 Rue', city: 'Lyon', country: 'France' });
  });

  it('folds long lines at 75 octets', () => {
    const text = serializeVCard({
      contact: { ...contact, bio: 'é'.repeat(200) },
      fields: [],
      addresses: [],
    });
    for (const line of text.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(parseVCards(text)[0]!.note).toBe('é'.repeat(200));
  });
});
