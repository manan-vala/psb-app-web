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
  email?: string | null;
}

export interface AuthStatus {
  hasAccount: boolean;
  hasPin: boolean;
  isAuthenticated: boolean;
  profile: UserProfile | null;
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
 * Single round trip covering what used to be four separate localStorage
 * reads (`hasAccount`, `hasPin`, `getProfile`, `isSessionActive`). Callers
 * that only need one field still call this and destructure — it's one fetch
 * either way.
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  try {
    const res = await fetch('/api/auth/status', { cache: 'no-store' });
    if (!res.ok) throw new Error('status check failed');
    return (await res.json()) as AuthStatus;
  } catch {
    // Fail closed on the routing decision (send to register) but don't crash
    // the entry screen — the user can retry.
    return { hasAccount: false, hasPin: false, isAuthenticated: false, profile: null };
  }
}

/** Creates the account and immediately signs the browser in via a session cookie. */
export async function registerAccount(profile: UserProfile, password: string): Promise<AuthResult> {
  return postJson('/api/auth/register', { ...profile, password });
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
