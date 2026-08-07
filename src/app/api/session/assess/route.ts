import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { assess } from '@/lib/riskEngine';

export const runtime = 'nodejs';

interface Body {
  sessionId?: string;
  accountNumber?: string;
  screen?: string;
  deviceFingerprint?: string;
  keystrokeIntervals?: number[];
  amount?: number;
  payee?: string;
  /** Set once the customer has cleared a step-up, to record the outcome. */
  stepUpCleared?: boolean;
}

/**
 * Scores a moment in a session and records it for the bank console.
 *
 * Identified by account number rather than a session cookie: the session
 * monitor is a demo surface, reachable without signing in, exactly like
 * `/analyze`. The account is only used to look up a spending baseline and to
 * attribute the event.
 *
 * Every call writes a `session_events` row, including the ALLOW ones — the
 * dashboard's timeline is only meaningful if it shows the quiet moments as well
 * as the alarming ones.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  if (!body.sessionId) {
    return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
  }

  let userId: string | null = null;
  let baselineAverage: number | null = null;

  if (body.accountNumber) {
    const [user] = await sql`
      SELECT id FROM users WHERE account_number = ${body.accountNumber}
    `;
    userId = (user?.id as string | undefined) ?? null;
  }

  if (userId) {
    // Seeded history only. Excluding demo-run rows keeps a ₹42,000 transfer
    // from raising the very average it's being judged against, so the rule
    // still fires on the second and third run.
    const [row] = await sql`
      SELECT avg(amount)::float AS baseline
      FROM transactions
      WHERE user_id = ${userId}
        AND created_at > now() - interval '30 days'
        AND NOT is_demo_run
    `;
    baselineAverage = (row?.baseline as number | null) ?? null;
  }

  const assessment = assess({
    keystrokeIntervals: body.keystrokeIntervals,
    amount: body.amount,
    baselineAverage,
  });

  await sql`
    INSERT INTO session_events
      (user_id, session_id, device_fingerprint, screen, risk_score, action,
       engines, flags, features)
    VALUES
      (${userId}, ${body.sessionId}, ${body.deviceFingerprint ?? null},
       ${body.screen ?? null}, ${assessment.riskScore}, ${assessment.action},
       ${JSON.stringify(assessment.engines)}::jsonb,
       ${JSON.stringify(assessment.flags)}::jsonb,
       ${JSON.stringify({ ...assessment.features, reasons: assessment.reasons, payee: body.payee ?? null, stepUpCleared: body.stepUpCleared ?? null })}::jsonb)
  `;

  return NextResponse.json(assessment);
}
