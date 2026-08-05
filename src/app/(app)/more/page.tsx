'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { AVATAR_URL } from '@/constants/mock';
import { useAlert } from '@/context/AlertContext';
import { useDrawer } from '@/context/DrawerContext';
import { getProfile, logout } from '@/services/auth';

const MENU_ITEMS = [
  { label: 'Fixed Deposits', icon: 'savings', route: '/fixed-deposits' },
  { label: 'Cards', icon: 'credit-card', route: '/cards' },
  { label: 'Loans', icon: 'real-estate-agent', route: '/loans' },
  { label: 'Offers', icon: 'local-offer', route: '/offers' },
  { label: 'Statements', icon: 'receipt-long', route: null },
  { label: 'Rewards', icon: 'redeem', route: null },
  { label: 'Manage Beneficiaries', icon: 'group', route: null },
  { label: 'Support', icon: 'headset-mic', route: '/support' },
  { label: 'Settings', icon: 'settings', route: '/settings' },
];

/** Port of the Expo app's `(app)/more.tsx`. */
export default function MoreScreen() {
  const router = useRouter();
  const showAlert = useAlert();
  const { openDrawer } = useDrawer();
  const [userName, setUserName] = useState('Bob World Customer');

  useEffect(() => {
    const profile = getProfile();
    if (profile?.fullName) setUserName(profile.fullName);
  }, []);

  return (
    <div className="screen">
      <TopAppBar title="More" showMenuIcon onMenuPress={openDrawer} />

      <div className="scroll">
        <div className="scroll__content pad-nav">
          <div className="card flex items-center mb-lg" style={{ padding: 16, gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={AVATAR_URL}
              alt=""
              style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }}
            />
            <div className="flex-1">
              <div className="t-body-lg fw-semibold">{userName}</div>
              <div className="t-body-sm c-variant">View &amp; manage your profile</div>
            </div>
            <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
          </div>

          <div
            className="mb-lg"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}
          >
            {MENU_ITEMS.map((item) => (
              <button
                key={item.label}
                className="card flex-col items-center"
                style={{ padding: '16px 8px' }}
                onClick={() =>
                  item.route
                    ? router.push(item.route)
                    : showAlert('Coming Soon', `${item.label} will be available in a future update.`)
                }
              >
                <span
                  className="flex items-center justify-center mb-sm"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'rgba(255,133,51,0.2)',
                    color: 'var(--primary)',
                  }}
                >
                  <Icon name={item.icon} size={24} />
                </span>
                <span className="t-label-md text-center">{item.label}</span>
              </button>
            ))}
          </div>

          <button
            className="btn btn--danger"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
          >
            <Icon name="logout" size={22} />
            <span>Logout</span>
          </button>

          <p className="t-label-md c-variant text-center mt-lg">Bob World v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
