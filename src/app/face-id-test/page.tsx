'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { BobLogo } from '@/components/ui/BobLogo';
import { useDemoSession, type DemoSessionState } from '@/hooks/useDemoSession';
import type { FaceCapturePayload } from '@/components/ui/FaceCamera';

// MediaPipe touches WebAssembly — must never be rendered during SSR.
const FaceCamera = dynamic(() => import('@/components/ui/FaceCamera').then((m) => m.FaceCamera), {
  ssr: false,
  loading: () => <div className="face-camera__frame" style={{ opacity: 0.35 }} />,
});

const MultiPoseEnroll = dynamic(
  () => import('@/components/ui/MultiPoseEnroll').then((m) => m.MultiPoseEnroll),
  {
    ssr: false,
    loading: () => <div className="face-camera__frame" style={{ opacity: 0.35 }} />,
  }
);

/** Mirrors MATCH_THRESHOLD in ml/face_api/main.py — displayed here, enforced there. */
const MATCH_THRESHOLD = 0.72;

type PhaseId = 'health' | 'camera' | 'enroll' | 'same' | 'other';
type Status = 'idle' | 'running' | 'pass' | 'fail';

interface PhaseState {
  status: Status;
  latencyMs?: number;
  data?: Record<string, unknown>;
  error?: string;
}

interface PhaseDef {
  id: PhaseId;
  title: string;
  expectation: string;
  /** Shown on the stage while this phase owns the camera. */
  stageTitle: string;
  stageHint: string;
  needsCamera: boolean;
  needsSession: boolean;
}

const PHASES: PhaseDef[] = [
  {
    id: 'health',
    title: 'Service health',
    expectation: 'Python face service reachable, model loaded',
    stageTitle: 'Checking the face service',
    stageHint: 'Calling /health/detail through the Next.js proxy.',
    needsCamera: false,
    needsSession: false,
  },
  {
    id: 'camera',
    title: 'Camera & landmark tracking',
    expectation: 'Face detected, oval turns amber when stable',
    stageTitle: 'Camera smoke test',
    stageHint:
      'Check that the oval tracks your face and turns amber once stable, then press capture. Nothing is sent to the server in this phase.',
    needsCamera: true,
    needsSession: false,
  },
  {
    id: 'enroll',
    title: 'Enroll — 3 poses',
    expectation: 'Three captures averaged into one stored template',
    stageTitle: 'Record your identity',
    stageHint:
      'Three captures — forward, left, right. Their embeddings are averaged into a single template vector.',
    needsCamera: true,
    needsSession: true,
  },
  {
    id: 'same',
    title: 'Verify — same person',
    expectation: 'Expect MATCH',
    stageTitle: 'Verify the enrolled person',
    stageHint: 'The person who just enrolled should clear the threshold.',
    needsCamera: true,
    needsSession: true,
  },
  {
    id: 'other',
    title: 'Verify — different person',
    expectation: 'Expect NO MATCH',
    stageTitle: 'Now try someone else',
    stageHint:
      'Have a different person sit in front of the camera. A rejection here is the passing result.',
    needsCamera: true,
    needsSession: true,
  },
];

const INITIAL: Record<PhaseId, PhaseState> = {
  health: { status: 'idle' },
  camera: { status: 'idle' },
  enroll: { status: 'idle' },
  same: { status: 'idle' },
  other: { status: 'idle' },
};

export default function FaceIdTestPage() {
  // Signs into a demo account on mount, signs out on the way out. The console
  // needs a session for the enroll/verify phases, and making a tester register
  // first would defeat the purpose of a diagnostics page.
  const demoSession = useDemoSession();
  const [states, setStates] = useState<Record<PhaseId, PhaseState>>(INITIAL);
  const [active, setActive] = useState<PhaseId | null>(null);
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});

  const sessionReady = demoSession.mode === 'demo' || demoSession.mode === 'existing';
  const sessionPending = demoSession.mode === 'loading';

  const set = useCallback((id: PhaseId, patch: PhaseState) => {
    setStates((prev) => ({ ...prev, [id]: patch }));
  }, []);

  const runHealth = useCallback(async () => {
    setActive('health');
    set('health', { status: 'running' });
    try {
      const res = await fetch('/api/face/health');
      const data = await res.json();
      set('health', data.ok
        ? { status: 'pass', latencyMs: data.latencyMs, data: data.python }
        : { status: 'fail', latencyMs: data.latencyMs, error: data.error, data });
    } catch (e) {
      set('health', { status: 'fail', error: e instanceof Error ? e.message : String(e) });
    } finally {
      setActive(null);
    }
  }, [set]);

  const handleEnroll = useCallback(
    async (captures: FaceCapturePayload[]) => {
      const t0 = Date.now();
      set('enroll', { status: 'running', data: { posesCaptured: captures.length } });
      try {
        const res = await fetch('/api/face/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captures }),
        });
        const data = await res.json();
        const latencyMs = Date.now() - t0;
        set('enroll', res.ok && data.ok
          ? { status: 'pass', latencyMs, data: { ...data, challenges: captures.map((c) => c.challenge) } }
          : { status: 'fail', latencyMs, error: data.error, data });
      } catch (e) {
        set('enroll', {
          status: 'fail',
          latencyMs: Date.now() - t0,
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setActive(null);
      }
    },
    [set]
  );

  /**
   * `expectMatch` is what makes the different-person phase meaningful: there,
   * a *non*-match is the passing outcome, so the verdict must be driven by
   * "did it behave as expected", not by "did it match".
   */
  const handleVerify = useCallback(
    async (id: PhaseId, payload: FaceCapturePayload, expectMatch: boolean) => {
      const t0 = Date.now();
      set(id, { status: 'running' });
      try {
        const res = await fetch('/api/face/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        const latencyMs = Date.now() - t0;

        if (!res.ok) {
          set(id, { status: 'fail', latencyMs, error: data.error, data });
          return;
        }
        if (data.enrolled === false) {
          set(id, {
            status: 'fail',
            latencyMs,
            error: 'No enrollment found — run the enroll phase first.',
            data,
          });
          return;
        }

        const matched = !!data.match;
        set(id, {
          status: matched === expectMatch ? 'pass' : 'fail',
          latencyMs,
          data,
          error:
            matched === expectMatch
              ? undefined
              : expectMatch
                ? 'Expected a match for the enrolled person, but got none.'
                : 'Expected no match for a different person, but it matched.',
        });
      } catch (e) {
        set(id, {
          status: 'fail',
          latencyMs: Date.now() - t0,
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setActive(null);
      }
    },
    [set]
  );

  const start = useCallback(
    (id: PhaseId) => {
      if (id === 'health') {
        runHealth();
        return;
      }
      set(id, { status: 'running' });
      setActive(id);
    },
    [runHealth, set]
  );

  const resetAll = useCallback(() => {
    setStates(INITIAL);
    setActive(null);
  }, []);

  const activeDef = useMemo(() => PHASES.find((p) => p.id === active) ?? null, [active]);
  const passCount = PHASES.filter((p) => states[p.id].status === 'pass').length;

  return (
    <div className="fid">
      <div className="fid__grid-bg" aria-hidden="true" />
      <div className="fid__glow fid__glow--orange" aria-hidden="true" />
      <div className="fid__glow fid__glow--blue" aria-hidden="true" />

      <header className="fid__header">
        <div className="fid__brand">
          <span className="fid__brand-mark">
            <BobLogo size={30} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h1 className="fid__title">Face ID diagnostics</h1>
            <p className="fid__subtitle">
              Enroll from three poses, then confirm it accepts the right person and rejects everyone
              else.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SessionChip session={demoSession} />
          <span className="fid__chip">
            Threshold <strong>{MATCH_THRESHOLD}</strong>
          </span>
          <span className="fid__chip">
            <strong>
              {passCount}/{PHASES.length}
            </strong>{' '}
            passed
          </span>
          <Button label="Reset" variant="ghost" onClick={resetAll} />
          <Link href="/home" className="fid-link">
            Back to app
          </Link>
        </div>
      </header>

      {(demoSession.mode === 'disabled' || demoSession.mode === 'error') && (
        <div className="fid-banner">
          <Icon name="warning" size={20} />
          <div>
            <strong>No session.</strong> {demoSession.message} Health and camera phases still run;
            enroll and verify need an active session.{' '}
            <Link href="/login" style={{ textDecoration: 'underline' }}>
              Sign in manually
            </Link>
          </div>
        </div>
      )}

      <div className="fid__grid">
        {/* ---------- Stage: one shared camera, owned by the active phase ---------- */}
        <section className="fid__stage" aria-live="polite">
          {activeDef ? (
            <>
              <span className="fid__stage-label">
                Phase {PHASES.indexOf(activeDef) + 1} of {PHASES.length}
              </span>
              <h2 className="fid__stage-title">{activeDef.stageTitle}</h2>
              <p className="fid__stage-hint">{activeDef.stageHint}</p>

              {active === 'camera' && (
                <FaceCamera
                  mode="verify"
                  captureMode="manual"
                  captureLabel="Test capture"
                  onCapture={() => {
                    set('camera', { status: 'pass' });
                    setActive(null);
                  }}
                  onError={(err) => {
                    set('camera', { status: 'fail', error: err });
                    setActive(null);
                  }}
                />
              )}

              {active === 'enroll' && (
                <MultiPoseEnroll
                  onComplete={handleEnroll}
                  onError={(err) => {
                    set('enroll', { status: 'fail', error: err });
                    setActive(null);
                  }}
                />
              )}

              {(active === 'same' || active === 'other') && (
                <FaceCamera
                  mode="verify"
                  captureMode="manual"
                  captureLabel="Capture & verify"
                  onCapture={(p) => handleVerify(active, p, active === 'same')}
                  onError={(err) => {
                    set(active, { status: 'fail', error: err });
                    setActive(null);
                  }}
                />
              )}

              <Button
                label="Cancel"
                variant="ghost"
                onClick={() => {
                  set(activeDef.id, INITIAL[activeDef.id]);
                  setActive(null);
                }}
              />
            </>
          ) : (
            <div className="fid__stage-empty">
              <div className="fid__stage-empty-ring">
                <Icon name="face" size={48} />
              </div>
              <h2 className="fid__stage-title">Camera idle</h2>
              <p className="fid__stage-hint">
                Start a phase from the list to bring the camera up here.
              </p>
            </div>
          )}
        </section>

        {/* ---------- Phase list ---------- */}
        <section className="fid__phases">
          {PHASES.map((phase, i) => {
            const state = states[phase.id];
            const isActive = active === phase.id;
            const settled = state.status === 'pass' || state.status === 'fail';
            // Held back while the demo sign-in is still in flight, so a tester
            // can't start an enroll that's guaranteed to 401.
            const blocked = phase.needsSession && !sessionReady;

            return (
              <article
                key={phase.id}
                className={[
                  'fid-phase',
                  isActive ? 'fid-phase--active' : '',
                  state.status === 'pass' ? 'fid-phase--pass' : '',
                  state.status === 'fail' ? 'fid-phase--fail' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {/* Four fixed columns — index, dot, text, action — so every
                    row's title starts at the same x regardless of number
                    width, and the result body below can indent to match. */}
                <div className="fid-phase__head">
                  <span className="fid-phase__index">{String(i + 1).padStart(2, '0')}</span>
                  <span className={`fid-dot fid-dot--${state.status}`} aria-hidden="true" />

                  <div className="fid-phase__text">
                    <h3 className="fid-phase__title">{phase.title}</h3>
                    <p className="fid-phase__expect">{phase.expectation}</p>
                  </div>

                  <div className="fid-phase__action">
                    {isActive ? (
                      phase.needsCamera && <span className="fid__chip fid__chip--live">on stage</span>
                    ) : (
                      <Button
                        label={
                          blocked && sessionPending ? 'Signing in…' : settled ? 'Run again' : 'Run'
                        }
                        variant={settled ? 'ghost' : 'primary'}
                        onClick={() => start(phase.id)}
                        disabled={blocked || (active !== null && active !== phase.id)}
                      />
                    )}
                  </div>
                </div>

                {(settled || state.error) && (
                  <div className="fid-phase__body">
                    <PhaseResult
                      phase={phase}
                      state={state}
                      show={!!showRaw[phase.id]}
                      onToggleRaw={() =>
                        setShowRaw((s) => ({ ...s, [phase.id]: !s[phase.id] }))
                      }
                    />
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}

/** Who the console is currently acting as — the enroll/verify phases write to
 *  whichever account this names, so it's worth showing rather than implying. */
function SessionChip({ session }: { session: DemoSessionState }) {
  if (session.mode === 'loading') {
    return <span className="fid__chip">Signing in…</span>;
  }
  if (session.mode === 'disabled' || session.mode === 'error') {
    return <span className="fid__chip fid__chip--warn">No session</span>;
  }
  return (
    <span className="fid__chip fid__chip--session">
      <Icon name="account-circle" size={15} />
      {session.name ?? 'Signed in'}
      {session.mode === 'demo' && <em>demo</em>}
    </span>
  );
}

function PhaseResult({
  phase,
  state,
  show,
  onToggleRaw,
}: {
  phase: PhaseDef;
  state: PhaseState;
  show: boolean;
  onToggleRaw: () => void;
}) {
  const isVerify = phase.id === 'same' || phase.id === 'other';
  const similarity = typeof state.data?.similarity === 'number' ? state.data.similarity : null;
  const matched = state.data?.match === true;

  return (
    <>
      {isVerify && similarity !== null && (
        <div style={{ marginBottom: 14 }}>
          <div className="fid-result">
            <span className={`fid-score fid-score--${state.status === 'pass' ? 'pass' : 'fail'}`}>
              {similarity.toFixed(3)}
            </span>

            {/* The identity conclusion, stated outright. The score and the
                pass/fail dot answer "how close" and "did the phase behave" —
                neither answers the question the tester is actually asking,
                which is whether this was the same human. Coloured by identity,
                NOT by pass/fail: in the different-person phase a non-match is
                the desired result, so painting it red would read as a failure. */}
            <div>
              <p className={`fid-identity fid-identity--${matched ? 'same' : 'different'}`}>
                {matched ? 'Same person' : 'Different person'}
              </p>
              <p className="fid-identity__note">
                {matched ? 'Matched the enrolled face' : 'Did not match the enrolled face'} ·{' '}
                {state.status === 'pass' ? 'as expected' : 'not what this phase expected'}
              </p>
            </div>
          </div>
          <SimilarityMeter value={similarity} />
        </div>
      )}

      <div>
        {state.latencyMs !== undefined && <Stat k="Latency" v={`${state.latencyMs} ms`} />}

        {phase.id === 'health' && state.data && (
          <>
            <Stat k="Model loaded" v={String(state.data.model_loaded ?? '—')} />
            <Stat k="Uptime" v={`${String(state.data.uptime_seconds ?? '—')}s`} />
          </>
        )}

        {phase.id === 'enroll' && state.data?.posesUsed !== undefined && (
          <Stat k="Poses averaged" v={String(state.data.posesUsed)} />
        )}
        {phase.id === 'enroll' && Array.isArray(state.data?.challenges) && (
          <Stat k="Challenges" v={(state.data.challenges as string[]).join(' → ')} />
        )}

        {/* The raw match boolean is intentionally not repeated here — the
            verdict line above already states it in words. It stays visible in
            the raw response for anyone checking the wire value. */}
        {isVerify && similarity !== null && (
          <Stat k="Threshold" v={`${similarity.toFixed(3)} vs ${MATCH_THRESHOLD} required`} />
        )}
      </div>

      {state.error && <p className="fid-note fid-note--error">{state.error}</p>}

      {state.data && (
        <>
          <button className="fid-link" onClick={onToggleRaw} style={{ marginTop: 10 }}>
            {show ? 'Hide raw response' : 'Show raw response'}
          </button>
          {show && <pre className="fid-raw">{JSON.stringify(state.data, null, 2)}</pre>}
        </>
      )}
    </>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="fid-stat">
      <span className="fid-stat__k">{k}</span>
      <span className="fid-stat__v">{v}</span>
    </div>
  );
}

/** Where this similarity landed relative to the match threshold. */
function SimilarityMeter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  const over = value >= MATCH_THRESHOLD;
  return (
    <>
      <div className="fid-meter">
        <div
          className="fid-meter__fill"
          style={{
            width: `${clamped * 100}%`,
            background: over ? 'var(--success)' : 'var(--error)',
          }}
        />
        <div className="fid-meter__mark" style={{ left: `${MATCH_THRESHOLD * 100}%` }} />
      </div>
      <div className="fid-meter__scale">
        <span>0.0</span>
        <span>threshold {MATCH_THRESHOLD}</span>
        <span>1.0</span>
      </div>
    </>
  );
}
