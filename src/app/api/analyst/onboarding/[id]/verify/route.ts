import { analystJson, handleAnalystOptions, requireAnalyst } from '@/lib/analystAuth';
import { sql } from '@/lib/db';
import { verifyFields, type CoreRecord, type TypedDetails } from '@/lib/onboarding';

export const runtime = 'nodejs';

export function OPTIONS(req: Request) {
  return handleAnalystOptions(req);
}

/**
 * Scores the analyst's typed passbook values and records the outcome.
 *
 * The comparison runs server-side, not in the dashboard, for two reasons: the
 * core record the client holds is masked and can't be compared against, and
 * the stored `match_result` is the audit trail for the decision that follows.
 * `/decision` refuses to approve unless a passing result from this endpoint is
 * already on the row, so this is the gate rather than the button's disabled
 * state.
 *
 * Re-runnable — an analyst who mistypes a digit fixes it and submits again,
 * and the latest attempt overwrites the stored result.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAnalyst(req);
  if (denied) return denied;

  const { id } = await ctx.params;
  const typed = (await req.json().catch(() => ({}))) as TypedDetails;

  const [row] = await sql`
    SELECT id, account_number, submitted_full_name, submitted_mobile, status
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

  const result = verifyFields(typed, coreRecord, {
    accountNumber: row.account_number as string,
    fullName: row.submitted_full_name as string,
    mobile: row.submitted_mobile as string,
  });

  await sql`
    UPDATE onboarding_requests
    SET match_result = ${JSON.stringify(result)}::jsonb
    WHERE id = ${id}
  `;

  return analystJson(req, result);
}
