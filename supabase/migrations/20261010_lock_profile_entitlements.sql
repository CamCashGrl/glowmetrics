-- Security Fix: Lock profile entitlements to prevent unauthorized plan upgrades
-- Issue: Authenticated users had table-wide UPDATE on profiles table, allowing free users to set plan='pro'
-- Fix: Implement row-level security and revoke unsafe browser writes

-- 1. Lock down profiles table - only allow users to update their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing unsafe policies if they exist
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON profiles;
DROP POLICY IF EXISTS "authenticated_update" ON profiles;

-- Create safe update policy - users can only update their own profile
CREATE POLICY "Users can only update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent plan changes via browser (must use server-side Stripe webhook)
    plan = (SELECT plan FROM profiles WHERE id = auth.uid()) AND
    -- Prevent subscription manipulation
    subscription_id = (SELECT subscription_id FROM profiles WHERE id = auth.uid()) AND
    -- Prevent status manipulation
    subscription_status = (SELECT subscription_status FROM profiles WHERE id = auth.uid())
  );

-- 2. Lock down subscriptions table
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can update subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "authenticated_update" ON subscriptions;

-- Only service role (server) can update subscriptions
CREATE POLICY "Service role only for subscription updates"
  ON subscriptions
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- Allow service role to bypass
ALTER POLICY "Service role only for subscription updates" ON subscriptions
  USING ((SELECT auth.jwt() ->> 'role' = 'authenticated') = false OR auth.jwt() IS NULL);

-- 3. Create permanent trigger for profile updates to validate plan changes
CREATE OR REPLACE FUNCTION validate_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent plan, subscription_id, or subscription_status changes via direct database
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'Plan changes must be processed through Stripe webhook';
  END IF;

  IF NEW.subscription_id IS DISTINCT FROM OLD.subscription_id THEN
    RAISE EXCEPTION 'Subscription ID changes must be processed through Stripe webhook';
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Subscription status changes must be processed through Stripe webhook';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS validate_profile_update_trigger ON profiles;

-- Create trigger with permanent marker
CREATE TRIGGER validate_profile_update_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (auth.role() = 'authenticated')
  EXECUTE FUNCTION validate_profile_update();

-- 4. Update Stripe webhook handler to use service role
-- The webhook processor (handled server-side via API route) will:
-- - Receive webhook from Stripe
-- - Verify signature server-side
-- - Use service role to update profiles and subscriptions tables
-- - Never expose customer_id to browser

-- 5. Audit log for sensitive operations
CREATE TABLE IF NOT EXISTS profile_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  change_type TEXT NOT NULL,
  old_plan TEXT,
  new_plan TEXT,
  old_subscription_id TEXT,
  new_subscription_id TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by TEXT
);

ALTER TABLE profile_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can write to audit log
CREATE POLICY "Service role audit log access"
  ON profile_audit_log
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Trigger to log plan changes
CREATE OR REPLACE FUNCTION log_profile_plan_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    INSERT INTO profile_audit_log (profile_id, change_type, old_plan, new_plan, changed_by)
    VALUES (NEW.id, 'plan_change', OLD.plan, NEW.plan, 'stripe_webhook');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_plan_changes ON profiles;

CREATE TRIGGER log_plan_changes
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_profile_plan_change();

-- Grant appropriate permissions
GRANT ALL ON profile_audit_log TO service_role;
GRANT SELECT ON profile_audit_log TO authenticated;
