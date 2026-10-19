import { z } from 'zod';
import type { ContactDraft } from '@/db/repositories';
import { contactFieldTypes } from '@/domain/schemas';
import { partialDateFromParts } from '@/domain/partialDate';
import type { Address, Contact, ContactField, PartialDate } from '@/domain/types';

const dateParts = { day: z.string(), month: z.string(), year: z.string() };

export const contactFormSchema = z
  .object({
    firstName: z.string().trim().min(1, 'required'),
    lastName: z.string(),
    nickname: z.string(),
    bio: z.string(),
    gender: z.string(),
    pronouns: z.string(),
    bannerColor: z.string(),
    birthday: z.object(dateParts),
    fields: z.array(
      z.object({
        id: z.string().optional(),
        type: z.enum(contactFieldTypes),
        label: z.string(),
        value: z.string().trim().min(1, 'invalidValue'),
        isPrimary: z.boolean(),
      }),
    ),
    addresses: z.array(
      z.object({
        id: z.string().optional(),
        label: z.string(),
        street: z.string(),
        city: z.string(),
        region: z.string(),
        postalCode: z.string(),
        country: z.string(),
        isCurrent: z.boolean(),
      }),
    ),
    howWeMet: z.object({
      text: z.string(),
      place: z.string(),
      introducedById: z.string(),
      date: z.object(dateParts),
    }),
    jobTitle: z.string(),
    company: z.string(),
    foodPreferences: z.string(),
    stayInTouchDays: z.string(),
    isDeceased: z.boolean(),
    deceasedDate: z.object(dateParts),
  })
  .superRefine((v, ctx) => {
    for (const path of [['birthday'], ['howWeMet', 'date'], ['deceasedDate']] as const) {
      const parts = path.length === 1 ? v[path[0]] : v.howWeMet.date;
      if (partialDateFromParts(parts.day, parts.month, parts.year) === 'invalid') {
        ctx.addIssue({ code: 'custom', path: [...path], message: 'birthdayInvalid' });
      }
    }
  });

export type ContactFormValues = z.infer<typeof contactFormSchema>;

const emptyParts = { day: '', month: '', year: '' };
const toParts = (pd?: PartialDate) =>
  pd
    ? { day: String(pd.day), month: String(pd.month), year: pd.year ? String(pd.year) : '' }
    : emptyParts;
const fromParts = (p: { day: string; month: string; year: string }) => {
  const pd = partialDateFromParts(p.day.trim(), p.month, p.year.trim());
  return pd && pd !== 'invalid' ? pd : undefined;
};
/** Empty strings become undefined so optional fields are omitted. */
const opt = (s: string) => (s.trim() ? s.trim() : undefined);

export const emptyContactForm: ContactFormValues = {
  firstName: '',
  lastName: '',
  nickname: '',
  bio: '',
  gender: '',
  pronouns: '',
  bannerColor: '',
  birthday: emptyParts,
  fields: [],
  addresses: [],
  howWeMet: { text: '', place: '', introducedById: '', date: emptyParts },
  jobTitle: '',
  company: '',
  foodPreferences: '',
  stayInTouchDays: '',
  isDeceased: false,
  deceasedDate: emptyParts,
};

export function toFormValues(
  c: Contact,
  fields: ContactField[],
  addresses: Address[],
): ContactFormValues {
  return {
    firstName: c.firstName,
    lastName: c.lastName ?? '',
    nickname: c.nickname ?? '',
    bio: c.bio ?? '',
    gender: c.gender ?? '',
    pronouns: c.pronouns ?? '',
    bannerColor: c.bannerColor ?? '',
    birthday: toParts(c.birthday),
    fields: fields.map((f) => ({
      id: f.id,
      type: f.type,
      label: f.label ?? '',
      value: f.value,
      isPrimary: !!f.isPrimary,
    })),
    addresses: addresses.map((a) => ({
      id: a.id,
      label: a.label ?? '',
      street: a.street ?? '',
      city: a.city ?? '',
      region: a.region ?? '',
      postalCode: a.postalCode ?? '',
      country: a.country ?? '',
      isCurrent: a.isCurrent,
    })),
    howWeMet: {
      text: c.howWeMet?.text ?? '',
      place: c.howWeMet?.place ?? '',
      introducedById: c.howWeMet?.introducedById ?? '',
      date: toParts(c.howWeMet?.date),
    },
    jobTitle: c.jobTitle ?? '',
    company: c.company ?? '',
    foodPreferences: c.foodPreferences ?? '',
    stayInTouchDays: c.stayInTouchDays ? String(c.stayInTouchDays) : '',
    isDeceased: !!c.isDeceased,
    deceasedDate: toParts(c.deceasedDate),
  };
}

/** Form values → repository draft. Images are handled separately by the page. */
export function toDraft(v: ContactFormValues): Omit<ContactDraft, 'avatar' | 'banner'> {
  const birthday = fromParts(v.birthday);
  const howWeMet = {
    text: opt(v.howWeMet.text),
    place: opt(v.howWeMet.place),
    introducedById: opt(v.howWeMet.introducedById),
    date: fromParts(v.howWeMet.date),
  };
  const hasHowWeMet = Object.values(howWeMet).some((x) => x !== undefined);
  return {
    contact: {
      firstName: v.firstName.trim(),
      lastName: opt(v.lastName),
      nickname: opt(v.nickname.replace(/^@/, '')),
      bio: opt(v.bio),
      gender: opt(v.gender),
      pronouns: opt(v.pronouns),
      bannerColor: opt(v.bannerColor),
      birthday,
      isBirthdayYearKnown: birthday ? birthday.year !== undefined : undefined,
      howWeMet: hasHowWeMet
        ? (Object.fromEntries(
            Object.entries(howWeMet).filter(([, x]) => x !== undefined),
          ) as Contact['howWeMet'])
        : undefined,
      jobTitle: opt(v.jobTitle),
      company: opt(v.company),
      foodPreferences: opt(v.foodPreferences),
      stayInTouchDays: v.stayInTouchDays ? Number(v.stayInTouchDays) : undefined,
      isDeceased: v.isDeceased || undefined,
      deceasedDate: v.isDeceased ? fromParts(v.deceasedDate) : undefined,
    },
    fields: v.fields.map((f) => ({
      ...(f.id && { id: f.id }),
      type: f.type,
      label: opt(f.label),
      value: f.value.trim(),
      isPrimary: f.isPrimary || undefined,
    })),
    addresses: v.addresses.map((a) => ({
      ...(a.id && { id: a.id }),
      label: opt(a.label),
      street: opt(a.street),
      city: opt(a.city),
      region: opt(a.region),
      postalCode: opt(a.postalCode),
      country: opt(a.country),
      isCurrent: a.isCurrent,
    })),
  };
}
