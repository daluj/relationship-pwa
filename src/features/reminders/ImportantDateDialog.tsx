import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { inputClass } from '@/components/form/fieldClass';
import { PartialDateInputs } from '@/components/form/PartialDateInputs';
import { TextField } from '@/components/form/TextField';
import { saveImportantDate } from '@/db/repositories';
import { partialDateFromParts } from '@/domain/partialDate';
import type { ImportantDate } from '@/domain/types';

const leadOptions = [0, 1, 3, 7, 14, 30];

interface Props {
  open: boolean;
  onClose: () => void;
  contactId: string;
  date?: ImportantDate;
}

/** Add/edit an important date with an optional yearly reminder (data-model §5.1, §8.5). */
export function ImportantDateDialog({ open, onClose, contactId, date }: Props) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [remind, setRemind] = useState(true);
  const [lead, setLead] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setLabel(date?.label ?? '');
    setDay(date ? String(date.date.day) : '');
    setMonth(date ? String(date.date.month) : '');
    setYear(date?.date.year ? String(date.date.year) : '');
    setRemind(date?.remind ?? true);
    setLead(date?.remindDaysBefore ?? 0);
    setError(undefined);
  }, [open, date]);

  const save = async () => {
    const pd = partialDateFromParts(day.trim(), month, year.trim());
    if (!label.trim()) return setError(t('form.required'));
    if (!pd || pd === 'invalid') return setError(t('form.birthdayInvalid'));
    await saveImportantDate(date?.id, {
      contactId,
      label: label.trim(),
      date: pd,
      remind,
      remindDaysBefore: remind ? lead : undefined,
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={date ? t('importantDates.edit') : t('importantDates.add')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={t('importantDates.label')}
          placeholder={t('importantDates.labelPlaceholder')}
          value={label}
          autoFocus
          onChange={(e) => setLabel(e.target.value)}
        />
        <PartialDateInputs
          legend={t('importantDates.date')}
          value={{ day, month, year }}
          onChange={(v) => {
            setDay(v.day);
            setMonth(v.month);
            setYear(v.year);
          }}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={remind}
            onChange={(e) => setRemind(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          {t('importantDates.remind')}
        </label>
        {remind && (
          <select
            aria-label={t('importantDates.daysBefore')}
            value={lead}
            onChange={(e) => setLead(Number(e.target.value))}
            className={inputClass}
          >
            {leadOptions.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t('importantDates.onTheDay') : t('importantDates.before', { count: n })}
              </option>
            ))}
          </select>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
