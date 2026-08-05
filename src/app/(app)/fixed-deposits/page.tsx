'use client';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { formatCurrency } from '@/constants/mock';
import { useAlert } from '@/context/AlertContext';
import { useDrawer } from '@/context/DrawerContext';

const DEPOSITS = [
  {
    id: '1',
    label: 'Family Goal FD',
    amount: 250000,
    rate: 7.1,
    tenure: '2 years',
    maturity: '14 Nov 2027',
    progress: 0.62,
  },
  {
    id: '2',
    label: 'Tax Saver FD',
    amount: 150000,
    rate: 6.75,
    tenure: '5 years',
    maturity: '02 Mar 2031',
    progress: 0.18,
  },
  {
    id: '3',
    label: 'Short Term FD',
    amount: 50000,
    rate: 6.4,
    tenure: '6 months',
    maturity: '20 Sep 2026',
    progress: 0.85,
  },
];

/** Port of the Expo app's `(app)/fixed-deposits.tsx`. */
export default function FixedDepositsScreen() {
  const showAlert = useAlert();
  const { openDrawer } = useDrawer();
  const totalValue = DEPOSITS.reduce((sum, d) => sum + d.amount, 0);

  const comingSoon = (feature: string) =>
    showAlert('Coming Soon', `${feature} will be available in a future update.`);

  return (
    <div className="screen">
      <TopAppBar title="Fixed Deposits" showMenuIcon onMenuPress={openDrawer} />

      <div className="scroll">
        <div className="scroll__content pad-nav">
          <div
            className="card mb-lg"
            style={{ padding: 24, position: 'relative' }}
          >
            <span
              className="blob"
              style={{
                top: -30,
                right: -30,
                width: 110,
                height: 110,
                background: 'rgba(255,102,0,0.1)',
              }}
            />
            <p className="t-body-sm c-variant">Total FD Value</p>
            <div className="t-display-lg c-primary">₹{formatCurrency(totalValue)}</div>
            <p className="t-body-sm c-variant">
              Across {DEPOSITS.length} active deposits
            </p>
          </div>

          <div className="mb-lg">
            <Button
              label="Open New FD"
              icon="add-circle-outline"
              onClick={() => comingSoon('Opening a new Fixed Deposit')}
            />
          </div>

          <h2 className="t-headline-sm mb-md">Your Deposits</h2>
          <div className="stack-md">
            {DEPOSITS.map((d) => (
              <button
                key={d.id}
                className="card w-full"
                style={{ padding: 16, textAlign: 'left' }}
                onClick={() => comingSoon(`Details for ${d.label}`)}
              >
                <div className="flex items-center mb-md" style={{ gap: 12 }}>
                  <span
                    className="flex items-center justify-center"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'var(--primary-container)',
                      color: 'var(--on-primary-container)',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="savings" size={22} />
                  </span>
                  <span className="flex-1">
                    <span className="t-body-md fw-semibold" style={{ display: 'block' }}>
                      {d.label}
                    </span>
                    <span className="t-body-sm c-variant">Matures {d.maturity}</span>
                  </span>
                  <span
                    className="t-label-md"
                    style={{
                      background: 'rgba(74,222,128,0.2)',
                      color: 'var(--success)',
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    Active
                  </span>
                </div>

                <div className="flex justify-between mb-sm">
                  <span>
                    <span className="t-label-md c-variant" style={{ display: 'block' }}>
                      Principal
                    </span>
                    <span className="t-body-md fw-semibold">
                      ₹{d.amount.toLocaleString('en-IN')}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="t-label-md c-variant" style={{ display: 'block' }}>
                      Interest Rate
                    </span>
                    <span className="t-body-md fw-semibold c-primary">{d.rate}% p.a.</span>
                  </span>
                  <span className="text-right">
                    <span className="t-label-md c-variant" style={{ display: 'block' }}>
                      Tenure
                    </span>
                    <span className="t-body-md fw-semibold">{d.tenure}</span>
                  </span>
                </div>

                <div
                  style={{
                    height: 6,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface-highest)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${d.progress * 100}%`,
                      height: '100%',
                      background: 'var(--primary)',
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
