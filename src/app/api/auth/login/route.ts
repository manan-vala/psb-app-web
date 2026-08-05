import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifySecret } from '@/lib/password';
import { createSession } from '@/lib/session';

export const runtime = 'nodejs';

interface LoginBody {
  identifier?: string;
  password?: string;
}

/**
 * Password login by mobile number or email. Used both for the ordinary
 * "Login" screen and for the "Forgot PIN?" re-authentication step — a
 * successful password check is a full login either way, so it always issues
 * a fresh session. The PIN-reset screen that follows requires that session.
 */
export async function POST(req: Request) {
  const { identifier, password } = (await req.json().catch(() => ({}))) as LoginBody;

  if (!identifier?.trim() || !password) {
    return NextResponse.json(
      { error: 'Please enter your mobile/email and password.' },
      { status: 400 }
    );
  }

  const id = identifier.trim();
  const [user] = await sql`
    SELECT id, password_hash FROM users
    WHERE mobile = ${id} OR lower(email) = lower(${id})
    LIMIT 1
  `;

  if (!user) {
    return NextResponse.json(
      { error: 'No account matches that mobile number or email.' },
      { status: 404 }
    );
  }

  const valid = await verifySecret(password, user.password_hash as string);
  if (!valid) {
    return NextResponse.json({ error: 'The password you entered is incorrect.' }, { status: 401 });
  }

  await createSession(user.id as string);
  return NextResponse.json({ ok: true });
}
