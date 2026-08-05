'use client';

import { useState, type FocusEvent, type InputHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onFocusCapture'> {
  label: string;
  leadingIcon?: string;
  isPassword?: boolean;
  onValueChange?: (value: string) => void;
  /** Telemetry taps, mirroring the Expo Input's capture props. */
  onFocusCapture?: () => void;
  onChangeTextCapture?: (value: string) => void;
}

/** Port of the Expo app's `components/ui/Input`. */
export function Input({
  label,
  leadingIcon,
  isPassword,
  onValueChange,
  onFocusCapture,
  onChangeTextCapture,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocusCapture?.();
    onFocus?.(e);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <div className="field">
      <label className="field__label">{label}</label>
      <div className={`field__box${isFocused ? ' field__box--focused' : ''}`}>
        {leadingIcon && <Icon name={leadingIcon} size={24} />}
        {/* `props` is spread first so the handlers below always win — the
            Expo version relied on RN prop ordering for the same effect. */}
        <input
          {...props}
          className="field__input"
          type={isPassword && !showPassword ? 'password' : 'text'}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => {
            onChangeTextCapture?.(e.target.value);
            onValueChange?.(e.target.value);
          }}
        />
        {isPassword && (
          <button
            type="button"
            className="field__toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={24} />
          </button>
        )}
      </div>
    </div>
  );
}
