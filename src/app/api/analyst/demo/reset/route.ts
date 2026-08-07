import { analystJson, handleAnalystOptions, requireAnalyst } from '@/lib/analystAuth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export function OPTIONS(req: Request) {
  return handleAnalystOptions(req);
}

/**
 * Fixed UUIDs from migration 007. Users with these ids are the seeded demo
 * cast and survive a reset; everyone else was created by someone walking
 * through the registration flow and is what a reset is for.
 */
const SEEDED_USER_IDS = [
  'a0000000-0000-4000-8000-000000000782', // Sunita  — ACTIVE, 2 trusted devices
  'a0000000-0000-4000-8000-000000000784', // Priya   — ACTIVE, 1 trusted device
  'a0000000-0000-4000-8000-000000000785', // Imran   — PENDING_APPROVAL
  'a0000000-0000-4000-8000-000000000786', // Kavita  — REJECTED
];

/**
 * Restores the demo to its seeded state.
 *
 * Scenario A gets run dozens of times while rehearsing, and every run leaves a
 * PENDING_APPROVAL user plus a row in the analyst's queue. Without this that's
 * hand-written DELETEs in the Neon console between takes, which is both slow
 * and a good way to delete the wrong thing under time pressure.
 *
 * What it does NOT touch:
 *   - `bank_accounts`, the core-banking reference — it's fixture data, and the
 *     demo is meaningless without it;
 *   - the `is_demo` account used by /face-id-test, which belongs to a
 *     different flow entirely.
 *
 * Rather than deleting everything and re-running the seed, this deletes only
 * accounts created since the seed and puts the seeded four back to their
 * starting state. That keeps the reset in one place instead of duplicating the
 * seed's contents here, where the two copies would drift.
 *
 * Destructive, so it's gated twice: the analyst key, and an explicit env flag
 * that defaults off in production. An always-live endpoint that wipes accounts
 * is not something to leave reachable on a deployed URL by default.
 */
export async function POST(req: Request) {
  const denied = requireAnalyst(req);
  if (denied) return denied;

  const flag = process.env.DEMO_RESET_ENABLED;
  const enabled = flag ? flag === 'true' : process.env.NODE_ENV !== 'production';
  if (!enabled) {
    return analystJson(
      req,
      { error: 'Demo reset is disabled. Set DEMO_RESET_ENABLED=true to allow it.' },
      { status: 403 }
    );
  }

  // Deleting the user cascades to sessions, user_devices, onboarding_requests
  // and device_trust_challenges; session_events is ON DELETE SET NULL, so the
  // risk history survives on purpose.
  const removed = await sql`
    DELETE FROM users
    WHERE id <> ALL(${SEEDED_USER_IDS}::uuid[])
      AND is_demo = false
    RETURNING id
  `;

  await sql.transaction([
    // Seeded account states
    sql`
      UPDATE users SET status = 'ACTIVE', pin_attempts = 0, pin_locked_until = NULL
      WHERE id IN (
        'a0000000-0000-4000-8000-000000000782',
        'a0000000-0000-4000-8000-000000000784'
      )
    `,
    sql`
      UPDATE users SET status = 'PENDING_APPROVAL', pin_attempts = 0, pin_locked_until = NULL
      WHERE id = 'a0000000-0000-4000-8000-000000000785'
    `,
    sql`
      UPDATE users SET status = 'REJECTED', pin_attempts = 0, pin_locked_until = NULL
      WHERE id = 'a0000000-0000-4000-8000-000000000786'
    `,

    // Seeded request states — Imran back into the queue, Kavita back to rejected
    sql`
      UPDATE onboarding_requests
      SET status = 'PENDING', match_result = NULL, reviewed_by = NULL,
          reviewed_at = NULL, rejection_reason = NULL
      WHERE id = 'b0000000-0000-4000-8000-000000000785'
    `,
    sql`
      UPDATE onboarding_requests
      SET status = 'REJECTED', reviewed_by = 'A. Kumar', reviewed_at = now(),
          rejection_reason = 'Name does not match branch records'
      WHERE id = 'b0000000-0000-4000-8000-000000000786'
    `,

    // Seeded device trust
    sql`
      UPDATE user_devices SET is_trusted = true
      WHERE id IN (
        'd0000000-0000-4000-8000-000000000001',
        'd0000000-0000-4000-8000-000000000002',
        'd0000000-0000-4000-8000-000000000003'
      )
    `,
    sql`
      UPDATE user_devices SET is_trusted = false, trusted_at = NULL
      WHERE id IN (
        'd0000000-0000-4000-8000-000000000004',
        'd0000000-0000-4000-8000-000000000005'
      )
    `,

    // Any challenges raised during a run
    sql`DELETE FROM device_trust_challenges`,

    // Devices the seeded users picked up along the way. Every run of the
    // two-phone demo mints a fresh fingerprint for the "new device" pane and
    // leaves a trusted row behind once it's approved; without this they pile up
    // and the trusted-device picker slowly fills with anonymous entries.
    sql`
      DELETE FROM user_devices
      WHERE id::text NOT LIKE 'd0000000-0000-4000-8000-%'
        AND user_id::text LIKE 'a0000000-0000-4000-8000-%'
    `,
  ]);

  return analystJson(req, { ok: true, deletedUsers: removed.length });
}
