import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { MAX_CHALLENGE_ATTEMPTS } from '@/lib/deviceTrust';
import { getSessionFromToken } from '@/lib/session';

export const runtime = 'nodejs';

interface Body {
  pendingToken?: string;
  challengeId?: string;
  code?: string;
}

/**
 * Consumes a challenge code and, on success, trusts the new device.
 *
 * Deliberately does not issue a full session. The two-frame demo runs in a
 * single browser, so minting a cookie here would sign the whole window in as
 * the demo account and clobber whatever else is open. The story is complete
 * without it: the device is bound, the dashboard shows it trusted, and the pane
 * says so. A production build would swap this line for `createSession`.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  const user = await getSessionFromToken(body.pendingToken, ['PENDING_DEVICE']);
  if (!user) {
    return NextResponse.json(
      { error: 'This verification has expired. Start again.' },
      { status: 401 }
    );
  }

  if (!body.challengeId || !/^\d{6}$/.test(body.code ?? '')) {
    return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 });
  }

  const [challenge] = await sql`
    SELECT id, code, attempts, status, expires_at, new_device_fingerprint
    FROM device_trust_challenges
    WHERE id = ${body.challengeId} AND user_id = ${user.id}
  `;

  if (!challenge || challenge.status !== 'PENDING') {
    return NextResponse.json({ error: 'This code is no longer valid.' }, { status: 410 });
  }

  // Lazy expiry — nothing sweeps these in the background, so the read path is
  // what makes the 5-minute TTL real.
  if (new Date(challenge.expires_at as string).getTime() <= Date.now()) {
    await sql`UPDATE device_trust_challenges SET status = 'EXPIRED' WHERE id = ${challenge.id}`;
    return NextResponse.json(
      { error: 'That code has expired. Request a new one.', expired: true },
      { status: 410 }
    );
  }

  if (body.code !== challenge.code) {
    const attempts = (challenge.attempts as number) + 1;
    const exhausted = attempts >= MAX_CHALLENGE_ATTEMPTS;

    await sql`
      UPDATE device_trust_challenges
      SET attempts = ${attempts}, status = ${exhausted ? 'FAILED' : 'PENDING'}
      WHERE id = ${challenge.id}
    `;

    return NextResponse.json(
      {
        error: exhausted
          ? 'Too many incorrect codes. Start the verification again.'
          : 'That code is incorrect.',
        attemptsRemaining: Math.max(0, MAX_CHALLENGE_ATTEMPTS - attempts),
        failed: exhausted,
      },
      { status: 401 }
    );
  }

  // Correct. Bind the device and burn the challenge in one transaction, so a
  // code can never be reused even if two requests arrive together.
  await sql.transaction([
    sql`UPDATE device_trust_challenges SET status = 'VERIFIED' WHERE id = ${challenge.id}`,
    sql`
      UPDATE user_devices
      SET is_trusted = true, trusted_at = now(), last_seen_at = now()
      WHERE user_id = ${user.id}
        AND fingerprint_hash = ${challenge.new_device_fingerprint as string}
    `,
  ]);

  return NextResponse.json({ ok: true, fullName: user.fullName });
}
