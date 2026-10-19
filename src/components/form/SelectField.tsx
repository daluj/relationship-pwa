import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { inputClass } from './fieldClass';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  className?: string;
  hideLabel?: boolean;
}

export const SelectField = forwardRef<HTMLSelectElement, Props>(function SelectField(
  { label, options, className = '', hideLabel, ...rest },
  ref,
) {
  const id = useId();
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={hideLabel ? 'sr-only' : 'mb-1 block text-sm font-bold text-muted'}
      >
        {label}
      </label>
      <select ref={ref} id={id} className={inputClass} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
});
