import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  /** Hover tint uses the accent (X action-row style). */
  tone?: 'default' | 'accent';
}

/** Round icon-only button; `label` becomes the aria-label (SPEC §6.10). */
export function IconButton({ label, children, tone = 'default', className = '', ...rest }: Props) {
  const hover =
    tone === 'accent' ? 'hover:bg-accent-tint hover:text-accent-text' : 'hover:bg-surface-2';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-full p-2 transition-colors ${hover} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
