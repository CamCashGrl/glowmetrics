-- Track data validation failures post-import and live mode failures
-- Catches data quality issues and live session errors that user-facing validation might miss

-- 1. TIP VALIDATION FAILURES - tracks sanity check failures on imported tips
CREATE TABLE IF NOT EXISTS tip_validation_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tip_id BIGINT REFERENCES tips(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL, -- 'future_date', 'invalid_amount', 'duplicate', 'missing_username', 'platform_mismatch'
  reason TEXT, -- detailed reason
  tip_data JSONB, -- the invalid tip data {date_time, username, tokens, usd, platform}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tip_validation_user ON tip_validation_failures(user_id);
CREATE INDEX idx_tip_validation_type ON tip_validation_failures(validation_type);
CREATE INDEX idx_tip_validation_created ON tip_validation_failures(created_at DESC);

ALTER TABLE tip_validation_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_validation_failures" ON tip_validation_failures
  FOR SELECT USING (auth.uid() = user_id);

-- 2. LIVE MODE FAILURES - tracks errors during live session data collection/processing
CREATE TABLE IF NOT EXISTS live_mode_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  live_session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  failure_type TEXT NOT NULL, -- 'heartbeat_missing', 'data_fetch_error', 'parse_error', 'save_error', 'browser_detection_failed', 'extension_error'
  severity TEXT DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'critical')),
  error_message TEXT,
  error_context JSONB, -- {platform, session_status, last_heartbeat, extension_version, browser}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_failure_user ON live_mode_failures(user_id);
CREATE INDEX idx_live_failure_type ON live_mode_failures(failure_type);
CREATE INDEX idx_live_failure_severity ON live_mode_failures(severity);
CREATE INDEX idx_live_failure_session ON live_mode_failures(live_session_id);

ALTER TABLE live_mode_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_live_failures" ON live_mode_failures
  FOR SELECT USING (auth.uid() = user_id);

-- 3. VALIDATION HELPER FUNCTIONS

-- Check imported tips for data quality issues
CREATE OR REPLACE FUNCTION validate_imported_tips(p_user_id UUID, p_tip_ids BIGINT[] DEFAULT NULL)
RETURNS TABLE(
  violation_count INTEGER,
  violations TEXT[]
) AS $$
DECLARE
  v_violations TEXT[] := ARRAY[]::TEXT[];
  v_tip_count INTEGER := 0;
  v_future_dates INTEGER := 0;
  v_invalid_amounts INTEGER := 0;
  v_duplicates INTEGER := 0;
  v_missing_username INTEGER := 0;
BEGIN
  -- Count future dates (data sanity check)
  SELECT COUNT(*) INTO v_future_dates
  FROM tips
  WHERE user_id = p_user_id
    AND date_time > NOW()
    AND (p_tip_ids IS NULL OR id = ANY(p_tip_ids));

  IF v_future_dates > 0 THEN
    v_violations := array_append(v_violations, 'future_date:' || v_future_dates::text);
    INSERT INTO tip_validation_failures (user_id, tip_id, validation_type, reason, tip_data)
    SELECT p_user_id, id, 'future_date', 'Tip timestamp is in the future (data entry error)',
           to_jsonb(row(date_time, username, tokens, usd, platform))
    FROM tips
    WHERE user_id = p_user_id AND date_time > NOW() AND (p_tip_ids IS NULL OR id = ANY(p_tip_ids))
    LIMIT 100;
  END IF;

  -- Check for unrealistic token amounts (likely copy-paste errors)
  -- Reasonable range: 1 to 100,000 tokens per tip
  SELECT COUNT(*) INTO v_invalid_amounts
  FROM tips
  WHERE user_id = p_user_id
    AND (tokens < 1 OR tokens > 100000)
    AND (p_tip_ids IS NULL OR id = ANY(p_tip_ids));

  IF v_invalid_amounts > 0 THEN
    v_violations := array_append(v_violations, 'invalid_amount:' || v_invalid_amounts::text);
    INSERT INTO tip_validation_failures (user_id, tip_id, validation_type, reason, tip_data)
    SELECT p_user_id, id, 'invalid_amount', 'Token amount outside realistic range (1-100,000)',
           to_jsonb(row(date_time, username, tokens, usd, platform))
    FROM tips
    WHERE user_id = p_user_id AND (tokens < 1 OR tokens > 100000) AND (p_tip_ids IS NULL OR id = ANY(p_tip_ids))
    LIMIT 100;
  END IF;

  -- Check for missing usernames
  SELECT COUNT(*) INTO v_missing_username
  FROM tips
  WHERE user_id = p_user_id
    AND (username IS NULL OR username = '' OR username = 'anonymous')
    AND (p_tip_ids IS NULL OR id = ANY(p_tip_ids));

  IF v_missing_username > 0 THEN
    v_violations := array_append(v_violations, 'missing_username:' || v_missing_username::text);
  END IF;

  -- Check for near-duplicates (same username, same amount within 10 seconds = likely copy-paste)
  SELECT COUNT(*) INTO v_duplicates
  FROM tips t1
  WHERE t1.user_id = p_user_id
    AND (p_tip_ids IS NULL OR t1.id = ANY(p_tip_ids))
    AND EXISTS (
      SELECT 1 FROM tips t2
      WHERE t2.user_id = p_user_id
        AND t2.id != t1.id
        AND t2.username = t1.username
        AND t2.tokens = t1.tokens
        AND ABS(EXTRACT(EPOCH FROM (t2.date_time - t1.date_time))) <= 10
    );

  IF v_duplicates > 0 THEN
    v_violations := array_append(v_violations, 'potential_duplicate:' || v_duplicates::text);
  END IF;

  RETURN QUERY SELECT COALESCE(array_length(v_violations, 1), 0), v_violations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log live mode failure safely
CREATE OR REPLACE FUNCTION log_live_mode_failure(
  p_user_id UUID,
  p_live_session_id UUID DEFAULT NULL,
  p_failure_type TEXT DEFAULT 'unknown',
  p_severity TEXT DEFAULT 'error',
  p_error_message TEXT DEFAULT NULL,
  p_error_context JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO live_mode_failures (
    user_id, live_session_id, failure_type, severity, error_message, error_context
  ) VALUES (
    p_user_id, p_live_session_id, p_failure_type, p_severity, p_error_message, p_error_context
  )
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to log live mode failure: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
