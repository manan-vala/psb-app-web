import { NextResponse } from 'next/server';
import { verifyFaceEmbedding, requireSession, FaceApiError, type Challenge, type LivenessFrame } from '@/lib/faceApi';

export const runtime = 'nodejs';
export const maxDuration = 60; // see enroll/route.ts — same reasoning

interface VerifyBody {
  imageBase64?: string;
  challenge?: Challenge;
  landmarkSequence?: LivenessFrame[];
}

const MAX_BASE64_LENGTH = 1_100_000;

/**
 * Note (spec v2, top of doc): this route intentionally has no server-side
 * attempt counter / lockout, unlike /api/auth/pin/verify. StepUpModal limits
 * retries client-side only, which is not a real control — anyone holding a
 * valid session cookie can call this endpoint directly, repeatedly. Tracked
 * as the next thing to build (mirror pin_attempts/pin_locked_until), not
 * solved here.
 */
export async function POST(req: Request) {
  let sessionUser;
  try {
    sessionUser = await requireSession();
  } catch (err) {
    if (err instanceof FaceApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = (await req.json().catch(() => ({}))) as VerifyBody;
  const { imageBase64, challenge, landmarkSequence } = body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return NextResponse.json({ error: 'Image data required.' }, { status: 400 });
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'Image too large.' }, { status: 413 });
  }
  if (!challenge || !Array.isArray(landmarkSequence) || landmarkSequence.length === 0) {
    return NextResponse.json({ error: 'Liveness challenge data required.' }, { status: 400 });
  }

  try {
    const result = await verifyFaceEmbedding({
      userId: sessionUser.id,
      imageBase64,
      challenge,
      landmarkSequence,
    });
    return NextResponse.json({ match: result.match, similarity: result.similarity });
  } catch (err) {
    if (err instanceof FaceApiError) {
      if (err.status === 404) return NextResponse.json({ enrolled: false });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('face verify failed:', err);
    return NextResponse.json(
      { error: 'Could not verify your face right now. Please try password instead.' },
      { status: 502 }
    );
  }
}
