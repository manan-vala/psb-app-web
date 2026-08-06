import { NextResponse } from 'next/server';
import {
  enrollFaceEmbedding,
  requireSession,
  FaceApiError,
  type Challenge,
  type LivenessFrame,
  type FaceCapture,
} from '@/lib/faceApi';

export const runtime = 'nodejs';
// Vercel Hobby supports up to 60s per route without Fluid Compute. Declared
// explicitly so a rare Python cold start (deploy/restart) can't collide with
// a hard 10s default — see spec v2 §15.4. The warm-up ping (warmup/route.ts)
// is still worth calling first for latency, but this is what removes the
// *correctness* risk. Multi-pose enrollment makes this matter more, not less:
// three captures means three inference passes inside that one budget.
export const maxDuration = 60;

interface CaptureBody {
  imageBase64?: string;
  challenge?: Challenge;
  landmarkSequence?: LivenessFrame[];
}

interface EnrollBody extends CaptureBody {
  /** Multi-pose enrollment. Legacy single-capture fields are still accepted. */
  captures?: CaptureBody[];
}

const MAX_BASE64_LENGTH = 1_100_000; // ~800KB base64 ≈ 600KB JPEG ceiling
// Three poses is what MultiPoseEnroll sends. The cap is here so a scripted
// caller can't turn one request into an unbounded number of inference passes
// on a 0.5-vCPU instance — that's a cheap denial-of-service otherwise.
const MAX_CAPTURES = 5;

/** Returns an error message, or null if the capture is well-formed. */
function validateCapture(c: CaptureBody, index: number, total: number): string | null {
  const where = total > 1 ? ` (capture ${index + 1} of ${total})` : '';
  if (!c.imageBase64 || typeof c.imageBase64 !== 'string') return `Image data required${where}.`;
  if (c.imageBase64.length > MAX_BASE64_LENGTH) return `Image too large${where}.`;
  if (!c.challenge || !Array.isArray(c.landmarkSequence) || c.landmarkSequence.length === 0) {
    return `Liveness challenge data required${where}.`;
  }
  return null;
}

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

  // Normalize both shapes to one list: `{ captures: [...] }` from the
  // multi-pose flow, or the flat single-capture body older callers send.
  const raw: CaptureBody[] = Array.isArray(body.captures) ? body.captures : [body];

  if (raw.length === 0) {
    return NextResponse.json({ error: 'At least one capture is required.' }, { status: 400 });
  }
  if (raw.length > MAX_CAPTURES) {
    return NextResponse.json(
      { error: `Too many captures — send at most ${MAX_CAPTURES}.` },
      { status: 400 }
    );
  }

  for (let i = 0; i < raw.length; i++) {
    const error = validateCapture(raw[i], i, raw.length);
    if (error) {
      // 413 only for the size ceiling; everything else is a malformed body.
      const status = error.startsWith('Image too large') ? 413 : 400;
      return NextResponse.json({ error }, { status });
    }
  }

  const captures: FaceCapture[] = raw.map((c) => ({
    imageBase64: c.imageBase64!,
    challenge: c.challenge!,
    landmarkSequence: c.landmarkSequence!,
  }));

  try {
    const result = await enrollFaceEmbedding({ userId: sessionUser.id, captures });
    return NextResponse.json({
      ok: true,
      posesUsed: result.poses_used ?? captures.length,
    });
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
