import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { findPendingChallengeForDevice } from '@/lib/deviceTrust';

export const runtime = 'nodejs';

/**
 * Polled by the **trusted** device: "is anything waiting for my approval?"
 *
 * Identified by account number plus that device's own fingerprint rather than
 * a session, because in the two-frame demo this pane and the new-device pane
 * share a browser and therefore a cookie. Matching on the fingerprint is what
 * keeps "Sunita's old phone" distinct from the laptop trying to get in.
 *
 * This is the one endpoint that returns a live code, and it only ever returns
 * it to a device already trusted on that account.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const accountNumber = params.get('accountNumber');
  const fingerprint = params.get('fingerprint');

  if (!accountNumber || !fingerprint) {
    return NextResponse.json(
      { error: 'accountNumber and fingerprint are required.' },
      { status: 400 }
    );
  }

  const [device] = await sql`
    SELECT d.id
    FROM user_devices d
    JOIN users u ON u.id = d.user_id
    WHERE u.account_number = ${accountNumber}
      AND d.fingerprint_hash = ${fingerprint}
      AND d.is_trusted
  `;

  // Not a trusted device on this account — no challenge, and no explanation
  // either. A caller probing fingerprints shouldn't learn which ones exist.
  if (!device) {
    return NextResponse.json({ challenge: null });
  }

  const challenge = await findPendingChallengeForDevice(device.id as string);

  return NextResponse.json({
    challenge: challenge
      ? {
          id: challenge.id,
          code: challenge.code,
          newDeviceLabel: challenge.newDeviceLabel,
          expiresAt: challenge.expiresAt,
        }
      : null,
  });
}
