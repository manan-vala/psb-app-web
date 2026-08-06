import { getSessionUser, type SessionUser } from './session';

/**
 * Server-only helper for talking to the `psb-face-api` Python microservice
 * (deployed separately from the `ml` repo — see `ml/face_api/`).
 *
 * Every call here is server-to-server: the browser never learns
 * `FACE_API_URL` or `FACE_API_SECRET`, and every Next.js route that uses
 * this first validates the caller's session itself (see `requireSession`
 * below) before forwarding anything to Python.
 *
 * Per the spec's corrected §3/§9: the shared secret is the actual access
 * control on the Python side. CORS is configured there too, but only as
 * browser-side defense-in-depth — it does nothing against a direct/scripted
 * caller, so don't rely on it when reasoning about what's actually blocking
 * unauthorized access.
 */

function getFaceApiUrl(): string {
  const url = process.env.FACE_API_URL;
  if (!url) {
    throw new Error(
      'FACE_API_URL is not set. Copy .env.example to .env(.local) and point it at the ' +
        'deployed psb-face-api service.'
    );
  }
  return url;
}

function getFaceApiSecret(): string {
  const secret = process.env.FACE_API_SECRET;
  if (!secret) {
    throw new Error(
      'FACE_API_SECRET is not set. Generate one with `openssl rand -hex 32` and set the same ' +
        'value on both this app and the psb-face-api service.'
    );
  }
  return secret;
}

export interface LivenessFrame {
  tMs: number;
  eyeAspectRatio: number;
  headYawDeg: number;
}

export type Challenge = 'blink' | 'turn_left' | 'turn_right';

interface FaceApiErrorBody {
  detail?: string;
}

export class FaceApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function callFaceApi<T>(path: string, body: unknown, timeoutMs = 45_000): Promise<T> {
  const res = await fetch(`${getFaceApiUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': getFaceApiSecret(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = (await res.json().catch(() => ({}))) as FaceApiErrorBody & Record<string, unknown>;

  if (!res.ok) {
    throw new FaceApiError(res.status, data.detail ?? 'Face service request failed.');
  }
  return data as T;
}

export interface EnrollResult {
  ok: true;
  embedding_id: string;
}

export async function enrollFaceEmbedding(params: {
  userId: string;
  imageBase64: string;
  challenge: Challenge;
  landmarkSequence: LivenessFrame[];
}): Promise<EnrollResult> {
  return callFaceApi<EnrollResult>('/enroll', {
    user_id: params.userId,
    image_b64: params.imageBase64,
    challenge: params.challenge,
    landmark_sequence: params.landmarkSequence,
  });
}

export interface VerifyResult {
  match: boolean;
  similarity: number;
  confidence: number;
}

export async function verifyFaceEmbedding(params: {
  userId: string;
  imageBase64: string;
  challenge: Challenge;
  landmarkSequence: LivenessFrame[];
}): Promise<VerifyResult> {
  return callFaceApi<VerifyResult>('/verify', {
    user_id: params.userId,
    image_b64: params.imageBase64,
    challenge: params.challenge,
    landmark_sequence: params.landmarkSequence,
  });
}

/** Fire-and-forget warm-up ping — see warmup/route.ts. Never throws. */
export function pingFaceApiWarmup(): void {
  try {
    fetch(`${getFaceApiUrl()}/health/detail`, {
      headers: { 'X-Internal-Secret': getFaceApiSecret() },
      signal: AbortSignal.timeout(8_000),
    }).catch(() => {
      /* best-effort only */
    });
  } catch {
    /* env vars missing — nothing to do, enroll/verify will surface the real error */
  }
}

/** Small helper so every face route repeats the same session gate the same way. */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new FaceApiError(401, 'Not signed in.');
  }
  return user;
}
