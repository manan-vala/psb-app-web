import { analystJson, handleAnalystOptions, requireAnalyst } from '@/lib/analystAuth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export function OPTIONS(req: Request) {
  return handleAnalystOptions(req);
}

/**
 * Recent sessions, one row each, worst verdict first.
 *
 * Collapsed in SQL rather than the client: a session is a stream of
 * assessments, but an analyst triaging a queue only wants "how bad did this get
 * and when". The individual events live behind `/sessions/:id`.
 *
 * Ordered by recency rather than severity — a resolved BLOCK from an hour ago
 * matters less than something happening now, and the alert count above the
 * table already surfaces severity.
 */
export async function GET(req: Request) {
  const denied = requireAnalyst(req);
  if (denied) return denied;

  const rows = await sql`
    SELECT e.session_id,
           max(e.risk_score)                                    AS max_risk,
           count(*)::int                                        AS event_count,
           min(e.created_at)                                    AS started_at,
           max(e.created_at)                                    AS last_seen_at,
           bool_or(e.action = 'BLOCK')                          AS had_block,
           bool_or(e.action = 'STEP_UP')                        AS had_step_up,
           max(u.full_name)                                     AS full_name,
           max(u.account_number)                                AS account_number,
           jsonb_agg(DISTINCT f.flag) FILTER (WHERE f.flag IS NOT NULL) AS flags
    FROM session_events e
    LEFT JOIN users u ON u.id = e.user_id
    LEFT JOIN LATERAL jsonb_array_elements_text(e.flags) AS f(flag) ON true
    GROUP BY e.session_id
    ORDER BY max(e.created_at) DESC
    LIMIT 50
  `;

  const sessions = rows.map((row) => ({
    sessionId: row.session_id as string,
    fullName: (row.full_name as string | null) ?? null,
    accountNumber: (row.account_number as string | null) ?? null,
    eventCount: row.event_count as number,
    maxRiskScore: row.max_risk as number,
    worstAction: row.had_block ? 'BLOCK' : row.had_step_up ? 'STEP_UP' : 'ALLOW',
    flags: (row.flags as string[] | null) ?? [],
    startedAt: new Date(row.started_at as string).toISOString(),
    lastSeenAt: new Date(row.last_seen_at as string).toISOString(),
  }));

  return analystJson(req, {
    sessions,
    // Drives the "needs attention" count above the table.
    alertCount: sessions.filter((s) => s.worstAction !== 'ALLOW').length,
  });
}
