import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Ellipsis, Merge, Palette, Pencil, Trash2 } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Dialog } from '@/components/Dialog';
import { Menu } from '@/components/Menu';
import { PageHeader } from '@/components/PageHeader';
import { SelectField } from '@/components/form/SelectField';
import { TextField } from '@/components/form/TextField';
import {
  deleteTag,
  DuplicateError,
  listTags,
  mergeTags,
  renameTag,
  momentsForTag,
  tagRepo,
  useLiveQuery,
  useLiveRecord,
} from '@/db/repositories';
import { avatarPalette } from '@/domain/contact';
import { Feed } from '@/features/moments/Feed';

type Mode = 'rename' | 'recolor' | 'merge' | 'delete' | null;

/** `/tags/:id`: tag timeline plus rename, recolor, merge and delete (SPEC §8.8). */
export function TagPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToasts((s) => s.show);
  const tag = useLiveRecord(tagRepo, id);
  const moments = useLiveQuery(() => (id ? momentsForTag(id) : []), [id]);
  const allTags = useLiveQuery(listTags, []);
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string>();

  if (tag === undefined) return null;
  if (tag === null) {
    return (
      <>
        <PageHeader title={t('pages.tag')} back />
        <p className="px-8 py-12 text-center text-muted">{t('tags.notFound')}</p>
      </>
    );
  }

  const open = (m: Mode) => {
    setName(tag.name);
    setColor(tag.color ?? '');
    setTarget('');
    setError(undefined);
    setMode(m);
  };
  const close = () => setMode(null);

  const rename = async () => {
    try {
      await renameTag(tag.id, name);
      close();
    } catch (e) {
      setError(e instanceof DuplicateError ? t('tags.duplicate') : String(e));
    }
  };
  const others = (allTags ?? []).filter((x) => x.id !== tag.id);

  return (
    <>
      <PageHeader
        title={`#${tag.name}`}
        subtitle={moments ? t('tags.moments', { count: moments.length }) : undefined}
        back
        actions={
          <Menu
            label={t('common.more')}
            triggerClassName="rounded-full p-2 hover:bg-surface-2"
            trigger={<Ellipsis size={20} aria-hidden />}
            items={[
              { label: t('tags.rename'), icon: Pencil, onSelect: () => open('rename') },
              { label: t('tags.recolor'), icon: Palette, onSelect: () => open('recolor') },
              ...(others.length
                ? [{ label: t('tags.merge'), icon: Merge, onSelect: () => open('merge') }]
                : []),
              {
                label: t('tags.delete'),
                icon: Trash2,
                onSelect: () => open('delete'),
                danger: true,
              },
            ]}
          />
        }
      />
      {tag.color && <div aria-hidden className="h-1" style={{ backgroundColor: tag.color }} />}
      {moments && moments.length === 0 ? (
        <p className="px-8 py-12 text-center text-muted">{t('tags.empty')}</p>
      ) : (
        <Feed moments={moments ?? []} />
      )}

      <Dialog
        open={mode === 'rename'}
        onClose={close}
        title={t('tags.renameTitle')}
        footer={
          <Button onClick={() => void rename()} disabled={!name.trim()}>
            {t('common.save')}
          </Button>
        }
      >
        <TextField
          label={t('tags.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
      </Dialog>

      <Dialog
        open={mode === 'recolor'}
        onClose={close}
        title={t('tags.recolor')}
        footer={
          <Button
            onClick={() => {
              void tagRepo.update(tag.id, { color: color || undefined });
              close();
            }}
          >
            {t('common.save')}
          </Button>
        }
      >
        <div role="radiogroup" aria-label={t('tags.color')} className="flex flex-wrap gap-2">
          {['', ...avatarPalette].map((c) => (
            <button
              key={c || 'none'}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c || t('common.none')}
              onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full border-2 bg-surface-2 ${color === c ? 'border-accent' : 'border-transparent'}`}
              style={c ? { backgroundColor: c } : undefined}
            />
          ))}
        </div>
      </Dialog>

      <Dialog
        open={mode === 'merge'}
        onClose={close}
        title={t('tags.mergeTitle', { name: tag.name })}
        footer={
          <Button
            disabled={!target}
            onClick={() => {
              void mergeTags(tag.id, target).then(() => {
                showToast({ message: t('tags.merged') });
                navigate(`/tags/${target}`, { replace: true });
              });
              close();
            }}
          >
            {t('tags.mergeConfirm')}
          </Button>
        }
      >
        <SelectField
          label={t('tags.mergeTarget')}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          options={[
            { value: '', label: '—' },
            ...others.map((x) => ({ value: x.id, label: `#${x.name}` })),
          ]}
        />
      </Dialog>

      <ConfirmDialog
        open={mode === 'delete'}
        title={t('tags.deleteTitle', { name: tag.name })}
        message={t('tags.deleteBody')}
        confirmLabel={t('common.delete')}
        danger
        onCancel={close}
        onConfirm={() => {
          close();
          void deleteTag(tag.id).then(() => {
            showToast({ message: t('tags.deleted') });
            navigate(-1);
          });
        }}
      />
    </>
  );
}
