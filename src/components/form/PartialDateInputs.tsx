import { useTranslation } from 'react-i18next';
import type { DateParts } from './dateParts';
import { inputClass } from './fieldClass';

/** Controlled day / month / optional year inputs (PartialDate, data-model §5.1). */
export function PartialDateInputs({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: DateParts;
  onChange: (v: DateParts) => void;
}) {
  const { t, i18n } = useTranslation();
  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(new Date(2000, i, 1)),
  );
  const set = (patch: Partial<DateParts>) => onChange({ ...value, ...patch });
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-bold text-muted">{legend}</legend>
      <div className="grid grid-cols-[1fr_2fr_1.3fr] gap-2">
        <input
          aria-label={t('form.day')}
          placeholder={t('form.day')}
          inputMode="numeric"
          value={value.day}
          onChange={(e) => set({ day: e.target.value })}
          className={inputClass}
        />
        <select
          aria-label={t('form.month')}
          value={value.month}
          onChange={(e) => set({ month: e.target.value })}
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
          value={value.year}
          onChange={(e) => set({ year: e.target.value })}
          className={inputClass}
        />
      </div>
    </fieldset>
  );
}
