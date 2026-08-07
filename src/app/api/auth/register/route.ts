import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { upsertDevice, type DeviceInput } from '@/lib/device';
import { hashSecret } from '@/lib/password';
import { createSession } from '@/lib/session';

export const runtime = 'nodejs';

interface RegisterBody {
  fullName?: string;
  mobile?: string;
  accountNumber?: string;
  password?: string;
  device?: DeviceInput;
}

/**
 * Server-side re-check of everything the register screen already validates
 * client-side. The client-side rules are for UX (instant feedback); these
 * are what actually decide what lands in Postgres — a request that skips the
 * UI (curl, a modified client) must not be able to store garbage.
 */
function validate(body: RegisterBody): string | null {
  if (!body.fullName || body.fullName.trim().length < 2) return 'Please enter your full name.';
  if (!body.mobile || !/^\d{10}$/.test(body.mobile.trim())) {
    return 'Enter a valid 10-digit mobile number.';
  }
  if (!body.accountNumber || !/^\d{14}$/.test(body.accountNumber.trim())) {
    return 'Enter a valid 14-digit account number.';
  }
  if (!body.password || body.password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[0-9]/.test(body.password)) return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(body.password)) {
    return 'Password must contain at least one special character.';
  }
  return null;
}

/**
 * Registration no longer signs anyone in.
 *
 * An account now starts at PENDING_APPROVAL and waits for a bank analyst to
 * check the submitted details against core banking before it can be used. What
 * this route issues is a LIMITED session: enough for /pending-approval to poll
 * its own request, and nothing else. The account becomes usable when
 * /api/analyst/onboarding/:id/decision approves it.
 *
 * Note that nothing here compares the submitted details against
 * `bank_accounts`. That check belongs to the analyst, on purpose — if the
 * server silently rejected a mismatch at registration there would be no
 * request in the queue to review, and the four-eyes story would have nothing
 * to show.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RegisterBody;

  const error = validate(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const fullName = body.fullName!.trim();
  const mobile = body.mobile!.trim();
  const accountNumber = body.accountNumber!.trim();
  const passwordHash = await hashSecret(body.password!);
  const userAgent = (await headers()).get('user-agent');

  try {
    const [user] = await sql`
      INSERT INTO users (full_name, mobile, account_number, password_hash, status)
      VALUES (${fullName}, ${mobile}, ${accountNumber}, ${passwordHash}, 'PENDING_APPROVAL')
      RETURNING id
    `;
    const userId = user.id as string;

    // Registered untrusted. Approval is what promotes it — see
    // /api/analyst/onboarding/[id]/decision.
    const device = await upsertDevice(userId, body.device, userAgent);

    const [request] = await sql`
      INSERT INTO onboarding_requests
        (user_id, account_number, submitted_full_name, submitted_mobile,
         device_fingerprint, device_label)
      VALUES
        (${userId}, ${accountNumber}, ${fullName}, ${mobile},
         ${device.fingerprintHash}, ${device.label})
      RETURNING id
    `;

    await createSession(userId, 'LIMITED');

    return NextResponse.json({ ok: true, requestId: request.id as string });
  } catch (err) {
    // Postgres unique_violation — surfaced as a clean 409 instead of a 500,
    // matching whichever column collided.
    const message = err instanceof Error ? err.message : '';
    if (message.includes('users_mobile_key')) {
      return NextResponse.json(
        { error: 'An account with this mobile number already exists.' },
        { status: 409 }
      );
    }
    if (message.includes('users_account_number_key')) {
      return NextResponse.json(
        { error: 'An account with this account number already exists.' },
        { status: 409 }
      );
    }
    if (message.includes('idx_onboarding_one_open_per_user')) {
      return NextResponse.json(
        { error: 'You already have a registration awaiting approval.' },
        { status: 409 }
      );
    }
    console.error('register failed:', err);
    return NextResponse.json(
      { error: 'Could not create your account. Please try again.' },
      { status: 500 }
    );
  }
}
