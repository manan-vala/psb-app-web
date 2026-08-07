import { analystJson, handleAnalystOptions, requireAnalyst } from '@/lib/analystAuth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export function OPTIONS(req: Request) {
  return handleAnalystOptions(req);
}

/**
 * Every account with its bound devices, for the Device Trust screen.
 *
 * Grouped in the route rather than the client so the dashboard renders what it
 * receives. Only ACTIVE accounts are listed — a pending or rejected
 * registration has devices attached, but they aren't a trust relationship
 * anyone can act on yet.
 */
export async function GET(req: Request) {
  const denied = requireAnalyst(req);
  if (denied) return denied;

  const rows = await sql`
    SELECT u.id AS user_id, u.full_name, u.account_number, u.mobile,
           d.id AS device_id, d.label, d.platform, d.is_trusted,
           d.trusted_at, d.last_seen_at, d.fingerprint_hash
    FROM users u
    LEFT JOIN user_devices d ON d.user_id = u.id
    WHERE u.status = 'ACTIVE' AND u.is_demo = false
    ORDER BY u.full_name, d.is_trusted DESC, d.last_seen_at DESC
  `;

  const accounts = new Map<
    string,
    {
      userId: string;
      fullName: string;
      accountNumber: string;
      mobile: string;
      devices: unknown[];
    }
  >();

  for (const row of rows) {
    const userId = row.user_id as string;

    if (!accounts.has(userId)) {
      accounts.set(userId, {
        userId,
        fullName: row.full_name as string,
        accountNumber: row.account_number as string,
        mobile: row.mobile as string,
        devices: [],
      });
    }

    // LEFT JOIN, so an account with no devices still appears — with a null row
    // that must not be turned into a phantom device.
    if (row.device_id) {
      accounts.get(userId)!.devices.push({
        id: row.device_id as string,
        label: row.label as string,
        platform: (row.platform as string | null) ?? null,
        isTrusted: row.is_trusted as boolean,
        trustedAt: row.trusted_at ? new Date(row.trusted_at as string).toISOString() : null,
        lastSeenAt: new Date(row.last_seen_at as string).toISOString(),
        // Shortened: the full hash is meaningless on screen and just wraps.
        fingerprint: (row.fingerprint_hash as string).slice(0, 18),
      });
    }
  }

  return analystJson(req, { accounts: [...accounts.values()] });
}
