-- CRITICAL SECURITY FIX: Add broadcaster account verification
-- Issue #285: Extension was capturing tips from ANY room, not just the authenticated creator's own room
-- This allows cross-creator tip theft while a Live Mode session is active

-- Add broadcaster identity columns to profiles for platform account verification
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS chaturbate_username text,
ADD COLUMN IF NOT EXISTS bongacams_username text,
ADD COLUMN IF NOT EXISTS myfreecams_username text;

-- Add constraint: at least one broadcaster username must be verified
-- (This allows users to stream on only one platform, which is the current use case)
ALTER TABLE public.profiles
ADD CONSTRAINT at_least_one_broadcaster_account CHECK (
  chaturbate_username IS NOT NULL OR
  bongacams_username IS NOT NULL OR
  myfreecams_username IS NOT NULL
);

-- Create a table to track broadcaster account verification
-- (For future multi-platform support or verification flows)
CREATE TABLE IF NOT EXISTS public.broadcaster_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('chaturbate', 'bongacams', 'myfreecams', 'stripchat', 'camsoda')),
  username text NOT NULL,
  verified_at timestamptz DEFAULT NOW(),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Enable RLS on broadcaster_accounts
ALTER TABLE public.broadcaster_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: users can only read their own broadcaster account records
CREATE POLICY "users_read_own_broadcaster_accounts"
  ON public.broadcaster_accounts
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: users can only insert/update their own broadcaster account records
CREATE POLICY "users_manage_own_broadcaster_accounts"
  ON public.broadcaster_accounts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_broadcaster_accounts"
  ON public.broadcaster_accounts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_broadcaster_accounts_user_id ON public.broadcaster_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcaster_accounts_platform_username ON public.broadcaster_accounts(platform, username);
