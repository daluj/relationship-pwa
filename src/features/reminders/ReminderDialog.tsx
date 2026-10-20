import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { inputClass } from '@/components/form/fieldClass';
import { SelectField } from '@/components/form/SelectField';
import { TextField } from '@/components/form/TextField';
import { saveReminder } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { toIsoDate } from '@/domain/partialDate';
import type { Reminder } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';

const recurrences = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit this manual reminder; otherwise create one. */
  reminder?: Reminder;
  /** Pre-selected person when creating (profile tab). */
  contactId?: string;
}

/** Create/edit a manual reminder (features §8.5). */
export function ReminderDialog({ open, onClose, reminder, contactId }: Props) {
  const { t } = useTranslation();
  const lookup = useLookup();
  const showToast = useToasts((s) => s.show);
  const [title, setTitle] = useState('');
  const [person, setPerson] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [recurrence, setRecurrence] = useState<Reminder['recurrence']>('none');
  const [interval, setIntervalN] = useState('1');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(reminder?.title ?? '');
    setPerson(reminder?.contactId ?? contactId ?? '');
    setDate(reminder?.dueDate.slice(0, 10) ?? toIsoDate(new Date()));
    setTime(reminder?.dueTime ?? '');
    setRecurrence(reminder?.recurrence ?? 'none');
    setIntervalN(String(reminder?.recurrenceInterval ?? 1));
    setNotes(reminder?.notes ?? '');
    setError(false);
  }, [open, reminder, contactId]);

  const save = async () => {
    if (!title.trim() || !date) {
      setError(true);
      return;
    }
    const n = Math.max(1, Math.round(Number(interval) || 1));
    await saveReminder(reminder?.id, {
      title: title.trim(),
      contactId: person || undefined,
      notes: notes.trim() || undefined,
      dueDate: date,
      dueTime: time || undefined,
      recurrence,
      recurrenceInterval: recurrence === 'none' ? undefined : n,
    });
    showToast({ message: t('reminders.toast.saved') });
    onClose();
  };

  const people = [...lookup.contacts].sort((a, b) => fullName(a).localeCompare(fullName(b)));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={reminder ? t('reminders.edit') : t('reminders.new')}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()}>{t('common.save')}</Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label={t('reminders.form.title')}
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          error={error && !title.trim() ? t('form.required') : undefined}
        />
        <SelectField
          label={t('reminders.form.contact')}
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          options={[
            { value: '', label: t('reminders.form.noContact') },
            ...people.map((c) => ({ value: c.id, label: fullName(c) })),
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-bold text-muted">
            {t('reminders.form.date')}
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputClass} mt-1 font-normal text-text`}
            />
          </label>
          <label className="text-sm font-bold text-muted">
            {t('reminders.form.time')}
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={`${inputClass} mt-1 font-normal text-text`}
            />
          </label>
        </div>
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <SelectField
            label={t('reminders.form.recurrence')}
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Reminder['recurrence'])}
            options={recurrences.map((r) => ({
              value: r,
              label:
                r === 'none'
                  ? t('reminders.repeat.none')
                  : t(`reminders.repeat.${r}`, { count: 1 }),
            }))}
          />
          {recurrence !== 'none' && (
            <TextField
              label={`${t('reminders.form.interval')} (${t(`reminders.units.${recurrence}`)})`}
              type="number"
              min={1}
              inputMode="numeric"
              value={interval}
              onChange={(e) => setIntervalN(e.target.value)}
            />
          )}
        </div>
        <TextField
          label={t('reminders.form.notes')}
          multiline
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
