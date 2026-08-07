import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { upsertDevice } from '@/lib/device';
import { describeLastSeen, listTrustedDevices } from '@/lib/deviceTrust';
import { verifySecret } from '@/lib/password';
import { createSessionToken } from '@/lib/session';

export const runtime = 'nodejs';

interface Body {
  identifier?: string;
  password?: string;
  deviceFingerprint?: string;
  deviceLabel?: string;
  platform?: string;
}

/**
 * Password login for the device-binding demo, keyed by an explicit device
 * rather than by a cookie.
 *
 * The ordinary /api/auth/login can't serve this: it identifies the browser by
 * the psb_session cookie, and the two-frame demo runs both devices in one
 * browser, where a cookie is shared. Here the caller states which device it is,
 * and the response comes back with a token the pane holds in its own state —
 * so the two frames stay independent.
 *
 * Three outcomes:
 *
 *   trusted        credentials good, device already bound. Nothing more to do.
 *   verification   credentials good, device unrecognised. Returns a
 *                  PENDING_DEVICE token plus the devices this account can
 *                  approve from.
 *   error          bad credentials, or an account that isn't ACTIVE.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const identifier = body.identifier?.trim();

  if (!identifier || !body.password) {
    return NextResponse.json(
      { error: 'Enter your account number or mobile, and your password.' },
      { status: 400 }
    );
  }

  // Account number or mobile — the demo's login pane asks for whichever the
  // presenter finds easier to read off the screen.
  const [user] = await sql`
    SELECT id, full_name, password_hash, status
    FROM users
    WHERE account_number = ${identifier} OR mobile = ${identifier}
    LIMIT 1
  `;

  if (!user) {
    return NextResponse.json({ error: 'No account matches those details.' }, { status: 404 });
  }

  const valid = await verifySecret(body.password, user.password_hash as string);
  if (!valid) {
    return NextResponse.json({ error: 'The password you entered is incorrect.' }, { status: 401 });
  }

  // Checked after the password, so account state is never disclosed to someone
  // who can't authenticate.
  if (user.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'This account is not active.', accountStatus: user.status },
      { status: 403 }
    );
  }

  const userId = user.id as string;
  const userAgent = (await headers()).get('user-agent');

  const device = await upsertDevice(
    userId,
    {
      fingerprint: body.deviceFingerprint,
      label: body.deviceLabel,
      platform: body.platform,
    },
    userAgent
  );

  if (device.isTrusted) {
    return NextResponse.json({
      outcome: 'trusted',
      fullName: user.full_name as string,
      device: { id: device.id, label: device.label },
    });
  }

  const trustedDevices = await listTrustedDevices(userId);

  // Nothing to approve from. In the real flow this can't happen — approving an
  // onboarding request trusts the device it was made on — but a seeded or
  // revoked account could reach it, and silently offering an empty picker
  // would look like a bug rather than a state.
  if (trustedDevices.length === 0) {
    return NextResponse.json(
      {
        error:
          'This account has no trusted device to approve from. Visit a branch to re-register.',
      },
      { status: 409 }
    );
  }

  const pendingToken = await createSessionToken(userId, 'PENDING_DEVICE');

  return NextResponse.json({
    outcome: 'verification-required',
    pendingToken,
    fullName: user.full_name as string,
    newDevice: { id: device.id, label: device.label },
    trustedDevices: trustedDevices.map((d) => ({
      id: d.id,
      label: d.label,
      platform: d.platform,
      lastSeen: describeLastSeen(d.lastSeenAt),
    })),
  });
}
