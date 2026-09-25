-- Add retention email tracking columns to profiles table
-- Tracks when retention emails have been sent to prevent duplicates

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS platform_connected_email_sent_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS day3_email_sent_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS day7_email_sent_at TIMESTAMPTZ;

-- Create indexes for email sending queries
CREATE INDEX IF NOT EXISTS idx_profiles_welcome_email_sent ON profiles(welcome_email_sent_at)
  WHERE welcome_email_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_platform_email_sent ON profiles(platform_connected_email_sent_at)
  WHERE platform_connected_email_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_day3_email_sent ON profiles(day3_email_sent_at)
  WHERE day3_email_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_day7_email_sent ON profiles(day7_email_sent_at)
  WHERE day7_email_sent_at IS NULL;

-- Create indexes for retention email batch queries (by created_at)
CREATE INDEX IF NOT EXISTS idx_profiles_created_at_desc ON profiles(created_at DESC);
