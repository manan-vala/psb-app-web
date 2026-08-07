import { analystJson, handleAnalystOptions, requireAnalyst } from '@/lib/analystAuth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export function OPTIONS(req: Request) {
  return handleAnalystOptions(req);
}

/**
 * Every assessment recorded for one session, oldest first.
 *
 * Chronological rather than newest-first, because the value of this view is
 * watching risk build: a quiet ALLOW, then the amount being typed, then the
 * step-up. Reversed, that story reads backwards.
 */
export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const denied = requireAnalyst(req);
  if (denied) return denied;

  const { sessionId } = await ctx.params;

  const rows = await sql`
    SELECT e.id, e.session_id, e.screen, e.risk_score, e.action, e.engines,
           e.flags, e.features, e.created_at, u.full_name, u.account_number
    FROM session_events e
    LEFT JOIN users u ON u.id = e.user_id
    WHERE e.session_id = ${sessionId}
    ORDER BY e.created_at ASC
    LIMIT 200
  `;

  return analystJson(req, {
    events: rows.map((row) => ({
      id: row.id as string,
      sessionId: row.session_id as string,
      screen: (row.screen as string | null) ?? null,
      riskScore: row.risk_score as number,
      action: row.action as string,
      engines: row.engines ?? null,
      flags: (row.flags as string[] | null) ?? [],
      features: row.features ?? null,
      fullName: (row.full_name as string | null) ?? null,
      accountNumber: (row.account_number as string | null) ?? null,
      createdAt: new Date(row.created_at as string).toISOString(),
    })),
  });
}
