-- Migration 007: Demo seed data
--
-- Run this once against the Neon Postgres database used by this app (the same
-- DATABASE_URL as src/lib/db.ts). Safe to re-run — every insert is
-- ON CONFLICT DO NOTHING against a fixed UUID.
--
-- Two layers:
--
--   Layer 1  bank_accounts — the core-banking reference the analyst verifies
--            a walk-up registration against.
--   Layer 2  pre-existing users, devices and onboarding rows, so that no
--            screen is empty on first load and Scenario B (device binding) can
--            be demonstrated without running Scenario A first.
--
-- Every seeded user shares one password, Demo@1234, and one PIN, 1234, so the
-- presenter never has to remember which account is which. The bcrypt hashes
-- below are written literally rather than computed, because SQL has no bcrypt.
--
-- See DEMO-IMPLEMENTATION-PLAN.md §1.3.

-- ═══════════════════════════════════════════════════════════════════════════
-- Layer 1 — core banking reference
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 781 is the clean happy path. 783 is the one a walk-up registers against
-- under the wrong name, so the verification form fails and the analyst
-- rejects. 788 is closed (is_active = false) — a second failure mode to reach
-- for if the happy path gets pushed on.

INSERT INTO bank_accounts
  (account_number, full_name, mobile, branch, ifsc, date_of_birth, is_active)
VALUES
  ('10250043100781', 'Ramesh Kumar Patel', '9825012345', 'Ahmedabad - Navrangpura', 'BARB0NAVRAN', '1985-03-14', true),
  ('10250043100782', 'Sunita Ramesh Patel', '9825067890', 'Ahmedabad - Navrangpura', 'BARB0NAVRAN', '1988-11-02', true),
  ('10250043100783', 'Arjun Mehta',        '9825055512', 'Surat - Ring Road',       'BARB0RINGRD', '1992-07-21', true),
  ('10250043100784', 'Priya Nair',         '9825033344', 'Vadodara - Alkapuri',     'BARB0ALKAPU', '1990-01-30', true),
  ('10250043100785', 'Imran Shaikh',       '9825099001', 'Rajkot - Kalawad Rd',     'BARB0KALAWD', '1983-09-09', true),
  ('10250043100786', 'Kavita Deshmukh',    '9825077220', 'Ahmedabad - Bodakdev',    'BARB0BODAKD', '1995-05-17', true),
  ('10250043100787', 'Faisal Qureshi',     '9825044118', 'Bharuch - Station Rd',    'BARB0BHARUC', '1987-12-05', true),
  ('10250043100788', 'Neha Trivedi',       '9825088934', 'Gandhinagar - Sector 11', 'BARB0GANDHI', '1993-04-25', false)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- Layer 2 — pre-existing app users
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fixed UUIDs, so re-running is a no-op and so the Phase 1 demo-reset endpoint
-- can restore exactly this state rather than an approximation.
--
--   ...782 Sunita  ACTIVE            2 trusted devices  → Scenario B, multi-device picker
--   ...784 Priya   ACTIVE            1 trusted device   → Scenario B, single-option picker
--   ...785 Imran   PENDING_APPROVAL  1 untrusted device → analyst queue has a row on load
--   ...786 Kavita  REJECTED          1 untrusted device → /registration-rejected has real data
--
-- Only the ACTIVE users carry a pin_hash. The other two never got far enough
-- through onboarding to set one, which is what the real flow would produce.

INSERT INTO users
  (id, full_name, mobile, account_number, password_hash, pin_hash, status)
VALUES
  ('a0000000-0000-4000-8000-000000000782', 'Sunita Ramesh Patel', '9825067890', '10250043100782',
   '$2a$12$6JWG4uiPyaMvFWLCReQYoOpADaKgezC8lhCYIhHZ1fz6fpXABMz6i',
   '$2a$12$okvesGtClzXWbAToQ.XvgOmlSUQzedM0N83cbiTbb/HCNGosmusUm', 'ACTIVE'),

  ('a0000000-0000-4000-8000-000000000784', 'Priya Nair', '9825033344', '10250043100784',
   '$2a$12$6JWG4uiPyaMvFWLCReQYoOpADaKgezC8lhCYIhHZ1fz6fpXABMz6i',
   '$2a$12$okvesGtClzXWbAToQ.XvgOmlSUQzedM0N83cbiTbb/HCNGosmusUm', 'ACTIVE'),

  ('a0000000-0000-4000-8000-000000000785', 'Imran Shaikh', '9825099001', '10250043100785',
   '$2a$12$6JWG4uiPyaMvFWLCReQYoOpADaKgezC8lhCYIhHZ1fz6fpXABMz6i',
   NULL, 'PENDING_APPROVAL'),

  ('a0000000-0000-4000-8000-000000000786', 'Kavita Deshmukh', '9825077220', '10250043100786',
   '$2a$12$6JWG4uiPyaMvFWLCReQYoOpADaKgezC8lhCYIhHZ1fz6fpXABMz6i',
   NULL, 'REJECTED')
ON CONFLICT DO NOTHING;

-- ── Bound devices ──────────────────────────────────────────────────────────
--
-- These fingerprints are fabricated and will NOT match any real browser — that
-- is the point. When the presenter logs in as Sunita from an actual browser,
-- that browser is by definition an unrecognised device, which is exactly the
-- state Scenario B needs to start from. Nothing has to be un-trusted by hand
-- first.
--
-- last_seen_at is staggered so the trusted-device picker has something
-- meaningful to render ("last used 2 days ago").

INSERT INTO user_devices
  (id, user_id, fingerprint_hash, label, platform, is_trusted, trusted_at, last_seen_at)
VALUES
  -- Sunita: two trusted devices, so the picker in /device-verify has a choice
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000782',
   'seed-fp-sunita-windows-chrome', 'Chrome on Windows', 'Windows',
   true, now() - interval '40 days', now() - interval '2 days'),

  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000782',
   'seed-fp-sunita-iphone-safari', 'Safari on iPhone', 'iOS',
   true, now() - interval '18 days', now() - interval '6 hours'),

  -- Priya: exactly one trusted device — the single-option case
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000784',
   'seed-fp-priya-windows-chrome', 'Chrome on Windows', 'Windows',
   true, now() - interval '9 days', now() - interval '1 day'),

  -- Imran: enrolled but never approved, so never trusted
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000785',
   'seed-fp-imran-windows-edge', 'Edge on Windows', 'Windows',
   false, NULL, now() - interval '25 minutes'),

  -- Kavita: rejected, device stays untrusted
  ('d0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000786',
   'seed-fp-kavita-android-chrome', 'Chrome on Android', 'Android',
   false, NULL, now() - interval '3 days')
ON CONFLICT DO NOTHING;

-- ── Onboarding history ─────────────────────────────────────────────────────
--
-- The two APPROVED rows give the queue's history filter something to show and
-- make the seeded ACTIVE accounts look like they went through the same door
-- everyone else does. The PENDING row means the analyst queue is populated the
-- instant the dashboard is opened, before anyone registers anything.

INSERT INTO onboarding_requests
  (id, user_id, account_number, submitted_full_name, submitted_mobile,
   device_fingerprint, device_label, status, match_result, reviewed_by,
   reviewed_at, rejection_reason, created_at)
VALUES
  ('b0000000-0000-4000-8000-000000000782', 'a0000000-0000-4000-8000-000000000782',
   '10250043100782', 'Sunita Ramesh Patel', '9825067890',
   'seed-fp-sunita-windows-chrome', 'Chrome on Windows', 'APPROVED',
   jsonb_build_object(
     'coreRecordExists', true,
     'accountActive', true,
     'fields', jsonb_build_object(
       'accountNumber', true, 'fullName', true, 'mobile', true, 'branch', true),
     'allMatch', true,
     'checkedAt', to_char(now() - interval '40 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
   'A. Kumar', now() - interval '40 days', NULL, now() - interval '40 days'),

  ('b0000000-0000-4000-8000-000000000784', 'a0000000-0000-4000-8000-000000000784',
   '10250043100784', 'Priya Nair', '9825033344',
   'seed-fp-priya-windows-chrome', 'Chrome on Windows', 'APPROVED',
   jsonb_build_object(
     'coreRecordExists', true,
     'accountActive', true,
     'fields', jsonb_build_object(
       'accountNumber', true, 'fullName', true, 'mobile', true, 'branch', true),
     'allMatch', true,
     'checkedAt', to_char(now() - interval '9 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
   'A. Kumar', now() - interval '9 days', NULL, now() - interval '9 days'),

  ('b0000000-0000-4000-8000-000000000785', 'a0000000-0000-4000-8000-000000000785',
   '10250043100785', 'Imran Shaikh', '9825099001',
   'seed-fp-imran-windows-edge', 'Edge on Windows', 'PENDING',
   NULL, NULL, NULL, NULL, now() - interval '25 minutes'),

  ('b0000000-0000-4000-8000-000000000786', 'a0000000-0000-4000-8000-000000000786',
   '10250043100786', 'Kavita Deshmukh', '9825077220',
   'seed-fp-kavita-android-chrome', 'Chrome on Android', 'REJECTED',
   jsonb_build_object(
     'coreRecordExists', true,
     'accountActive', true,
     'fields', jsonb_build_object(
       'accountNumber', true, 'fullName', false, 'mobile', true, 'branch', true),
     'allMatch', false,
     'checkedAt', to_char(now() - interval '3 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
   'A. Kumar', now() - interval '3 days',
   'Name does not match branch records', now() - interval '3 days')
ON CONFLICT DO NOTHING;
