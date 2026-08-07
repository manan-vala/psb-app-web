import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAnySession } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * The entry screen's routing decision — register vs. pending vs. rejected vs.
 * set-pin vs. login vs. home — in a single round trip.
 *
 * This used to answer "does *any* account exist" with
 * `SELECT count(*) FROM users` and "is there a PIN" with
 * `SELECT pin_hash FROM users LIMIT 1`. Both encoded the assumption that the
 * database holds exactly one account, and both silently return the wrong
 * user's answer the moment there are two. The seed data alone now creates
 * four, and Scenario B is inherently multi-account, so the whole endpoint is
 * scoped to the session instead.
 *
 * The old `hasAccount` field is gone rather than reinterpreted. There is no
 * session-scoped meaning of "does an account exist" — with a session the
 * answer is always yes, and without one the browser has no account to ask
 * about. Nothing in the UI read it.
 *
 * Reads the session at any scope: a user waiting on approval or stuck on
 * device verification is exactly who needs routing, and refusing to see their
 * session here would make this endpoint unable to describe them.
 */
export async function GET(req: Request) {
  const sessionUser = await getAnySession();

  if (!sessionUser) {
    return NextResponse.json({
      isAuthenticated: false,
      scope: null,
      status: null,
      profile: null,
      hasPin: false,
      deviceTrusted: null,
      pendingRequestId: null,
    });
  }

  const [{ pin_hash: pinHash }] = await sql`
    SELECT pin_hash FROM users WHERE id = ${sessionUser.id}
  `;

  // Only meaningful while the account is still waiting — an approved or
  // rejected user has no open request, and /pending-approval shouldn't poll.
  let pendingRequestId: string | null = null;
  if (sessionUser.status === 'PENDING_APPROVAL') {
    const [row] = await sql`
      SELECT id FROM onboarding_requests
      WHERE user_id = ${sessionUser.id} AND status = 'PENDING'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    pendingRequestId = (row?.id as string | undefined) ?? null;
  }

  // Device trust is a question about a *specific* browser, and the server only
  // knows which one if the caller says. Callers that pass ?fp= get a real
  // answer; callers that don't get null, which is honestly "not asked" rather
  // than a misleading false.
  const fingerprint = new URL(req.url).searchParams.get('fp');
  let deviceTrusted: boolean | null = null;
  if (fingerprint) {
    const [row] = await sql`
      SELECT is_trusted FROM user_devices
      WHERE user_id = ${sessionUser.id} AND fingerprint_hash = ${fingerprint}
    `;
    deviceTrusted = row ? (row.is_trusted as boolean) : false;
  }

  return NextResponse.json({
    isAuthenticated: sessionUser.scope === 'FULL',
    scope: sessionUser.scope,
    status: sessionUser.status,
    profile: {
      fullName: sessionUser.fullName,
      mobile: sessionUser.mobile,
      accountNumber: sessionUser.accountNumber,
      email: sessionUser.email,
    },
    hasPin: !!pinHash,
    deviceTrusted,
    pendingRequestId,
  });
}
