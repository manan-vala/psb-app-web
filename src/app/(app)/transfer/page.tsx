'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { AVATAR_URL, PAYEES, formatCurrency } from '@/constants/mock';
import { useAlert } from '@/context/AlertContext';
import { useBalance } from '@/context/BalanceContext';
import { useDrawer } from '@/context/DrawerContext';

/** Port of the Expo app's `(app)/transfer.tsx`. */
export default function TransferScreen() {
  const router = useRouter();
  const showAlert = useAlert();
  const { openDrawer } = useDrawer();
  const { balance } = useBalance();

  const [amount, setAmount] = useState('0.00');
  const [selectedPayee, setSelectedPayee] = useState<string | null>(null);

  const handleAddAmount = (add: number) => {
    const current = parseFloat(amount || '0');
    setAmount((current + add).toFixed(2));
  };

  const handleContinue = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (numAmount > balance) {
      showAlert('Insufficient Funds', 'You do not have enough balance for this transfer.');
      return;
    }
    if (!selectedPayee) {
      showAlert('Select Payee', 'Please select a payee before continuing.');
      return;
    }
    const payee = PAYEES.find((p) => p.id === selectedPayee);
    router.push(
      `/confirm?amount=${numAmount.toFixed(2)}&payeeName=${encodeURIComponent(
        payee?.name ?? 'Unknown'
      )}`
    );
  };

  return (
    <div className="screen">
      <TopAppBar
        title="Transfer"
        showMenuIcon
        onMenuPress={openDrawer}
        rightElement={
          <span className="avatar-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={AVATAR_URL} alt="" />
          </span>
        }
      />

      <div className="scroll">
        <div className="scroll__content pad-nav">
          {/* From account */}
          <div className="mb-lg">
            <p className="section-label">FROM ACCOUNT</p>
            <div className="card flex items-center justify-between" style={{ padding: 16 }}>
              <div className="flex items-center" style={{ gap: 12 }}>
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--secondary-container)',
                    color: 'var(--on-secondary-container)',
                  }}
                >
                  <Icon name="account-balance-wallet" size={20} />
                </span>
                <div>
                  <div className="t-body-md fw-semibold">Everyday Checking</div>
                  <div className="t-body-sm c-variant">
                    Available: ₹{formatCurrency(balance)}
                  </div>
                </div>
              </div>
              <Icon name="expand-more" size={24} color="var(--on-surface-variant)" />
            </div>
          </div>

          {/* Amount */}
          <div className="mb-lg">
            <p className="section-label text-center">AMOUNT</p>
            <div
              className="card flex-col items-center"
              style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}
            >
              <div className="flex items-center justify-center mb-md" style={{ gap: 4 }}>
                <span className="t-display-lg c-secondary" style={{ opacity: 0.8 }}>
                  ₹
                </span>
                <input
                  className="t-display-lg c-primary"
                  style={{
                    textAlign: 'center',
                    minWidth: 120,
                    maxWidth: 200,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                  }}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                {[50, 100, 500].map((v) => (
                  <button
                    key={v}
                    className="t-label-md"
                    style={{
                      background: 'var(--surface-high)',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-full)',
                    }}
                    onClick={() => handleAddAmount(v)}
                  >
                    + ₹{v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Payees */}
          <div className="mb-lg">
            <div className="flex justify-between items-center mb-sm">
              <p className="section-label" style={{ margin: 0 }}>
                SELECT PAYEE
              </p>
              <span className="t-label-md c-primary">See All</span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 16,
                overflowX: 'auto',
                paddingBottom: 4,
                scrollbarWidth: 'none',
              }}
            >
              <button className="flex-col items-center" style={{ width: 72, flexShrink: 0 }}>
                <span
                  className="flex items-center justify-center mb-sm"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'var(--surface-container)',
                    border: '2px dashed rgba(72,94,138,0.3)',
                    color: 'var(--secondary)',
                  }}
                >
                  <Icon name="add" size={24} />
                </span>
                <span className="t-label-md">New</span>
              </button>

              {PAYEES.map((p) => {
                const isSelected = selectedPayee === p.id;
                return (
                  <button
                    key={p.id}
                    className="flex-col items-center"
                    style={{ width: 72, flexShrink: 0 }}
                    onClick={() => setSelectedPayee(p.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image}
                      alt=""
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginBottom: 8,
                        border: `2px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
                        boxShadow: 'var(--shadow-low)',
                      }}
                    />
                    <span className="t-label-md text-center truncate w-full">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div className="mb-lg">
            <div className="field__box">
              <Icon name="edit-note" size={24} />
              <input className="field__input" placeholder="Add a note (optional)" />
            </div>
          </div>

          <Button label="Continue" icon="arrow-forward" onClick={handleContinue} />
        </div>
      </div>
    </div>
  );
}
