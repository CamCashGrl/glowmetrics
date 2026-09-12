-- EMERGENCY FIX: emmyfox2 Subscription Data Sync Failure
-- Date: Sept 12, 2026
-- Issue: Webhook never synced during checkout, trial end date was wrong
-- Impact: Payment charge happening today - subscription must be linked to Stripe
--
-- Root Cause: Stripe integration incomplete
-- - Stripe creates subscription with 7-day trial
-- - Our system never captures the subscription ID from Stripe response
-- - Webhooks either don't fire OR don't log/save the subscription ID
-- - Database showed "active" status without verifying Stripe record
--
-- User Details:
-- - Username: emmyfox2
-- - User ID: 40790ad4-9524-4aaa-9945-e23f6e540067
-- - Stripe Customer ID: cus_VCusx6yzXcUPvU
-- - Stripe Subscription ID: sub_1UCV3UGnNbF6OYVRAEmmK723
-- - Setup Intent: si_VCutPa3MVNugB8
-- - Tips Imported: 7,000
-- - Trial Ends: Sept 12, 2026 @ 6:59 PM UTC (TODAY)
-- - Revenue Risk: HIGH (major active customer)

BEGIN;

-- Fix 1: Update trial end date from Sept 13 to TODAY (Sept 12 @ 6:59 PM UTC)
-- This was off by ~18 hours in our database
UPDATE profiles
SET trial_ends_at = '2026-09-12 18:59:00+00'
WHERE id = '40790ad4-9524-4aaa-9945-e23f6e540067'
  AND display_name = 'emmyfox2';

-- Fix 2: Add missing Stripe subscription ID
-- This subscription exists in Stripe but was never captured in our DB
UPDATE subscriptions
SET stripe_subscription_id = 'sub_1UCV3UGnNbF6OYVRAEmmK723'
WHERE user_id = '40790ad4-9524-4aaa-9945-e23f6e540067';

-- Fix 3: Log this manual correction in audit trail
-- Important: Document WHY this manual fix was needed
INSERT INTO subscription_events (
  user_id,
  event_type,
  stripe_event_id,
  stripe_customer_id,
  stripe_subscription_id,
  previous_plan,
  new_plan,
  details
) VALUES (
  '40790ad4-9524-4aaa-9945-e23f6e540067',
  'manual_sync_correction',
  'manual_20260912_emmyfox2_emergency',
  'cus_VCusx6yzXcUPvU',
  'sub_1UCV3UGnNbF6OYVRAEmmK723',
  'pro',
  'pro',
  jsonb_build_object(
    'reason', 'EMERGENCY: Webhook sync failure - correcting before payment charge',
    'original_trial_ends', '2026-09-13 01:39:36+00',
    'corrected_trial_ends', '2026-09-12 18:59:00+00',
    'setup_intent', 'si_VCutPa3MVNugB8',
    'tips_imported', 7000,
    'charge_time_utc', '2026-09-12 18:59:00',
    'stripe_customer', 'cus_VCusx6yzXcUPvU',
    'stripe_subscription', 'sub_1UCV3UGnNbF6OYVRAEmmK723',
    'root_cause', 'Stripe integration incomplete - subscription ID never captured from checkout'
  )
);

COMMIT;

-- Verification: Confirm fixes were applied
-- SELECT * FROM profiles WHERE id = '40790ad4-9524-4aaa-9945-e23f6e540067';
-- SELECT * FROM subscriptions WHERE user_id = '40790ad4-9524-4aaa-9945-e23f6e540067';
-- SELECT * FROM subscription_events WHERE user_id = '40790ad4-9524-4aaa-9945-e23f6e540067' ORDER BY created_at DESC;
