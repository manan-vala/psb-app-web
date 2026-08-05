import bcrypt from 'bcryptjs';

/**
 * bcrypt with a cost factor of 12 — the currently-recommended default for
 * interactive login (high enough to resist offline brute-forcing at scale,
 * low enough to stay well under 100ms per hash on serverless compute).
 *
 * Used for both the account password and the 4-digit PIN. Hashing the PIN
 * with bcrypt too — despite its tiny 4-digit keyspace — matters because it's
 * what makes the *hash* resistant to being reversed if the `users` table
 * ever leaks. It does nothing about the keyspace itself: with unlimited
 * attempts a PIN is brute-forceable in ~10k guesses. The login route below
 * rate-limits PIN attempts per account to close that gap.
 */
const SALT_ROUNDS = 12;

export function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, SALT_ROUNDS);
}

export function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}
