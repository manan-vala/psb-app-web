import { randomInt } from 'node:crypto';
import { sql } from './db';

/**
 * Rules for binding an account to a device (Scenario B).
 *
 * A challenge is a 6-digit code raised on an *already trusted* device to
 * approve an unrecognised one. The parameters are deliberately short and
 * strict — a code that lives for hours, or survives unlimited guesses, isn't a
 * second factor.
 */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_CHALLENGE_ATTEMPTS = 5;

export interface TrustedDeviceSummary {
  id: string;
  label: string;
  platform: string | null;
  lastSeenAt: string;
}

/** "2 days ago" — what the picker shows so a user recognises their own device. */
export function describeLastSeen(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Trusted devices an account can approve a new one from. */
export async function listTrustedDevices(userId: string): Promise<TrustedDeviceSummary[]> {
  const rows = await sql`
    SELECT id, label, platform, last_seen_at
    FROM user_devices
    WHERE user_id = ${userId} AND is_trusted
    ORDER BY last_seen_at DESC
  `;

  return rows.map((row) => ({
    id: row.id as string,
    label: row.label as string,
    platform: (row.platform as string | null) ?? null,
    lastSeenAt: new Date(row.last_seen_at as string).toISOString(),
  }));
}

/**
 * Six digits, uniformly distributed and allowed to have leading zeros.
 *
 * `randomInt` rather than `Math.random`: this is the only thing standing
 * between an unrecognised device and someone's bank account, and a predictable
 * PRNG would make the code guessable from earlier ones.
 */
export function generateChallengeCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export interface PendingChallenge {
  id: string;
  code: string;
  newDeviceLabel: string | null;
  expiresAt: string;
  attempts: number;
}

/**
 * The live challenge waiting on a given trusted device, if any.
 *
 * Expiry is evaluated here rather than by a background job — Neon's HTTP driver
 * has no cron, so `expires_at > now()` in the read path is what actually makes
 * the 5-minute TTL real. Nothing ever writes status='EXPIRED'; a lapsed row
 * simply stops being returned.
 */
export async function findPendingChallengeForDevice(
  targetDeviceId: string
): Promise<PendingChallenge | null> {
  const [row] = await sql`
    SELECT id, code, new_device_label, expires_at, attempts
    FROM device_trust_challenges
    WHERE target_device_id = ${targetDeviceId}
      AND status = 'PENDING'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!row) return null;

  return {
    id: row.id as string,
    code: row.code as string,
    newDeviceLabel: (row.new_device_label as string | null) ?? null,
    expiresAt: new Date(row.expires_at as string).toISOString(),
    attempts: row.attempts as number,
  };
}
