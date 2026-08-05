'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { TrustIndicatorDot } from '@/components/ui/TrustIndicatorDot';
import { AVATAR_URL, RECENT_TRANSACTIONS, formatCurrency } from '@/constants/mock';
import { useBalance } from '@/context/BalanceContext';
import { useDrawer } from '@/context/DrawerContext';
import { useTelemetry } from '@/context/TelemetryContext';
import { getProfile } from '@/services/auth';

const QUICK_ACTIONS = [
  { label: 'Transfer', icon: 'swap-horiz', route: '/transfer' },
  { label: 'Pay Bills', icon: 'receipt', route: '/pay' },
  { label: 'Scan QR', icon: 'qr-code-scanner', route: null },
  { label: 'Invest', icon: 'trending-up', route: null },
];

/** Port of the Expo app's `(app)/home.tsx`. */
export default function HomeScreen() {
  const router = useRouter();
  const { openDrawer } = useDrawer();
  const { balance } = useBalance();
  const { trustScore } = useTelemetry();

  const [showBalance, setShowBalance] = useState(true);
  const [name, setName] = useState('Rahul Kapoor');

  useEffect(() => {
    const profile = getProfile();
    if (profile?.fullName) setName(profile.fullName);
  }, []);

  return (
    <div className="screen">
      <TopAppBar
        showMenuIcon
        onMenuPress={openDrawer}
        rightElement={
          <span className="avatar-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={AVATAR_URL} alt="" />
            <TrustIndicatorDot score={trustScore} />
          </span>
        }
      />

      <div className="scroll">
        <div className="scroll__content pad-nav">
          <div className="mb-lg">
            <p className="t-body-lg c-variant">Good Morning,</p>
            <h1 className="t-display-lg" style={{ marginTop: -4 }}>
              {name}
            </h1>
          </div>

          {/* Balance card */}
          <div className="card card--pad mb-lg" style={{ position: 'relative', padding: 24 }}>
            <span
              className="blob"
              style={{
                top: -30,
                right: -30,
                width: 100,
                height: 100,
                background: 'rgba(255,102,0,0.1)',
              }}
            />
            <div className="flex items-center gap-sm mb-sm">
              <span className="t-body-sm c-variant">Total Balance</span>
              <button
                onClick={() => setShowBalance((v) => !v)}
                aria-label="Toggle balance visibility"
                className="flex items-center"
              >
                <Icon
                  name={showBalance ? 'visibility' : 'visibility-off'}
                  size={20}
                  color="var(--secondary)"
                />
              </button>
            </div>

            <div className="t-display-lg c-primary mb-md">
              {showBalance ? `₹${formatCurrency(balance)}` : '••••••••'}
            </div>

            <div className="flex gap-sm">
              <button
                className="flex-1 t-label-md"
                style={{
                  background: 'var(--primary)',
                  color: 'var(--on-primary)',
                  padding: '12px 0',
                  borderRadius: 'var(--radius)',
                }}
              >
                Passbook
              </button>
              <button
                className="flex-1 t-label-md c-secondary"
                style={{
                  border: '1px solid var(--secondary)',
                  padding: '12px 0',
                  borderRadius: 'var(--radius)',
                }}
                onClick={() => router.push('/cards')}
              >
                Cards
              </button>
            </div>
          </div>

          {/* Quick actions */}
          <div
            className="mb-lg"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}
          >
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                className="flex-col items-center"
                onClick={() => action.route && router.push(action.route)}
              >
                <span
                  className="flex items-center justify-center mb-sm"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'rgba(255,133,51,0.2)',
                    color: 'var(--primary)',
                  }}
                >
                  <Icon name={action.icon} size={28} />
                </span>
                <span className="t-label-md text-center">{action.label}</span>
              </button>
            ))}
          </div>

          {/* Recent transactions */}
          <div>
            <div className="flex justify-between items-center mb-md">
              <h2 className="t-headline-sm">Recent Transactions</h2>
              <span className="t-label-md c-primary">View All</span>
            </div>

            <div className="stack-md">
              {RECENT_TRANSACTIONS.map((tx) => (
                <div key={tx.id} className="flex items-center">
                  <span
                    className="flex items-center justify-center"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: tx.iconBg,
                      color: '#fff',
                      marginRight: 12,
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={tx.icon} size={20} />
                  </span>
                  <div className="flex-1">
                    <div className="t-body-md fw-medium truncate">{tx.name}</div>
                    <div className="t-body-sm c-variant">{tx.date}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      className="t-body-md fw-bold"
                      style={{ color: tx.isPositive ? 'var(--success)' : 'var(--on-surface)' }}
                    >
                      {tx.amount}
                    </div>
                    <span
                      className="t-label-md c-variant"
                      style={{
                        display: 'inline-block',
                        background: 'var(--surface-highest)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 10,
                        marginTop: 4,
                      }}
                    >
                      {tx.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
