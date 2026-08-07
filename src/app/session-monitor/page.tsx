'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PhoneFrame } from '@/components/PhoneFrame';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { RiskSidebar, type Assessment, type Baseline, type KeystrokeEvent } from './RiskSidebar';
import { SessionStepUp, type StepUpOutcome } from './SessionStepUp';

const DEMO_ACCOUNT = '10250043100782';

type Phase = 'form' | 'stepup' | 'blocked' | 'sent';

/**
 * Scenario C — a real transfer, scored as it's made.
 *
 * Keystroke timing is captured on BOTH the payee name and amount fields.
 * We capture dwell time (keydown→keyup for each key) and flight time
 * (keyup of previous key → keydown of current key). The gaps between
 * consecutive keydowns are also collected as intervals for the risk engine.
 */
export default function SessionMonitorPage() {
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [busy, setBusy] = useState(false);

  // Fresh per page load, so each run is a distinct session in the console.
  const sessionId = useMemo(
    () => `sm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    []
  );

  // ── Keystroke capture (both fields) ─────────────────────────────────────
  // intervals: gaps between consecutive keydowns (for the risk engine).
  // keystrokeEvents: richer per-key data for the sidebar visualisation.
  const lastKeyDownAt = useRef<number | null>(null);
  const lastKeyUpAt = useRef<number | null>(null);
  const pendingKeyDownAt = useRef<number | null>(null);
  const intervals = useRef<number[]>([]);
  const [keystrokeEvents, setKeystrokeEvents] = useState<KeystrokeEvent[]>([]);
  const [keyCount, setKeyCount] = useState(0);
  const keystrokeIndexRef = useRef(0);

  const handleKeyDown = useCallback(() => {
    const now = performance.now();

    // Interval between consecutive keydowns (for risk engine)
    if (lastKeyDownAt.current !== null) {
      intervals.current = [...intervals.current, now - lastKeyDownAt.current].slice(-40);
    }

    // Flight time: gap between last keyup and this keydown
    const flight = lastKeyUpAt.current !== null ? Math.round(now - lastKeyUpAt.current) : null;

    pendingKeyDownAt.current = now;
    lastKeyDownAt.current = now;

    // We create the event on keydown with flight, dwell gets filled on keyup.
    // Store the index so keyup can find it.
    const idx = keystrokeIndexRef.current++;
    setKeystrokeEvents((prev) => {
      const next = [
        ...prev,
        { index: idx, dwellMs: null, flightMs: flight },
      ].slice(-10);
      return next;
    });

    setKeyCount((c) => c + 1);
  }, []);

  const handleKeyUp = useCallback(() => {
    const now = performance.now();
    const downAt = pendingKeyDownAt.current;
    if (downAt !== null) {
      const dwell = Math.round(now - downAt);
      const idx = keystrokeIndexRef.current - 1;
      setKeystrokeEvents((prev) =>
        prev.map((evt) => (evt.index === idx && evt.dwellMs === null ? { ...evt, dwellMs: dwell } : evt))
      );
    }
    lastKeyUpAt.current = now;
    pendingKeyDownAt.current = null;
  }, []);

  useEffect(() => {
    fetch(`/api/session/baseline?accountNumber=${DEMO_ACCOUNT}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => !data.error && setBaseline(data))
      .catch(() => {});
  }, []);

  /**
   * Scores the current transfer. Called on submit, and again when a step up
   * ends, so failed face checks are folded into the score and reach the bank
   * console as their own event rather than staying in the client.
   */
  const score = useCallback(
    async (faceMismatches: number): Promise<Assessment | null> => {
      const value = Number(amount);
      if (!value || value <= 0 || !payee.trim()) return null;

      const res = await fetch('/api/session/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          accountNumber: DEMO_ACCOUNT,
          screen: '/transfer',
          keystrokeIntervals: intervals.current,
          amount: value,
          payee: payee.trim(),
          faceMismatches,
        }),
      });
      return (await res.json()) as Assessment;
    },
    [amount, payee, sessionId]
  );

  const submit = async () => {
    setBusy(true);
    try {
      const result = await score(0);
      if (!result) return;
      setAssessment(result);

      if (result.action === 'BLOCK') setPhase('blocked');
      else if (result.action === 'STEP_UP') setPhase('stepup');
      else setPhase('sent');
    } finally {
      setBusy(false);
    }
  };

  /** Step up cleared. Re-score so the console records how it ended. */
  const handleStepUpSuccess = async (outcome: StepUpOutcome) => {
    const result = await score(outcome.faceMismatches);
    if (result) setAssessment(result);
    setPhase('sent');
  };

  /** Two wrong faces. Re-scoring pushes the total past the block threshold. */
  const handleStepUpBlocked = async (outcome: StepUpOutcome) => {
    const result = await score(outcome.faceMismatches);
    if (result) setAssessment(result);
    setPhase('blocked');
  };

  const reset = () => {
    setPhase('form');
    setAmount('');
    setPayee('');
    setAssessment(null);
    intervals.current = [];
    lastKeyDownAt.current = null;
    lastKeyUpAt.current = null;
    pendingKeyDownAt.current = null;
    setKeystrokeEvents([]);
    setKeyCount(0);
    keystrokeIndexRef.current = 0;
  };

  return (
    <PhoneFrame
      sidebar={
        <RiskSidebar
          assessment={assessment}
          baseline={baseline}
          sessionId={sessionId}
          keystrokeSamples={Math.max(0, keyCount - 1)}
          keystrokeEvents={keystrokeEvents}
          liveAmount={Number(amount) || null}
        />
      }
    >
      <div className="screen sm-screen">
        {phase === 'blocked' ? (
          <div className="sm-result">
            <span className="hero-icon hero-icon--error">
              <Icon name="block" size={40} />
            </span>
            <h2 className="t-headline-sm">Transfer blocked</h2>
            <p className="t-body-sm c-variant">
              This transfer was stopped for your protection. Please contact your branch.
            </p>
            <Button label="Start over" variant="secondary" onClick={reset} />
          </div>
        ) : phase === 'sent' ? (
          <div className="sm-result">
            <span className="hero-icon">
              <Icon name="check-circle" size={40} color="var(--success)" />
            </span>
            <h2 className="t-headline-sm">₹{Number(amount).toLocaleString('en-IN')} sent</h2>
            <p className="t-body-sm c-variant">Nothing unusual about this one.</p>
            <Button label="Send another" variant="secondary" onClick={reset} />
          </div>
        ) : (
          <>
            <div className="sm-screen__head">
              <h2 className="t-headline-sm">Send money</h2>
              <p className="t-body-sm c-variant">From your savings account</p>
            </div>

            <Input
              label="To"
              value={payee}
              placeholder="Payee name"
              onValueChange={setPayee}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
            />
            <Input
              label="Amount (₹)"
              value={amount}
              inputMode="numeric"
              placeholder="0"
              onValueChange={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
            />

            {baseline?.highValueThreshold && Number(amount) > baseline.highValueThreshold && (
              <p className="sm-screen__warn">
                <Icon name="warning" size={14} />
                Well above your usual spending
              </p>
            )}

            <Button
              label="Send"
              icon="arrow-forward"
              onClick={submit}
              loading={busy}
              disabled={!amount || !payee.trim()}
            />

            <p className="sm-screen__hint">
              Type the name and amount normally, then try again typing super fast.
            </p>
          </>
        )}

        {phase === 'stepup' && assessment && (
          <SessionStepUp
            accountNumber={DEMO_ACCOUNT}
            reasons={assessment.reasons}
            onSuccess={handleStepUpSuccess}
            onBlocked={handleStepUpBlocked}
            onCancel={reset}
          />
        )}
      </div>
    </PhoneFrame>
  );
}
