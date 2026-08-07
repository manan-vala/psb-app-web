import { cookies, headers } from 'next/headers';
import { sql } from './db';

const COOKIE_NAME = 'psb_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * `sessions.id` is a uuid column, so handing Postgres a non-uuid string throws
 * a cast error rather than returning no rows. Session ids arrive from places we
 * don't control — a tampered cookie, a request body — so they're shape-checked
 * before they reach a query, turning "malformed token" into a clean null
 * instead of a 500.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * How much a session is allowed to do.
 *
 *   LIMITED         registered, waiting on bank approval. Can poll
 *                   /api/onboarding/status and nothing else.
 *   PENDING_DEVICE  password was correct but this device isn't trusted yet.
 *                   Can drive the /device-verify challenge and nothing else.
 *   FULL            ordinary authenticated customer.
 *
 * Both restricted scopes exist because "we know who you are" and "you may use
 * the bank" stopped being the same statement once registration had to wait on
 * an analyst and logins had to be bound to a device.
 */
export type SessionScope = 'LIMITED' | 'PENDING_DEVICE' | 'FULL';

/** Mirrors the users_status_check constraint in migration 005. */
export type AccountStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export interface SessionUser {
  id: string;
  fullName: string;
  mobile: string;
  accountNumber: string;
  email: string | null;
  /** Approval state of the account itself, independent of the session. */
  status: AccountStatus;
  /** What this particular session is allowed to do. */
  scope: SessionScope;
}

/**
 * Creates a session row and sets its id as an httpOnly cookie.
 *
 * The cookie holds nothing but an opaque UUID — no user data, no signature to
 * forge. Every subsequent request looks the id up in `sessions`, which is
 * what makes `logout` (and a future "sign out everywhere") actually work:
 * deleting the row invalidates the session immediately, unlike a stateless
 * JWT that stays valid until it expires.
 *
 * `scope` defaults to FULL so that every pre-existing caller keeps the
 * behaviour it was written against.
 */
export async function createSession(
  userId: string,
  scope: SessionScope = 'FULL'
): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const userAgent = (await headers()).get('user-agent') ?? undefined;

  const [row] = await sql`
    INSERT INTO sessions (user_id, user_agent, expires_at, scope)
    VALUES (${userId}, ${userAgent ?? null}, ${expiresAt.toISOString()}, ${scope})
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
 * isn't one, it's expired, it doesn't match any row (already logged out
 * elsewhere), or its scope isn't in `allowed`.
 *
 * Expired sessions are lazily deleted here rather than requiring a cron job.
 *
 * `allowed` defaults to `['FULL']`, which is the important half of the
 * design: a route that doesn't think about scope gets the strictest one, so
 * forgetting to consider a partial session fails closed. Routes that genuinely
 * serve a half-authenticated user — the approval poller, the device-challenge
 * endpoints — have to say so explicitly.
 */
export async function getSessionUser(
  allowed: readonly SessionScope[] = ['FULL']
): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token || !UUID_RE.test(token)) return null;

  const rows = await sql`
    SELECT u.id, u.full_name, u.mobile, u.account_number, u.email, u.status,
           s.expires_at, s.scope
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

  const scope = row.scope as SessionScope;
  if (!allowed.includes(scope)) return null;

  return {
    id: row.id as string,
    fullName: row.full_name as string,
    mobile: row.mobile as string,
    accountNumber: row.account_number as string,
    email: (row.email as string | null) ?? null,
    status: row.status as AccountStatus,
    scope,
  };
}

/**
 * Creates a session row and returns its id **without setting a cookie**.
 *
 * Exists for the side-by-side device demo, where two phone frames render in a
 * single browser window. A cookie is per-origin, so if both panes used the
 * normal cookie session they would share one — "Sunita's old phone" and "an
 * unrecognised new laptop" would literally be the same session, which destroys
 * the thing Scenario B is demonstrating.
 *
 * Returning the token in the response body instead lets each pane hold its own
 * in React state, so the two devices stay genuinely independent. It is also
 * closer to how a real second-device handshake works: the new device isn't
 * logged in yet, so it has no business holding a session cookie.
 */
export async function createSessionToken(
  userId: string,
  scope: SessionScope
): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const userAgent = (await headers()).get('user-agent') ?? undefined;

  const [row] = await sql`
    INSERT INTO sessions (user_id, user_agent, expires_at, scope)
    VALUES (${userId}, ${userAgent ?? null}, ${expiresAt.toISOString()}, ${scope})
    RETURNING id
  `;

  return row.id as string;
}

/**
 * Resolves a token issued by `createSessionToken`. Same expiry and scope rules
 * as `getSessionUser`, just sourced from the request body rather than a cookie.
 */
export async function getSessionFromToken(
  token: string | undefined | null,
  allowed: readonly SessionScope[]
): Promise<SessionUser | null> {
  if (!token || !UUID_RE.test(token)) return null;

  const rows = await sql`
    SELECT u.id, u.full_name, u.mobile, u.account_number, u.email, u.status,
           s.expires_at, s.scope
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

  const scope = row.scope as SessionScope;
  if (!allowed.includes(scope)) return null;

  return {
    id: row.id as string,
    fullName: row.full_name as string,
    mobile: row.mobile as string,
    accountNumber: row.account_number as string,
    email: (row.email as string | null) ?? null,
    status: row.status as AccountStatus,
    scope,
  };
}

/**
 * Resolves the session whatever its scope. Used by the routing/status endpoint,
 * which has to be able to say "you're registered but waiting on approval" —
 * a statement that requires reading a session it would refuse to act on.
 */
export async function getAnySession(): Promise<SessionUser | null> {
  return getSessionUser(['LIMITED', 'PENDING_DEVICE', 'FULL']);
}

/**
 * Promotes the current session in place, used when a partial session earns
 * full access — approval landing while /pending-approval is open, or a device
 * challenge being verified. Rotating the scope rather than issuing a new
 * cookie keeps the session id, so anything already keyed to it stays valid.
 */
export async function upgradeSessionScope(scope: SessionScope): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return;
  await sql`UPDATE sessions SET scope = ${scope} WHERE id = ${token}`;
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
