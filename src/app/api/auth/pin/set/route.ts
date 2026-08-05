import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashSecret } from '@/lib/password';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Sets (or resets) the signed-in user's PIN. Requires a session — reached
 * either right after registration, or after a password re-auth via
 * /api/auth/login when the user chose "Forgot PIN?". Also clears any
 * lockout, since setting a new PIN is itself proof of identity.
 */
export async function POST(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 });
  }

  const pinHash = await hashSecret(pin);
  await sql`
    UPDATE users
    SET pin_hash = ${pinHash}, pin_attempts = 0, pin_locked_until = NULL
    WHERE id = ${sessionUser.id}
  `;

  return NextResponse.json({ ok: true });
}
