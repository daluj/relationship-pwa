import { useMemo } from 'react';
import { inputClass } from '@/components/form/fieldClass';
import { currencyCodes } from '@/domain/money';

export function CurrencySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const codes = useMemo(() => {
    const all = currencyCodes();
    return all.includes(value) ? all : [value, ...all];
  }, [value]);
  return (
    <label className="text-sm font-bold text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} mt-1 font-normal text-text`}
      >
        {codes.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );
}
