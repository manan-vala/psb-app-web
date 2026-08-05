import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Replaces the old synchronous localStorage reads (`hasAccount`, `hasPin`,
 * `getProfile`, `isSessionActive`) with a single round trip. The entry
 * screen's routing decision — register vs. set-pin vs. login vs. home —
 * previously read four localStorage keys instantly; now it awaits this once.
 *
 * `hasAccount` here means "does *any* account exist" (mobile lookup happens
 * at login), since this remains a single-demo-account app for now — the
 * schema supports more, the UI doesn't yet.
 */
export async function GET() {
  const sessionUser = await getSessionUser();

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM users`;
  const hasAccount = (count as number) > 0;

  let hasPin = false;
  if (hasAccount) {
    const [row] = await sql`SELECT pin_hash FROM users LIMIT 1`;
    hasPin = !!row?.pin_hash;
  }

  return NextResponse.json({
    hasAccount,
    hasPin,
    isAuthenticated: !!sessionUser,
    profile: sessionUser
      ? { fullName: sessionUser.fullName, mobile: sessionUser.mobile, email: sessionUser.email }
      : null,
  });
}
