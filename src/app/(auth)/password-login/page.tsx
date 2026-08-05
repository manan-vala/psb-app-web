'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BobLogo } from '@/components/ui/BobLogo';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { useAlert } from '@/context/AlertContext';
import { useTelemetry } from '@/context/TelemetryContext';
import { loginWithPassword } from '@/services/auth';

/** Port of the Expo app's `(auth)/password-login.tsx`, with telemetry wired in. */
function PasswordLoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAlert = useAlert();
  const {
    keystrokeInputProps,
    pasteHandlers,
    startGyroSampling,
    stopGyroSampling,
    submitTelemetry,
    resetBehavior,
  } = useTelemetry();

  const isPinReset = searchParams.get('next') === 'set-pin';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepUp, setStepUp] = useState<string | null>(null);

  const proceed = () => {
    if (isPinReset) {
      router.replace('/set-pin');
    } else {
      router.replace('/home');
    }
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      showAlert('Missing details', 'Please enter your mobile/email and password.');
      return;
    }

    setLoading(true);
    stopGyroSampling();

    // 1. Verify credentials against Postgres and issue a session.
    const result = await loginWithPassword(identifier.trim(), password);
    if (!result.ok) {
      setLoading(false);
      showAlert(
        'Login Failed',
        result.error ?? 'Please check your details and try again.'
      );
      return;
    }

    // 2. Credentials are good — now let the risk orchestrator weigh in.
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

    proceed();
  };

  return (
    <div className="screen">
      <span className="blob blob--top-right" />

      <div className="scroll">
        <div className="scroll__content" style={{ paddingTop: 40 }}>
          <button
            className="appbar__icon-btn"
            style={{ position: 'absolute', top: 12, left: 8, zIndex: 10 }}
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <Icon name="arrow-back" size={26} />
          </button>

          <div className="text-center" style={{ marginBottom: 40 }}>
            <div className="hero-icon">
              <BobLogo size={64} />
            </div>
            <h1 className="t-headline-md c-primary">
              {isPinReset ? 'Reset your PIN' : 'Login'}
            </h1>
            <p className="t-body-md c-variant" style={{ marginTop: 6 }}>
              {isPinReset
                ? 'Verify your password to set a new PIN'
                : 'Enter your password to continue'}
            </p>
          </div>

          <div className="mb-md">
            <Input
              label="Mobile Number or Email"
              placeholder="Enter mobile number or email"
              leadingIcon="person-outline"
              value={identifier}
              onValueChange={setIdentifier}
            />
            <Input
              label="Password"
              placeholder="Enter your password"
              leadingIcon="lock-outline"
              isPassword
              value={password}
              onValueChange={setPassword}
              onPaste={pasteHandlers.onPaste}
              onFocus={startGyroSampling}
              onFocusCapture={pasteHandlers.onFocusCapture}
              onChangeTextCapture={pasteHandlers.onChangeTextCapture}
              {...keystrokeInputProps()}
            />
          </div>

          <Button
            label={isPinReset ? 'Verify & Continue' : 'Login'}
            icon="login"
            onClick={handleLogin}
            loading={loading}
          />
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
      <PasswordLoginScreen />
    </Suspense>
  );
}
