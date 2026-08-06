import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getFaceApiUrl(): string {
  const url = process.env.FACE_API_URL;
  if (!url) {
    throw new Error('FACE_API_URL is not set.');
  }
  return url;
}

function getFaceApiSecret(): string {
  const secret = process.env.FACE_API_SECRET;
  if (!secret) {
    throw new Error('FACE_API_SECRET is not set.');
  }
  return secret;
}

/**
 * GET /api/face/health
 * Calls Python /health/detail and returns the full payload with latency.
 * Unlike /api/face/warmup, this route intentionally awaits the response.
 */
export async function GET() {
  const t0 = Date.now();

  try {
    const res = await fetch(`${getFaceApiUrl()}/health/detail`, {
      headers: { 'X-Internal-Secret': getFaceApiSecret() },
      signal: AbortSignal.timeout(8_000),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data.detail || 'Service unhealthy', status: res.status },
        { status: res.status }
      );
    }

    const latencyMs = Date.now() - t0;
    return NextResponse.json({
      ok: true,
      latencyMs,
      python: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Connection failed', latencyMs: Date.now() - t0 },
      { status: 502 }
    );
  }
}
