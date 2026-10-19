import { contrastRatio } from '@/domain/color';
import { avatarColors, fullName, initials, sortContacts, sortLetter } from '@/domain/contact';
import { contactFieldHref } from '@/domain/contactFieldHref';
import { clampCrop, coverRect } from '@/domain/crop';
import type { Contact } from '@/domain/types';

const c = (firstName: string, extra: Partial<Contact> = {}): Contact => ({
  id: crypto.randomUUID(),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  firstName,
  isStarred: false,
  isArchived: false,
  tagIds: [],
  groupIds: [],
  ...extra,
});

describe('names & avatars', () => {
  it('builds full names and initials', () => {
    expect(fullName({ firstName: 'Élise', lastName: 'Aubert' })).toBe('Élise Aubert');
    expect(initials({ firstName: 'élise', lastName: 'aubert' })).toBe('ÉA');
    expect(initials({ firstName: 'Marc' })).toBe('M');
  });
  it('assigns a stable, readable color per id', () => {
    const a = avatarColors('abc');
    expect(avatarColors('abc')).toEqual(a);
    expect(contrastRatio(a.bg, a.fg)).toBeGreaterThanOrEqual(4.5);
  });
  it('groups by base letter', () => {
    expect(sortLetter({ firstName: 'Élise' })).toBe('E');
    expect(sortLetter({ firstName: '42' })).toBe('#');
  });
});

describe('sortContacts', () => {
  const list = [
    c('Zoé', { createdAt: '2026-01-03T00:00:00.000Z' }),
    c('ana', {
      lastInteractionAt: '2026-02-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    c('Émile', {
      lastInteractionAt: '2026-03-01T00:00:00.000Z',
      createdAt: '2026-01-02T00:00:00.000Z',
    }),
  ];
  it('sorts A–Z with locale collation (accents and case ignored)', () => {
    expect(sortContacts(list, 'az', 'en').map((x) => x.firstName)).toEqual(['ana', 'Émile', 'Zoé']);
  });
  it('sorts by recent interaction, never-interacted last', () => {
    expect(sortContacts(list, 'recent-interaction', 'en').map((x) => x.firstName)).toEqual([
      'Émile',
      'ana',
      'Zoé',
    ]);
  });
  it('sorts by recently added', () => {
    expect(sortContacts(list, 'recently-added', 'en').map((x) => x.firstName)).toEqual([
      'Zoé',
      'Émile',
      'ana',
    ]);
  });
});

describe('contactFieldHref', () => {
  it.each([
    ['phone', '+34 600 11 22 33', 'tel:+34600112233'],
    ['email', 'lise@example.com', 'mailto:lise@example.com'],
    ['email', 'not an email', undefined],
    ['website', 'example.com', 'https://example.com/'],
    ['website', 'javascript:alert(1)', undefined],
    ['instagram', '@lise', 'https://instagram.com/lise'],
    ['x', 'https://x.com/lise', 'https://x.com/lise'],
    ['whatsapp', '+34 600 112 233', 'https://wa.me/34600112233'],
    ['signal', '+34 600', undefined],
    ['other', 'javascript:alert(1)', undefined],
  ] as const)('%s %s → %s', (type, value, href) => {
    expect(contactFieldHref({ type, value })).toBe(href);
  });
});

describe('crop geometry', () => {
  const img = { w: 1000, h: 500 };
  const frame = { w: 100, h: 100 };
  it('covers the frame at zoom 1, centered', () => {
    expect(coverRect({ zoom: 1, panX: 0, panY: 0 }, img, frame)).toEqual({
      x: -50,
      y: 0,
      w: 200,
      h: 100,
    });
  });
  it('clamps pan so the image always covers the frame', () => {
    expect(clampCrop({ zoom: 1, panX: 5, panY: 5 }, img, frame)).toEqual({
      zoom: 1,
      panX: 0.5,
      panY: 0,
    });
    const r = coverRect({ zoom: 1, panX: -5, panY: 0 }, img, frame);
    expect(r.x + r.w).toBe(100);
  });
  it('clamps zoom to [1, 4]', () => {
    expect(clampCrop({ zoom: 0.2, panX: 0, panY: 0 }, img, frame).zoom).toBe(1);
    expect(clampCrop({ zoom: 9, panX: 0, panY: 0 }, img, frame).zoom).toBe(4);
  });
});
