/**
 * Client-side auth API — talks to the Route Handlers under
 * `src/app/api/auth/*`, which are backed by Postgres (Neon) and an httpOnly
 * cookie session. No credentials or session state live in the browser
 * anymore; every function here is a `fetch` call, which is why (unlike the
 * old localStorage-backed version) every one of them is `async`.
 *
 * `credentials: 'include'` isn't set explicitly below because these are
 * always same-origin requests (the API routes live in this same Next.js
 * app) — the session cookie is sent automatically.
 */

export interface UserProfile {
  fullName: string;
  mobile: string;
  accountNumber: string;
  email?: string | null;
}

/** Mirrors `sessions.scope` — see src/lib/session.ts. */
export type SessionScope = 'LIMITED' | 'PENDING_DEVICE' | 'FULL';

/** Mirrors `users.status` — see migration 005. */
export type AccountStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export interface AuthStatus {
  /** True only for a FULL-scope session. A user waiting on approval is not authenticated. */
  isAuthenticated: boolean;
  scope: SessionScope | null;
  /** Approval state of the account, independent of the session. Null when signed out. */
  status: AccountStatus | null;
  profile: UserProfile | null;
  hasPin: boolean;
  /**
   * Whether the browser identified by the `fp` argument is a trusted device.
   * Null means the question wasn't asked, not "no" — pass a fingerprint to
   * `getAuthStatus` to get a real answer.
   */
  deviceTrusted: boolean | null;
  /** Set only while an account is PENDING_APPROVAL. */
  pendingRequestId: string | null;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  /** Present on PIN failures — surfaced so the UI can warn before lockout. */
  attemptsRemaining?: number;
  locked?: boolean;
}

async function postJson(path: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? 'Something went wrong. Please try again.',
        attemptsRemaining: data.attemptsRemaining,
        locked: data.locked,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

/**
 * Everything the entry screen needs to decide where to send the browser, in
 * one round trip: whether there's a session, what scope it has, and what state
 * the account behind it is in.
 *
 * Pass `fingerprint` to also get a `deviceTrusted` answer for this specific
 * browser; without it that field stays null.
 */
export async function getAuthStatus(fingerprint?: string): Promise<AuthStatus> {
  const query = fingerprint ? `?fp=${encodeURIComponent(fingerprint)}` : '';
  try {
    const res = await fetch(`/api/auth/status${query}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('status check failed');
    return (await res.json()) as AuthStatus;
  } catch {
    // Fail closed on the routing decision (send to register) but don't crash
    // the entry screen — the user can retry.
    return {
      isAuthenticated: false,
      scope: null,
      status: null,
      profile: null,
      hasPin: false,
      deviceTrusted: null,
      pendingRequestId: null,
    };
  }
}

export interface RegisterResult extends AuthResult {
  /** The onboarding request now sitting in the analyst's queue. */
  requestId?: string;
}

/**
 * Submits the account for bank approval. Unlike before, this does NOT sign the
 * browser in — registration now creates a PENDING_APPROVAL account and a
 * LIMITED session that can do nothing but poll `/api/onboarding/status`.
 */
export async function registerAccount(
  profile: UserProfile,
  password: string,
  device?: { fingerprint: string; label: string; platform?: string }
): Promise<RegisterResult> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, password, device }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error ?? 'Something went wrong. Please try again.' };
    }
    return { ok: true, requestId: data.requestId };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

export interface OnboardingStatus {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  requestId: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
}

/** Polled by `/pending-approval` every few seconds until the analyst decides. */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  try {
    const res = await fetch('/api/onboarding/status', { cache: 'no-store' });
    if (!res.ok) throw new Error('onboarding status failed');
    return (await res.json()) as OnboardingStatus;
  } catch {
    // A failed poll is not a decision — keep the caller waiting rather than
    // bouncing it to a terminal screen on one dropped request.
    return { status: null, requestId: null, rejectionReason: null, submittedAt: null };
  }
}

/** Password login by mobile number or email. Issues a session on success. */
export async function loginWithPassword(identifier: string, password: string): Promise<AuthResult> {
  return postJson('/api/auth/login', { identifier, password });
}

/**
 * Re-checks the signed-in user's password without touching the session.
 * Used for step-up confirmation (e.g. before sending a transfer).
 */
export async function verifyPassword(password: string): Promise<AuthResult> {
  return postJson('/api/auth/verify-password', { password });
}

/** PIN quick-login. Issues a session on success; rate-limited server-side. */
export async function verifyPin(pin: string): Promise<AuthResult> {
  return postJson('/api/auth/pin/verify', { pin });
}

/** Sets/resets the signed-in user's PIN. Requires an active session. */
export async function setPin(pin: string): Promise<AuthResult> {
  return postJson('/api/auth/pin/set', { pin });
}

/** Ends the current session server-side and clears the cookie. */
export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

/**
 * Face ID — talks to `/api/face/*`, which proxy (session-gated) to the
 * separate `psb-face-api` Python service. See `src/lib/faceApi.ts` for the
 * server-side half of this and `hybrid_face_auth_spec_v2.md` for the design.
 */

export interface FaceApiResult {
  ok: boolean;
  error?: string;
}

export interface FaceCapturePayload {
  imageBase64: string;
  challenge: 'blink' | 'turn_left' | 'turn_right';
  landmarkSequence: { tMs: number; eyeAspectRatio: number; headYawDeg: number }[];
}

export interface FaceStatus {
  enrolled: boolean;
  enrolledAt?: string | null;
}

export interface FaceVerifyResult {
  match: boolean;
  similarity?: number;
  /** True when /api/face/verify reports no enrollment exists — caller should fall back to password. */
  enrolled?: boolean;
  error?: string;
}

/**
 * Enrolls a face for the signed-in session. Requires an active session.
 *
 * Accepts either a single capture (the original single-shot path) or an array
 * of captures from multi-pose enrollment — in the array case the server
 * embeds each one and stores their averaged centroid as a single template.
 * Both shapes are sent as `{ captures: [...] }`; the single-capture overload
 * just wraps it, so there's one wire format rather than two.
 */
export async function enrollFace(
  payload: FaceCapturePayload | FaceCapturePayload[]
): Promise<FaceApiResult> {
  const captures = Array.isArray(payload) ? payload : [payload];
  try {
    const res = await fetch('/api/face/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captures }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? 'Could not set up Face ID.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

/** Verifies a live face capture against the signed-in user's stored embedding. */
export async function verifyFace(payload: FaceCapturePayload): Promise<FaceVerifyResult> {
  try {
    const res = await fetch('/api/face/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (data.enrolled === false) return { match: false, enrolled: false };
    if (!res.ok) return { match: false, error: data.error ?? 'Verification failed.' };
    return { match: !!data.match, similarity: data.similarity };
  } catch {
    return { match: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

/** Whether the signed-in user has an active face enrollment. */
export async function getFaceStatus(): Promise<FaceStatus> {
  try {
    const res = await fetch('/api/face/status', { cache: 'no-store' });
    if (!res.ok) throw new Error('status check failed');
    return (await res.json()) as FaceStatus;
  } catch {
    return { enrolled: false };
  }
}

/** Soft-deletes the signed-in user's face enrollment. */
export async function deleteFace(): Promise<FaceApiResult> {
  try {
    const res = await fetch('/api/face/delete', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? 'Could not delete Face ID data.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

/** Fire-and-forget: wakes the Python face service ahead of time. Never throws. */
export function pingFaceWarmup(): void {
  fetch('/api/face/warmup').catch(() => {});
}
