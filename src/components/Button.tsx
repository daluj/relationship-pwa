import type { ButtonHTMLAttributes } from 'react';
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonClass';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className = '', type = 'button', ...rest }: Props) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...rest} />;
}
