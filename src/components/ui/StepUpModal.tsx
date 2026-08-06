'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { Input } from './Input';
import { useAlert } from '@/context/AlertContext';
import { getFaceStatus, verifyFace, verifyPassword, pingFaceWarmup } from '@/services/auth';
import type { FaceCapturePayload } from './FaceCamera';

// MediaPipe touches WebAssembly — must never be rendered during SSR.
const FaceCamera = dynamic(() => import('./FaceCamera').then((m) => m.FaceCamera), {
  ssr: false,
  loading: () => <div className="face-camera__frame" style={{ opacity: 0.4, margin: '0 auto' }} />,
});

const MAX_FACE_ATTEMPTS = 3;

type Mode =
  | 'checking-status' // GET /api/face/status in flight
  | 'no-face-enrolled' // never enrolled — go straight to password
  | 'face-camera' // enrolled — showing FaceCamera
  | 'face-verifying' // a capture was submitted, awaiting /api/face/verify
  | 'face-failed-fallback' // ran out of face attempts — password fallback
  | 'password-fallback'; // showing password re-entry (either path above)

/**
 * Adaptive-friction step-up, shown when the risk orchestrator returns
 * `STEP_UP`. Per hybrid_face_auth_spec_v2.md §11: real face verification via
 * the psb-face-api Python service when the user has enrolled a face,
 * falling back to password re-entry otherwise or after repeated failures.
 *
 * Known gap (spec v2, explicitly not addressed): there is no server-side
 * attempt counter on /api/face/verify, unlike PIN login's
 * pin_attempts/pin_locked_until. The MAX_FACE_ATTEMPTS limit below is a
 * client-side UX affordance only, not a real control.
 */
export function StepUpModal({
  reason,
  onSuccess,
  onCancel,
}: {
  reason?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const showAlert = useAlert();
  const [mode, setMode] = useState<Mode>('checking-status');
  const [attempts, setAttempts] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const warmedUp = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getFaceStatus().then((status) => {
      if (cancelled) return;
      if (status.enrolled) {
        setMode('face-camera');
        if (!warmedUp.current) {
          warmedUp.current = true;
          pingFaceWarmup();
        }
      } else {
        setMode('no-face-enrolled');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFaceCapture = async (payload: FaceCapturePayload) => {
    setMode('face-verifying');
    setCameraError(null);

    const result = await verifyFace(payload);

    if (result.enrolled === false) {
      // Enrollment was deleted mid-flow (e.g. another tab) — fall back cleanly.
      setMode('password-fallback');
      return;
    }

    if (result.match) {
      onSuccess();
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (nextAttempts >= MAX_FACE_ATTEMPTS) {
      setMode('face-failed-fallback');
      return;
    }

    showAlert(
      'Not recognized',
      `${result.error ?? "That didn't match your enrolled face."} (${
        MAX_FACE_ATTEMPTS - nextAttempts
      } attempt${MAX_FACE_ATTEMPTS - nextAttempts === 1 ? '' : 's'} left.)`
    );
    setMode('face-camera'); // retry
  };

  const handlePasswordSubmit = async () => {
    if (!password) return;
    setVerifyingPassword(true);
    setPasswordError(null);

    const result = await verifyPassword(password);
    setVerifyingPassword(false);

    if (!result.ok) {
      setPasswordError(result.error ?? 'Incorrect password.');
      return;
    }
    onSuccess();
  };

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true">
      <div className="modal stepup" style={{ maxWidth: mode === 'face-camera' || mode === 'face-verifying' ? 340 : 320 }}>
        {(mode === 'checking-status' || mode === 'face-verifying') && (
          <>
            <div className="stepup__icon stepup__icon--scanning">
              <Icon name="verified-user" size={44} />
            </div>
            <h2 className="modal__title text-center">Additional Verification</h2>
            <p className="modal__message text-center">
              {mode === 'checking-status' ? 'One moment…' : 'Verifying your identity…'}
            </p>
          </>
        )}

        {mode === 'face-camera' && (
          <>
            <h2 className="modal__title text-center">Confirm It&apos;s You</h2>
            <p className="modal__message text-center" style={{ marginBottom: 12 }}>
              {reason ?? 'This session showed unusual signals. Verify your face to continue.'}
            </p>
            <FaceCamera mode="verify" onCapture={handleFaceCapture} onError={setCameraError} />
            {cameraError && (
              <p className="t-body-sm" style={{ color: 'var(--error)', textAlign: 'center', marginTop: 8 }}>
                {cameraError}
              </p>
            )}
            <div className="mt-lg" style={{ display: 'grid', gap: 10 }}>
              <Button label="Use Password Instead" variant="ghost" onClick={() => setMode('password-fallback')} />
              <Button label="Cancel" variant="ghost" onClick={onCancel} style={{ height: 44 }} />
            </div>
          </>
        )}

        {(mode === 'no-face-enrolled' || mode === 'face-failed-fallback' || mode === 'password-fallback') && (
          <>
            <div className="stepup__icon">
              <Icon name="lock-outline" size={44} />
            </div>
            <h2 className="modal__title text-center">Confirm Your Password</h2>
            <p className="modal__message text-center" style={{ marginBottom: 12 }}>
              {mode === 'face-failed-fallback'
                ? "We couldn't verify your face. Enter your password to continue."
                : reason ?? 'This session showed unusual signals. Confirm to continue.'}
            </p>

            <Input
              label="Password"
              isPassword
              value={password}
              onValueChange={(v) => {
                setPassword(v);
                setPasswordError(null);
              }}
            />
            {passwordError && (
              <p className="t-body-sm" style={{ color: 'var(--error)', marginTop: -6, marginBottom: 8 }}>
                {passwordError}
              </p>
            )}

            <div className="mt-lg" style={{ display: 'grid', gap: 10 }}>
              <Button
                label={verifyingPassword ? 'Verifying…' : 'Verify & Continue'}
                icon="check-circle"
                loading={verifyingPassword}
                disabled={!password}
                onClick={handlePasswordSubmit}
              />
              <Button label="Cancel" variant="ghost" onClick={onCancel} disabled={verifyingPassword} style={{ height: 44 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
