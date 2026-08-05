/**
 * Client-safe hashing helper. Uses the browser's Web Crypto API — no
 * dependency on server-only code (unlike password/PIN hashing, which moved
 * to bcrypt on the server in `services/auth.ts`).
 *
 * Used by `useDeviceFingerprint` to hash browser/hardware characteristics
 * for the telemetry device fingerprint. This is unrelated to auth.
 */
export async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
