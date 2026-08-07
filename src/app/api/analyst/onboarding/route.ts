import { analystJson, handleAnalystOptions, requireAnalyst } from '@/lib/analystAuth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export function OPTIONS(req: Request) {
  return handleAnalystOptions(req);
}

/**
 * The analyst's approval queue.
 *
 * `?status=` filters to one state; omitting it returns everything, newest
 * first, so the dashboard can show history alongside the live queue. The
 * dashboard polls this every few seconds, so it stays deliberately small —
 * summary columns only, with the full record behind `/[id]`.
 */
export async function GET(req: Request) {
  const denied = requireAnalyst(req);
  if (denied) return denied;

  const status = new URL(req.url).searchParams.get('status');
  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
  const filter = status && validStatuses.includes(status) ? status : null;

  const rows = filter
    ? await sql`
        SELECT r.id, r.account_number, r.submitted_full_name, r.submitted_mobile,
               r.device_label, r.status, r.reviewed_by, r.reviewed_at,
               r.rejection_reason, r.created_at, u.status AS user_status
        FROM onboarding_requests r
        JOIN users u ON u.id = r.user_id
        WHERE r.status = ${filter}
        ORDER BY r.created_at DESC
        LIMIT 100
      `
    : await sql`
        SELECT r.id, r.account_number, r.submitted_full_name, r.submitted_mobile,
               r.device_label, r.status, r.reviewed_by, r.reviewed_at,
               r.rejection_reason, r.created_at, u.status AS user_status
        FROM onboarding_requests r
        JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC
        LIMIT 100
      `;

  const [{ pending }] = await sql`
    SELECT count(*)::int AS pending FROM onboarding_requests WHERE status = 'PENDING'
  `;

  return analystJson(req, {
    // Drives the sidebar's live badge without a second round trip.
    pendingCount: pending as number,
    requests: rows.map((row) => ({
      id: row.id as string,
      accountNumber: row.account_number as string,
      submittedFullName: row.submitted_full_name as string,
      submittedMobile: row.submitted_mobile as string,
      deviceLabel: (row.device_label as string | null) ?? null,
      status: row.status as string,
      userStatus: row.user_status as string,
      reviewedBy: (row.reviewed_by as string | null) ?? null,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string).toISOString() : null,
      rejectionReason: (row.rejection_reason as string | null) ?? null,
      createdAt: new Date(row.created_at as string).toISOString(),
    })),
  });
}
