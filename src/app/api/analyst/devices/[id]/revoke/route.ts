import { analystJson, handleAnalystOptions, requireAnalyst } from '@/lib/analystAuth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export function OPTIONS(req: Request) {
  return handleAnalystOptions(req);
}

/**
 * Revokes a device's trust.
 *
 * The row is kept rather than deleted, so the account keeps a record that the
 * device was once bound and when. Untrusting it is enough: the next sign-in
 * from that device fails the trust check and has to go through verification
 * again, which is the thing worth showing live.
 *
 * Any challenge currently targeting the revoked device is cancelled in the same
 * transaction — leaving one live would let a code be approved from hardware the
 * bank has just decided not to trust.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAnalyst(req);
  if (denied) return denied;

  const { id } = await ctx.params;

  const [device] = await sql`SELECT id, is_trusted FROM user_devices WHERE id = ${id}`;

  if (!device) {
    return analystJson(req, { error: 'Device not found.' }, { status: 404 });
  }

  if (!device.is_trusted) {
    return analystJson(req, { error: 'That device is already untrusted.' }, { status: 409 });
  }

  await sql.transaction([
    sql`UPDATE user_devices SET is_trusted = false, trusted_at = NULL WHERE id = ${id}`,
    sql`
      UPDATE device_trust_challenges
      SET status = 'FAILED'
      WHERE target_device_id = ${id} AND status = 'PENDING'
    `,
  ]);

  return analystJson(req, { ok: true });
}
