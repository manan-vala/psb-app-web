'use client';

import { memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';

const TABS = [
  { name: 'Home', icon: 'home', route: '/home' },
  { name: 'Transfer', icon: 'swap-horiz', route: '/transfer' },
  { name: 'Pay', icon: 'payments', route: '/pay' },
  { name: 'More', icon: 'more-horiz', route: '/more' },
];

/** Screens where the app hides the bar, matching the Expo implementation. */
const HIDDEN_ON = ['/confirm', '/password', '/success', '/blocked'];

/**
 * Tabs are `<Link>`s rather than buttons calling `router.push`. Next only
 * prefetches Link elements, so as buttons every tab switch had to fetch the
 * route's RSC payload and JS chunk on click — that was the tab-switch lag.
 * As Links, all four routes are prefetched while the bar is on screen and the
 * switch becomes instant.
 */
export const BottomNavBar = memo(function BottomNavBar() {
  const pathname = usePathname();

  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="bottomnav">
      {TABS.map((tab) => {
        const isActive = pathname === tab.route;
        return (
          <Link
            key={tab.name}
            href={tab.route}
            prefetch
            aria-current={isActive ? 'page' : undefined}
            className={`bottomnav__tab${isActive ? ' bottomnav__tab--active' : ''}`}
            // Re-navigating to the current route would remount it for nothing.
            onClick={(e) => {
              if (isActive) e.preventDefault();
            }}
          >
            {isActive && <span className="bottomnav__indicator" />}
            <Icon name={tab.icon} size={24} />
            <span className="bottomnav__label">{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
});
