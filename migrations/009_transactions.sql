-- Migration 009: Transaction history, for the spending baseline (Scenario C)
--
-- Run this once against the Neon Postgres database used by this app (the same
-- DATABASE_URL as src/lib/db.ts). Safe to re-run — the seed is skipped if the
-- user already has history.
--
-- Scenario C's high-value rule is "more than 100% above this customer's own
-- 30-day average". That needs an actual average, and the app has never stored a
-- transaction: BalanceContext is in-memory and transfers don't persist. So this
-- table exists to give the rule something true to compare against, and to let
-- the dashboard say "usual spend ₹2,600, this one ₹42,000" rather than an
-- unexplained "high value" label.

CREATE TABLE IF NOT EXISTS transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  payee         text NOT NULL,
  payee_account varchar(14),
  -- Marks rows written by a live demo run rather than seeded history, so the
  -- baseline can ignore them. Without this, demonstrating a ₹42,000 transfer
  -- twice would drag the average up and stop the rule firing the second time.
  is_demo_run   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_recent
  ON transactions (user_id, created_at DESC);

-- ── 30 days of ordinary spending for the two ACTIVE seeded users ───────────
--
-- 40 transactions each, spread randomly across the last 30 days, between ₹200
-- and ₹5,000. That puts the average around ₹2,600, so the ₹42,000 transfer the
-- demo makes is roughly 15x baseline — comfortably over the 2x threshold, and
-- obviously wrong to anyone looking at the screen.

INSERT INTO transactions (user_id, amount, payee, created_at)
SELECT
  u.id,
  (200 + random() * 4800)::numeric(12,2),
  (ARRAY[
    'Swiggy', 'BigBasket', 'Reliance Digital', 'Indian Oil', 'Croma',
    'Apollo Pharmacy', 'DMart', 'Uber', 'Airtel Postpaid', 'Zomato'
  ])[1 + floor(random() * 10)::int],
  now() - (random() * interval '30 days')
FROM users u
CROSS JOIN generate_series(1, 40)
WHERE u.id IN (
  'a0000000-0000-4000-8000-000000000782',  -- Sunita
  'a0000000-0000-4000-8000-000000000784'   -- Priya
)
AND NOT EXISTS (
  SELECT 1 FROM transactions t WHERE t.user_id = u.id
);
