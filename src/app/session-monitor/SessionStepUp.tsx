'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PinDots, PinKeypad } from '@/components/ui/PinKeypad';
import type { FaceCapturePayload } from '@/components/ui/FaceCamera';

const FaceCamera = dynamic(() => import('@/components/ui/FaceCamera').then((m) => m.FaceCamera), {
  ssr: false,
  loading: () => <div className="face-camera__frame" style={{ opacity: 0.4, margin: '0 auto' }} />,
});

type Stage = 'pin' | 'face' | 'done';

/**
 * Total face attempts allowed, counting every kind of failure.
 *
 * Not "mismatches": a capture the service rejects outright — no face in frame,
 * liveness not satisfied — is still a failed check and still consumes a try.
 * Counting only clean non-matches left the number of attempts unbounded, which
 * is how repeatedly failing eventually got somebody through.
 */
const MAX_FACE_ATTEMPTS = 2;

export interface StepUpOutcome {
  /** Failed face checks, so the caller can re-score and record the escalation. */
  faceMismatches: number;
  /** True when identity could not be established, only liveness. */
  identityChecked: boolean;
}

/**
 * Two factor step up raised when the risk engine returns STEP_UP.
 *
 * PIN first, then a face check against the template recorded at /demo-setup.
 * Two factors because the premise is that something already looks wrong, and
 * re-entering one thing an attacker may already have is not new evidence.
 *
 * The face stage has four outcomes, and they are not interchangeable:
 *
 *   match          the account holder. Step up clears.
 *   mismatch       a live person, but not them. Risk rises and the transfer
 *                  is refused on the second attempt.
 *   not enrolled   nothing to compare against, so this falls back to the
 *                  liveness result. A live face passes.
 *   unavailable    the face service could not be reached. Retries once, then
 *                  lets the PIN alone carry the step up rather than blocking
 *                  a customer for an outage.
 */
export function SessionStepUp({
  accountNumber,
  reasons,
  onSuccess,
  onBlocked,
  onCancel,
}: {
  accountNumber: string;
  reasons: string[];
  onSuccess: (outcome: StepUpOutcome) => void;
  onBlocked: (outcome: StepUpOutcome) => void;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<Stage>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Held in a ref as well as state. Auto-capture can fire again before React
  // has re-rendered, and reading the count from the render closure let two
  // captures both compute "attempt 1", so the limit was never reached. The ref
  // is the source of truth for the decision; the state copy only drives the UI.
  const attemptsRef = useRef(0);
  const [attempts, setAttempts] = useState(0);

  const [cameraKey, setCameraKey] = useState(0);
  const [serviceRetried, setServiceRetried] = useState(false);
  const [identityChecked, setIdentityChecked] = useState(true);

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

  const clear = (checked: boolean) => {
    setIdentityChecked(checked);
    setStage('done');
    setTimeout(
      () => onSuccess({ faceMismatches: attemptsRef.current, identityChecked: checked }),
      900
    );
  };

  /**
   * Records one failed face check and decides whether the transfer survives it.
   *
   * Every failure route goes through here, so the attempt limit cannot be
   * sidestepped by failing in a way that used to be classified differently.
   */
  const registerFailure = (message: string) => {
    const used = attemptsRef.current + 1;
    attemptsRef.current = used;
    setAttempts(used);

    if (used >= MAX_FACE_ATTEMPTS) {
      onBlocked({ faceMismatches: used, identityChecked: true });
      return;
    }

    setError(`${message} One more failed attempt will stop the transfer.`);
    setCameraKey((k) => k + 1);
  };

  const submitFace = async (capture: FaceCapturePayload) => {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/session/face/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber,
          imageBase64: capture.imageBase64,
          challenge: capture.challenge,
          landmarkSequence: capture.landmarkSequence,
        }),
      });
      const data = await res.json();

      // Genuinely unreachable: a 5xx, a timeout, or a dead network. This is the
      // only path that can still clear the step up without a match, and it is
      // deliberately narrow — the route now reports a rejected capture as a
      // failed check rather than an outage, so this no longer fires for "no
      // face in frame" or a failed liveness pass.
      if (!res.ok) {
        if (!serviceRetried) {
          setServiceRetried(true);
          setError('Could not reach the face service. Trying once more.');
          setCameraKey((k) => k + 1);
          return;
        }
        clear(false);
        return;
      }

      // No template stored. Falls back to the liveness result, which the
      // camera has already satisfied by producing a capture at all.
      if (data.enrolled === false) {
        clear(false);
        return;
      }

      if (data.match) {
        clear(true);
        return;
      }

      // Either a live face that is somebody else, or a capture the service
      // refused to read. Both are failed checks and both consume an attempt.
      registerFailure(
        data.rejected
          ? 'That capture could not be verified.'
          : 'That is not the face registered to this account.'
      );
    } catch {
      if (!serviceRetried) {
        setServiceRetried(true);
        setError('Could not reach the face service. Trying once more.');
        setCameraKey((k) => k + 1);
        return;
      }
      clear(false);
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
          <span
            className={`sm-stepup__step${stage === 'face' ? ' is-active' : ''}${
              stage === 'done' ? ' is-done' : ''
            }`}
          >
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
              {attempts > 0
                ? 'Last attempt. Show the face registered to this account.'
                : 'Look at the camera and follow the prompt'}
            </p>
            <FaceCamera
              key={cameraKey}
              mode="verify"
              onCapture={submitFace}
              onError={(msg) => setError(msg)}
              disabled={busy}
            />
            {attempts > 0 && (
              <p className="sm-stepup__strike">
                <Icon name="gpp-bad" size={14} />
                {attempts} of {MAX_FACE_ATTEMPTS} attempts used
              </p>
            )}
          </>
        )}

        {stage === 'done' && (
          <div className="sm-stepup__done">
            <Icon name="check-circle" size={40} color="var(--success)" />
            <p>Verified — completing your transfer</p>
            {!identityChecked && (
              <span className="sm-stepup__note">
                Liveness only. No face is enrolled for this account, so identity was
                not checked.
              </span>
            )}
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
