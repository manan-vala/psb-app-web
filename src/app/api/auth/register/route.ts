import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashSecret } from '@/lib/password';
import { createSession } from '@/lib/session';

export const runtime = 'nodejs';

interface RegisterBody {
  fullName?: string;
  mobile?: string;
  email?: string;
  password?: string;
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
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return 'Enter a valid email address.';
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

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RegisterBody;

  const error = validate(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const fullName = body.fullName!.trim();
  const mobile = body.mobile!.trim();
  const email = body.email?.trim() || null;
  const passwordHash = await hashSecret(body.password!);

  try {
    const [user] = await sql`
      INSERT INTO users (full_name, mobile, email, password_hash)
      VALUES (${fullName}, ${mobile}, ${email}, ${passwordHash})
      RETURNING id
    `;

    await createSession(user.id as string);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Postgres unique_violation — surfaced as a clean 409 instead of a 500,
    // matching whichever column collided (mobile vs. email).
    const message = err instanceof Error ? err.message : '';
    if (message.includes('users_mobile_key')) {
      return NextResponse.json(
        { error: 'An account with this mobile number already exists.' },
        { status: 409 }
      );
    }
    if (message.includes('users_email_key')) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
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
