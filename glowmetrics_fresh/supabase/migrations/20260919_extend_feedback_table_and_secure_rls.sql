-- Extends the existing public.feedback table (20260605_create_feedback_table.sql)
-- for the in-app feedback button/modal/contextual-popup feature.
-- Does not rename or drop any existing column.

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS sentiment text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS plan text;

-- Stable values only (never the raw emoji) — enforced at the DB layer as a
-- defense-in-depth backstop to the API's own zod validation.
ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_sentiment_check
    CHECK (sentiment IS NULL OR sentiment IN ('love_it', 'good', 'okay', 'frustrated', 'broken'));

ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_category_check
    CHECK (category IS NULL OR category IN (
      'bug', 'feature_request', 'confusing', 'performance', 'data_analytics', 'ui_design', 'other'
    ));

-- The previous "anyone_can_insert_feedback" policy allowed anonymous, unauthenticated
-- inserts with no ownership check at all. Feedback must now come from a signed-in
-- user, and the row's user_id must match the submitter's own auth uid — a user
-- can never insert a row claiming to be someone else.
DROP POLICY IF EXISTS "anyone_can_insert_feedback" ON public.feedback;

CREATE POLICY "authenticated_users_insert_own_feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- admin_can_read_feedback is untouched — admin read access is preserved as-is.
