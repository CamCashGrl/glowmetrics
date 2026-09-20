CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  page_url text,
  page_title text,
  user_agent text,
  referrer text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_insert_feedback"
  ON public.feedback FOR INSERT WITH CHECK (true);

CREATE POLICY "admin_can_read_feedback"
  ON public.feedback FOR SELECT
  USING (auth.jwt()->>'role' = 'admin');
