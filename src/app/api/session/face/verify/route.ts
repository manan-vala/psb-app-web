import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  FaceApiError,
  verifyFaceEmbedding,
  type Challenge,
  type LivenessFrame,
} from '@/lib/faceApi';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BASE64_LENGTH = 1_100_000;

interface Body {
  accountNumber?: string;
  imageBase64?: string;
  challenge?: Challenge;
  landmarkSequence?: LivenessFrame[];
}

/**
 * Compares a live capture against the demo account's stored template.
 *
 * Three distinct outcomes, and the caller has to treat them differently:
 *
 *   { match: true  }              this is the enrolled person
 *   { match: false }              a live face, but somebody else
 *   { enrolled: false }           no template stored, nothing to compare
 *   502                           the face service could not be reached
 *
 * Collapsing the last two into "failed" would be wrong in opposite directions:
 * an unenrolled account would look like an impostor, and a sleeping Render
 * instance would too. Scenario C's step up branches on all four.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  if (!body.accountNumber) {
    return NextResponse.json({ error: 'accountNumber is required.' }, { status: 400 });
  }
  if (!body.imageBase64 || typeof body.imageBase64 !== 'string') {
    return NextResponse.json({ error: 'Image data required.' }, { status: 400 });
  }
  if (body.imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'Image too large.' }, { status: 413 });
  }
  if (!body.challenge || !Array.isArray(body.landmarkSequence) || body.landmarkSequence.length === 0) {
    return NextResponse.json({ error: 'Liveness challenge data required.' }, { status: 400 });
  }

  const [user] = await sql`
    SELECT id FROM users WHERE account_number = ${body.accountNumber}
  `;

  if (!user) {
    return NextResponse.json({ error: 'No such account.' }, { status: 404 });
  }

  // Checked before calling out to the face service: if there's no template,
  // the answer is knowable locally and there's no reason to wait on a cold
  // start to be told the same thing.
  const [enrollment] = await sql`
    SELECT id FROM face_enrollments WHERE user_id = ${user.id} AND is_active
  `;

  if (!enrollment) {
    return NextResponse.json({ enrolled: false });
  }

  try {
    const result = await verifyFaceEmbedding({
      userId: user.id as string,
      imageBase64: body.imageBase64,
      challenge: body.challenge,
      landmarkSequence: body.landmarkSequence,
    });

    return NextResponse.json({
      enrolled: true,
      match: result.match,
      similarity: result.similarity,
      confidence: result.confidence,
    });
  } catch (err) {
    // 404 means the service lost the template between our check and the call —
    // treat it the same as never having had one.
    if (err instanceof FaceApiError && err.status === 404) {
      return NextResponse.json({ enrolled: false });
    }

    // Any other 4xx is the service *rejecting this capture*: no face found in
    // the frame, liveness not satisfied, image unusable. That is a failed
    // verification, not an outage, and it has to count against the attempt
    // limit like any other failure.
    //
    // Collapsing these into "unavailable" is what let an unrecognised person
    // through: the caller's outage path clears the step up, so anyone whose
    // captures merely errored was waved past without ever being compared.
    if (err instanceof FaceApiError && err.status >= 400 && err.status < 500) {
      return NextResponse.json({
        enrolled: true,
        match: false,
        rejected: true,
        reason: err.message,
      });
    }

    // Genuinely unreachable: a 5xx, a timeout, or a network failure.
    console.error('demo face verify unavailable:', err);
    return NextResponse.json(
      { error: 'Could not reach the face service.', unavailable: true },
      { status: 502 }
    );
  }
}
