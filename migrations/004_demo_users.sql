-- Migration 004: Demo accounts for the /face-id-test diagnostics console
--
-- Run this once against the Neon Postgres database used by this app (the
-- same DATABASE_URL as src/lib/db.ts). Safe to re-run.
--
-- The console needs an active session to exercise /api/face/enroll and
-- /api/face/verify, but making a tester register an account first defeats the
-- point of a diagnostics page. `is_demo` marks accounts created by that
-- auto-sign-in path so they can be told apart from real ones at every point
-- that matters:
--
--   * /api/demo/session/end will only ever destroy a session whose user is
--     is_demo — so leaving the console can never sign out a real customer who
--     happened to already be logged in.
--   * A demo account's face enrollment lives under its own user_id, so it
--     cannot collide with or overwrite a real user's stored template.
--
-- The column is NOT NULL DEFAULT false, so every pre-existing row and every
-- account created through the normal /register flow is correctly a non-demo
-- account without a backfill.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Partial index: the demo lookup is "find the demo account", which touches a
-- single row out of the table. Indexing only WHERE is_demo keeps the index
-- tiny rather than covering every real user for a flag that's false on all of
-- them.
CREATE INDEX IF NOT EXISTS idx_users_is_demo ON users (is_demo) WHERE is_demo;
