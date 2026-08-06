import { sql } from './db';
import { hashSecret } from './password';

/**
 * Server-only support for the /face-id-test console's auto sign-in.
 *
 * The console can't do anything useful without a session — /api/face/enroll
 * and /api/face/verify both gate on one — but asking a tester to register an
 * account before they can run diagnostics defeats the purpose of the page.
 * So the console signs itself into a dedicated demo account on mount and
 * signs out on the way out.
 *
 * That is an auth-shaped capability, so it is deliberately narrow:
 *
 *   1. It is env-gated (see `isDemoAuthEnabled`) — on by default only in
 *      development. Turning it on in production is an explicit decision,
 *      because an always-on endpoint that mints sessions is also an
 *      unauthenticated path to the face service, which has no rate limiting
 *      of its own (see ml/face_api/main.py's top-of-file note).
 *   2. It can only ever reach the account flagged `is_demo`. There is no code
 *      path here that takes a user id, mobile, or email from the request, so
 *      it cannot be pointed at a real customer's account.
 *   3. It never clobbers an existing session — if someone is already signed
 *      in, their session is left exactly as-is and reused.
 */

/** Fixed identity for the seeded account. Values are placeholders, not real. */
const DEMO_MOBILE = '9000000001';
const DEMO_ACCOUNT_NUMBER = '90000000000001';
const DEMO_FULL_NAME = 'Demo Tester';
const DEMO_EMAIL = 'demo.tester@example.invalid';

/**
 * Not a secret and not meant to be one — this account is reachable by anyone
 * who can load the console in an environment where demo auth is switched on.
 * It is still stored bcrypt-hashed like any other password, because
 * `users.password_hash` is NOT NULL and because a plaintext column would be
 * a trap for whoever copies this pattern next.
 */
const DEMO_PASSWORD = 'demo-face-id-console';

export interface DemoAuthDisabledReason {
  enabled: false;
  reason: string;
}

/**
 * Demo auth is on by default outside production. In production it requires
 * `DEMO_AUTH_ENABLED=true`, so deploying this app doesn't silently expose a
 * session-minting endpoint — flipping it on for a demo is a conscious act.
 */
export function isDemoAuthEnabled(): boolean {
  const flag = process.env.DEMO_AUTH_ENABLED?.trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

export function demoAuthDisabledReason(): string {
  return (
    'Demo auto sign-in is disabled in this environment. Set DEMO_AUTH_ENABLED=true ' +
    'to enable it, or sign in with a real account.'
  );
}

export interface DemoUser {
  id: string;
  fullName: string;
  mobile: string;
}

/**
 * Returns the demo account, creating it on first use.
 *
 * Idempotent by design: two concurrent first-loads of the console would
 * otherwise race to insert. The insert is `ON CONFLICT DO NOTHING` against
 * the existing `users_mobile_key` unique constraint, and the follow-up select
 * picks up whichever row won — so the loser of the race gets the same account
 * rather than a duplicate or an error.
 */
export async function ensureDemoUser(): Promise<DemoUser> {
  const existing = await findDemoUser();
  if (existing) return existing;

  const passwordHash = await hashSecret(DEMO_PASSWORD);

  await sql`
    INSERT INTO users (full_name, mobile, email, account_number, password_hash, is_demo)
    VALUES (
      ${DEMO_FULL_NAME},
      ${DEMO_MOBILE},
      ${DEMO_EMAIL},
      ${DEMO_ACCOUNT_NUMBER},
      ${passwordHash},
      true
    )
    ON CONFLICT DO NOTHING
  `;

  const created = await findDemoUser();
  if (!created) {
    // Reachable only if a non-demo account already occupies the demo mobile
    // or account number — surfaced loudly rather than silently signing the
    // caller into somebody else's account.
    throw new Error(
      'Could not create the demo account — its mobile or account number is already ' +
        'taken by a non-demo user. Free it up or change the constants in src/lib/demoAuth.ts.'
    );
  }
  return created;
}

async function findDemoUser(): Promise<DemoUser | null> {
  const [row] = await sql`
    SELECT id, full_name, mobile
    FROM users
    WHERE is_demo
    ORDER BY created_at
    LIMIT 1
  `;
  if (!row) return null;
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    mobile: row.mobile as string,
  };
}

/** Whether a given user id belongs to a demo account. */
export async function isDemoUser(userId: string): Promise<boolean> {
  const [row] = await sql`SELECT is_demo FROM users WHERE id = ${userId}`;
  return !!row?.is_demo;
}
