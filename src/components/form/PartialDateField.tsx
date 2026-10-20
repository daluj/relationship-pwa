import type { UseFormRegisterReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { inputClass } from './fieldClass';

interface Props {
  legend: string;
  day: UseFormRegisterReturn;
  month: UseFormRegisterReturn;
  year: UseFormRegisterReturn;
  error?: string;
}

/** Day / month / optional year (PartialDate, data-model §5.1). */
export function PartialDateField({ legend, day, month, year, error }: Props) {
  const { t, i18n } = useTranslation();
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(new Date(2000, i, 1)),
  );
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-bold text-muted">{legend}</legend>
      <div className="grid grid-cols-[1fr_2fr_1.3fr] gap-2">
        <label>
          <span className="sr-only">{t('form.day')}</span>
          <input
            {...day}
            inputMode="numeric"
            placeholder={t('form.day')}
            aria-invalid={!!error}
            className={inputClass}
          />
        </label>
        <label>
          <span className="sr-only">{t('form.month')}</span>
          <select {...month} aria-invalid={!!error} className={inputClass}>
            <option value="">{t('form.month')}</option>
            {monthNames.map((name, i) => (
              <option key={name} value={String(i + 1)}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">
            {t('form.year')} ({t('common.optional')})
          </span>
          <input
            {...year}
            inputMode="numeric"
            placeholder={`${t('form.year')} (${t('common.optional')})`}
            aria-invalid={!!error}
            className={inputClass}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
