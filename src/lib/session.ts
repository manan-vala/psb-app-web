import { cookies, headers } from 'next/headers';
import { sql } from './db';

const COOKIE_NAME = 'psb_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  fullName: string;
  mobile: string;
  accountNumber: string;
  email: string | null;
}

/**
 * Creates a session row and sets its id as an httpOnly cookie.
 *
 * The cookie holds nothing but an opaque UUID — no user data, no signature to
 * forge. Every subsequent request looks the id up in `sessions`, which is
 * what makes `logout` (and a future "sign out everywhere") actually work:
 * deleting the row invalidates the session immediately, unlike a stateless
 * JWT that stays valid until it expires.
 */
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const userAgent = (await headers()).get('user-agent') ?? undefined;

  const [row] = await sql`
    INSERT INTO sessions (user_id, user_agent, expires_at)
    VALUES (${userId}, ${userAgent ?? null}, ${expiresAt.toISOString()})
    RETURNING id
  `;

  const jar = await cookies();
  jar.set(COOKIE_NAME, row.id as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Resolves the current request's session cookie to a user, or null if there
 * isn't one, it's expired, or it doesn't match any row (already logged out
 * elsewhere). Expired sessions are lazily deleted here rather than requiring
 * a cron job.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await sql`
    SELECT u.id, u.full_name, u.mobile, u.account_number, u.email, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${token}
  `;

  const row = rows[0];
  if (!row) return null;

  if (new Date(row.expires_at as string).getTime() <= Date.now()) {
    await sql`DELETE FROM sessions WHERE id = ${token}`;
    return null;
  }

  return {
    id: row.id as string,
    fullName: row.full_name as string,
    mobile: row.mobile as string,
    accountNumber: row.account_number as string,
    email: (row.email as string | null) ?? null,
  };
}

/** Deletes the current session row and clears the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await sql`DELETE FROM sessions WHERE id = ${token}`;
  }
  jar.delete(COOKIE_NAME);
}
