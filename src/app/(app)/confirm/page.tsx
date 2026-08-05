'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { useAlert } from '@/context/AlertContext';
import { useTelemetry } from '@/context/TelemetryContext';

/**
 * Port of the Expo app's `(app)/confirm.tsx`.
 *
 * This is where the second risk assessment happens: by now the journey has
 * accumulated (login -> home -> transfer -> confirm), so the backend can catch
 * speedruns and headless navigation that looked fine at login time.
 */
function ConfirmScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const showAlert = useAlert();
  const { keystrokeInputProps, submitTelemetry } = useTelemetry();

  const amount = params.get('amount') ?? '0';
  const payeeName = params.get('payeeName') ?? 'Unknown Payee';

  const numericAmount = parseFloat(amount);
  const isLargeTransfer = numericAmount > 10000;

  const [otp, setOtp] = useState('');
  const [checking, setChecking] = useState(false);
  const [stepUp, setStepUp] = useState<string | null>(null);

  useEffect(() => {
    if (!isLargeTransfer) return;
    const timer = setTimeout(() => {
      showAlert(
        'SMS Notification',
        'Your BOB World OTP is 1234. Do not share this with anyone.'
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [isLargeTransfer, showAlert]);

  const proceed = () => {
    router.push(
      `/password?amount=${encodeURIComponent(amount)}&payeeName=${encodeURIComponent(
        payeeName
      )}`
    );
  };

  const handleConfirm = async () => {
    if (isLargeTransfer && otp !== '1234') {
      showAlert(
        'Verification Failed',
        'Please enter the correct OTP sent to your registered mobile number.'
      );
      return;
    }

    setChecking(true);
    const assessment = await submitTelemetry('transfer-confirm');
    setChecking(false);

    if (assessment.action === 'BLOCK') {
      const reason =
        assessment.explanation ??
        `This transfer was blocked (${assessment.flags.join(', ')}).`;
      router.replace(`/blocked?reason=${encodeURIComponent(reason)}`);
      return;
    }

    if (assessment.action === 'STEP_UP') {
      setStepUp(
        assessment.explanation ??
          `Additional verification required: ${assessment.flags.join(', ')}.`
      );
      return;
    }

    proceed();
  };

  return (
    <div className="screen">
      <TopAppBar title="Confirm Payment" showBackIcon onBackPress={() => router.back()} />

      <div className="scroll">
        <div className="scroll__content" style={{ paddingBottom: 24 }}>
          <div className="text-center mb-md" style={{ padding: '16px 0' }}>
            <div className="hero-icon hero-icon--sm" style={{ background: 'var(--primary-fixed)' }}>
              <Icon name="payments" size={32} color="var(--primary)" />
            </div>
            <p className="t-body-sm c-secondary">You are paying</p>
            <h1 className="t-headline-lg" style={{ marginTop: 4 }}>
              {payeeName}
            </h1>
          </div>

          <div className="card mb-lg">
            <div style={{ height: 4, background: 'var(--primary)' }} />

            <div
              className="text-center"
              style={{
                padding: '24px 16px',
                borderBottom: '1px solid var(--surface-highest)',
              }}
            >
              <div className="t-display-lg c-primary">₹ {numericAmount.toFixed(2)}</div>
              <div
                className="t-label-md"
                style={{ color: 'var(--tertiary)', textTransform: 'uppercase', marginTop: 4 }}
              >
                Total Amount
              </div>
            </div>

            <div style={{ padding: 16 }}>
              {[
                ['Payee Name', payeeName],
                ['Transaction Date', 'Today'],
                ['Transfer Method', 'Bank Account (...4321)'],
                ['Fee', '₹ 0.00'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center" style={{ padding: '8px 0' }}>
                  <span className="t-body-sm c-variant">{label}</span>
                  <span className="t-body-md fw-medium text-right" style={{ marginLeft: 16 }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-center"
              style={{
                gap: 6,
                padding: '12px 0',
                background: 'var(--surface-low)',
                borderTop: '1px solid var(--surface-highest)',
              }}
            >
              <Icon name="lock" size={16} color="var(--secondary)" />
              <span className="t-label-md c-secondary">Secure 256-bit Encryption</span>
            </div>
          </div>

          {isLargeTransfer && (
            <div className="mb-lg">
              <div
                className="flex items-center mb-md"
                style={{
                  gap: 8,
                  background: 'var(--error-container)',
                  padding: 12,
                  borderRadius: 'var(--radius)',
                }}
              >
                <Icon name="security" size={20} color="var(--error)" />
                <span className="t-body-sm" style={{ color: 'var(--on-error-container)' }}>
                  OTP required for transfers over ₹10,000
                </span>
              </div>
              <p className="t-body-sm c-variant mb-sm" style={{ paddingLeft: 4 }}>
                Enter OTP
              </p>
              <div className="field__box">
                <input
                  className="field__input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Enter 4-digit OTP"
                  inputMode="numeric"
                  maxLength={4}
                  {...keystrokeInputProps()}
                />
                <Icon name="dialpad" size={20} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            <Button
              label="Confirm Payment"
              icon="check-circle"
              loading={checking}
              onClick={handleConfirm}
            />
            <Button
              label="Cancel"
              variant="ghost"
              style={{ height: 48 }}
              onClick={() => router.back()}
            />
          </div>
        </div>
      </div>

      {stepUp && (
        <StepUpModal
          reason={stepUp}
          onSuccess={() => {
            setStepUp(null);
            proceed();
          }}
          onCancel={() => setStepUp(null)}
        />
      )}
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
      <ConfirmScreen />
    </Suspense>
  );
}
