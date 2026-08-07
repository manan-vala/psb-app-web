'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BobLogo } from '@/components/ui/BobLogo';
import { Icon } from '@/components/ui/Icon';
import type { FaceCapturePayload } from '@/components/ui/FaceCamera';

// MediaPipe touches WebAssembly, so it must never render during SSR.
const MultiPoseEnroll = dynamic(
  () => import('@/components/ui/MultiPoseEnroll').then((m) => m.MultiPoseEnroll),
  {
    ssr: false,
    loading: () => <div className="face-camera__frame" style={{ opacity: 0.4 }} />,
  }
);

/** Sunita, the account the session monitor runs as. */
const DEMO_ACCOUNT = '10250043100782';

type Status = { enrolled: boolean; enrolledAt: string | null };

/**
 * Presenter setup, kept off the demo routes themselves.
 *
 * Scenario C's step up compares the face at the camera against a stored
 * template. Until one exists there is nothing to compare against, and the
 * check can only prove that a live person is present, not who they are. This
 * page is where that template gets recorded.
 *
 * Enrol before demonstrating. Re-enrolling is safe and replaces the old
 * template, which is worth doing if the room's lighting is very different from
 * wherever you last set it up.
 */
export default function DemoSetupPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/session/face/status?accountNumber=${DEMO_ACCOUNT}`,
        { cache: 'no-store' }
      );
      setStatus(await res.json());
    } catch {
      setError('Could not reach the server.');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const submit = async (captures: FaceCapturePayload[]) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/session/face/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber: DEMO_ACCOUNT, captures }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Could not set up Face ID.');
        setEnrolling(false);
        return;
      }

      setDone(true);
      setEnrolling(false);
      loadStatus();
    } catch {
      setError('Could not reach the server.');
      setEnrolling(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="setup">
      <div className="setup__glow" />
      <div className="setup__grid" />

      <nav className="setup__nav">
        <Link href="/" className="setup__brand">
          <BobLogo size={30} />
          <span>Bob World</span>
        </Link>
        <Link href="/demo" className="setup__back">
          <Icon name="arrow-back" size={17} />
          Scenarios
        </Link>
      </nav>

      <section className="setup__body">
        <div className="setup__copy">
          <span className="setup__eyebrow">Presenter setup</span>
          <h1>Teach it your face.</h1>
          <p>
            Scenario C asks for a face at its security check. Until a face is stored
            here it can only tell that a real person is in front of the camera, not
            who. Record yours and it will start turning other people away.
          </p>

          <div className={`setup__status setup__status--${status?.enrolled ? 'on' : 'off'}`}>
            <Icon name={status?.enrolled ? 'verified-user' : 'no-accounts'} size={18} />
            <div>
              <strong>
                {status === null
                  ? 'Checking…'
                  : status.enrolled
                    ? 'A face is enrolled'
                    : 'No face enrolled yet'}
              </strong>
              <small>
                {status?.enrolled && status.enrolledAt
                  ? `Recorded ${new Date(status.enrolledAt).toLocaleString('en-IN')}`
                  : 'The security check will pass anyone until you record one'}
              </small>
            </div>
          </div>

          {status?.enrolled && !enrolling && !done && (
            <button
              type="button"
              className="setup__again"
              onClick={() => {
                setEnrolling(true);
                setDone(false);
              }}
            >
              Record it again
            </button>
          )}

          <p className="setup__note">
            Three poses are captured and averaged into one template. Nothing is stored
            as a photograph, only a numeric fingerprint of the face.
          </p>
        </div>

        <div className="setup__camera">
          {done ? (
            <div className="setup__done">
              <span className="hero-icon">
                <Icon name="check-circle" size={40} color="var(--success)" />
              </span>
              <h2>Face recorded</h2>
              <p>The security check will now recognise you and refuse anyone else.</p>
              <Link href="/session-monitor" className="setup__cta">
                Go to Scenario C
                <Icon name="arrow-forward" size={18} />
              </Link>
            </div>
          ) : status === null ? (
            <p className="setup__note">Loading…</p>
          ) : status.enrolled && !enrolling ? (
            <div className="setup__done">
              <span className="hero-icon">
                <Icon name="face" size={40} color="var(--primary)" />
              </span>
              <h2>Ready</h2>
              <p>Scenario C will check faces against the template you recorded.</p>
              <Link href="/session-monitor" className="setup__cta">
                Go to Scenario C
                <Icon name="arrow-forward" size={18} />
              </Link>
            </div>
          ) : (
            <MultiPoseEnroll
              onComplete={submit}
              onError={(msg) => setError(msg)}
              disabled={busy}
            />
          )}

          {busy && <p className="setup__note">Storing your face template…</p>}

          {error && (
            <p className="setup__error">
              <Icon name="error-outline" size={15} />
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
