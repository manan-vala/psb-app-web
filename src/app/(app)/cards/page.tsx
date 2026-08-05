'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { useAlert } from '@/context/AlertContext';
import { useDrawer } from '@/context/DrawerContext';

const CARDS = [
  {
    id: '1',
    type: 'Debit Card',
    name: 'BOB World Debit',
    last4: '4321',
    expiry: '09/29',
    gradient: 'linear-gradient(135deg, #FF6600, #AD3300)',
  },
  {
    id: '2',
    type: 'Credit Card',
    name: 'BOB Premier Credit',
    last4: '8890',
    expiry: '03/28',
    gradient: 'linear-gradient(135deg, #485e8a, #1D355E)',
  },
];

const ACTIONS = [
  { label: 'Block Card', icon: 'block' },
  { label: 'Set Limits', icon: 'tune' },
  { label: 'View PIN', icon: 'password' },
  { label: 'Manage', icon: 'settings' },
];

/** Port of the Expo app's `(app)/cards.tsx`. */
export default function CardsScreen() {
  const showAlert = useAlert();
  const { openDrawer } = useDrawer();
  const [selected, setSelected] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const active = CARDS[selected];

  return (
    <div className="screen">
      <TopAppBar title="Cards" showMenuIcon onMenuPress={openDrawer} />

      <div className="scroll">
        <div className="scroll__content pad-nav">
          <div
            style={{
              display: 'flex',
              gap: 16,
              overflowX: 'auto',
              paddingBottom: 8,
              scrollbarWidth: 'none',
            }}
          >
            {CARDS.map((card, i) => (
              <button
                key={card.id}
                onClick={() => setSelected(i)}
                style={{
                  flexShrink: 0,
                  width: 280,
                  height: 172,
                  borderRadius: 'var(--radius-lg)',
                  background: card.gradient,
                  color: '#fff',
                  padding: 20,
                  textAlign: 'left',
                  boxShadow: 'var(--shadow-high)',
                  opacity: i === selected ? 1 : 0.55,
                  transition: 'opacity 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <span className="flex justify-between items-center">
                  <span className="t-label-md" style={{ opacity: 0.9 }}>
                    {card.type}
                  </span>
                  <Icon name="contactless" size={22} />
                </span>
                <span className="t-headline-sm" style={{ letterSpacing: 2 }}>
                  {revealed ? `5241 8832 9017 ${card.last4}` : `•••• •••• •••• ${card.last4}`}
                </span>
                <span className="flex justify-between items-end">
                  <span>
                    <span className="t-label-md" style={{ opacity: 0.75, display: 'block' }}>
                      CARD HOLDER
                    </span>
                    <span className="t-body-sm fw-medium">{card.name}</span>
                  </span>
                  <span>
                    <span className="t-label-md" style={{ opacity: 0.75, display: 'block' }}>
                      EXPIRES
                    </span>
                    <span className="t-body-sm fw-medium">{card.expiry}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>

          <button
            className="flex items-center justify-center w-full mt-md mb-lg"
            style={{ gap: 6, color: 'var(--primary)' }}
            onClick={() => setRevealed((v) => !v)}
          >
            <Icon name={revealed ? 'visibility-off' : 'visibility'} size={18} />
            <span className="t-label-md">{revealed ? 'Hide' : 'Reveal'} card number</span>
          </button>

          <div
            className="mb-lg"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}
          >
            {ACTIONS.map((a) => (
              <button
                key={a.label}
                className="flex-col items-center"
                onClick={() =>
                  showAlert('Coming Soon', `${a.label} will be available in a future update.`)
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
                  <Icon name={a.icon} size={22} />
                </span>
                <span className="t-label-md text-center" style={{ fontSize: 11 }}>
                  {a.label}
                </span>
              </button>
            ))}
          </div>

          <p className="section-label">CARD DETAILS</p>
          <div className="card">
            {[
              ['Card Type', active.type],
              ['Status', 'Active'],
              ['Linked Account', 'Everyday Checking'],
              ['Daily ATM Limit', '₹50,000'],
              ['Daily POS Limit', '₹2,00,000'],
            ].map(([label, value], i) => (
              <div key={label}>
                {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
                <div className="flex justify-between items-center" style={{ padding: 16 }}>
                  <span className="t-body-sm c-variant">{label}</span>
                  <span className="t-body-md fw-medium">{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
