'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAlert } from '@/context/AlertContext';
import { enrollFace, pingFaceWarmup, type FaceApiResult } from '@/services/auth';
import type { FaceCapturePayload } from '@/components/ui/FaceCamera';

// MediaPipe touches WebAssembly — must never be rendered during SSR.
const MultiPoseEnroll = dynamic(
  () => import('@/components/ui/MultiPoseEnroll').then((m) => m.MultiPoseEnroll),
  {
    ssr: false,
    loading: () => <div className="face-camera__frame" style={{ opacity: 0.4 }} />,
  }
);

type Stage = 'consent' | 'camera' | 'success';

/** Step 3 of registration (spec v2 §10): /register → /face-enroll → /set-pin → /home. */
export default function FaceEnrollScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAlert = useAlert();
  const isReenroll = searchParams.get('mode') === 'reenroll';

  const [stage, setStage] = useState<Stage>('consent');
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const warmedUp = useRef(false);

  // Fire-and-forget warm-up as soon as the consent screen mounts — by the
  // time the user reads it and taps through, the Python service has had a
  // head start (spec v2 §7/§10).
  useEffect(() => {
    if (warmedUp.current) return;
    warmedUp.current = true;
    pingFaceWarmup();
  }, []);

  const goNext = () => {
    if (isReenroll) router.replace('/settings');
    else router.replace('/set-pin');
  };

  const handleSkip = () => {
    if (isReenroll) router.replace('/settings');
    else router.replace('/set-pin');
  };

  const handleCapture = async (captures: FaceCapturePayload[]) => {
    if (submitting) return;
    setSubmitting(true);
    setCameraError(null);

    const result: FaceApiResult = await enrollFace(captures);
    setSubmitting(false);

    if (!result.ok) {
      showAlert('Could not set up Face ID', result.error ?? 'Please try again.', [
        { text: 'Retry' },
        { text: 'Skip for now', style: 'cancel', onPress: handleSkip },
      ]);
      return;
    }

    setStage('success');
    setTimeout(goNext, 1200);
  };

  return (
    <div className="screen">
      <span className="blob blob--top-right" />
      <div className="scroll">
        <div className="scroll__content flex-col items-center" style={{ paddingTop: 40 }}>
          {stage === 'consent' && (
            <>
              <div className="text-center mb-lg">
                <div className="hero-icon">
                  <Icon name="face" size={40} />
                </div>
                <h1 className="t-headline-md">Set Up Face ID</h1>
                <p className="t-body-md c-variant" style={{ marginTop: 8, padding: '0 12px' }}>
                  Bob World wants to use face recognition to verify your identity during
                  suspicious activity.
                </p>
              </div>

              <div className="card card--pad mb-lg w-full">
                <ConsentPoint
                  icon="verified-user"
                  text="Only a mathematical code — not your photo — is stored. Raw images never leave your browser."
                />
                <ConsentPoint
                  icon="visibility"
                  text="You'll take three photos — facing forward, turned left, turned right — blinking or turning when prompted, to confirm it's really you on camera."
                />
                <ConsentPoint
                  icon="delete-outline"
                  text="You can delete this data anytime from Settings → Security → Face ID."
                />
                <ConsentPoint
                  icon="skip-next"
                  text="This step is optional. You can still sign in with your PIN and password if you skip it."
                  last
                />
              </div>

              <Button label="Set Up Face ID" icon="arrow-forward" onClick={() => setStage('camera')} />
              <Button label="Skip for Now" variant="ghost" onClick={handleSkip} style={{ marginTop: 8 }} />
            </>
          )}

          {stage === 'camera' && (
            <>
              <div className="text-center mb-lg">
                <h1 className="t-headline-sm">Position your face</h1>
                <p className="t-body-sm c-variant" style={{ marginTop: 6 }}>
                  We&apos;ll take three quick photos from different angles
                </p>
              </div>

              <MultiPoseEnroll onComplete={handleCapture} onError={setCameraError} disabled={submitting} />

              {cameraError && (
                <div className="mt-md w-full" style={{ display: 'grid', gap: 8 }}>
                  <p className="t-body-sm" style={{ color: 'var(--error)', textAlign: 'center' }}>
                    {cameraError}
                  </p>
                  <Button label="Skip and continue" variant="ghost" onClick={handleSkip} />
                </div>
              )}
            </>
          )}

          {stage === 'success' && (
            <div className="text-center" style={{ marginTop: 60 }}>
              <div className="hero-icon" style={{ background: 'var(--success-container, rgba(76,175,80,0.15))' }}>
                <Icon name="check-circle" size={44} color="var(--success)" />
              </div>
              <h1 className="t-headline-md">Face ID set up!</h1>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConsentPoint({ icon, text, last }: { icon: string; text: string; last?: boolean }) {
  return (
    <div className="flex items-start" style={{ gap: 10, marginBottom: last ? 0 : 14 }}>
      <span style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}>
        <Icon name={icon} size={20} />
      </span>
      <p className="t-body-sm c-variant" style={{ margin: 0 }}>
        {text}
      </p>
    </div>
  );
}
