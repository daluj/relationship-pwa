import { useTranslation } from 'react-i18next';
import { Archive, ArchiveRestore, FolderPlus, Tag, Trash2, X } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { Menu, type MenuItem } from '@/components/Menu';
import {
  bulkUpdateContacts,
  listGroups,
  undoBulkUpdate,
  useLiveQuery,
  type BulkAction,
} from '@/db/repositories';
import { useLookup } from '@/features/moments/useLookup';

interface Props {
  ids: string[];
  total: number;
  onSelectAll: () => void;
  onDone: () => void;
}

const trigger =
  'inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-bold hover:bg-surface-2';

/** Selection-mode toolbar on the Contacts list (features §8.13). */
export function BulkBar({ ids, total, onSelectAll, onDone }: Props) {
  const { t } = useTranslation();
  const lookup = useLookup();
  const groups = useLiveQuery(listGroups, []);
  const showToast = useToasts((s) => s.show);
  const none = ids.length === 0;

  const run = async (action: BulkAction, message: (n: number) => string) => {
    const { changed, undo } = await bulkUpdateContacts(ids, action);
    onDone();
    showToast({
      message: changed === 0 ? t('bulk.nothingChanged') : message(changed),
      ...(changed > 0 && {
        action: { label: t('common.undo'), onClick: () => void undoBulkUpdate(undo) },
      }),
    });
  };

  const tagItems: MenuItem[] = [
    ...lookup.tags.map((tag) => ({
      label: t('bulk.addTag', { name: tag.name }),
      onSelect: () =>
        void run({ type: 'add-tag', tagId: tag.id }, (n) =>
          t('bulk.taggedDone', { count: n, name: tag.name }),
        ),
    })),
    ...lookup.tags.map((tag) => ({
      label: t('bulk.removeTag', { name: tag.name }),
      onSelect: () =>
        void run({ type: 'remove-tag', tagId: tag.id }, (n) =>
          t('bulk.untaggedDone', { count: n, name: tag.name }),
        ),
    })),
  ];
  const groupItems: MenuItem[] = [
    ...(groups ?? []).map((g) => ({
      label: t('bulk.addGroup', { name: g.name }),
      onSelect: () =>
        void run({ type: 'add-group', groupId: g.id }, (n) =>
          t('bulk.groupedDone', { count: n, name: g.name }),
        ),
    })),
    ...(groups ?? []).map((g) => ({
      label: t('bulk.removeGroup', { name: g.name }),
      onSelect: () =>
        void run({ type: 'remove-group', groupId: g.id }, (n) =>
          t('bulk.ungroupedDone', { count: n, name: g.name }),
        ),
    })),
  ];

  return (
    <div
      role="toolbar"
      aria-label={t('bulk.toolbar')}
      className="sticky top-[106px] z-10 flex flex-wrap items-center gap-2 border-b border-border bg-bg px-4 py-2 md:top-[53px]"
    >
      <p role="status" aria-live="polite" className="mr-auto font-bold">
        {t('bulk.selected', { count: ids.length })}
      </p>
      <button type="button" onClick={onSelectAll} className={trigger}>
        {t('bulk.selectAll', { count: total })}
      </button>
      {tagItems.length > 0 && !none && (
        <Menu
          label={t('bulk.tags')}
          triggerClassName={trigger}
          trigger={
            <>
              <Tag size={16} aria-hidden /> {t('bulk.tags')}
            </>
          }
          items={tagItems}
        />
      )}
      {groupItems.length > 0 && !none && (
        <Menu
          label={t('bulk.groups')}
          triggerClassName={trigger}
          trigger={
            <>
              <FolderPlus size={16} aria-hidden /> {t('bulk.groups')}
            </>
          }
          items={groupItems}
        />
      )}
      <button
        type="button"
        disabled={none}
        className={`${trigger} disabled:opacity-40`}
        onClick={() =>
          void run({ type: 'archive', archived: true }, (n) => t('bulk.archivedDone', { count: n }))
        }
      >
        <Archive size={16} aria-hidden /> {t('bulk.archive')}
      </button>
      <button
        type="button"
        disabled={none}
        className={`${trigger} disabled:opacity-40`}
        onClick={() =>
          void run({ type: 'archive', archived: false }, (n) =>
            t('bulk.unarchivedDone', { count: n }),
          )
        }
      >
        <ArchiveRestore size={16} aria-hidden /> {t('bulk.unarchive')}
      </button>
      <button
        type="button"
        disabled={none}
        className={`${trigger} text-danger disabled:opacity-40`}
        onClick={() => void run({ type: 'trash' }, (n) => t('bulk.trashedDone', { count: n }))}
      >
        <Trash2 size={16} aria-hidden /> {t('bulk.trash')}
      </button>
      <button type="button" onClick={onDone} className={trigger}>
        <X size={16} aria-hidden /> {t('bulk.done')}
      </button>
    </div>
  );
}
