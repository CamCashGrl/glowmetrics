-- Add trial feature and onboarding tracking to profiles
-- Enables 7-day pro trial on signup + getting started modal on first visit

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_dashboard_visit_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS getting_started_dismissed_at TIMESTAMPTZ;

-- Create function to check if user's trial is still active
CREATE OR REPLACE FUNCTION is_trial_active(trial_starts TIMESTAMPTZ, trial_ends TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
  IF trial_starts IS NULL OR trial_ends IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN NOW() >= trial_starts AND NOW() < trial_ends;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create index for finding users with active trials
CREATE INDEX IF NOT EXISTS idx_profiles_trial_active ON profiles(trial_ends)
  WHERE trial_starts IS NOT NULL AND trial_ends IS NOT NULL AND trial_ends > NOW();

-- Create index for tracking first dashboard visits
CREATE INDEX IF NOT EXISTS idx_profiles_first_dashboard_visit ON profiles(first_dashboard_visit_at)
  WHERE first_dashboard_visit_at IS NULL;
