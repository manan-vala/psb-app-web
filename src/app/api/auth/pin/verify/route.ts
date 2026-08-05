import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifySecret } from '@/lib/password';
import { createSession } from '@/lib/session';

export const runtime = 'nodejs';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * PIN quick-login — the main login screen. This is the closest server
 * equivalent to the native app's device-level PIN unlock: it checks the pin
 * against the sole demo account rather than taking an identifier, matching
 * the original per-device behaviour now that there's one shared account. See
 * the README's "Known limitations" for what this means once real multi-user
 * support is added.
 *
 * A successful verify issues a session, exactly like /api/auth/login.
 */
export async function POST(req: Request) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'Enter your 4-digit PIN.' }, { status: 400 });
  }

  const [user] = await sql`
    SELECT id, pin_hash, pin_attempts, pin_locked_until
    FROM users
    ORDER BY created_at
    LIMIT 1
  `;

  if (!user || !user.pin_hash) {
    return NextResponse.json({ error: 'No PIN has been set up yet.' }, { status: 404 });
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
