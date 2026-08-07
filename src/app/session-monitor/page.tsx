'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PhoneFrame } from '@/components/PhoneFrame';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { RiskSidebar, type Assessment, type Baseline } from './RiskSidebar';
import { SessionStepUp } from './SessionStepUp';

const DEMO_ACCOUNT = '10250043100782';

type Phase = 'form' | 'stepup' | 'blocked' | 'sent';

/**
 * Scenario C — a real transfer, scored as it's made.
 *
 * The layout is the one `/analyze` already uses: the phone docked left, a live
 * telemetry panel filling the right. What's new is that the panel leads with a
 * verdict, and that the verdict comes from the server rather than the browser.
 *
 * Keystroke timing is captured on the amount field — the gaps between keys, not
 * the keys themselves. Nothing that could reconstruct what was typed leaves the
 * page.
 */
export default function SessionMonitorPage() {
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('Rahul Sharma');
  const [phase, setPhase] = useState<Phase>('form');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [busy, setBusy] = useState(false);

  // Fresh per page load, so each run is a distinct session in the console.
  const sessionId = useMemo(
    () => `sm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    []
  );

  // Gaps between keystrokes on the amount field. Timestamps stay in a ref so
  // typing doesn't re-render the page on every key.
  const lastKeyAt = useRef<number | null>(null);
  const intervals = useRef<number[]>([]);
  const [keyCount, setKeyCount] = useState(0);

  const recordKeystroke = useCallback(() => {
    const now = performance.now();
    if (lastKeyAt.current !== null) {
      intervals.current = [...intervals.current, now - lastKeyAt.current].slice(-40);
    }
    lastKeyAt.current = now;
    setKeyCount((c) => c + 1);
  }, []);

  useEffect(() => {
    fetch(`/api/session/baseline?accountNumber=${DEMO_ACCOUNT}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => !data.error && setBaseline(data))
      .catch(() => {});
  }, []);

  const submit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) return;

    setBusy(true);
    try {
      const res = await fetch('/api/session/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          accountNumber: DEMO_ACCOUNT,
          screen: '/transfer',
          keystrokeIntervals: intervals.current,
          amount: value,
          payee,
        }),
      });
      const result = (await res.json()) as Assessment;
      setAssessment(result);

      if (result.action === 'BLOCK') setPhase('blocked');
      else if (result.action === 'STEP_UP') setPhase('stepup');
      else setPhase('sent');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPhase('form');
    setAmount('');
    setAssessment(null);
    intervals.current = [];
    lastKeyAt.current = null;
    setKeyCount(0);
  };

  return (
    <PhoneFrame
      sidebar={
        <RiskSidebar
          assessment={assessment}
          baseline={baseline}
          sessionId={sessionId}
          keystrokeSamples={Math.max(0, keyCount - 1)}
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

            <Input label="To" value={payee} onValueChange={setPayee} />
            <Input
              label="Amount (₹)"
              value={amount}
              inputMode="numeric"
              placeholder="0"
              onValueChange={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
              onKeyDown={recordKeystroke}
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
              disabled={!amount}
            />

            <p className="sm-screen__hint">
              Try ₹2,000 typed normally, then ₹42,000 pasted or typed very fast.
            </p>
          </>
        )}

        {phase === 'stepup' && assessment && (
          <SessionStepUp
            accountNumber={DEMO_ACCOUNT}
            reasons={assessment.reasons}
            onSuccess={() => setPhase('sent')}
            onCancel={reset}
          />
        )}
      </div>
    </PhoneFrame>
  );
}
