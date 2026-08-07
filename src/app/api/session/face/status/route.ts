import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Whether the demo account has a face template stored.
 *
 * Keyed by account number rather than a session, like the rest of
 * /api/session/*, because the session monitor is reachable without signing in.
 *
 * Read straight from `face_enrollments` instead of asking the Python service.
 * The question here is "is identity checking armed", which the database can
 * answer instantly and correctly even when the face service is asleep.
 */
export async function GET(req: Request) {
  const accountNumber = new URL(req.url).searchParams.get('accountNumber');

  if (!accountNumber) {
    return NextResponse.json({ error: 'accountNumber is required.' }, { status: 400 });
  }

  const [row] = await sql`
    SELECT f.enrolled_at, f.quality_score
    FROM face_enrollments f
    JOIN users u ON u.id = f.user_id
    WHERE u.account_number = ${accountNumber} AND f.is_active
  `;

  return NextResponse.json({
    enrolled: !!row,
    enrolledAt: row ? new Date(row.enrolled_at as string).toISOString() : null,
    qualityScore: row ? (row.quality_score as number | null) : null,
  });
}
