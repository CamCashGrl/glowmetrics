-- Track all paste/upload parsing attempts to diagnose platform support and format issues
-- Captures raw input, format patterns, and error details for analysis
--
-- Use cases:
-- 1. Identify unsupported platforms users are trying to use
-- 2. Detect format issues vs parser bugs
-- 3. Improve error messages based on actual failure patterns

CREATE TABLE IF NOT EXISTS paste_parse_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('onboarding', 'dashboard')),
  attempted_platform TEXT, -- platform user selected or we detected
  claimed_platform TEXT, -- platform they explicitly chose (if different from detected)
  supported BOOLEAN, -- whether we support this platform
  raw_text TEXT, -- first 500 chars of paste/upload (avoids huge storage)
  line_count INTEGER,
  has_tabs BOOLEAN,
  has_commas BOOLEAN,
  top_shapes TEXT[], -- format patterns from error analysis
  parse_success BOOLEAN,
  error_reason TEXT, -- friendly error message
  error_details JSONB, -- internal diagnostic: {reason, line_count, distinct_shapes, etc}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_paste_parse_user ON paste_parse_attempts(user_id);
CREATE INDEX idx_paste_parse_platform ON paste_parse_attempts(attempted_platform);
CREATE INDEX idx_paste_parse_source ON paste_parse_attempts(source);
CREATE INDEX idx_paste_parse_supported ON paste_parse_attempts(supported);
CREATE INDEX idx_paste_parse_success ON paste_parse_attempts(parse_success);

ALTER TABLE paste_parse_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_paste_attempts" ON paste_parse_attempts
  FOR SELECT USING (auth.uid() = user_id);

-- Helper function to safely log paste attempts
CREATE OR REPLACE FUNCTION log_paste_parse_attempt(
  p_user_id UUID,
  p_source TEXT,
  p_attempted_platform TEXT,
  p_claimed_platform TEXT DEFAULT NULL,
  p_supported BOOLEAN DEFAULT FALSE,
  p_raw_text TEXT DEFAULT NULL,
  p_line_count INTEGER DEFAULT NULL,
  p_has_tabs BOOLEAN DEFAULT NULL,
  p_has_commas BOOLEAN DEFAULT NULL,
  p_top_shapes TEXT[] DEFAULT NULL,
  p_parse_success BOOLEAN DEFAULT FALSE,
  p_error_reason TEXT DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO paste_parse_attempts (
    user_id, source, attempted_platform, claimed_platform, supported,
    raw_text, line_count, has_tabs, has_commas, top_shapes,
    parse_success, error_reason, error_details
  ) VALUES (
    p_user_id, p_source, p_attempted_platform, p_claimed_platform, p_supported,
    p_raw_text, p_line_count, p_has_tabs, p_has_commas, p_top_shapes,
    p_parse_success, p_error_reason, p_error_details
  )
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to log paste attempt: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
