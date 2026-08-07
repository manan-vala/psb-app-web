import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { enrollFaceEmbedding, FaceApiError, type FaceCapture } from '@/lib/faceApi';

export const runtime = 'nodejs';
export const maxDuration = 60; // several SCRFD + ArcFace passes on a CPU instance

const MAX_BASE64_LENGTH = 1_100_000;

interface Body {
  accountNumber?: string;
  captures?: FaceCapture[];
}

/**
 * Enrols a face template against the demo account, for /demo-setup.
 *
 * Separate from /api/face/enroll because that route identifies the user from
 * the session cookie, and nothing in the Scenario C flow signs in. The
 * underlying `enrollFaceEmbedding` already takes an explicit user id, so this
 * is the same operation with a different way of naming who it is for.
 *
 * Re-enrolling is allowed and expected: the Python service soft deletes the
 * previous template and stores a new one, so the presenter can re-enrol under
 * different lighting right before a demo without cleaning anything up.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const captures = body.captures ?? [];

  if (!body.accountNumber) {
    return NextResponse.json({ error: 'accountNumber is required.' }, { status: 400 });
  }
  if (captures.length === 0) {
    return NextResponse.json({ error: 'At least one capture is required.' }, { status: 400 });
  }
  if (captures.some((c) => !c.imageBase64 || c.imageBase64.length > MAX_BASE64_LENGTH)) {
    return NextResponse.json({ error: 'Capture image missing or too large.' }, { status: 413 });
  }

  const [user] = await sql`
    SELECT id FROM users WHERE account_number = ${body.accountNumber}
  `;

  if (!user) {
    return NextResponse.json({ error: 'No such account.' }, { status: 404 });
  }

  try {
    const result = await enrollFaceEmbedding({
      userId: user.id as string,
      captures,
    });
    return NextResponse.json({ ok: true, posesUsed: result.poses_used ?? captures.length });
  } catch (err) {
    if (err instanceof FaceApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('demo face enroll failed:', err);
    return NextResponse.json(
      { error: 'Could not set up Face ID right now. Please try again.' },
      { status: 502 }
    );
  }
}
