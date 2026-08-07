import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifySecret } from '@/lib/password';
import { createSession, getAnySession } from '@/lib/session';

export const runtime = 'nodejs';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * PIN quick-login — the main login screen. The closest server equivalent to
 * the native app's device-level PIN unlock: it doesn't take an identifier,
 * because the PIN is a re-entry gesture for a browser that has been here
 * before rather than a fresh sign-in.
 *
 * "Which account?" used to be answered with `ORDER BY created_at LIMIT 1`,
 * back when the database held exactly one. It now holds several seeded ones,
 * and that query would pick an arbitrary user — possibly one that is
 * PENDING_APPROVAL or REJECTED and has no business logging in at all.
 *
 * So the account is resolved from the session cookie, which is the thing that
 * actually identifies this browser's user and is what the login screen already
 * reads to greet them by name. The fallback below only exists for a browser
 * with no cookie, and is restricted to ACTIVE accounts that have a PIN set.
 *
 * A successful verify issues a session, exactly like /api/auth/login.
 */
export async function POST(req: Request) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'Enter your 4-digit PIN.' }, { status: 400 });
  }

  const session = await getAnySession();

  const [user] = session
    ? await sql`
        SELECT id, pin_hash, pin_attempts, pin_locked_until, status
        FROM users
        WHERE id = ${session.id}
      `
    : await sql`
        SELECT id, pin_hash, pin_attempts, pin_locked_until, status
        FROM users
        WHERE status = 'ACTIVE' AND pin_hash IS NOT NULL
        ORDER BY created_at
        LIMIT 1
      `;

  if (!user || !user.pin_hash) {
    return NextResponse.json({ error: 'No PIN has been set up yet.' }, { status: 404 });
  }

  // Same approval gate as /api/auth/login, and checked before the PIN is
  // compared here rather than after: an account that can't log in shouldn't be
  // burning its 5-attempt lockout budget either way.
  const status = user.status as string;
  if (status !== 'ACTIVE') {
    return NextResponse.json(
      {
        error:
          status === 'PENDING_APPROVAL'
            ? 'Your registration is still being reviewed by the bank.'
            : status === 'REJECTED'
              ? 'This registration was not approved. Please contact your branch.'
              : 'This account is not currently active. Please contact your branch.',
        accountStatus: status,
      },
      { status: 403 }
    );
  }

  const lockedUntil = user.pin_locked_until as string | null;
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
    return NextResponse.json(
      {
        error: 'Too many incorrect attempts. Please try again later, or use your password.',
        lockedUntil,
      },
      { status: 423 }
    );
  }

  const valid = await verifySecret(pin, user.pin_hash as string);

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

  await sql`UPDATE users SET pin_attempts = 0, pin_locked_until = NULL WHERE id = ${user.id}`;
  await createSession(user.id as string);
  return NextResponse.json({ ok: true });
}
