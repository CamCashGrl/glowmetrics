-- COMPREHENSIVE ANALYTICS & MONITORING TABLES
-- Tracks all user activity, API calls, errors, and engagement metrics

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. ANALYTICS EVENTS - Universal event tracking (clicks, page views, etc.)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_category text,
  page_url text,
  referrer text,
  properties jsonb DEFAULT '{}',
  user_agent text,
  ip_address text,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_name ON public.analytics_events(event_name);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_category ON public.analytics_events(event_category);

-- Enable RLS on analytics_events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own events (for debugging)
CREATE POLICY "users_read_own_analytics"
  ON public.analytics_events
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. API CALL TRACKING - Monitor all API endpoints
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.api_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  method text NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  status_code integer,
  response_time_ms integer,
  error_message text,
  request_body jsonb,
  response_summary jsonb,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_api_calls_user_id ON public.api_calls(user_id);
CREATE INDEX idx_api_calls_endpoint ON public.api_calls(endpoint);
CREATE INDEX idx_api_calls_status ON public.api_calls(status_code);
CREATE INDEX idx_api_calls_created_at ON public.api_calls(created_at DESC);

ALTER TABLE public.api_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_api_calls"
  ON public.api_calls
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. TIP DATA TRACKING - Comprehensive tip analytics by model/platform
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tip_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipper_username text NOT NULL,
  amount_tokens integer NOT NULL,
  amount_usd numeric NOT NULL,
  platform text NOT NULL CHECK (platform IN ('chaturbate', 'bongacams', 'myfreecams', 'stripchat', 'camsoda', 'extension', 'manual')),
  tip_type text DEFAULT 'manual' CHECK (tip_type IN ('manual', 'group', 'private', 'spy', 'session', 'extension')),
  is_live boolean DEFAULT false,
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  device_type text,
  country text,
  created_at timestamptz DEFAULT NOW(),
  recorded_at timestamptz
);

CREATE INDEX idx_tip_analytics_user_id ON public.tip_analytics(user_id);
CREATE INDEX idx_tip_analytics_platform ON public.tip_analytics(platform);
CREATE INDEX idx_tip_analytics_created_at ON public.tip_analytics(created_at DESC);
CREATE INDEX idx_tip_analytics_live_session ON public.tip_analytics(live_session_id);
CREATE INDEX idx_tip_analytics_tipper ON public.tip_analytics(tipper_username);

ALTER TABLE public.tip_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_tips"
  ON public.tip_analytics
  FOR SELECT
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. FREE TRIAL TRACKING - Monitor trial signups and conversions
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.free_trial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('trial_offered', 'trial_started', 'trial_days_remaining', 'trial_expiring_soon', 'trial_expired', 'converted_to_paid', 'trial_abandoned')),
  trial_days_offered integer,
  trial_starts_at timestamptz,
  trial_expires_at timestamptz,
  converted_plan text,
  converted_at timestamptz,
  properties jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_free_trial_user_id ON public.free_trial_events(user_id);
CREATE INDEX idx_free_trial_event_type ON public.free_trial_events(event_type);
CREATE INDEX idx_free_trial_created_at ON public.free_trial_events(created_at DESC);

ALTER TABLE public.free_trial_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_trial_events"
  ON public.free_trial_events
  FOR SELECT
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. CHECKOUT TRACKING - Monitor payment processing and failures
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.checkout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text UNIQUE,
  status text NOT NULL CHECK (status IN ('initiated', 'in_progress', 'completed', 'abandoned', 'failed', 'error')),
  plan_type text,
  plan_price numeric,
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'annual')),
  stripe_session_id text,
  stripe_intent_id text,
  error_code text,
  error_message text,
  failure_reason text,
  properties jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  completed_at timestamptz
);

CREATE INDEX idx_checkout_user_id ON public.checkout_events(user_id);
CREATE INDEX idx_checkout_status ON public.checkout_events(status);
CREATE INDEX idx_checkout_stripe_session ON public.checkout_events(stripe_session_id);
CREATE INDEX idx_checkout_created_at ON public.checkout_events(created_at DESC);

ALTER TABLE public.checkout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_checkout"
  ON public.checkout_events
  FOR SELECT
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. CSV UPLOAD TRACKING - Monitor import success/failure
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.csv_upload_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upload_session_id uuid,
  filename text,
  platform text NOT NULL,
  status text NOT NULL CHECK (status IN ('validation_pending', 'validation_passed', 'validation_failed', 'import_in_progress', 'import_completed', 'import_failed', 'abandoned')),
  file_size_bytes integer,
  row_count integer,
  rows_validated integer,
  rows_imported integer,
  rows_rejected integer,
  error_code text,
  error_message text,
  validation_errors jsonb,
  import_duration_ms integer,
  properties jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  completed_at timestamptz
);

CREATE INDEX idx_csv_upload_user_id ON public.csv_upload_events(user_id);
CREATE INDEX idx_csv_upload_status ON public.csv_upload_events(status);
CREATE INDEX idx_csv_upload_platform ON public.csv_upload_events(platform);
CREATE INDEX idx_csv_upload_created_at ON public.csv_upload_events(created_at DESC);

ALTER TABLE public.csv_upload_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_csv_uploads"
  ON public.csv_upload_events
  FOR SELECT
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. USER ENGAGEMENT TRACKING - Monitor page views, scroll depth, time spent
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  page_path text NOT NULL,
  page_title text,
  session_id text,
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'scroll', 'click', 'input', 'focus', 'blur', 'page_exit')),
  scroll_depth_percent integer,
  time_on_page_seconds integer,
  element_selector text,
  element_text text,
  referrer text,
  device_type text,
  browser text,
  os text,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_engagement_user_id ON public.engagement_events(user_id);
CREATE INDEX idx_engagement_page_path ON public.engagement_events(page_path);
CREATE INDEX idx_engagement_session_id ON public.engagement_events(session_id);
CREATE INDEX idx_engagement_event_type ON public.engagement_events(event_type);
CREATE INDEX idx_engagement_created_at ON public.engagement_events(created_at DESC);

ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_engagement"
  ON public.engagement_events
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ══════════════════════════════════════════════════════════════════════════════
-- 8. CLICK TRACKING - Track every interaction with UI elements
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  page_path text NOT NULL,
  element_type text,
  element_id text,
  element_class text,
  element_selector text,
  button_text text,
  link_href text,
  section_name text,
  cta_name text,
  click_x integer,
  click_y integer,
  viewport_width integer,
  viewport_height integer,
  device_type text,
  session_id text,
  properties jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_click_events_user_id ON public.click_events(user_id);
CREATE INDEX idx_click_events_page_path ON public.click_events(page_path);
CREATE INDEX idx_click_events_element_id ON public.click_events(element_id);
CREATE INDEX idx_click_events_cta_name ON public.click_events(cta_name);
CREATE INDEX idx_click_events_created_at ON public.click_events(created_at DESC);

ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_clicks"
  ON public.click_events
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ══════════════════════════════════════════════════════════════════════════════
-- 9. ERROR TRACKING - Monitor all errors and exceptions
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_type text NOT NULL,
  error_message text,
  error_stack text,
  page_url text,
  endpoint text,
  http_status_code integer,
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source text CHECK (source IN ('client', 'server', 'api', 'database', 'external_service')),
  properties jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_error_events_user_id ON public.error_events(user_id);
CREATE INDEX idx_error_events_type ON public.error_events(error_type);
CREATE INDEX idx_error_events_severity ON public.error_events(severity);
CREATE INDEX idx_error_events_created_at ON public.error_events(created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- 10. SESSION TRACKING - Track user sessions for analytics
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text UNIQUE NOT NULL,
  device_type text,
  browser text,
  os text,
  ip_address text,
  country text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  pages_visited integer DEFAULT 0,
  total_time_seconds integer DEFAULT 0,
  bounce boolean DEFAULT false,
  conversion_occurred boolean DEFAULT false,
  started_at timestamptz DEFAULT NOW(),
  last_activity_at timestamptz DEFAULT NOW(),
  ended_at timestamptz
);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_id ON public.user_sessions(session_id);
CREATE INDEX idx_user_sessions_started_at ON public.user_sessions(started_at DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_sessions"
  ON public.user_sessions
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);
