import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Whether the current session's user has an active face enrollment.
 * Read directly from Postgres — no need to round-trip through Python for a
 * plain existence check.
 */
export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const rows = await sql`
    SELECT enrolled_at
    FROM face_enrollments
    WHERE user_id = ${sessionUser.id} AND is_active = TRUE
    LIMIT 1
  `;

  const row = rows[0];
  return NextResponse.json({
    enrolled: !!row,
    enrolledAt: row ? (row.enrolled_at as string) : null,
  });
}
