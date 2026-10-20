import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PawPrint, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { IconButton } from '@/components/IconButton';
import { TextField } from '@/components/form/TextField';
import { petRepo, petsFor, savePet, useLiveQuery } from '@/db/repositories';
import type { Pet } from '@/domain/types';

/** Profile › Details › Pets (ui §6.6). */
export function PetsBlock({ contactId }: { contactId: string }) {
  const { t } = useTranslation();
  const pets = useLiveQuery(() => petsFor(contactId), [contactId]);
  const [editing, setEditing] = useState<Pet | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editing === undefined) return;
    setName(editing?.name ?? '');
    setSpecies(editing?.species ?? '');
    setNotes(editing?.notes ?? '');
  }, [editing]);

  const save = async () => {
    if (!name.trim()) return;
    await savePet(editing?.id, {
      contactId,
      name: name.trim(),
      species: species.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setEditing(undefined);
  };

  return (
    <section className="border-b border-border px-4 py-4" aria-label={t('pets.title')}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-extrabold">{t('pets.title')}</h3>
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
          <Plus size={16} aria-hidden /> {t('pets.add')}
        </Button>
      </div>
      {!!pets?.length && (
        <ul className="flex flex-col gap-2">
          {pets.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <PawPrint size={18} className="shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {p.name}
                  {p.species && <span className="font-normal text-muted"> · {p.species}</span>}
                </p>
                {p.notes && <p className="text-sm text-muted">{p.notes}</p>}
              </div>
              <IconButton label={`${t('pets.edit')}: ${p.name}`} onClick={() => setEditing(p)}>
                <Pencil size={16} aria-hidden />
              </IconButton>
              <IconButton
                label={`${t('pets.delete')}: ${p.name}`}
                onClick={() => void petRepo.softDelete(p.id)}
              >
                <Trash2 size={16} aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? t('pets.edit') : t('pets.add')}
        footer={
          <Button onClick={() => void save()} disabled={!name.trim()}>
            {t('common.save')}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label={t('pets.name')}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label={t('pets.species')}
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          />
          <TextField
            label={t('pets.notes')}
            multiline
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </Dialog>
    </section>
  );
}
