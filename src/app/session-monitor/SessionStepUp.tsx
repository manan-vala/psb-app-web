'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PinDots, PinKeypad } from '@/components/ui/PinKeypad';

const FaceCamera = dynamic(() => import('@/components/ui/FaceCamera').then((m) => m.FaceCamera), {
  ssr: false,
  loading: () => <div className="face-camera__frame" style={{ opacity: 0.4, margin: '0 auto' }} />,
});

type Stage = 'pin' | 'face' | 'done';

/**
 * Two-factor step-up raised when the risk engine returns STEP_UP.
 *
 * PIN first, then a face check. Two factors rather than one because the whole
 * premise of the scenario is that something about this session already looks
 * wrong — a single re-entry of something the attacker may already have isn't
 * additional evidence.
 *
 * ⚠️ The face stage is a **liveness** check, not identity matching. It runs the
 * real camera and the real MediaPipe blink/turn challenge, so a photo held to
 * the lens won't pass — but it doesn't compare against a stored template,
 * because the seeded demo accounts have no face enrolled. Wiring the identity
 * match is a matter of enrolling a face for the demo user and calling
 * /api/face/verify here; the capture payload this produces is already the right
 * shape for it.
 */
export function SessionStepUp({
  accountNumber,
  reasons,
  onSuccess,
  onCancel,
}: {
  accountNumber: string;
  reasons: string[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<Stage>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPin = async (entered: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/session/stepup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, pin: entered }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPinError(true);
        setPin('');
        setError(data.error ?? 'Incorrect PIN.');
        return;
      }

      setStage('face');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sm-stepup">
      <div className="sm-stepup__card">
        <div className="sm-stepup__head">
          <span className="sm-stepup__icon">
            <Icon name="gpp-maybe" size={24} />
          </span>
          <div>
            <h3>Additional verification needed</h3>
            <p>This transfer looked unusual for your account.</p>
          </div>
        </div>

        {reasons.length > 0 && (
          <ul className="sm-stepup__reasons">
            {reasons.map((reason) => (
              <li key={reason}>
                <Icon name="warning" size={13} />
                {reason}
              </li>
            ))}
          </ul>
        )}

        <div className="sm-stepup__steps">
          <span className={`sm-stepup__step${stage !== 'pin' ? ' is-done' : ' is-active'}`}>
            <Icon name={stage !== 'pin' ? 'check-circle' : 'pin'} size={15} />
            PIN
          </span>
          <span className="sm-stepup__step-line" />
          <span className={`sm-stepup__step${stage === 'face' ? ' is-active' : ''}${stage === 'done' ? ' is-done' : ''}`}>
            <Icon name={stage === 'done' ? 'check-circle' : 'face'} size={15} />
            Face
          </span>
        </div>

        {stage === 'pin' && (
          <>
            <p className="sm-stepup__prompt">Enter your 4-digit PIN</p>
            <PinDots length={4} filled={pin.length} error={pinError} />
            <PinKeypad
              pin={pin}
              maxLength={4}
              onChangePin={(v) => {
                setPinError(false);
                setPin(v);
              }}
              onComplete={submitPin}
              disabled={busy}
            />
          </>
        )}

        {stage === 'face' && (
          <>
            <p className="sm-stepup__prompt">
              Look at the camera and follow the prompt
            </p>
            <FaceCamera
              mode="verify"
              onCapture={() => {
                // The capture only fires once the blink/turn challenge has been
                // satisfied, so reaching here *is* the liveness result.
                setStage('done');
                setTimeout(onSuccess, 900);
              }}
              onError={(msg) => setError(msg)}
            />
            <p className="sm-stepup__note">Liveness check — no photo is stored</p>
          </>
        )}

        {stage === 'done' && (
          <div className="sm-stepup__done">
            <Icon name="check-circle" size={40} color="var(--success)" />
            <p>Verified — completing your transfer</p>
          </div>
        )}

        {error && (
          <p className="sm-stepup__error">
            <Icon name="error-outline" size={14} />
            {error}
          </p>
        )}

        {stage !== 'done' && (
          <button type="button" className="sm-stepup__cancel" onClick={onCancel}>
            Cancel transfer
          </button>
        )}
      </div>
    </div>
  );
}
