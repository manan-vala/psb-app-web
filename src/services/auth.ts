/**
 * Local, in-browser authentication store.
 *
 * Web port of the Expo app's `services/auth.ts`. The app has no multi-user
 * backend (the server side is a single hardcoded demo user used for the
 * risk-telemetry pipeline), so account creation, password, and PIN live on
 * the client — here in `localStorage`, hashed with a per-credential random
 * salt via the Web Crypto API.
 *
 * Note on parity: the native app used `expo-secure-store` (Android Keystore /
 * iOS Keychain). The browser has no equivalent hardware-backed store, so
 * localStorage is the honest equivalent — the salted SHA-256 hashing is
 * preserved so raw credentials are never persisted either way.
 */

const KEYS = {
  PROFILE: 'psb_auth_profile',
  PASSWORD_SALT: 'psb_auth_password_salt',
  PASSWORD_HASH: 'psb_auth_password_hash',
  PIN_SALT: 'psb_auth_pin_salt',
  PIN_HASH: 'psb_auth_pin_hash',
  SESSION_ACTIVE: 'psb_auth_session_active',
} as const;

export interface UserProfile {
  fullName: string;
  mobile: string;
  email?: string;
}

/* ------------------------------------------------------------------ */
/* storage helpers (SSR-safe)                                          */
/* ------------------------------------------------------------------ */

function getItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — non-fatal for a demo */
  }
}

/* ------------------------------------------------------------------ */
/* crypto                                                              */
/* ------------------------------------------------------------------ */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** SHA-256 of `salt:value` — identical scheme to the Expo app. */
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

async function hashWithSalt(value: string, salt: string): Promise<string> {
  return sha256(`${salt}:${value}`);
}

/* ------------------------------------------------------------------ */
/* account                                                             */
/* ------------------------------------------------------------------ */

/** True once the user has created an account (name + password) in this browser. */
export function hasAccount(): boolean {
  return getItem(KEYS.PASSWORD_HASH) !== null;
}

/** Creates the local account: stores profile + salted password hash. */
export async function registerAccount(
  profile: UserProfile,
  password: string
): Promise<void> {
  const salt = generateSalt();
  const hash = await hashWithSalt(password, salt);
  setItem(KEYS.PROFILE, JSON.stringify(profile));
  setItem(KEYS.PASSWORD_SALT, salt);
  setItem(KEYS.PASSWORD_HASH, hash);
}

/** Checks a password attempt against the stored hash. */
export async function verifyPassword(password: string): Promise<boolean> {
  const salt = getItem(KEYS.PASSWORD_SALT);
  const stored = getItem(KEYS.PASSWORD_HASH);
  if (!salt || !stored) return false;
  return (await hashWithSalt(password, salt)) === stored;
}

/* ------------------------------------------------------------------ */
/* PIN                                                                 */
/* ------------------------------------------------------------------ */

/** True once the user has set a 4-digit PIN in this browser. */
export function hasPin(): boolean {
  return getItem(KEYS.PIN_HASH) !== null;
}

/** Sets (or resets) the local PIN. */
export async function setPin(pin: string): Promise<void> {
  const salt = generateSalt();
  const hash = await hashWithSalt(pin, salt);
  setItem(KEYS.PIN_SALT, salt);
  setItem(KEYS.PIN_HASH, hash);
}

/** Checks a PIN attempt against the stored hash. */
export async function verifyPin(pin: string): Promise<boolean> {
  const salt = getItem(KEYS.PIN_SALT);
  const stored = getItem(KEYS.PIN_HASH);
  if (!salt || !stored) return false;
  return (await hashWithSalt(pin, salt)) === stored;
}

/* ------------------------------------------------------------------ */
/* profile & session                                                   */
/* ------------------------------------------------------------------ */

export function getProfile(): UserProfile | null {
  const raw = getItem(KEYS.PROFILE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function setSessionActive(active: boolean): void {
  setItem(KEYS.SESSION_ACTIVE, active ? 'true' : 'false');
}

export function isSessionActive(): boolean {
  return getItem(KEYS.SESSION_ACTIVE) === 'true';
}

/** Ends the current session. Account/PIN/password remain for next login. */
export function logout(): void {
  setSessionActive(false);
}
