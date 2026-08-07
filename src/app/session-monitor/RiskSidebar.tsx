'use client';

import { Icon } from '@/components/ui/Icon';

export interface Assessment {
  riskScore: number;
  action: 'ALLOW' | 'STEP_UP' | 'BLOCK';
  flags: string[];
  engines: { network: number; device: number; behavior: number; journey: number };
  reasons: string[];
  features: {
    keystrokeSamples: number;
    keystrokeStdDevMs: number | null;
    keystrokeMeanMs: number | null;
    amount: number | null;
    baselineAverage: number | null;
    timesBaseline: number | null;
  };
}

export interface Baseline {
  fullName: string;
  baselineAverage: number | null;
  largest: number | null;
  transactionCount: number;
  highValueThreshold: number | null;
}

const ENGINE_LABELS: Record<string, string> = {
  network: 'Network',
  device: 'Device',
  behavior: 'Behaviour',
  journey: 'Journey',
};

/**
 * The panel beside the phone: what the bank is measuring, and what it concluded.
 *
 * Leads with the verdict, then shows the two rules and the numbers behind them.
 * The baseline is on screen before anything is submitted, so the audience can
 * watch the amount cross the line as it's typed rather than being told
 * afterwards that it did.
 */
export function RiskSidebar({
  assessment,
  baseline,
  sessionId,
  keystrokeSamples,
  liveAmount,
}: {
  assessment: Assessment | null;
  baseline: Baseline | null;
  sessionId: string;
  keystrokeSamples: number;
  liveAmount: number | null;
}) {
  const action = assessment?.action ?? 'ALLOW';
  const score = assessment?.riskScore ?? 0;

  const overThreshold =
    baseline?.highValueThreshold != null &&
    liveAmount != null &&
    liveAmount > baseline.highValueThreshold;

  return (
    <div className="sm-side">
      <header className="sm-side__head">
        <span className="sm-side__live">
          <span className="sm-side__live-dot" />
          Live
        </span>
        <h2>Aegis session monitor</h2>
        <p className="sm-side__session">{sessionId}</p>
      </header>

      {/* ── Verdict ────────────────────────────────────────────────────── */}
      <section className={`sm-verdict sm-verdict--${action.toLowerCase()}`}>
        <div className="sm-verdict__top">
          <div>
            <p className="sm-verdict__label">Risk score</p>
            <p className="sm-verdict__score">{score}</p>
          </div>
          <span className="sm-verdict__action">{action.replace('_', ' ')}</span>
        </div>

        <div className="sm-engines">
          {(['network', 'device', 'behavior', 'journey'] as const).map((key) => {
            const value = assessment?.engines[key] ?? 100;
            return (
              <div key={key} className="sm-engine">
                <span className="sm-engine__name">{ENGINE_LABELS[key]}</span>
                <span className="sm-engine__track">
                  <span
                    className="sm-engine__fill"
                    style={{
                      width: `${value}%`,
                      background: value < 70 ? 'var(--error)' : 'var(--success)',
                    }}
                  />
                </span>
                <span className="sm-engine__value">{value}</span>
              </div>
            );
          })}
        </div>

        {assessment && assessment.flags.length > 0 && (
          <div className="sm-flags">
            {assessment.flags.map((flag) => (
              <span key={flag} className="sm-flag">
                <Icon name="flag" size={12} />
                {flag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Why ────────────────────────────────────────────────────────── */}
      {assessment && assessment.reasons.length > 0 && (
        <section className="sm-side__block">
          <h3>Why</h3>
          {assessment.reasons.map((reason) => (
            <p key={reason} className="sm-reason">
              {reason}
            </p>
          ))}
        </section>
      )}

      {/* ── Rule 1 ─────────────────────────────────────────────────────── */}
      <section className="sm-side__block">
        <h3>Typing rhythm</h3>
        <dl className="sm-stats">
          <div>
            <dt>Keys captured</dt>
            <dd>{assessment?.features.keystrokeSamples ?? keystrokeSamples}</dd>
          </div>
          <div>
            <dt>Interval spread</dt>
            <dd>
              {assessment?.features.keystrokeStdDevMs != null
                ? `${assessment.features.keystrokeStdDevMs}ms`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Average gap</dt>
            <dd>
              {assessment?.features.keystrokeMeanMs != null
                ? `${assessment.features.keystrokeMeanMs}ms`
                : '—'}
            </dd>
          </div>
        </dl>
        <p className="sm-side__note">
          Human typing varies by 40ms or more. Under 15ms is machine-like.
        </p>
      </section>

      {/* ── Rule 2 ─────────────────────────────────────────────────────── */}
      <section className="sm-side__block">
        <h3>Spending baseline</h3>
        {baseline ? (
          <>
            <dl className="sm-stats">
              <div>
                <dt>30-day average</dt>
                <dd>₹{baseline.baselineAverage?.toLocaleString('en-IN') ?? '—'}</dd>
              </div>
              <div>
                <dt>Largest recent</dt>
                <dd>₹{baseline.largest?.toLocaleString('en-IN') ?? '—'}</dd>
              </div>
              <div>
                <dt>Alerts above</dt>
                <dd className={overThreshold ? 'is-breached' : undefined}>
                  ₹{baseline.highValueThreshold?.toLocaleString('en-IN') ?? '—'}
                </dd>
              </div>
            </dl>
            {overThreshold && (
              <p className="sm-side__breach">
                <Icon name="trending-up" size={13} />
                Current amount is over the line
              </p>
            )}
            <p className="sm-side__note">
              Based on {baseline.transactionCount} transactions in the last 30 days.
            </p>
          </>
        ) : (
          <p className="sm-side__note">Loading history…</p>
        )}
      </section>

      <footer className="sm-side__foot">
        Scored server-side. Every assessment is recorded for the bank console.
      </footer>
    </div>
  );
}
