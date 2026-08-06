import { NextResponse } from 'next/server';
import { pingFaceApiWarmup } from '@/lib/faceApi';

export const runtime = 'nodejs';

/**
 * Deliberately fire-and-forget (spec v2 §7 correction): the caller does not
 * await the Python response here, and neither does this route wait on it
 * before responding. Awaiting a cold Python instance inside this handler
 * would burn most of this function's own duration budget before the user
 * has even seen the camera — the whole point of warm-up is to get model
 * weights resident in memory *during* the consent screen, not to block on
 * it. `enroll`/`verify` will still work even if this never resolves; they'll
 * just be slower on the very first call.
 */
export async function GET() {
  pingFaceApiWarmup();
  return NextResponse.json({ ok: true });
}
