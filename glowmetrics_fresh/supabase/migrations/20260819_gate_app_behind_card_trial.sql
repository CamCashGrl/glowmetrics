-- Adds profiles.trial_ends_at: a mirror of the Stripe subscription's
-- trial_end, written by the Stripe webhook on subscription created/updated.
-- Display only (the trial countdown in the dashboard); Pro access is decided
-- by plan/plan_expires_at, so a stale value here can never unlock anything.
--
-- This migration is REQUIRED for payments to work at all. The webhook writes
-- trial_ends_at on every subscription event; without the column that UPDATE
-- fails, updateProfile() returns false, the webhook 500s, and a creator who
-- paid successfully is never upgraded to Pro. Applied to production on
-- 2026-08-20 after exactly that was found blocking a live checkout test.
--
-- ─────────────────────────────────────────────────────────────────────────
-- REMOVED: grandfathering UPDATE. Do not restore it.
--
-- This file originally also ran:
--
--     UPDATE profiles SET plan = 'legacy', plan_expires_at = NULL
--      WHERE plan IS NULL OR plan = 'free'
--         OR (plan_expires_at IS NOT NULL AND plan_expires_at <= now());
--
-- That belonged to the hard-gate model, where every account without a
-- subscription was redirected to /start-trial and locked out of its own
-- dashboard; promoting existing users to a 'legacy' plan was what kept them
-- from being locked out on launch day.
--
-- That model was reversed the same week (PRs #418, #419): CamCash is
-- freemium again, Free is a genuinely useful product, and nobody is gated out
-- of their own data. There is now nothing to grandfather anyone against —
-- and running the statement would set ~134 existing free accounts to a plan
-- that lib/plan.js counts as full Pro access, permanently, with no expiry.
-- It would delete the paid tier for every user who already has an account.
--
-- The statement was never applied to production. It is documented here
-- rather than deleted silently so that this file's history stays legible and
-- nobody reintroduces it from an older copy of the branch.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.trial_ends_at IS
  'Mirror of the Stripe subscription trial_end, written by the Stripe webhook. Display only — Pro access is decided by plan/plan_expires_at.';
