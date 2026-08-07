import { analystJson, handleAnalystOptions, requireAnalyst } from '@/lib/analystAuth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export function OPTIONS(req: Request) {
  return handleAnalystOptions(req);
}

/**
 * Device-verification challenges, live ones first.
 *
 * ⚠️ This returns the 6-digit code. That is a demo affordance: it lets the
 * presenter read the code off the console instead of squinting at a phone, and
 * it is a complete bypass of the control Scenario B exists to demonstrate — an
 * analyst could approve their own device against any account. In production the
 * console shows that a challenge is outstanding and never its code. Documented
 * in DEMO-IMPLEMENTATION-PLAN.md §2.4.
 *
 * Expiry is computed here rather than stored: nothing sweeps these rows, so a
 * PENDING challenge past its `expires_at` is reported as expired by the read
 * path, matching how the app's own endpoints treat it.
 */
export async function GET(req: Request) {
  const denied = requireAnalyst(req);
  if (denied) return denied;

  const rows = await sql`
    SELECT c.id, c.code, c.status, c.attempts, c.expires_at, c.created_at,
           c.new_device_label, u.full_name, u.account_number,
           d.label AS target_label
    FROM device_trust_challenges c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN user_devices d ON d.id = c.target_device_id
    ORDER BY c.created_at DESC
    LIMIT 25
  `;

  const now = Date.now();

  return analystJson(req, {
    challenges: rows.map((row) => {
      const expiresAt = new Date(row.expires_at as string);
      const isLive = row.status === 'PENDING' && expiresAt.getTime() > now;

      return {
        id: row.id as string,
        // Only surfaced while genuinely live — a lapsed code isn't useful and
        // showing it invites someone to type it and wonder why it fails.
        code: isLive ? (row.code as string) : null,
        status: row.status === 'PENDING' && !isLive ? 'EXPIRED' : (row.status as string),
        isLive,
        attempts: row.attempts as number,
        fullName: row.full_name as string,
        accountNumber: row.account_number as string,
        newDeviceLabel: (row.new_device_label as string | null) ?? null,
        targetLabel: (row.target_label as string | null) ?? null,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date(row.created_at as string).toISOString(),
      };
    }),
  });
}
