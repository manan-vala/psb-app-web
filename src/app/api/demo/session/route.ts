import { NextResponse } from 'next/server';
import { createSession, getSessionUser } from '@/lib/session';
import {
  ensureDemoUser,
  isDemoAuthEnabled,
  isDemoUser,
  demoAuthDisabledReason,
} from '@/lib/demoAuth';

export const runtime = 'nodejs';

/**
 * POST /api/demo/session — signs the caller into the seeded demo account.
 *
 * Used only by the /face-id-test console, which needs a session to exercise
 * the face routes. See src/lib/demoAuth.ts for why this is env-gated and how
 * it's constrained.
 *
 * Three outcomes, all 200:
 *   - `mode: 'existing'`  someone was already signed in; their session is
 *                         untouched and reused. This is what stops the
 *                         console from evicting a real customer's session
 *                         just because they opened the page.
 *   - `mode: 'demo'`      a fresh demo session was created.
 *   - `mode: 'disabled'`  demo auth is off here; the console falls back to
 *                         telling the user to sign in manually.
 */
export async function POST() {
  const current = await getSessionUser();

  if (current) {
    return NextResponse.json({
      mode: 'existing',
      isDemo: await isDemoUser(current.id),
      profile: { fullName: current.fullName, mobile: current.mobile },
    });
  }

  if (!isDemoAuthEnabled()) {
    return NextResponse.json({ mode: 'disabled', reason: demoAuthDisabledReason() });
  }

  try {
    const demo = await ensureDemoUser();
    await createSession(demo.id);
    return NextResponse.json({
      mode: 'demo',
      isDemo: true,
      profile: { fullName: demo.fullName, mobile: demo.mobile },
    });
  } catch (err) {
    console.error('demo sign-in failed:', err);
    return NextResponse.json(
      { error: 'Could not start a demo session.' },
      { status: 500 }
    );
  }
}
