import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bookmark, Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { Menu } from '@/components/Menu';
import { TextField } from '@/components/form/TextField';
import {
  deleteSavedSearch,
  listSavedSearches,
  renameSavedSearch,
  restoreSavedSearch,
  saveSearch,
  useLiveQuery,
} from '@/db/repositories';
import type { SavedSearch, SearchFilters } from '@/domain/types';
import { savedSearchPath } from './savedSearchPath';

/** Name prompt shared by "Save search" and "Rename". */
function NameDialog({
  open,
  title,
  initial,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  initial: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string>();
  const submit = async () => {
    if (!name.trim()) return setError(t('form.required'));
    await onSubmit(name.trim());
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void submit()}>{t('common.save')}</Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextField
          label={t('savedSearches.name')}
          value={name}
          autoFocus
          error={error}
          onChange={(e) => setName(e.target.value)}
        />
      </form>
    </Dialog>
  );
}

/** "Save search" button for the current query and filters. */
export function SaveSearchButton({ query, filters }: { query: string; filters: SearchFilters }) {
  const { t } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-bold hover:bg-surface-2"
      >
        <Bookmark size={16} aria-hidden />
        {t('savedSearches.save')}
      </button>
      <NameDialog
        key={String(open)}
        open={open}
        title={t('savedSearches.saveTitle')}
        initial={query.trim()}
        onSubmit={async (name) => {
          await saveSearch(name, query, filters);
          showToast({ message: t('savedSearches.saved', { name }) });
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** Saved searches list shown when nothing is being searched. */
export function SavedSearches() {
  const { t } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const saved = useLiveQuery(listSavedSearches, []);
  const [renaming, setRenaming] = useState<SavedSearch>();
  if (!saved || saved.length === 0) return null;

  const remove = async (s: SavedSearch) => {
    await deleteSavedSearch(s.id);
    showToast({
      message: t('savedSearches.deleted', { name: s.name }),
      action: { label: t('common.undo'), onClick: () => void restoreSavedSearch(s.id) },
    });
  };

  return (
    <section aria-labelledby="saved-searches" className="border-b border-border py-2">
      <h2 id="saved-searches" className="px-4 py-2 text-xl font-extrabold">
        {t('savedSearches.title')}
      </h2>
      <ul>
        {saved.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 hover:bg-surface-1">
            <Bookmark size={18} className="text-muted" aria-hidden />
            <Link to={savedSearchPath(s)} className="flex-1 py-3 font-bold">
              {s.name}
            </Link>
            <Menu
              label={t('savedSearches.options', { name: s.name })}
              triggerClassName="rounded-full p-1.5 text-muted hover:bg-surface-2"
              trigger={<Ellipsis size={18} aria-hidden />}
              items={[
                { label: t('savedSearches.rename'), icon: Pencil, onSelect: () => setRenaming(s) },
                {
                  label: t('common.delete'),
                  icon: Trash2,
                  danger: true,
                  onSelect: () => void remove(s),
                },
              ]}
            />
          </li>
        ))}
      </ul>
      {renaming && (
        <NameDialog
          key={renaming.id}
          open
          title={t('savedSearches.rename')}
          initial={renaming.name}
          onSubmit={async (name) => void (await renameSavedSearch(renaming.id, name))}
          onClose={() => setRenaming(undefined)}
        />
      )}
    </section>
  );
}
