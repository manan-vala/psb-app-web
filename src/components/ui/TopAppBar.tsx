'use client';

import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface TopAppBarProps {
  title?: string;
  showMenuIcon?: boolean;
  showBackIcon?: boolean;
  onMenuPress?: () => void;
  onBackPress?: () => void;
  rightElement?: ReactNode;
}

/** Port of the Expo app's `components/ui/TopAppBar`. */
export function TopAppBar({
  title = 'Bob World',
  showMenuIcon,
  showBackIcon,
  onMenuPress,
  onBackPress,
  rightElement,
}: TopAppBarProps) {
  return (
    <header className="appbar">
      <div className="appbar__content">
        <div className="appbar__side">
          {showMenuIcon && (
            <button className="appbar__icon-btn" onClick={onMenuPress} aria-label="Open menu">
              <Icon name="menu" size={28} />
            </button>
          )}
          {showBackIcon && (
            <button className="appbar__icon-btn" onClick={onBackPress} aria-label="Go back">
              <Icon name="arrow-back" size={28} />
            </button>
          )}
        </div>

        <div className="appbar__title">{title}</div>

        <div className="appbar__side appbar__side--right">{rightElement}</div>
      </div>
    </header>
  );
}
