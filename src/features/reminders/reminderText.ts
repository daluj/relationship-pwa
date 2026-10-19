import type { TFunction } from 'i18next';
import { fullName } from '@/domain/contact';
import { ageOn, inYear } from '@/domain/partialDate';
import { parseIsoDate } from '@/domain/recurrence';
import type { Contact, Reminder } from '@/domain/types';

/** Display title for a reminder; auto reminders are worded from their source (SPEC §8.5). */
export function reminderTitle(r: Reminder, contact: Contact | undefined, t: TFunction): string {
  const name = contact ? fullName(contact) : r.title;
  switch (r.source) {
    case 'birthday': {
      const due = parseIsoDate(r.dueDate);
      const age = contact?.birthday
        ? ageOn(contact.birthday, inYear(contact.birthday, due.getFullYear()))
        : undefined;
      return age !== undefined && age > 0
        ? t('reminders.titles.birthdayTurns', { name, age })
        : t('reminders.titles.birthday', { name });
    }
    case 'stay-in-touch':
      return t('reminders.titles.stayInTouch', { name });
    case 'important-date':
      return contact ? t('reminders.titles.importantDate', { label: r.title, name }) : r.title;
    case 'manual':
      return r.title;
  }
}

/** "Every 2 weeks" etc. */
export function repeatLabel(
  r: Pick<Reminder, 'recurrence' | 'recurrenceInterval'>,
  t: TFunction,
): string {
  if (r.recurrence === 'none') return t('reminders.repeat.none');
  return t(`reminders.repeat.${r.recurrence}`, { count: r.recurrenceInterval ?? 1 });
}
