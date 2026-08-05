'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { PinDots, PinKeypad } from '@/components/ui/PinKeypad';
import { useAlert } from '@/context/AlertContext';
import { useTelemetry } from '@/context/TelemetryContext';
import { setPin as persistPin, setSessionActive } from '@/services/auth';

const PIN_LENGTH = 4;

/** Port of the Expo app's `(auth)/set-pin.tsx`. */
export default function SetPinScreen() {
  const router = useRouter();
  const showAlert = useAlert();
  const { registerVirtualKeypress } = useTelemetry();

  const [stage, setStage] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  // Brief pause after the 4th digit so the filled (or red) dots actually
  // paint before we reset — same reason the native screen needed it.
  const [transitioning, setTransitioning] = useState(false);

  const handleComplete = (value: string) => {
    setTransitioning(true);

    if (stage === 'create') {
      setTimeout(() => {
        setFirstPin(value);
        setStage('confirm');
        setPinValue('');
        setError(false);
        setTransitioning(false);
      }, 300);
      return;
    }

    if (value !== firstPin) {
      setError(true);
      setTimeout(() => {
        setStage('create');
        setFirstPin('');
        setPinValue('');
        setError(false);
        setTransitioning(false);
        showAlert(
          'PIN Mismatch',
          "The PINs you entered don't match. Please set your PIN again."
        );
      }, 300);
      return;
    }

    setTimeout(async () => {
      setSaving(true);
      try {
        await persistPin(value);
        setSessionActive(true);
        router.replace('/home');
      } catch {
        setSaving(false);
        setTransitioning(false);
        setStage('create');
        setFirstPin('');
        setPinValue('');
        showAlert('Something went wrong', 'Could not save your PIN. Please try again.');
      }
    }, 300);
  };

  const title = stage === 'create' ? 'Set a 4-digit PIN' : 'Confirm your PIN';
  const subtitle =
    stage === 'create'
      ? 'Use this PIN for quick, secure access to Bob World'
      : 'Re-enter the same PIN to confirm';

  return (
    <div className="screen">
      <span className="blob blob--top-right" />
      <div className="scroll">
        <div
          className="scroll__content flex-col items-center justify-center"
          style={{ minHeight: '100%' }}
        >
          <div className="text-center" style={{ marginBottom: 40 }}>
            <div className="hero-icon hero-icon--sm hero-icon--tint">
              <Icon name="password" size={32} />
            </div>
            <h1 className="t-headline-md">{title}</h1>
            <p className="t-body-md c-variant" style={{ marginTop: 8, padding: '0 24px' }}>
              {subtitle}
            </p>
          </div>

          <div className="w-full">
            <PinDots length={PIN_LENGTH} filled={pin.length} error={error} />
            <PinKeypad
              pin={pin}
              maxLength={PIN_LENGTH}
              onChangePin={setPinValue}
              onComplete={handleComplete}
              onKeypress={registerVirtualKeypress}
              disabled={saving || transitioning}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
