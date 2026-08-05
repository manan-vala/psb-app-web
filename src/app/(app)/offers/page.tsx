'use client';

import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { useAlert } from '@/context/AlertContext';
import { useDrawer } from '@/context/DrawerContext';

const OFFERS = [
  {
    id: '1',
    title: '10% Cashback on Amazon',
    desc: 'Use your BOB Debit Card, up to ₹500 back',
    icon: 'shopping-bag',
    expiry: 'Valid till 31 Aug 2026',
    color: '#FF8533',
  },
  {
    id: '2',
    title: 'Zero Forex Markup',
    desc: 'On international spends with Premier Credit Card',
    icon: 'public',
    expiry: 'Valid till 30 Sep 2026',
    color: '#b5ccfe',
  },
  {
    id: '3',
    title: '5% Off Dining',
    desc: 'At 500+ partner restaurants nationwide',
    icon: 'restaurant',
    expiry: 'Valid till 15 Sep 2026',
    color: '#79746f',
  },
  {
    id: '4',
    title: 'Fuel Surcharge Waiver',
    desc: '1% waiver at all major fuel stations',
    icon: 'local-gas-station',
    expiry: 'Valid till 31 Dec 2026',
    color: '#ffdad6',
  },
];

/** Port of the Expo app's `(app)/offers.tsx`. */
export default function OffersScreen() {
  const showAlert = useAlert();
  const { openDrawer } = useDrawer();

  return (
    <div className="screen">
      <TopAppBar title="Offers" showMenuIcon onMenuPress={openDrawer} />

      <div className="scroll">
        <div className="scroll__content pad-nav">
          <p className="t-body-sm c-variant mb-lg">
            Curated deals based on your cards &amp; spending
          </p>

          <div className="stack-md">
            {OFFERS.map((o) => (
              <button
                key={o.id}
                className="card flex items-center w-full"
                style={{ padding: 16, gap: 12 }}
                onClick={() => showAlert('Coming Soon', `${o.title} will be available in a future update.`)}
              >
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 'var(--radius-md)',
                    background: `${o.color}88`,
                    color: 'var(--primary)',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={o.icon} size={26} />
                </span>
                <span className="flex-1" style={{ textAlign: 'left' }}>
                  <span className="t-body-md fw-semibold" style={{ display: 'block' }}>
                    {o.title}
                  </span>
                  <span className="t-body-sm c-variant" style={{ display: 'block' }}>
                    {o.desc}
                  </span>
                  <span className="flex items-center" style={{ gap: 4, marginTop: 4 }}>
                    <Icon name="schedule" size={14} color="var(--on-surface-variant)" />
                    <span className="t-label-md c-variant">{o.expiry}</span>
                  </span>
                </span>
                <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
