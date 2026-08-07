import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifySecret } from '@/lib/password';

export const runtime = 'nodejs';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface Body {
  accountNumber?: string;
  pin?: string;
}

/**
 * PIN check for the session monitor's step-up challenge.
 *
 * Separate from /api/auth/pin/verify because that endpoint issues a session on
 * success — it's a login. This one only answers "is this the right PIN", which
 * is what a step-up needs: the customer is already in a session, and clearing
 * the challenge shouldn't mint a new one.
 *
 * Keyed by account number since the session monitor is a demo surface reachable
 * without signing in, matching /analyze. The same 5-attempt lockout as PIN
 * login applies, sharing the pin_attempts/pin_locked_until columns so a step-up
 * can't be used to brute-force around the login limit.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  if (!body.accountNumber || !/^\d{4}$/.test(body.pin ?? '')) {
    return NextResponse.json({ error: 'Enter your 4-digit PIN.' }, { status: 400 });
  }

  const [user] = await sql`
    SELECT id, pin_hash, pin_attempts, pin_locked_until
    FROM users
    WHERE account_number = ${body.accountNumber}
  `;

  if (!user?.pin_hash) {
    return NextResponse.json({ error: 'No PIN is set on this account.' }, { status: 404 });
  }

  const lockedUntil = user.pin_locked_until as string | null;
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
    return NextResponse.json(
      { error: 'Too many incorrect attempts. Try again later.', lockedUntil },
      { status: 423 }
    );
  }

  const valid = await verifySecret(body.pin!, user.pin_hash as string);

  if (!valid) {
    const attempts = ((user.pin_attempts as number) ?? 0) + 1;
    const lock = attempts >= MAX_ATTEMPTS;

    await sql`
      UPDATE users
      SET pin_attempts = ${attempts},
          pin_locked_until = ${lock ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null}
      WHERE id = ${user.id}
    `;

    return NextResponse.json(
      {
        error: 'Incorrect PIN.',
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - attempts),
        locked: lock,
      },
      { status: 401 }
    );
  }

  await sql`
    UPDATE users SET pin_attempts = 0, pin_locked_until = NULL WHERE id = ${user.id}
  `;

  return NextResponse.json({ ok: true });
}
