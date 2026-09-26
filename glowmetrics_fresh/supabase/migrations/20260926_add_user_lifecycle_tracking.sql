-- Create user lifecycle tracking tables for subscription management

-- 1. User Lifecycle Events table
CREATE TABLE IF NOT EXISTS user_lifecycle_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type VARCHAR NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason VARCHAR,
  properties JSONB,
  stripe_event_id VARCHAR UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. User Exit Surveys table
CREATE TABLE IF NOT EXISTS user_exit_surveys (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  survey_type VARCHAR NOT NULL,
  reason VARCHAR,
  details TEXT,
  survey_answers JSONB,
  user_email VARCHAR,
  user_plan VARCHAR,
  months_active INTEGER,
  subscription_duration_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Payment Events table
CREATE TABLE IF NOT EXISTS payment_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_event_id VARCHAR UNIQUE,
  event_type VARCHAR NOT NULL,
  amount_cents BIGINT,
  currency VARCHAR DEFAULT 'usd',
  status VARCHAR,
  properties JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Deleted Accounts Archive table
CREATE TABLE IF NOT EXISTS deleted_accounts_archive (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  email VARCHAR,
  name VARCHAR,
  profile_snapshot JSONB NOT NULL,
  exit_survey JSONB,
  deletion_reason VARCHAR,
  ip_address VARCHAR,
  user_agent TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add columns to profiles table if they don't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_start_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_stop_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS months_active INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE user_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_exit_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_accounts_archive ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_lifecycle_events
CREATE POLICY "user_lifecycle_events_own" ON user_lifecycle_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_lifecycle_events_insert_own" ON user_lifecycle_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for user_exit_surveys
CREATE POLICY "user_exit_surveys_own" ON user_exit_surveys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_exit_surveys_insert_own" ON user_exit_surveys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for payment_events
CREATE POLICY "payment_events_own" ON payment_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "payment_events_insert_own" ON payment_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_lifecycle_events_user_id ON user_lifecycle_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lifecycle_events_event_type ON user_lifecycle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_exit_surveys_user_id ON user_exit_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON payment_events(user_id);
