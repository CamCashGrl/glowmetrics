-- USER LIFECYCLE TRACKING - Comprehensive audit trail for all user account events
-- Tracks: subscription changes, account deletion, retention offers, surveys, payment events
-- Data is ALWAYS preserved even if account is deleted (soft delete only)

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Add soft-delete and lifecycle columns to profiles
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS account_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS subscription_start_at timestamptz,
ADD COLUMN IF NOT EXISTS subscription_stop_at timestamptz,
ADD COLUMN IF NOT EXISTS months_active integer DEFAULT 0;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. USER LIFECYCLE EVENTS - Track all subscription and account events
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'subscription_started',
    'subscription_upgraded',
    'subscription_downgraded',
    'subscription_renewal_upcoming',
    'subscription_renewed',
    'subscription_stopped',
    'subscription_canceled',
    'billing_cycle_changed',
    'payment_method_changed',
    'payment_failed',
    'payment_recovered',
    'retention_offer_shown',
    'retention_offer_accepted',
    'retention_offer_declined',
    'account_deletion_initiated',
    'account_deleted',
    'account_reactivated'
  )),
  old_value text,
  new_value text,
  reason text,
  properties jsonb DEFAULT '{}',
  stripe_event_id text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_user_lifecycle_user_id ON public.user_lifecycle_events(user_id);
CREATE INDEX idx_user_lifecycle_event_type ON public.user_lifecycle_events(event_type);
CREATE INDEX idx_user_lifecycle_created_at ON public.user_lifecycle_events(created_at DESC);
CREATE INDEX idx_user_lifecycle_stripe_event ON public.user_lifecycle_events(stripe_event_id);

ALTER TABLE public.user_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_lifecycle_events"
  ON public.user_lifecycle_events
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. USER EXIT SURVEYS - Track why users cancel or delete accounts
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_exit_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  survey_type text NOT NULL CHECK (survey_type IN ('subscription_cancel', 'account_deletion', 'account_downgrade')),
  reason text NOT NULL,
  details text,
  survey_answers jsonb DEFAULT '{}',
  user_email text,
  user_plan text,
  months_active integer,
  subscription_duration_days integer,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_exit_surveys_user_id ON public.user_exit_surveys(user_id);
CREATE INDEX idx_exit_surveys_survey_type ON public.user_exit_surveys(survey_type);
CREATE INDEX idx_exit_surveys_created_at ON public.user_exit_surveys(created_at DESC);

ALTER TABLE public.user_exit_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_exit_surveys"
  ON public.user_exit_surveys
  FOR SELECT
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. PAYMENT TRACKING - Track all payment events (cards, renewals, etc.)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'payment_succeeded',
    'payment_failed',
    'payment_retry',
    'card_updated',
    'card_deleted',
    'invoice_created',
    'invoice_sent',
    'invoice_paid',
    'invoice_failed'
  )),
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  amount_usd numeric,
  currency text DEFAULT 'USD',
  description text,
  properties jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_payment_events_user_id ON public.payment_events(user_id);
CREATE INDEX idx_payment_events_event_type ON public.payment_events(event_type);
CREATE INDEX idx_payment_events_created_at ON public.payment_events(created_at DESC);
CREATE INDEX idx_payment_events_stripe_invoice ON public.payment_events(stripe_invoice_id);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_payment_events"
  ON public.payment_events
  FOR SELECT
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. ACCOUNT DELETION ARCHIVE - Complete snapshot of deleted accounts
-- Preserved for compliance, analytics, and potential recovery
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.deleted_accounts_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  created_at_original timestamptz,
  deleted_at timestamptz DEFAULT NOW(),
  last_plan text,
  subscription_status_at_deletion text,
  months_active_at_deletion integer,
  total_lifetime_revenue_usd numeric,
  reason_for_deletion text,
  survey_answers jsonb,
  archived_profile_snapshot jsonb,
  archived_metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_deleted_accounts_user_id ON public.deleted_accounts_archive(user_id);
CREATE INDEX idx_deleted_accounts_email ON public.deleted_accounts_archive(email);
CREATE INDEX idx_deleted_accounts_deleted_at ON public.deleted_accounts_archive(deleted_at DESC);

ALTER TABLE public.deleted_accounts_archive ENABLE ROW LEVEL SECURITY;
