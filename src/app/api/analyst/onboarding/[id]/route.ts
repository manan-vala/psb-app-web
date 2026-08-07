import { analystJson, handleAnalystOptions, requireAnalyst } from '@/lib/analystAuth';
import { sql } from '@/lib/db';
import { maskCoreRecord, type CoreRecord } from '@/lib/onboarding';

export const runtime = 'nodejs';

export function OPTIONS(req: Request) {
  return handleAnalystOptions(req);
}

/**
 * One onboarding request, plus the core-banking record it claims to be for.
 *
 * The core record comes back **masked** (see src/lib/onboarding.ts). The
 * analyst is meant to be reading a physical passbook; if the screen showed the
 * answer, typing it back would verify nothing.
 *
 * A missing core record is not an error — a walk-up can perfectly well type an
 * account number that core banking has never heard of, and showing the analyst
 * that nothing was found is exactly the outcome that should lead to a reject.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAnalyst(req);
  if (denied) return denied;

  const { id } = await ctx.params;

  const [row] = await sql`
    SELECT r.id, r.user_id, r.account_number, r.submitted_full_name,
           r.submitted_mobile, r.device_fingerprint, r.device_label, r.status,
           r.match_result, r.reviewed_by, r.reviewed_at, r.rejection_reason,
           r.created_at, u.status AS user_status
    FROM onboarding_requests r
    JOIN users u ON u.id = r.user_id
    WHERE r.id = ${id}
  `;

  if (!row) {
    return analystJson(req, { error: 'Request not found.' }, { status: 404 });
  }

  const [core] = await sql`
    SELECT account_number, full_name, mobile, branch, ifsc, date_of_birth, is_active
    FROM bank_accounts
    WHERE account_number = ${row.account_number as string}
  `;

  const coreRecord: CoreRecord | null = core
    ? {
        accountNumber: core.account_number as string,
        fullName: core.full_name as string,
        mobile: core.mobile as string,
        branch: core.branch as string,
        ifsc: core.ifsc as string,
        dateOfBirth: core.date_of_birth ? String(core.date_of_birth) : null,
        isActive: core.is_active as boolean,
      }
    : null;

  return analystJson(req, {
    // ⚠️ Demo affordance. The unmasked record, so the console's "Fill from
    // passbook" button can type what a physical passbook would say.
    //
    // This obviously defeats the masking directly above it — that is the
    // trade, made deliberately: verifying by hand on stage is slow and easy to
    // fat-finger, and a demo that stalls on a mistyped digit teaches the
    // audience nothing. In production this field does not exist and the
    // analyst reads the paper book. Documented in
    // DEMO-IMPLEMENTATION-PLAN.md §2.4.
    demoPassbook: coreRecord
      ? {
          accountNumber: coreRecord.accountNumber,
          fullName: coreRecord.fullName,
          mobile: coreRecord.mobile,
          branch: coreRecord.branch,
        }
      : null,
    request: {
      id: row.id as string,
      accountNumber: row.account_number as string,
      submittedFullName: row.submitted_full_name as string,
      submittedMobile: row.submitted_mobile as string,
      deviceFingerprint: (row.device_fingerprint as string | null) ?? null,
      deviceLabel: (row.device_label as string | null) ?? null,
      status: row.status as string,
      userStatus: row.user_status as string,
      matchResult: row.match_result ?? null,
      reviewedBy: (row.reviewed_by as string | null) ?? null,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string).toISOString() : null,
      rejectionReason: (row.rejection_reason as string | null) ?? null,
      createdAt: new Date(row.created_at as string).toISOString(),
    },
    coreRecord: coreRecord ? maskCoreRecord(coreRecord) : null,
  });
}
