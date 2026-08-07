import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

interface Body {
  accountNumber?: string;
  fingerprint?: string;
  challengeId?: string;
}

/**
 * "Not you? Deny" on the trusted device's approval banner.
 *
 * Worth having rather than leaving the code to time out: the honest customer
 * response to an unexpected approval prompt is to reject it immediately, and a
 * banner that can only be ignored teaches the opposite habit.
 *
 * Authorised the same way as the notifications poll — the caller must be a
 * trusted device on the account the challenge belongs to.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  if (!body.accountNumber || !body.fingerprint || !body.challengeId) {
    return NextResponse.json(
      { error: 'accountNumber, fingerprint and challengeId are required.' },
      { status: 400 }
    );
  }

  const [row] = await sql`
    SELECT c.id
    FROM device_trust_challenges c
    JOIN users u ON u.id = c.user_id
    JOIN user_devices d ON d.id = c.target_device_id
    WHERE c.id = ${body.challengeId}
      AND c.status = 'PENDING'
      AND u.account_number = ${body.accountNumber}
      AND d.fingerprint_hash = ${body.fingerprint}
      AND d.is_trusted
  `;

  if (!row) {
    return NextResponse.json({ error: 'No such pending request.' }, { status: 404 });
  }

  await sql`UPDATE device_trust_challenges SET status = 'FAILED' WHERE id = ${row.id}`;

  return NextResponse.json({ ok: true });
}
