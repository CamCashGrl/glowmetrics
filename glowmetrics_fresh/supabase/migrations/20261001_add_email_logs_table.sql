-- Create email_logs table for tracking all email send attempts
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  resend_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX idx_email_logs_type_created ON email_logs(email_type, created_at DESC);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert/read for auditing
CREATE POLICY "Allow service role to manage email logs" ON email_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE email_logs IS 'Audit trail for all email send attempts via Resend API';
COMMENT ON COLUMN email_logs.email_type IS 'Type of email: daily_summary, trial_alerts, conversion_report, webhook_failures, email_failures';
COMMENT ON COLUMN email_logs.status IS 'Email status: pending (queued), sent (success), failed (error)';
