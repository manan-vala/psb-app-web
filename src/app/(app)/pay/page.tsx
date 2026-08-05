'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { useAlert } from '@/context/AlertContext';
import { useDrawer } from '@/context/DrawerContext';

const BILLERS = [
  { label: 'Mobile Recharge', icon: 'smartphone' },
  { label: 'Electricity', icon: 'bolt' },
  { label: 'DTH', icon: 'live-tv' },
  { label: 'Broadband', icon: 'wifi' },
  { label: 'Water Bill', icon: 'water-drop' },
  { label: 'Gas Bill', icon: 'local-fire-department' },
  { label: 'Credit Card', icon: 'credit-card' },
  { label: 'Insurance', icon: 'shield' },
];

const RECENT_BILLERS = [
  { name: 'Airtel Postpaid', sub: 'Mobile • •••• 4321', icon: 'smartphone' },
  { name: 'Tata Power', sub: 'Electricity • Account 998211', icon: 'bolt' },
];

/** Port of the Expo app's `(app)/pay.tsx`. */
export default function PayScreen() {
  const router = useRouter();
  const showAlert = useAlert();
  const { openDrawer } = useDrawer();

  const comingSoon = (feature: string) =>
    showAlert('Coming Soon', `${feature} will be available in a future update.`);

  return (
    <div className="screen">
      <TopAppBar title="Pay" showMenuIcon onMenuPress={openDrawer} />

      <div className="scroll">
        <div className="scroll__content pad-nav">
          <button
            className="flex items-center w-full mb-lg"
            style={{
              gap: 12,
              background: 'var(--primary)',
              color: '#fff',
              padding: 16,
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-high)',
            }}
            onClick={() => comingSoon('Scan & Pay')}
          >
            <span
              className="flex items-center justify-center"
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                flexShrink: 0,
              }}
            >
              <Icon name="qr-code-scanner" size={28} />
            </span>
            <span className="flex-1" style={{ textAlign: 'left' }}>
              <span className="t-headline-sm" style={{ display: 'block' }}>
                Scan &amp; Pay
              </span>
              <span className="t-body-sm" style={{ opacity: 0.85 }}>
                Pay instantly using any UPI QR code
              </span>
            </span>
            <Icon name="arrow-forward-ios" size={16} />
          </button>

          <div className="flex mb-lg" style={{ gap: 12 }}>
            <button className="flex-col items-center flex-1" onClick={() => router.push('/transfer')}>
              <span
                className="flex items-center justify-center mb-sm"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(255,133,51,0.3)',
                  color: 'var(--primary)',
                }}
              >
                <Icon name="swap-horiz" size={22} />
              </span>
              <span className="t-label-md">To Bank / UPI</span>
            </button>
            <button
              className="flex-col items-center flex-1"
              onClick={() => comingSoon('Mobile Number payments')}
            >
              <span
                className="flex items-center justify-center mb-sm"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(181,204,254,0.5)',
                  color: 'var(--primary)',
                }}
              >
                <Icon name="contacts" size={22} />
              </span>
              <span className="t-label-md">To Mobile No.</span>
            </button>
          </div>

          <p className="section-label">PAY BILLS</p>
          <div
            className="mb-lg"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}
          >
            {BILLERS.map((b) => (
              <button
                key={b.label}
                className="flex-col items-center"
                onClick={() => comingSoon(b.label)}
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
                  <Icon name={b.icon} size={22} />
                </span>
                <span className="t-label-md text-center" style={{ fontSize: 11 }}>
                  {b.label}
                </span>
              </button>
            ))}
          </div>

          <p className="section-label">RECENT BILLERS</p>
          <div className="card">
            {RECENT_BILLERS.map((b, i) => (
              <div key={b.name}>
                {i > 0 && <div className="divider" />}
                <button className="row" onClick={() => comingSoon(b.name)}>
                  <span className="row__icon">
                    <Icon name={b.icon} size={22} />
                  </span>
                  <span className="row__body">
                    <span className="row__label" style={{ display: 'block' }}>
                      {b.name}
                    </span>
                    <span className="row__sub" style={{ display: 'block' }}>
                      {b.sub}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
