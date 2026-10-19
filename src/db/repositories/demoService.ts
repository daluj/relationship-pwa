import { fullName } from '@/domain/contact';
import { demoContent } from '@/domain/demoContent';
import { mentionToken, tagToken } from '@/domain/momentText';
import { addDays } from '@/domain/recurrence';
import { toIsoDate } from '@/domain/partialDate';
import type { DemoIds, Locale } from '@/domain/settings';
import type { Contact } from '@/domain/types';
import { db } from '../db';
import { purgeContact, saveContact } from './contactService';
import { reminderRepo, tagRepo, taskRepo } from './entities';
import { addToGroup, saveGroup } from './groupService';
import { purgeMoment, saveMoment } from './momentService';
import { saveDebt, saveGift, savePet, saveTask } from './profileItems';
import { saveRelationship } from './relationshipService';
import { saveImportantDate, saveReminder } from './reminderService';
import { settingsRepo } from './settingsRepo';
import { deleteTag, findOrCreateTag } from './tagService';

/**
 * "Load demo data" (SPEC §8.1): ~15 contacts with moments, reminders, gifts, debts, tasks, pets, groups and
 * relationships, created through the normal services. The ids are remembered for "Remove demo data".
 */
export async function loadDemoData(locale: Locale, now = new Date()): Promise<DemoIds> {
  const content = demoContent(locale);
  const ids: DemoIds = {
    contacts: [],
    moments: [],
    tags: [],
    groups: [],
    reminders: [],
    tasks: [],
  };
  const today = toIsoDate(now);
  const currency = await settingsRepo.get('currency');

  const groups: Record<string, string> = {};
  const emoji = { family: '🏡', bookclub: '📚', work: '💼' } as const;
  for (const key of ['family', 'bookclub', 'work'] as const) {
    const g = await saveGroup(undefined, { name: content.groups[key], emoji: emoji[key] });
    groups[key] = g.id;
    ids.groups.push(g.id);
  }

  const people: Record<string, Contact> = {};
  for (const p of content.people) {
    const c = await saveContact(undefined, {
      contact: {
        firstName: p.firstName,
        lastName: p.lastName,
        nickname: p.nickname,
        birthday: p.birthday,
        isBirthdayYearKnown: p.birthday ? p.birthday.year !== undefined : undefined,
        company: p.company,
        jobTitle: p.jobTitle,
        bio: (content.bios as Record<string, string>)[p.key],
        stayInTouchDays: p.stayInTouchDays,
        isStarred: p.starred,
      },
      fields: [
        ...(p.email ? [{ type: 'email' as const, value: p.email }] : []),
        ...(p.phone ? [{ type: 'phone' as const, value: p.phone }] : []),
      ],
      addresses: p.city ? [{ city: p.city, isCurrent: true }] : [],
    });
    for (const g of p.groups ?? []) await addToGroup(c.id, groups[g]!);
    people[p.key] = c;
    ids.contacts.push(c.id);
  }

  for (const [from, to, type] of content.relationships) {
    await saveRelationship(undefined, {
      fromContactId: people[from]!.id,
      toContactId: people[to]!.id,
      type,
    });
  }

  const tags: Record<string, { id: string; name: string }> = {};
  for (const name of new Set(content.moments.flatMap((m) => m.tags ?? []))) {
    const existed = await tagRepo.findByName(name);
    const tag = existed ?? (await findOrCreateTag(name));
    if (!existed) ids.tags.push(tag.id);
    tags[name] = { id: tag.id, name: tag.name };
  }

  for (const m of content.moments) {
    const body = m.text
      .replace(/\{(\w+)\}/g, (_, key: string) =>
        mentionToken(people[key]!.id, fullName(people[key]!)),
      )
      .replace(/#([\p{L}\p{N}_-]+)/gu, (match, name: string) =>
        tags[name] ? tagToken(tags[name].id, tags[name].name) : match,
      );
    const at = new Date(now.getTime() - m.daysAgo * 86_400_000);
    at.setHours(18, 0, 0, 0);
    const moment = await saveMoment(undefined, {
      kind: m.kind,
      body,
      happenedAt: at.toISOString(),
      contactIds: [],
      photos: [],
      location: m.location,
      activityType: m.activityType,
      lifeEventType: m.lifeEventType,
      callDirection: m.callDirection,
      mood: m.mood,
    });
    ids.moments.push(moment.id);
  }

  for (const r of content.reminders) {
    const reminder = await saveReminder(undefined, {
      title: r.title.replace(/\{(\w+)\}/g, (_, key: string) => people[key]!.firstName),
      contactId: r.person ? people[r.person]!.id : undefined,
      dueDate: addDays(today, r.daysFromNow),
      recurrence: (r as { recurrence?: 'weekly' }).recurrence ?? 'none',
      recurrenceInterval: (r as { recurrence?: 'weekly' }).recurrence ? 1 : undefined,
    });
    ids.reminders.push(reminder.id);
  }
  for (const g of content.gifts) {
    await saveGift(undefined, {
      contactId: people[g.person]!.id,
      name: g.name,
      status: g.status,
      occasion: 'occasion' in g ? g.occasion : undefined,
      price: 'price' in g ? g.price : undefined,
      currency: 'price' in g ? currency : undefined,
    });
  }
  for (const d of content.debts) {
    await saveDebt(undefined, {
      contactId: people[d.person]!.id,
      direction: d.direction,
      amount: d.amount,
      currency,
      reason: d.reason,
      date: addDays(today, -10),
    });
  }
  for (const task of content.tasks) {
    const saved = await saveTask(undefined, {
      title: task.title,
      contactId: (task as { person?: string }).person
        ? people[(task as { person: string }).person]!.id
        : undefined,
    });
    ids.tasks.push(saved.id);
  }
  for (const pet of content.pets)
    await savePet(undefined, {
      contactId: people[pet.person]!.id,
      name: pet.name,
      species: pet.species,
    });
  for (const d of content.importantDates) {
    await saveImportantDate(undefined, {
      contactId: people[d.person]!.id,
      label: d.label,
      date: { month: d.month, day: d.day, year: d.year },
      remind: true,
      remindDaysBefore: 7,
    });
  }

  await settingsRepo.set('demo', ids);
  return ids;
}

/** "Remove demo data" (SPEC §8.1): permanently removes exactly what the demo created. */
export async function removeDemoData(): Promise<void> {
  const ids = await settingsRepo.get('demo');
  if (!ids) return;
  for (const id of ids.contacts) await purgeContact(id); // dependents, relationships, auto reminders
  for (const id of ids.moments) await purgeMoment(id);
  for (const id of ids.reminders) await reminderRepo.purge(id);
  for (const id of ids.tasks) await taskRepo.purge(id);
  for (const id of ids.tags) await deleteTag(id);
  await db.groups.bulkDelete(ids.groups);
  await settingsRepo.remove('demo');
}
