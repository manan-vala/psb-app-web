import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * The customer's recent spending profile, so the session monitor can show what
 * a transfer is about to be judged against *before* it's submitted.
 *
 * Showing the baseline up front is what turns the eventual alert from a
 * surprise into something the audience saw coming — they can watch the amount
 * cross the line as it's typed.
 */
export async function GET(req: Request) {
  const accountNumber = new URL(req.url).searchParams.get('accountNumber');

  if (!accountNumber) {
    return NextResponse.json({ error: 'accountNumber is required.' }, { status: 400 });
  }

  const [row] = await sql`
    SELECT u.full_name,
           avg(t.amount)::float AS baseline,
           max(t.amount)::float AS largest,
           count(t.id)::int AS txn_count
    FROM users u
    LEFT JOIN transactions t
      ON t.user_id = u.id
     AND t.created_at > now() - interval '30 days'
     AND NOT t.is_demo_run
    WHERE u.account_number = ${accountNumber}
    GROUP BY u.full_name
  `;

  if (!row) {
    return NextResponse.json({ error: 'No such account.' }, { status: 404 });
  }

  const baseline = (row.baseline as number | null) ?? null;

  return NextResponse.json({
    fullName: row.full_name as string,
    baselineAverage: baseline === null ? null : Math.round(baseline),
    largest: row.largest === null ? null : Math.round(row.largest as number),
    transactionCount: row.txn_count as number,
    // The point at which the high-value rule starts firing. Handed to the
    // client so the UI and the scorer can't disagree about where the line is.
    highValueThreshold: baseline === null ? null : Math.round(baseline * 2),
  });
}
