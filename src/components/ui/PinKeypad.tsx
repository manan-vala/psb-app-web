'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/**
 * Keeps the keypad layout randomized each time it mounts, matching the Expo
 * app's anti-shoulder-surfing behaviour.
 */
function shuffleArray<T>(array: T[]): T[] {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function PinDots({
  length,
  filled,
  error,
}: {
  length: number;
  filled: number;
  error?: boolean;
}) {
  return (
    <div className="pin-dots">
      {Array.from({ length }).map((_, index) => (
        <span
          key={index}
          className={`pin-dot${
            filled > index ? (error ? ' pin-dot--error' : ' pin-dot--filled') : ''
          }`}
        />
      ))}
    </div>
  );
}

interface PinKeypadProps {
  pin: string;
  maxLength?: number;
  onChangePin: (pin: string) => void;
  onComplete?: (pin: string) => void;
  onKeypress?: () => void;
  disabled?: boolean;
}

export function PinKeypad({
  pin,
  maxLength = 4,
  onChangePin,
  onComplete,
  onKeypress,
  disabled,
}: PinKeypadProps) {
  // Start with a stable order for SSR/hydration, then shuffle client-side after mount.
  const [keypadNumbers, setKeypadNumbers] = useState<number[]>([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 0,
  ]);

  useEffect(() => {
    setKeypadNumbers(shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  }, []);

  const handleKeyPress = (digit: number) => {
    if (disabled || pin.length >= maxLength) return;
    onKeypress?.();
    const newPin = pin + digit;
    onChangePin(newPin);
    if (newPin.length === maxLength) onComplete?.(newPin);
  };

  const handleBackspace = () => {
    if (disabled || pin.length === 0) return;
    onChangePin(pin.slice(0, -1));
  };

  return (
    <div className="keypad">
      {keypadNumbers.slice(0, 9).map((n, i) => (
        <button
          key={i}
          className="keypad__btn"
          onClick={() => handleKeyPress(n)}
          disabled={disabled}
        >
          {n}
        </button>
      ))}
      <span className="keypad__btn keypad__btn--empty" />
      <button
        className="keypad__btn"
        onClick={() => handleKeyPress(keypadNumbers[9])}
        disabled={disabled}
      >
        {keypadNumbers[9]}
      </button>
      <button
        className="keypad__btn"
        onClick={handleBackspace}
        disabled={disabled || pin.length === 0}
        aria-label="Delete"
      >
        <Icon
          name="backspace"
          size={26}
          color={pin.length > 0 ? 'var(--on-surface)' : 'var(--outline)'}
        />
      </button>
    </div>
  );
}
