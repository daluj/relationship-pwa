import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { inputClass } from './fieldClass';

interface Common {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
}

type InputProps = Common & InputHTMLAttributes<HTMLInputElement> & { multiline?: false };
type AreaProps = Common & TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true };

/** Labelled input/textarea with error + hint wired to aria-describedby. */
export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps | AreaProps>(
  function TextField({ label, error, hint, className = '', multiline, ...rest }, ref) {
    const id = useId();
    const describedBy =
      [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
    const shared = {
      id,
      'aria-invalid': !!error,
      'aria-describedby': describedBy,
      className: inputClass,
    };
    return (
      <div className={className}>
        <label htmlFor={id} className="mb-1 block text-sm font-bold text-muted">
          {label}
        </label>
        {multiline ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            rows={3}
            {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
            {...shared}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            {...(rest as InputHTMLAttributes<HTMLInputElement>)}
            {...shared}
          />
        )}
        {hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);
