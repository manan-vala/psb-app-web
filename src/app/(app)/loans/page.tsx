'use client';

import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { useAlert } from '@/context/AlertContext';
import { useDrawer } from '@/context/DrawerContext';

const PRODUCTS = [
  {
    id: '1',
    label: 'Personal Loan',
    icon: 'account-balance-wallet',
    rate: 'From 10.5% p.a.',
    desc: 'Up to ₹15,00,000, quick disbursal',
    color: '#FF8533',
  },
  {
    id: '2',
    label: 'Home Loan',
    icon: 'home',
    rate: 'From 8.4% p.a.',
    desc: 'Up to ₹5 Cr, tenure up to 30 years',
    color: '#b5ccfe',
  },
  {
    id: '3',
    label: 'Car Loan',
    icon: 'directions-car',
    rate: 'From 9.1% p.a.',
    desc: 'Up to 90% on-road funding',
    color: '#79746f',
  },
  {
    id: '4',
    label: 'Education Loan',
    icon: 'school',
    rate: 'From 9.5% p.a.',
    desc: 'For domestic & overseas studies',
    color: '#ffdad6',
  },
];

/** Port of the Expo app's `(app)/loans.tsx`. */
export default function LoansScreen() {
  const showAlert = useAlert();
  const { openDrawer } = useDrawer();

  const comingSoon = (feature: string) =>
    showAlert('Coming Soon', `${feature} will be available in a future update.`);

  return (
    <div className="screen">
      <TopAppBar title="Loans" showMenuIcon onMenuPress={openDrawer} />

      <div className="scroll">
        <div className="scroll__content pad-nav">
          <div
            className="card flex items-center mb-lg"
            style={{ padding: 16, gap: 10 }}
          >
            <Icon name="check-circle-outline" size={22} color="var(--secondary)" />
            <span className="t-body-sm c-variant">
              You have no active loans right now.
            </span>
          </div>

          <h2 className="t-headline-sm mb-md">Explore Loan Products</h2>
          <div className="stack-md mb-lg">
            {PRODUCTS.map((p) => (
              <div key={p.id} className="card flex items-center" style={{ padding: 16, gap: 12 }}>
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 'var(--radius-md)',
                    background: `${p.color}88`,
                    color: 'var(--primary)',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={p.icon} size={26} />
                </span>
                <div className="flex-1">
                  <div className="t-body-md fw-semibold">{p.label}</div>
                  <div className="t-body-sm c-variant">{p.desc}</div>
                  <div className="t-label-md c-primary" style={{ marginTop: 4 }}>
                    {p.rate}
                  </div>
                </div>
                <button
                  className="t-label-md"
                  style={{
                    background: 'var(--primary)',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-full)',
                  }}
                  onClick={() => comingSoon(`Applying for a ${p.label}`)}
                >
                  Apply
                </button>
              </div>
            ))}
          </div>

          <button
            className="card flex items-center w-full"
            style={{ padding: 16, gap: 12 }}
            onClick={() => comingSoon('The EMI calculator')}
          >
            <Icon name="calculate" size={22} color="var(--primary)" />
            <span className="flex-1" style={{ textAlign: 'left' }}>
              <span className="t-body-md fw-semibold" style={{ display: 'block' }}>
                EMI Calculator
              </span>
              <span className="t-body-sm c-variant">
                Estimate your monthly installment before applying.
              </span>
            </span>
            <Icon name="arrow-forward-ios" size={16} color="var(--on-surface-variant)" />
          </button>
        </div>
      </div>
    </div>
  );
}
