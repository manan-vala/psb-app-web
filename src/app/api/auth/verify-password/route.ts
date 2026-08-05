import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifySecret } from '@/lib/password';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Re-authentication for an *already logged-in* user — used by the transfer
 * confirmation screen ("Enter Password" before sending money). Unlike
 * /api/auth/login, this takes no identifier: the current session already
 * says who's asking, so it only checks that password against that session's
 * account. It doesn't touch the session either way (no rotation, no new
 * cookie) — it's a step-up check, not a fresh login.
 */
export async function POST(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password) {
    return NextResponse.json({ error: 'Please enter your password.' }, { status: 400 });
  }

  const [row] = await sql`SELECT password_hash FROM users WHERE id = ${sessionUser.id}`;
  const valid = !!row && (await verifySecret(password, row.password_hash as string));

  if (!valid) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
