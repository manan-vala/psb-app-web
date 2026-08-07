-- Migration 005: Account approval status + session scope
--
-- Run this once against the Neon Postgres database used by this app (the same
-- DATABASE_URL as src/lib/db.ts). Safe to re-run.
--
-- Two independent changes, kept together because Scenario A needs both before
-- any of it works:
--
--   1. users.status  — registration is no longer instantly active. A new
--      account waits in an analyst approval queue before it can log in.
--   2. sessions.scope — a session can now mean less than "fully logged in".
--
-- See DEMO-IMPLEMENTATION-PLAN.md §1.1.

-- ── users.status ───────────────────────────────────────────────────────────
--
-- DEFAULT is 'ACTIVE', not 'PENDING_APPROVAL'.
--
-- This column has to backfill every row already in the table. Defaulting to
-- PENDING_APPROVAL would retroactively put every existing account — including
-- the one currently being used to demo the app, and the is_demo account the
-- /face-id-test console signs into — behind an approval queue that nothing has
-- ever inserted a request for. The login gate added in this phase rejects
-- anything that isn't ACTIVE, so those accounts would simply stop working with
-- no way to fix them short of another migration.
--
-- New registrations get PENDING_APPROVAL by writing it explicitly in
-- /api/auth/register, which is the only place that should ever mint one.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so re-runnability is done by
-- hand. Same pattern for every constraint below.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_status_check
      CHECK (status IN ('PENDING_APPROVAL','ACTIVE','REJECTED','SUSPENDED'));
  END IF;
END $$;

-- The analyst queue filters on status constantly; the app's own login path
-- looks it up on every attempt.
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- ── sessions.scope ─────────────────────────────────────────────────────────
--
-- Both new flows need a cookie that proves "we know who you are" without
-- granting access to the banking app:
--
--   LIMITED         — registered, waiting on approval. Can poll
--                     /api/onboarding/status and nothing else.
--   PENDING_DEVICE  — password was correct but this device isn't trusted yet.
--                     Can drive the /device-verify challenge and nothing else.
--   FULL            — ordinary authenticated session. Everything.
--
-- Without this the device-verification flow has no way to exist: a user on an
-- unrecognised device has passed the password check but has no session, and
-- the challenge endpoints have nothing to authenticate them by.
--
-- DEFAULT 'FULL' is correct for the backfill — every session row that exists
-- today was minted by register/login/pin-verify and is a real logged-in
-- session. It also means a route that forgets to specify a scope requirement
-- fails closed rather than open.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'FULL';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_scope_check'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_scope_check
      CHECK (scope IN ('LIMITED','PENDING_DEVICE','FULL'));
  END IF;
END $$;
