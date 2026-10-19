import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  addToGroup,
  findOrCreateTag,
  listGroups,
  removeFromGroup,
  saveGroup,
  setContactTags,
  useLiveQuery,
} from '@/db/repositories';
import type { Contact } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';
import { ChipPicker } from './ChipPicker';

/** Profile › Details › Tags and Groups (SPEC §6.6, §8.8). */
export function TagsGroupsBlocks({ contact }: { contact: Contact }) {
  const { t } = useTranslation();
  const lookup = useLookup();
  const groups = useLiveQuery(listGroups, []);

  return (
    <>
      <ChipPicker
        title={t('tagsGroups.tags')}
        ready={lookup.loaded}
        options={lookup.tags.map((tag) => ({ id: tag.id, label: tag.name }))}
        selected={contact.tagIds}
        onAdd={(id) => void setContactTags(contact.id, [...contact.tagIds, id])}
        onRemove={(id) =>
          void setContactTags(
            contact.id,
            contact.tagIds.filter((x) => x !== id),
          )
        }
        onCreate={async (name) => {
          const tag = await findOrCreateTag(name);
          await setContactTags(contact.id, [...contact.tagIds, tag.id]);
        }}
        renderChip={(o) => (
          <Link to={`/tags/${o.id}`} className="text-accent hover:underline">
            #{o.label}
          </Link>
        )}
        labels={{
          add: t('tagsGroups.addTag'),
          search: t('tagsGroups.searchTags'),
          remove: (name) => t('tagsGroups.removeTag', { name }),
          create: (name) => t('composer.createTag', { name }),
        }}
      />
      <ChipPicker
        title={t('tagsGroups.groups')}
        ready={groups !== undefined}
        options={(groups ?? []).map((g) => ({
          id: g.id,
          label: g.name,
          icon: <span className="m-1 w-6 text-center">{g.emoji ?? '👥'}</span>,
        }))}
        selected={contact.groupIds}
        onAdd={(id) => void addToGroup(contact.id, id)}
        onRemove={(id) => void removeFromGroup(contact.id, id)}
        onCreate={async (name) => {
          const g = await saveGroup(undefined, { name });
          await addToGroup(contact.id, g.id);
        }}
        renderChip={(o) => (
          <Link to={`/groups/${o.id}`} className="hover:underline">
            {o.label}
          </Link>
        )}
        labels={{
          add: t('tagsGroups.addGroup'),
          search: t('tagsGroups.searchGroups'),
          remove: (name) => t('tagsGroups.removeGroup', { name }),
          create: (name) => t('tagsGroups.createGroup', { name }),
        }}
      />
    </>
  );
}
