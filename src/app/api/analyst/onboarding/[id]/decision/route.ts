import {
  analystJson,
  demoAnalystName,
  handleAnalystOptions,
  requireAnalyst,
} from '@/lib/analystAuth';
import { sql } from '@/lib/db';
import type { MatchResult } from '@/lib/onboarding';

export const runtime = 'nodejs';

export function OPTIONS(req: Request) {
  return handleAnalystOptions(req);
}

interface DecisionBody {
  decision?: 'APPROVE' | 'REJECT';
  reason?: string;
  analyst?: string;
}

/**
 * Approve or reject an onboarding request.
 *
 * Approval is not a status flip. In one transaction it:
 *
 *   1. marks the request APPROVED, with reviewer and timestamp;
 *   2. sets users.status = 'ACTIVE', which is what lets the account log in;
 *   3. marks the device the customer registered on as TRUSTED.
 *
 * Step 3 is the one that's easy to miss, and device binding deadlocks without
 * it: /device-verify asks the user to pick an existing trusted device to
 * approve a new one from, so if enrolment never produces a first trusted
 * device, the very first login has an empty picker and no way forward.
 * Approving the person on the device they enrolled on is also just what the
 * bank has actually done.
 *
 * The approval gate is the stored `match_result`, not the client's say-so. The
 * dashboard disables its Approve button until the fields check out, but a
 * disabled button is a UI state, not a control — a direct POST has to hit the
 * same wall.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAnalyst(req);
  if (denied) return denied;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as DecisionBody;

  if (body.decision !== 'APPROVE' && body.decision !== 'REJECT') {
    return analystJson(
      req,
      { error: "decision must be 'APPROVE' or 'REJECT'." },
      { status: 400 }
    );
  }

  const [row] = await sql`
    SELECT id, user_id, status, match_result, device_fingerprint
    FROM onboarding_requests
    WHERE id = ${id}
  `;

  if (!row) {
    return analystJson(req, { error: 'Request not found.' }, { status: 404 });
  }

  if (row.status !== 'PENDING') {
    return analystJson(
      req,
      { error: 'This request has already been decided.' },
      { status: 409 }
    );
  }

  const reviewer = body.analyst?.trim() || demoAnalystName();
  const userId = row.user_id as string;

  if (body.decision === 'APPROVE') {
    const match = row.match_result as MatchResult | null;
    if (!match?.allMatch) {
      return analystJson(
        req,
        {
          error:
            'Verify the passbook details against core banking before approving.',
        },
        { status: 422 }
      );
    }

    const fingerprint = (row.device_fingerprint as string | null) ?? null;

    // Neon's HTTP driver batches these into one transaction, so an account
    // can't end up ACTIVE with its request still PENDING, or approved with an
    // untrusted device.
    await sql.transaction([
      sql`
        UPDATE onboarding_requests
        SET status = 'APPROVED', reviewed_by = ${reviewer}, reviewed_at = now(),
            rejection_reason = NULL
        WHERE id = ${id}
      `,
      sql`UPDATE users SET status = 'ACTIVE' WHERE id = ${userId}`,
      sql`
        UPDATE user_devices
        SET is_trusted = true, trusted_at = now()
        WHERE user_id = ${userId} AND fingerprint_hash = ${fingerprint}
      `,
    ]);

    return analystJson(req, { ok: true, decision: 'APPROVE', reviewedBy: reviewer });
  }

  const reason = body.reason?.trim();
  if (!reason) {
    return analystJson(
      req,
      { error: 'A rejection reason is required — the customer is shown it.' },
      { status: 400 }
    );
  }

  await sql.transaction([
    sql`
      UPDATE onboarding_requests
      SET status = 'REJECTED', reviewed_by = ${reviewer}, reviewed_at = now(),
          rejection_reason = ${reason}
      WHERE id = ${id}
    `,
    sql`UPDATE users SET status = 'REJECTED' WHERE id = ${userId}`,
  ]);

  return analystJson(req, { ok: true, decision: 'REJECT', reviewedBy: reviewer });
}
