-- Gate CamCash behind a card-backed free trial.
--
-- Replaces the per-feature paywall model (free tier with locked cards) with a
-- single access gate: to use the dashboard you need an active Stripe
-- subscription OR an active Stripe trial (card on file). New signups start a
-- 7-day trial from /start-trial after onboarding.
--
-- Two things this migration establishes:
--
-- 1. profiles.trial_ends_at — mirror of the Stripe subscription's trial_end,
--    written by the Stripe webhook. Display only (trial countdown UI); access
--    itself still follows `plan`, which the webhook flips to 'pro' for
--    status='trialing' and back to 'free' when the trial lapses unpaid. We
--    never grant access from this column, so a stale value can't unlock
--    anything.
--
-- 2. Grandfathering. Everyone who already had an account before the gate
--    shipped keeps full access with no card. The existing server-side Pro
--    gates (check_free_tier_platform_limit, the Live Mode gate,
--    get_user_insights) all test `plan <> 'free'` rather than an allowlist,
--    so moving these users to plan='legacy' grants them full access through
--    every existing gate without touching a single one of those functions.
--    plan_expires_at is left NULL so the access never lapses.
--
--    plan='legacy' is deliberately distinct from 'pro': it keeps
--    "grandfathered, never paid" separable from real subscribers in revenue
--    reporting. lib/plan.js counts it as full access (PRO_PLANS).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.trial_ends_at IS
  'Mirror of the Stripe subscription trial_end, written by the Stripe webhook. Display only — access is decided by plan/plan_expires_at.';

-- Grandfather every account that exists at the moment the gate ships: free
-- users, and users whose time-limited promo grant has already lapsed. Anyone
-- with currently-active paid access (pro/unlimited, or an unexpired promo
-- grant) is left exactly as-is.
UPDATE profiles
   SET plan = 'legacy',
       plan_expires_at = NULL
 WHERE plan IS NULL
    OR plan = 'free'
    OR (plan_expires_at IS NOT NULL AND plan_expires_at <= now());
