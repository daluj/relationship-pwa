import {
  contactFormSchema,
  emptyContactForm,
  toDraft,
  toFormValues,
  type ContactFormValues,
} from '@/features/contacts/form/contactFormModel';
import type { Contact } from '@/domain/types';

const values = (over: Partial<ContactFormValues> = {}): ContactFormValues => ({
  ...emptyContactForm,
  firstName: 'Élise',
  ...over,
});

describe('contactFormSchema', () => {
  it('requires only a first name', () => {
    expect(contactFormSchema.safeParse(values()).success).toBe(true);
    expect(contactFormSchema.safeParse(values({ firstName: ' ' })).success).toBe(false);
  });
  it('rejects incomplete or impossible dates', () => {
    const r = contactFormSchema.safeParse(
      values({ birthday: { day: '31', month: '4', year: '' } }),
    );
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['birthday']);
    expect(
      contactFormSchema.safeParse(values({ birthday: { day: '', month: '3', year: '' } })).success,
    ).toBe(false);
  });
  it('rejects contact fields with an empty value', () => {
    const r = contactFormSchema.safeParse(
      values({ fields: [{ type: 'email', label: '', value: ' ', isPrimary: false }] }),
    );
    expect(r.success).toBe(false);
  });
});

describe('toDraft', () => {
  it('omits empty optional fields and trims', () => {
    const d = toDraft(values({ lastName: '  ', nickname: '@lise ', bio: ' hi ' }));
    expect(d.contact).toEqual({ firstName: 'Élise', nickname: 'lise', bio: 'hi' });
  });
  it('maps dates, how-we-met and stay-in-touch', () => {
    const d = toDraft(
      values({
        birthday: { day: '18', month: '3', year: '' },
        howWeMet: {
          text: '',
          place: 'Lyon',
          introducedById: '',
          date: { day: '1', month: '6', year: '2014' },
        },
        stayInTouchDays: '30',
      }),
    );
    expect(d.contact).toMatchObject({
      birthday: { day: 18, month: 3 },
      isBirthdayYearKnown: false,
      howWeMet: { place: 'Lyon', date: { day: 1, month: 6, year: 2014 } },
      stayInTouchDays: 30,
    });
  });
  it('drops the deceased date unless marked deceased', () => {
    const date = { day: '1', month: '1', year: '2020' };
    expect(toDraft(values({ deceasedDate: date })).contact.deceasedDate).toBeUndefined();
    expect(toDraft(values({ isDeceased: true, deceasedDate: date })).contact).toMatchObject({
      isDeceased: true,
      deceasedDate: { day: 1, month: 1, year: 2020 },
    });
  });
});

it('round-trips a stored contact through the form', () => {
  const contact: Contact = {
    id: crypto.randomUUID(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    firstName: 'Élise',
    lastName: 'Aubert',
    nickname: 'lise',
    birthday: { day: 18, month: 3, year: 1987 },
    isBirthdayYearKnown: true,
    howWeMet: { place: 'Lyon' },
    stayInTouchDays: 90,
    isStarred: true,
    isArchived: false,
    tagIds: [],
    groupIds: [],
  };
  const d = toDraft(toFormValues(contact, [], []));
  expect(d.contact).toEqual({
    firstName: 'Élise',
    lastName: 'Aubert',
    nickname: 'lise',
    birthday: { day: 18, month: 3, year: 1987 },
    isBirthdayYearKnown: true,
    howWeMet: { place: 'Lyon' },
    stayInTouchDays: 90,
  });
});
