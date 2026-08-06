import { NextResponse } from 'next/server';
import { enrollFaceEmbedding, requireSession, FaceApiError, type Challenge, type LivenessFrame } from '@/lib/faceApi';

export const runtime = 'nodejs';
// Vercel Hobby supports up to 60s per route without Fluid Compute. Declared
// explicitly so a rare Python cold start (deploy/restart) can't collide with
// a hard 10s default — see spec v2 §15.4. The warm-up ping (warmup/route.ts)
// is still worth calling first for latency, but this is what removes the
// *correctness* risk.
export const maxDuration = 60;

interface EnrollBody {
  imageBase64?: string;
  challenge?: Challenge;
  landmarkSequence?: LivenessFrame[];
}

const MAX_BASE64_LENGTH = 1_100_000; // ~800KB base64 ≈ 600KB JPEG ceiling

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

  const body = (await req.json().catch(() => ({}))) as EnrollBody;
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
    await enrollFaceEmbedding({
      userId: sessionUser.id,
      imageBase64,
      challenge,
      landmarkSequence,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof FaceApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('face enroll failed:', err);
    return NextResponse.json(
      { error: 'Could not set up Face ID right now. Please try again.' },
      { status: 502 }
    );
  }
}
