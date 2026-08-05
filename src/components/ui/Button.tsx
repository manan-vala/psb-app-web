'use client';

import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: string;
  loading?: boolean;
}

/** Port of the Expo app's `components/ui/Button`. */
export function Button({
  label,
  variant = 'primary',
  icon,
  loading,
  disabled,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="spinner" />
      ) : (
        <>
          {icon && <Icon name={icon} size={24} />}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
