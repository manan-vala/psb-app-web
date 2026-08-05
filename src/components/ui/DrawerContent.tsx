'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { Button } from './Button';
import { AVATAR_URL } from '@/constants/mock';
import { getProfile, logout } from '@/services/auth';

const NAV_ITEMS = [
  { label: 'My Accounts', icon: 'account-balance', route: '/home' },
  { label: 'Fixed Deposits', icon: 'savings', route: '/fixed-deposits' },
  { label: 'Cards', icon: 'credit-card', route: '/cards' },
  { label: 'Loans', icon: 'real-estate-agent', route: '/loans' },
  { label: 'Offers', icon: 'local-offer', route: '/offers' },
  { label: 'Support', icon: 'headset-mic', route: '/support', divider: true },
  { label: 'Settings', icon: 'settings', route: '/settings' },
];

/** Port of the Expo app's `DrawerContent`, rendered as a slide-over panel. */
export function DrawerContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState('Bob World Customer');

  useEffect(() => {
    const profile = getProfile();
    if (profile?.fullName) setUserName(profile.fullName);
  }, []);

  return (
    <>
      <div className="drawer__overlay" onClick={onClose} />
      <aside className="drawer__panel">
        <div className="drawer__profile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="drawer__avatar" src={AVATAR_URL} alt="" />
          <div className="t-headline-sm mb-sm">{userName}</div>
          <span className="drawer__badge t-label-md">Premier Customer</span>
        </div>

        <div className="drawer__nav">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.route;
            return (
              <div key={item.label}>
                {item.divider && <div className="drawer__divider" />}
                {/* Links prefetch on render, so opening the drawer warms every
                    destination while the user is still reading the menu. */}
                <Link
                  href={item.route}
                  prefetch
                  className={`drawer__item${isActive ? ' drawer__item--active' : ''}`}
                  onClick={() => onClose()}
                >
                  <Icon name={item.icon} size={24} />
                  <span className="t-body-lg">{item.label}</span>
                </Link>
              </div>
            );
          })}
        </div>

        <div className="drawer__footer">
          <Button
            label="Logout"
            variant="secondary"
            icon="logout"
            style={{ height: 48, borderRadius: 24 }}
            onClick={() => {
              onClose();
              logout();
              router.replace('/login');
            }}
          />
        </div>
      </aside>
    </>
  );
}
