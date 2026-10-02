-- Track all Stripe webhook events for audit trail and debugging
-- This is critical for detecting silent failures

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'user_resolution_failed', 'profile_update_failed', 'subscriptions_upsert_failed', 'signature_failed', 'handler_error', 'unhandled_event_type')),
  error_message TEXT,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_stripe_id ON public.webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_type ON public.webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON public.webhook_events(status);
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at DESC);
CREATE INDEX idx_webhook_events_failures ON public.webhook_events(created_at DESC) WHERE status != 'success';

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow read access for security reasons (audit trail)
CREATE POLICY "allow_admin_read_webhook_events"
  ON public.webhook_events
  FOR SELECT
  USING (true);

-- Create alert function: Check for recent webhook failures
CREATE OR REPLACE FUNCTION check_recent_webhook_failures(p_minutes INT DEFAULT 60)
RETURNS TABLE(
  failure_count INT,
  failures JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT as failure_count,
    jsonb_agg(jsonb_build_object(
      'event_id', stripe_event_id,
      'event_type', event_type,
      'status', status,
      'error_message', error_message,
      'created_at', created_at
    )) as failures
  FROM webhook_events
  WHERE status != 'success'
    AND created_at > NOW() - (p_minutes || ' minutes')::INTERVAL
  GROUP BY 1 = 1;
END;
$$ LANGUAGE plpgsql;

-- Create daily webhook failure report function
CREATE OR REPLACE FUNCTION webhook_daily_report()
RETURNS TABLE(
  total_events INT,
  successful INT,
  failed INT,
  failure_rate NUMERIC,
  failure_details JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as fail_count
    FROM webhook_events
    WHERE created_at >= DATE_TRUNC('day', NOW())
  ),
  failures AS (
    SELECT jsonb_agg(jsonb_build_object(
      'event_type', event_type,
      'status', status,
      'count', COUNT(*),
      'errors', jsonb_agg(DISTINCT error_message)
    )) as details
    FROM webhook_events
    WHERE status != 'success'
      AND created_at >= DATE_TRUNC('day', NOW())
    GROUP BY event_type, status
  )
  SELECT
    (SELECT total FROM daily_stats)::INT,
    (SELECT success_count FROM daily_stats)::INT,
    (SELECT fail_count FROM daily_stats)::INT,
    ROUND((SELECT fail_count::NUMERIC / NULLIF(total, 0) * 100 FROM daily_stats), 2),
    (SELECT details FROM failures)
  FROM daily_stats;
END;
$$ LANGUAGE plpgsql;
