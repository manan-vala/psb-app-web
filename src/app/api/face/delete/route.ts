import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Soft-deletes the signed-in user's face enrollment (Settings → "Delete Face
 * Data"). Soft delete, not a hard DELETE, so an audit trail survives and
 * re-enrollment later reactivates this row instead of hitting a uniqueness
 * conflict — see migrations/002_face_enrollments.sql for the partial unique
 * index that makes that safe.
 */
export async function POST() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  await sql`
    UPDATE face_enrollments
    SET is_active = FALSE
    WHERE user_id = ${sessionUser.id} AND is_active = TRUE
  `;

  return NextResponse.json({ ok: true });
}
