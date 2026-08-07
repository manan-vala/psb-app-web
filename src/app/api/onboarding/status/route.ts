import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionUser, upgradeSessionScope } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Polled by /pending-approval every few seconds until an analyst decides.
 *
 * Accepts a LIMITED session — that is the entire point of the scope. It also
 * accepts FULL, so that a user who has already been approved and is walking
 * back through the screen gets a coherent answer rather than a 401.
 *
 * This route also owns the LIMITED → FULL promotion. Approval happens on the
 * analyst's side, in a request this browser knows nothing about, so somebody
 * has to notice on the customer's behalf; the poller is already asking the
 * right question every three seconds. Without this the approved user would sit
 * holding a LIMITED cookie that can't reach /face-enroll or /set-pin, and the
 * flow would dead-end one step short of the payoff.
 */
export async function GET() {
  const sessionUser = await getSessionUser(['LIMITED', 'FULL']);

  if (!sessionUser) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const [row] = await sql`
    SELECT id, status, rejection_reason, created_at
    FROM onboarding_requests
    WHERE user_id = ${sessionUser.id}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!row) {
    return NextResponse.json({
      status: null,
      requestId: null,
      rejectionReason: null,
      submittedAt: null,
    });
  }

  const status = row.status as 'PENDING' | 'APPROVED' | 'REJECTED';

  // Both conditions, not just the request row: the decision endpoint writes
  // users.status and onboarding_requests.status in one transaction, so if they
  // ever disagree the account state is the one that governs access.
  if (status === 'APPROVED' && sessionUser.status === 'ACTIVE' && sessionUser.scope !== 'FULL') {
    await upgradeSessionScope('FULL');
  }

  return NextResponse.json({
    status,
    requestId: row.id as string,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    submittedAt: new Date(row.created_at as string).toISOString(),
  });
}
