import { Hash, UserRoundPlus } from 'lucide-react';
import type { TFunction } from 'i18next';
import { Avatar } from '@/components/Avatar';
import { fullName } from '@/domain/contact';
import { fuzzyFilter, normalizeText } from '@/domain/fuzzy';
import type { Contact, Tag } from '@/domain/types';
import type { Suggestion } from './SuggestionList';

/** Contact suggestions + "Create contact 'X'" at the bottom (SPEC §6.5). */
export function contactSuggestions(
  contacts: Contact[],
  query: string,
  t: TFunction,
  onPick: (c: Contact) => void,
  onCreate: ((name: string) => void) | undefined,
  exclude: string[] = [],
): Suggestion[] {
  const matches = fuzzyFilter(
    contacts.filter((c) => !exclude.includes(c.id)),
    query,
    (c) => [fullName(c), c.nickname],
    6,
  );
  const items: Suggestion[] = matches.map((c) => ({
    key: c.id,
    label: fullName(c),
    secondary: c.nickname ? `@${c.nickname}` : undefined,
    icon: <Avatar contact={c} size={32} />,
    onSelect: () => onPick(c),
  }));
  const name = query.trim();
  if (name && onCreate) {
    items.push({
      key: 'create-contact',
      label: t('composer.createContact', { name }),
      icon: <UserRoundPlus size={20} className="m-1.5 text-accent" aria-hidden />,
      onSelect: () => onCreate(name),
    });
  }
  return items;
}

/** Tag suggestions; a new tag is offered unless the name already exists (SPEC §6.5). */
export function tagSuggestions(
  tags: Tag[],
  query: string,
  t: TFunction,
  onPick: (tag: Tag) => void,
  onCreate: (name: string) => void,
): Suggestion[] {
  const items: Suggestion[] = fuzzyFilter(tags, query, (tag) => [tag.name], 6).map((tag) => ({
    key: tag.id,
    label: `#${tag.name}`,
    icon: <Hash size={20} className="m-1.5 text-muted" aria-hidden />,
    onSelect: () => onPick(tag),
  }));
  const name = query.trim();
  if (name && !tags.some((tag) => normalizeText(tag.name) === normalizeText(name))) {
    items.push({
      key: 'create-tag',
      label: t('composer.createTag', { name }),
      icon: <Hash size={20} className="m-1.5 text-accent" aria-hidden />,
      onSelect: () => onCreate(name),
    });
  }
  return items;
}
