-- Migration 006: Onboarding queue, device binding, session risk events
--
-- Run this once against the Neon Postgres database used by this app (the same
-- DATABASE_URL as src/lib/db.ts). Safe to re-run.
--
-- Creates the tables behind all three demo scenarios. Scenario A (onboarding
-- approval) uses bank_accounts + onboarding_requests + user_devices and is
-- being built now; device_trust_challenges and session_events belong to
-- Scenarios B and C and are created here so the schema only has to be applied
-- once.
--
-- See DEMO-IMPLEMENTATION-PLAN.md §1.2.

-- ── Scenario A: core-banking reference ("what the passbook says") ──────────
--
-- Stands in for the bank's system of record. Deliberately NOT related to
-- `users` by a foreign key in either direction: the whole point of Scenario A
-- is that a person can claim an account number that doesn't exist here, or
-- exists with different details, and the analyst is the one who catches it.
CREATE TABLE IF NOT EXISTS bank_accounts (
  account_number  varchar(14) PRIMARY KEY
                  CHECK (account_number ~ '^[0-9]{14}$'),
  full_name       text        NOT NULL,
  mobile          varchar(15) NOT NULL,
  branch          text        NOT NULL,
  ifsc            varchar(11) NOT NULL,
  date_of_birth   date,
  is_active       boolean     NOT NULL DEFAULT true
);

-- ── Scenario A: the analyst's approval queue ───────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_number      varchar(14) NOT NULL,
  submitted_full_name text NOT NULL,
  submitted_mobile    varchar(15) NOT NULL,
  device_fingerprint  text,
  device_label        text,
  status              text NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  match_result        jsonb,       -- per-field verification outcome, for audit
  reviewed_by         text,
  reviewed_at         timestamptz,
  rejection_reason    text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_status
  ON onboarding_requests (status, created_at DESC);

-- One open request per user. Without this, hitting register twice puts two
-- PENDING rows in the analyst's queue for the same person. Partial, so the
-- historical APPROVED and REJECTED rows are still kept for the audit trail.
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_one_open_per_user
  ON onboarding_requests (user_id) WHERE status = 'PENDING';

-- ── Scenario B: which devices an account is bound to ───────────────────────
CREATE TABLE IF NOT EXISTS user_devices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint_hash text NOT NULL,
  label            text NOT NULL,          -- "Chrome on Windows"
  platform         text,
  user_agent       text,
  is_trusted       boolean NOT NULL DEFAULT false,
  trusted_at       timestamptz,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user
  ON user_devices (user_id, is_trusted);

-- ── Scenario B: new-device verification challenges ─────────────────────────
--
-- NOTE: nothing ever writes status = 'EXPIRED'. Neon's HTTP driver has no
-- background jobs and there is no cron, so expiry is evaluated lazily at read
-- time (status = 'PENDING' AND expires_at > now()), the same way
-- src/lib/session.ts already handles expired sessions. 'EXPIRED' exists only
-- for rows a read path chooses to tombstone on the way past.
CREATE TABLE IF NOT EXISTS device_trust_challenges (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_device_fingerprint text NOT NULL,
  new_device_label       text,
  target_device_id       uuid REFERENCES user_devices(id) ON DELETE CASCADE,
  code                   varchar(6) NOT NULL,
  status                 text NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING','VERIFIED','EXPIRED','FAILED')),
  attempts               integer NOT NULL DEFAULT 0,
  expires_at             timestamptz NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_target
  ON device_trust_challenges (target_device_id, status);

-- ── Scenario C: session risk events (feeds the dashboard) ──────────────────
--
-- user_id is ON DELETE SET NULL rather than CASCADE: the demo-reset endpoint
-- wipes users, and the risk history is more useful surviving that than
-- disappearing with it.
CREATE TABLE IF NOT EXISTS session_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id         text NOT NULL,
  device_fingerprint text,
  screen             text,
  risk_score         integer NOT NULL,
  action             text NOT NULL CHECK (action IN ('ALLOW','STEP_UP','BLOCK')),
  engines            jsonb,
  flags              jsonb,
  features           jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_events_session
  ON session_events (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_events_recent
  ON session_events (created_at DESC);
