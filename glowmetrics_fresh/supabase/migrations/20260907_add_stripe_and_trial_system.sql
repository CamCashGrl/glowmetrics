-- Add Stripe customer ID tracking and free trial system to profiles
-- This fixes critical data integrity issue where stripe_customer_id was created
-- but never persisted, breaking subscription tracking and cancellations.
--
-- TRIAL FLOW:
-- 1. User signs up → plan='free'
-- 2. User clicks "Upgrade" → Goes to checkout
-- 3. User enters card in checkout → Stripe creates subscription with trial_period_days=7
-- 4. Card is immediately on file but NOT charged yet
-- 5. After 7 days → Stripe automatically charges the card
-- 6. Webhook updates profile: plan='pro', subscription_status='active'
--
-- Stripe handles all trial logic; we track trial_ends_at from webhook data

-- 1. Add stripe_customer_id column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);

-- 2. Add trial tracking columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 7;

-- 3. Add subscription status tracking (for better webhook handling)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none'; -- none, trialing, active, past_due, canceled
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);

-- 4. Update handle_new_user trigger
-- Users start on free plan, upgrade to pro only after entering card in checkout
-- Stripe handles the 7-day trial with subscription_data.trial_period_days
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, plan, trial_days)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email),
    'free',  -- Start on free plan until they enter card
    7  -- Default trial length if they upgrade (configured in checkout)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to check if user is in valid trial period
CREATE OR REPLACE FUNCTION is_user_in_valid_trial(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  profile profiles;
BEGIN
  SELECT * INTO profile FROM profiles WHERE id = user_id;

  IF profile IS NULL THEN
    RETURN false;
  END IF;

  -- Valid trial if plan is 'pro' and trial_ends_at is in the future
  RETURN profile.plan = 'pro'
    AND profile.trial_ends_at IS NOT NULL
    AND profile.trial_ends_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Audit table for subscription events (for tracking and debugging)
CREATE TABLE IF NOT EXISTS subscription_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'checkout_created', 'subscription_started', 'subscription_updated', 'subscription_canceled', 'trial_ended'
  stripe_event_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  previous_plan TEXT,
  new_plan TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_events_user ON subscription_events(user_id);
CREATE INDEX idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX idx_subscription_events_customer ON subscription_events(stripe_customer_id);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_subscription_events" ON subscription_events
  FOR SELECT USING (auth.uid() = user_id);

-- 7. Helper function to safely log subscription events
CREATE OR REPLACE FUNCTION log_subscription_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_stripe_event_id TEXT DEFAULT NULL,
  p_customer_id TEXT DEFAULT NULL,
  p_subscription_id TEXT DEFAULT NULL,
  p_prev_plan TEXT DEFAULT NULL,
  p_new_plan TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO subscription_events (
    user_id, event_type, stripe_event_id, stripe_customer_id,
    stripe_subscription_id, previous_plan, new_plan, details
  ) VALUES (
    p_user_id, p_event_type, p_stripe_event_id, p_customer_id,
    p_subscription_id, p_prev_plan, p_new_plan, p_details
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to log subscription event: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Existing users on free plan will keep their current plan
-- This is backward compatible - only new signups get the trial
