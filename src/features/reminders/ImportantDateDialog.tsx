import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { inputClass } from '@/components/form/fieldClass';
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

/** Add/edit an important date with an optional yearly reminder (SPEC §5.1, §8.5). */
export function ImportantDateDialog({ open, onClose, contactId, date }: Props) {
  const { t, i18n } = useTranslation();
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

  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(new Date(2000, i, 1)),
  );

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
        <fieldset>
          <legend className="mb-1 text-sm font-bold text-muted">{t('importantDates.date')}</legend>
          <div className="grid grid-cols-[1fr_2fr_1.3fr] gap-2">
            <input
              aria-label={t('form.day')}
              placeholder={t('form.day')}
              inputMode="numeric"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className={inputClass}
            />
            <select
              aria-label={t('form.month')}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={inputClass}
            >
              <option value="">{t('form.month')}</option>
              {months.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m}
                </option>
              ))}
            </select>
            <input
              aria-label={`${t('form.year')} (${t('common.optional')})`}
              placeholder={`${t('form.year')} (${t('common.optional')})`}
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={inputClass}
            />
          </div>
        </fieldset>
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
