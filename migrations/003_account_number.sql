-- Migration 003: Compulsory 14-digit account number on registration
--
-- Run this once against the Neon Postgres database used by this app (the
-- same DATABASE_URL as src/lib/db.ts). Replaces the "optional email at
-- registration" field with a required bank account number.
--
-- NOTE: this deletes all existing rows in `users` (cascading to
-- `sessions`/`face_enrollments`) before adding the NOT NULL column, since
-- there is no historical account number to backfill for accounts created
-- before this migration. Do not re-run against a database with real user
-- data without adjusting this.

DELETE FROM users;

ALTER TABLE users ADD COLUMN account_number varchar(14);

-- Exactly 14 digits, numeric only.
ALTER TABLE users
  ADD CONSTRAINT users_account_number_format CHECK (account_number ~ '^[0-9]{14}$');

ALTER TABLE users ALTER COLUMN account_number SET NOT NULL;

-- One user per account number, mirroring the mobile/email uniqueness rules.
ALTER TABLE users ADD CONSTRAINT users_account_number_key UNIQUE (account_number);

CREATE INDEX idx_users_account_number ON users (account_number);
