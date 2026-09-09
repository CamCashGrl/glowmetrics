-- CRITICAL FIX: Trial system data population and renewal pricing
-- Issue: Trial dates were never populated, causing no expiration tracking
-- Also: Need to store renewal pricing for post-trial conversion

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Add renewal pricing column to subscriptions
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS renewal_price_usd numeric(10,2),
ADD COLUMN IF NOT EXISTS renewal_billing_cycle text;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Update trigger to populate trial dates on signup
-- ══════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create profile record with trial dates populated
  INSERT INTO public.profiles (
    id,
    display_name,
    plan,
    trial_days,
    trial_ends_at
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email),
    'free',
    7,
    NOW() + INTERVAL '7 days'
  );

  -- Create subscription record with trial period
  INSERT INTO public.subscriptions (
    id,
    user_id,
    plan_type,
    billing_cycle,
    is_lifetime_locked,
    current_period_start,
    current_period_end,
    renewal_price_usd,
    renewal_billing_cycle,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    new.id,
    'free',
    NULL,
    false,
    NOW(),
    NOW() + INTERVAL '7 days',
    9.99,
    'monthly',
    NOW(),
    NOW()
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Create signup audit log table
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.signup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  signup_email_sent boolean DEFAULT false,
  signup_email_sent_at timestamptz,
  trial_notification_sent boolean DEFAULT false,
  trial_notification_sent_at timestamptz,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_signup_events_user_id ON public.signup_events(user_id);
CREATE INDEX idx_signup_events_email ON public.signup_events(email);
CREATE INDEX idx_signup_events_created_at ON public.signup_events(created_at DESC);

ALTER TABLE public.signup_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_signup"
  ON public.signup_events
  FOR SELECT
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Backfill trial dates for existing users
-- ══════════════════════════════════════════════════════════════════════════════

UPDATE public.profiles
SET
  trial_days = 7,
  trial_ends_at = COALESCE(trial_ends_at, created_at + INTERVAL '7 days')
WHERE trial_ends_at IS NULL
  AND plan = 'free';

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. Set renewal pricing for all free tier subscriptions
-- ══════════════════════════════════════════════════════════════════════════════

UPDATE public.subscriptions
SET
  renewal_price_usd = 9.99,
  renewal_billing_cycle = 'monthly'
WHERE plan_type = 'free'
  AND renewal_price_usd IS NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. Set renewal pricing for standard_monthly subscriptions
-- ══════════════════════════════════════════════════════════════════════════════

UPDATE public.subscriptions
SET
  renewal_price_usd = 9.99,
  renewal_billing_cycle = 'monthly'
WHERE plan_type = 'standard_monthly'
  AND renewal_price_usd IS NULL;
