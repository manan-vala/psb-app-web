'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { useAlert } from '@/context/AlertContext';
import { useBalance } from '@/context/BalanceContext';
import { useTelemetry } from '@/context/TelemetryContext';
import { verifyPassword } from '@/services/auth';

/** Port of the Expo app's `(app)/password.tsx` — final transaction authorisation. */
function PasswordScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const showAlert = useAlert();
  const { updateBalance } = useBalance();
  const { keystrokeInputProps, pasteHandlers } = useTelemetry();

  const amount = params.get('amount') ?? '0';
  const payeeName = params.get('payeeName') ?? 'Unknown Payee';

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = () => {
    if (!password) {
      showAlert('Error', 'Please enter your password to proceed.');
      return;
    }

    setLoading(true);
    setTimeout(async () => {
      if (!(await verifyPassword(password))) {
        setLoading(false);
        showAlert('Incorrect Password', 'Please enter your Bob World account password.');
        return;
      }
      setLoading(false);
      updateBalance(parseFloat(amount));
      router.push(
        `/success?amount=${encodeURIComponent(amount)}&payeeName=${encodeURIComponent(
          payeeName
        )}`
      );
    }, 1000);
  };

  return (
    <div className="screen">
      <TopAppBar title="Enter Password" showBackIcon onBackPress={() => router.back()} />

      <div className="scroll">
        <div className="scroll__content">
          <div className="text-center mb-lg" style={{ padding: '24px 0' }}>
            <div className="hero-icon hero-icon--sm hero-icon--tint">
              <Icon name="lock" size={32} />
            </div>
            <h1 className="t-headline-sm mb-sm">Confirm Transfer</h1>
            <p className="t-body-md c-variant">
              You are about to send ₹{amount} to {payeeName}
            </p>
          </div>

          <Input
            label="Password"
            placeholder="Enter your Bob World password"
            leadingIcon="lock"
            isPassword
            value={password}
            onValueChange={setPassword}
            onPaste={pasteHandlers.onPaste}
            onFocusCapture={pasteHandlers.onFocusCapture}
            onChangeTextCapture={pasteHandlers.onChangeTextCapture}
            {...keystrokeInputProps()}
          />
        </div>
      </div>

      <div
        style={{
          padding: 'var(--margin-mobile)',
          borderTop: '1px solid var(--surface-highest)',
          background: 'var(--surface-lowest)',
        }}
      >
        <Button label="Send Payment" icon="send" onClick={handleConfirm} loading={loading} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="loading-screen">
          <span className="spinner" style={{ width: 34, height: 34 }} />
        </div>
      }
    >
      <PasswordScreen />
    </Suspense>
  );
}
