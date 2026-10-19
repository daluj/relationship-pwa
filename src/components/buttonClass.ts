export type ButtonVariant = 'primary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  outline: 'border border-border text-text hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90',
  ghost: 'text-text hover:bg-surface-2',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-4 text-sm',
  md: 'h-9 px-4',
  lg: 'h-[52px] px-8 text-lg',
};

/** Pill button styles (X-like), shared by <Button> and button-looking links. */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]}`;
}
