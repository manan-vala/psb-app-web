/**
 * Server-side risk scoring for Scenario C.
 *
 * Deliberately two rules, not eight. A demo rule set has to be explainable in
 * one sentence each, and a scorer nobody in the room can predict is
 * indistinguishable from a random number.
 *
 *   ROBOTIC_TYPING          keystroke timing too regular to be a hand
 *   HIGH_VALUE_VS_BASELINE  amount more than 100% above this customer's own
 *                           30-day average
 *
 * This runs on the server, over telemetry the client reports, rather than in
 * the browser. The original plan scored client-side because `psb-back` sleeps
 * on Render — but none of this touches `psb-back`, it's a route handler in the
 * same Next app that already serves the analyst API, so there's no cold start
 * to design around. It also means the verdict the dashboard displays is the
 * bank's, not one the client asserted about itself.
 */

export type RiskAction = 'ALLOW' | 'STEP_UP' | 'BLOCK';

export type RiskFlag = 'ROBOTIC_TYPING' | 'HIGH_VALUE_VS_BASELINE' | 'FACE_MISMATCH';

/** One signal steps up; two together block. */
const WEIGHTS: Record<RiskFlag, number> = {
  ROBOTIC_TYPING: 45,
  HIGH_VALUE_VS_BASELINE: 45,
  // Per failed face check, and cumulative. Sized so that alongside an existing
  // signal the first wrong face keeps the score inside STEP_UP (45 + 20 = 65)
  // and the second crosses BLOCK (45 + 40 = 85). One failed biometric can be
  // bad lighting; two is a pattern.
  FACE_MISMATCH: 20,
};

/** Beyond this, extra mismatches add nothing — the verdict is already BLOCK. */
const MAX_COUNTED_FACE_MISMATCHES = 2;

const STEP_UP_AT = 40;
const BLOCK_AT = 80;

/**
 * Below this standard deviation, the gaps between keystrokes are too even to
 * be human. Real typing varies by tens of milliseconds — different fingers,
 * different letter pairs, moments of thought. Scripted input and replayed
 * events are near-metronomic.
 */
const ROBOTIC_STDDEV_MS = 15;

/** Fewer samples than this and the variance figure means nothing. */
const MIN_KEYSTROKE_SAMPLES = 8;

/** "More than 100% above average" — i.e. more than double. */
const HIGH_VALUE_MULTIPLIER = 2;

export interface RiskEngines {
  network: number;
  device: number;
  behavior: number;
  journey: number;
}

export interface AssessmentInput {
  /** Milliseconds between consecutive keystrokes. */
  keystrokeIntervals?: number[];
  /** Transfer amount under consideration, if this is a payment screen. */
  amount?: number;
  /** The customer's mean transaction over the last 30 days. */
  baselineAverage?: number | null;
  /** How many times a step up face check has come back as somebody else. */
  faceMismatches?: number;
}

export interface Assessment {
  riskScore: number;
  action: RiskAction;
  flags: RiskFlag[];
  engines: RiskEngines;
  /** Human-readable reason per flag, shown in the app and the console. */
  reasons: string[];
  /** The numbers behind the decision, so the verdict can be argued with. */
  features: {
    keystrokeSamples: number;
    keystrokeStdDevMs: number | null;
    keystrokeMeanMs: number | null;
    amount: number | null;
    baselineAverage: number | null;
    timesBaseline: number | null;
    faceMismatches: number;
  };
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function assess(input: AssessmentInput): Assessment {
  const flags: RiskFlag[] = [];
  const reasons: string[] = [];

  /* ── Rule 1: typing rhythm ─────────────────────────────────────────────── */
  const intervals = (input.keystrokeIntervals ?? []).filter(
    (n) => Number.isFinite(n) && n >= 0
  );

  let stdDev: number | null = null;
  let mean: number | null = null;

  if (intervals.length >= MIN_KEYSTROKE_SAMPLES) {
    stdDev = standardDeviation(intervals);
    mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    if (stdDev < ROBOTIC_STDDEV_MS) {
      flags.push('ROBOTIC_TYPING');
      reasons.push(
        `Keystroke timing varied by only ${stdDev.toFixed(0)}ms across ${intervals.length} keys — human typing typically varies by 40ms or more.`
      );
    }
  }

  /* ── Rule 2: amount against the customer's own history ─────────────────── */
  const amount = typeof input.amount === 'number' && input.amount > 0 ? input.amount : null;
  const baseline =
    typeof input.baselineAverage === 'number' && input.baselineAverage > 0
      ? input.baselineAverage
      : null;

  let timesBaseline: number | null = null;

  if (amount !== null && baseline !== null) {
    timesBaseline = amount / baseline;

    if (timesBaseline > HIGH_VALUE_MULTIPLIER) {
      flags.push('HIGH_VALUE_VS_BASELINE');
      reasons.push(
        `₹${amount.toLocaleString('en-IN')} is ${timesBaseline.toFixed(1)}× this customer's 30-day average of ₹${Math.round(baseline).toLocaleString('en-IN')}.`
      );
    }
  }

  /* ── Rule 3: the face at the step up is not the enrolled one ───────────── */
  const faceMismatches = Math.max(0, Math.floor(input.faceMismatches ?? 0));
  const countedMismatches = Math.min(faceMismatches, MAX_COUNTED_FACE_MISMATCHES);

  if (faceMismatches > 0) {
    flags.push('FACE_MISMATCH');
    reasons.push(
      faceMismatches === 1
        ? 'The face at the security check did not match the one enrolled on this account.'
        : `${faceMismatches} failed face checks at the security prompt. The person completing this transfer is not the account holder.`
    );
  }

  /* ── Score and verdict ─────────────────────────────────────────────────── */
  // FACE_MISMATCH is scored per occurrence rather than once, which is why the
  // total is built from weights directly instead of summing over flags.
  const rawScore = flags.reduce(
    (sum, flag) =>
      sum + (flag === 'FACE_MISMATCH' ? WEIGHTS[flag] * countedMismatches : WEIGHTS[flag]),
    0
  );
  const riskScore = Math.min(100, rawScore);

  const action: RiskAction =
    riskScore >= BLOCK_AT ? 'BLOCK' : riskScore >= STEP_UP_AT ? 'STEP_UP' : 'ALLOW';

  // Each engine starts clean and only its own flags pull it down. Network and
  // device have no rules in this build, so they stay at 100 — which is honest
  // rather than decorative: nothing is being measured there.
  // A failed face check lands on `behavior` alongside robotic typing: both
  // answer the same question, which is whether the human driving this session
  // is the one the account belongs to.
  const behaviorPenalty =
    (flags.includes('ROBOTIC_TYPING') ? WEIGHTS.ROBOTIC_TYPING : 0) +
    WEIGHTS.FACE_MISMATCH * countedMismatches;

  const engines: RiskEngines = {
    network: 100,
    device: 100,
    behavior: Math.max(0, 100 - behaviorPenalty),
    journey: flags.includes('HIGH_VALUE_VS_BASELINE')
      ? 100 - WEIGHTS.HIGH_VALUE_VS_BASELINE
      : 100,
  };

  return {
    riskScore,
    action,
    flags,
    engines,
    reasons,
    features: {
      keystrokeSamples: intervals.length,
      keystrokeStdDevMs: stdDev === null ? null : Math.round(stdDev),
      keystrokeMeanMs: mean === null ? null : Math.round(mean),
      amount,
      baselineAverage: baseline === null ? null : Math.round(baseline),
      timesBaseline: timesBaseline === null ? null : Number(timesBaseline.toFixed(2)),
      faceMismatches,
    },
  };
}
