import { createHash } from 'node:crypto';
import { sql } from './db';

/**
 * Server-side half of device binding. The browser computes the fingerprint
 * (see src/hooks/useDeviceFingerprint.ts, which hashes canvas output, screen
 * geometry, CPU/memory and timezone); this module is what turns that opaque
 * hash into a row a human can recognise in a trusted-device list.
 */

/**
 * Human-readable device label from a user-agent string — "Chrome on Windows".
 *
 * Deliberately crude. This is only ever shown back to the account holder in
 * the trusted-device picker, so it has to be recognisable ("that's my laptop"),
 * not accurate. Nothing branches on it.
 */
export function labelFromUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';

  const ua = userAgent.toLowerCase();

  const platform = ua.includes('android')
    ? 'Android'
    : /iphone|ipad|ipod/.test(ua)
      ? 'iOS'
      : ua.includes('mac os')
        ? 'macOS'
        : ua.includes('windows')
          ? 'Windows'
          : ua.includes('linux')
            ? 'Linux'
            : 'Unknown';

  // Order matters: Edge and Opera both claim Chrome, and Chrome claims Safari.
  const browser = ua.includes('edg/')
    ? 'Edge'
    : /opr\/|opera/.test(ua)
      ? 'Opera'
      : ua.includes('firefox')
        ? 'Firefox'
        : ua.includes('chrome')
          ? 'Chrome'
          : ua.includes('safari')
            ? 'Safari'
            : 'Browser';

  return `${browser} on ${platform}`;
}

/** Coarse platform bucket, stored alongside the label for display grouping. */
export function platformFromUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  return labelFromUserAgent(userAgent).split(' on ')[1] ?? null;
}

/**
 * Fallback fingerprint for a request whose client didn't send one — a curl
 * call, or a browser where canvas/crypto was unavailable and the hook left the
 * hash empty.
 *
 * This is intentionally weak: every browser on a given OS+version shares a
 * user-agent, so two different machines can collide. That's the right failure
 * mode here — a collision means an extra device gets treated as already known,
 * which is a demo inconvenience, whereas generating a random fingerprint per
 * request would mean the user is on a brand-new device every single login and
 * could never get through verification at all.
 */
export function fallbackFingerprint(userAgent: string | null): string {
  return createHash('sha256')
    .update(`ua-fallback|${userAgent ?? 'unknown'}`)
    .digest('hex');
}

export interface DeviceInput {
  fingerprint?: string;
  label?: string;
  platform?: string;
}

export interface RegisteredDevice {
  id: string;
  fingerprintHash: string;
  label: string;
  isTrusted: boolean;
}

/**
 * Upserts the calling browser into `user_devices` and returns it.
 *
 * `is_trusted` is never set here — a device becomes trusted only by an analyst
 * approving the onboarding request it enrolled on (Scenario A), or by passing
 * a verification challenge from an already-trusted device (Scenario B).
 * Touching trust on a plain upsert would quietly defeat both.
 */
export async function upsertDevice(
  userId: string,
  device: DeviceInput | undefined,
  userAgent: string | null
): Promise<RegisteredDevice> {
  const fingerprint = device?.fingerprint?.trim() || fallbackFingerprint(userAgent);
  const label = device?.label?.trim() || labelFromUserAgent(userAgent);
  const platform = device?.platform?.trim() || platformFromUserAgent(userAgent);

  const [row] = await sql`
    INSERT INTO user_devices (user_id, fingerprint_hash, label, platform, user_agent)
    VALUES (${userId}, ${fingerprint}, ${label}, ${platform}, ${userAgent})
    ON CONFLICT (user_id, fingerprint_hash) DO UPDATE
      SET last_seen_at = now(),
          label        = EXCLUDED.label,
          platform     = EXCLUDED.platform,
          user_agent   = EXCLUDED.user_agent
    RETURNING id, fingerprint_hash, label, is_trusted
  `;

  return {
    id: row.id as string,
    fingerprintHash: row.fingerprint_hash as string,
    label: row.label as string,
    isTrusted: row.is_trusted as boolean,
  };
}
