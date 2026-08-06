import { NextResponse } from 'next/server';
import { destroySession, getSessionUser } from '@/lib/session';
import { isDemoUser } from '@/lib/demoAuth';

export const runtime = 'nodejs';

/**
 * POST /api/demo/session/end — ends the session, but ONLY if it belongs to a
 * demo account.
 *
 * This asymmetry is the whole point. The console signs out when you navigate
 * away so a demo session doesn't leak into the rest of the app, but a real
 * customer who was already signed in when they opened the console must still
 * be signed in when they leave it. Checking `is_demo` before destroying is
 * what makes "log out on other pages" safe to call unconditionally from the
 * client — including from a `pagehide` beacon, where the client has no chance
 * to inspect the response and branch on it.
 */
export async function POST() {
  const current = await getSessionUser();

  if (!current) {
    return NextResponse.json({ ended: false, reason: 'no-session' });
  }

  if (!(await isDemoUser(current.id))) {
    return NextResponse.json({ ended: false, reason: 'not-a-demo-session' });
  }

  await destroySession();
  return NextResponse.json({ ended: true });
}
