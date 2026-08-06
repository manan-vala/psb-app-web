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

/**
 * FastAPI's `detail` is a plain string for our own `HTTPException`s, but an
 * ARRAY of validation-error objects for a 422 raised by Pydantic. Typing it as
 * `string` and interpolating it is what produced the useless
 * "[object Object],[object Object],[object Object]" message — one
 * "[object Object]" per field Pydantic rejected.
 */
type FastApiDetail =
  | string
  | { loc?: (string | number)[]; msg?: string; type?: string }[]
  | undefined;

interface FaceApiErrorBody {
  detail?: FastApiDetail;
}

/** Flattens either `detail` shape into one readable sentence. */
function formatDetail(detail: FastApiDetail, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (!Array.isArray(detail) || detail.length === 0) return fallback;

  return detail
    .map((item) => {
      // `loc` is like ["body", "captures", 0, "image_b64"] — drop the leading
      // "body" so the field path reads the way the request body looks.
      const path = (item.loc ?? []).filter((p) => p !== 'body').join('.');
      const msg = item.msg ?? 'invalid';
      return path ? `${path}: ${msg}` : msg;
    })
    .join('; ');
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
    throw new FaceApiError(res.status, formatDetail(data.detail, 'Face service request failed.'));
  }
  return data as T;
}

/**
 * The browser captures landmark frames in camelCase (`tMs`, `eyeAspectRatio`,
 * `headYawDeg`), but the Python service's `LandmarkFrame` model declares
 * snake_case fields with no alias generator — so passing the frames through
 * untouched makes Pydantic reject every one of them as missing.
 *
 * Converting here rather than renaming the TS interface keeps the browser-side
 * code idiomatic and puts the wire-format translation at the single boundary
 * that owns it.
 */
function toWireFrames(frames: LivenessFrame[]) {
  return frames.map((f) => ({
    t_ms: Math.max(0, Math.round(f.tMs)), // Pydantic wants an int, ge=0
    eye_aspect_ratio: clamp(f.eyeAspectRatio, 0, 1),
    head_yaw_deg: clamp(f.headYawDeg, -90, 90),
  }));
}

/**
 * The Python model constrains these ranges (`ge`/`le`), and a rejected frame
 * fails the whole request. Yaw from MediaPipe's transform matrix can exceed
 * ±90 on an extreme turn, and the derived eye-aspect ratio can land a hair
 * outside 0..1 — clamping keeps a physically-plausible capture from 422-ing on
 * a boundary value.
 */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export interface EnrollResult {
  ok: true;
  embedding_id: string;
  /** How many captures were averaged into the stored template. */
  poses_used?: number;
}

export interface FaceCapture {
  imageBase64: string;
  challenge: Challenge;
  landmarkSequence: LivenessFrame[];
}

/**
 * Enrolls one or more captures as a single stored template.
 *
 * The Python service validates liveness for *every* capture and averages
 * their embeddings into one centroid before storing — so a request with
 * three poses still produces exactly one `face_enrollments` row, and the
 * database schema is unchanged from the single-capture design.
 *
 * The timeout scales with capture count: each capture costs a full
 * SCRFD-detect + ArcFace-embed pass (~400-700ms each on the CPU-only Render
 * instance), so a fixed 45s budget that was comfortable for one image is
 * uncomfortably tight for three plus a cold start.
 */
export async function enrollFaceEmbedding(params: {
  userId: string;
  captures: FaceCapture[];
}): Promise<EnrollResult> {
  const timeoutMs = Math.min(45_000 + (params.captures.length - 1) * 15_000, 55_000);
  return callFaceApi<EnrollResult>(
    '/enroll',
    {
      user_id: params.userId,
      captures: params.captures.map((c) => ({
        image_b64: c.imageBase64,
        challenge: c.challenge,
        landmark_sequence: toWireFrames(c.landmarkSequence),
      })),
    },
    timeoutMs
  );
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
    landmark_sequence: toWireFrames(params.landmarkSequence),
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
