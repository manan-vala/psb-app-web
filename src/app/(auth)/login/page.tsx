'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BobLogo } from '@/components/ui/BobLogo';
import { PinDots, PinKeypad } from '@/components/ui/PinKeypad';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { useAlert } from '@/context/AlertContext';
import { useTelemetry } from '@/context/TelemetryContext';
import { getProfile, setSessionActive, verifyPin } from '@/services/auth';

const PIN_LENGTH = 4;

/**
 * Port of the Expo app's `(auth)/login.tsx`, with telemetry wired in.
 *
 * The native app offered biometric login via `expo-local-authentication`.
 * That has no dependable web equivalent — most desktops have no fingerprint
 * or face sensor — so this build authenticates with the 4-digit PIN only.
 */
export default function LoginScreen() {
  const router = useRouter();
  const showAlert = useAlert();
  const { registerVirtualKeypress, submitTelemetry, resetBehavior } = useTelemetry();

  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [stepUp, setStepUp] = useState<string | null>(null);

  useEffect(() => {
    const profile = getProfile();
    if (profile?.fullName) setFirstName(profile.fullName.trim().split(' ')[0]);
  }, []);

  const enterApp = () => {
    setSessionActive(true);
    router.replace('/home');
  };

  const handleLogin = async (currentPin: string) => {
    setLoading(true);

    if (!(await verifyPin(currentPin))) {
      setLoading(false);
      setError(true);
      setPin('');
      showAlert('Incorrect PIN', 'The PIN you entered is incorrect. Please try again.');
      return;
    }

    // Credentials are good — now let the risk orchestrator weigh in.
    const assessment = await submitTelemetry('login');
    resetBehavior();
    setLoading(false);

    if (assessment.action === 'BLOCK') {
      const reason =
        assessment.explanation ??
        `Suspicious activity detected (${assessment.flags.join(', ')}).`;
      router.replace(`/blocked?reason=${encodeURIComponent(reason)}`);
      return;
    }

    if (assessment.action === 'STEP_UP') {
      setStepUp(
        assessment.explanation ??
          `Unusual signals on this session: ${assessment.flags.join(', ')}.`
      );
      return;
    }

    enterApp();
  };

  return (
    <div className="screen">
      <span className="blob blob--top-right" />

      <div className="scroll">
        <div
          className="scroll__content flex-col justify-center"
          style={{ minHeight: '100%' }}
        >
          <div className="text-center" style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <BobLogo size={80} />
            </div>
            <h1 className="t-display-lg c-primary">Bob World</h1>
            <p className="t-body-lg c-variant" style={{ marginTop: 8 }}>
              {firstName ? `Welcome back, ${firstName}` : 'Enter 4-digit PIN'}
            </p>
          </div>

          <div className="mb-lg">
            <PinDots length={PIN_LENGTH} filled={pin.length} error={error} />
            <PinKeypad
              pin={pin}
              maxLength={PIN_LENGTH}
              onChangePin={(v) => {
                setError(false);
                setPin(v);
              }}
              onComplete={handleLogin}
              onKeypress={registerVirtualKeypress}
              disabled={loading}
            />
            <button
              className="t-label-md c-primary"
              style={{ display: 'block', margin: '0 auto' }}
              onClick={() => {
                setPin('');
                router.push('/password-login?next=set-pin');
              }}
            >
              Forgot PIN?
            </button>
          </div>

          <div className="flex justify-center items-center" style={{ gap: 8 }}>
            <span className="t-body-sm c-secondary fw-medium">Need Help?</span>
            <span className="t-body-sm c-secondary">•</span>
            <span className="t-body-sm c-secondary fw-medium">Security Tips</span>
          </div>
        </div>
      </div>

      {stepUp && (
        <StepUpModal
          reason={stepUp}
          onSuccess={() => {
            setStepUp(null);
            enterApp();
          }}
          onCancel={() => {
            setStepUp(null);
            setPin('');
          }}
        />
      )}
    </div>
  );
}
