import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { TextField } from '@/components/form/TextField';
import { saveGoal } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import type { Goal } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';
import { ChipPicker } from '@/features/profile/ChipPicker';

interface Props {
  open: boolean;
  /** The goal being edited; `null`/`undefined` creates a new one. */
  goal?: Goal | null;
  onClose: () => void;
  onSaved?: (goal: Goal) => void;
}

/** Create/edit a goal: title (required), why, deadline, area, next action, helpers (features §8.11). */
export function GoalFormDialog({ open, goal, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const lookup = useLookup();
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [deadline, setDeadline] = useState('');
  const [area, setArea] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? '');
    setWhy(goal?.why ?? '');
    setDeadline(goal?.deadline ?? '');
    setArea(goal?.area ?? '');
    setNextAction(goal?.nextAction ?? '');
    setContactIds(goal?.contactIds ?? []);
    setError(false);
  }, [open, goal]);

  const options = useMemo(
    () =>
      lookup.contacts
        .filter((c) => !c.isArchived)
        .map((c) => ({ id: c.id, label: fullName(c) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [lookup.contacts],
  );

  const save = async () => {
    if (!title.trim()) {
      setError(true);
      return;
    }
    const saved = await saveGoal(goal?.id, {
      title: title.trim(),
      why: why.trim() || undefined,
      area: area.trim() || undefined,
      deadline: deadline || undefined,
      nextAction: nextAction.trim() || undefined,
      contactIds,
    });
    onSaved?.(saved);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={goal ? t('goals.form.edit') : t('goals.form.new')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField
          label={t('goals.form.title')}
          placeholder={t('goals.form.titlePlaceholder')}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(false);
          }}
          error={error ? t('goals.form.titleRequired') : undefined}
          autoFocus
        />
        <TextField
          multiline
          label={t('goals.form.why')}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
        />
        <TextField
          label={t('goals.form.nextAction')}
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            type="date"
            label={t('goals.form.deadline')}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <TextField
            label={t('goals.form.area')}
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </div>
        <ChipPicker
          title={t('goals.people.title')}
          options={options}
          selected={contactIds}
          ready={lookup.loaded}
          onAdd={(id) => setContactIds((ids) => [...ids, id])}
          onRemove={(id) => setContactIds((ids) => ids.filter((x) => x !== id))}
          labels={{
            add: t('goals.people.add'),
            search: t('goals.people.search'),
            remove: (name) => t('goals.people.remove', { name }),
          }}
        />
      </div>
    </Dialog>
  );
}
