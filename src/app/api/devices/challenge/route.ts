import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { CHALLENGE_TTL_MS, generateChallengeCode } from '@/lib/deviceTrust';
import { getSessionFromToken } from '@/lib/session';

export const runtime = 'nodejs';

interface Body {
  pendingToken?: string;
  targetDeviceId?: string;
  newDeviceFingerprint?: string;
  newDeviceLabel?: string;
}

/**
 * Raises a 6-digit challenge on a trusted device to approve an unrecognised one.
 *
 * Authenticated by the PENDING_DEVICE token from /api/devices/login rather than
 * a cookie — the caller has proved its password but is explicitly not logged in
 * yet, which is the entire state this endpoint exists to serve.
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

  if (!body.targetDeviceId) {
    return NextResponse.json({ error: 'Choose a device to approve from.' }, { status: 400 });
  }

  // The target must belong to this account and actually be trusted. Without
  // this check the token holder could name any device row in the table and have
  // the code delivered to a stranger's phone.
  const [target] = await sql`
    SELECT id FROM user_devices
    WHERE id = ${body.targetDeviceId} AND user_id = ${user.id} AND is_trusted
  `;

  if (!target) {
    return NextResponse.json({ error: 'That device cannot approve this login.' }, { status: 403 });
  }

  // One live challenge per attempt. Superseding the previous one stops a user
  // who pressed the button twice from having two valid codes in flight and
  // entering the older one.
  await sql`
    UPDATE device_trust_challenges
    SET status = 'EXPIRED'
    WHERE user_id = ${user.id} AND status = 'PENDING'
  `;

  const code = generateChallengeCode();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  const [row] = await sql`
    INSERT INTO device_trust_challenges
      (user_id, new_device_fingerprint, new_device_label, target_device_id, code, expires_at)
    VALUES
      (${user.id}, ${body.newDeviceFingerprint ?? ''}, ${body.newDeviceLabel ?? null},
       ${body.targetDeviceId}, ${code}, ${expiresAt.toISOString()})
    RETURNING id
  `;

  // The code itself is deliberately NOT returned. It goes to the trusted
  // device via /api/devices/notifications; handing it back to the device that
  // asked for it would make the second factor a formality.
  return NextResponse.json({
    challengeId: row.id as string,
    expiresAt: expiresAt.toISOString(),
  });
}
