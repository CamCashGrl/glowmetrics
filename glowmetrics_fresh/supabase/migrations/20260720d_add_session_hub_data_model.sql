-- CamCash Session Hub — Phase 1: data model only.
--
-- Builds the tables needed to (a) separate uploaded/inferred sessions from
-- verified Live Mode sessions, (b) let a user correct an inaccurate Live
-- Mode session's timing without ever losing the original recorded values,
-- (c) store coaching prompts + optional Performed/Skipped responses, (d)
-- capture the raw before/after activity windows around each prompt for
-- later effectiveness analysis, and (e) flag session data quality for
-- future comparison eligibility.
--
-- Deliberately NOT built here (per spec): any UI, any API route, any
-- earnings-impact/effectiveness conclusion, any Streaming Planner
-- recommendation. This migration only stores clean data.
--
-- Entirely additive: no existing table is altered except live_sessions,
-- which only gains one new nullable/defaulted column
-- (duration_confidence). Nothing existing is renamed, dropped, or
-- repurposed.

-- ── live_sessions: duration confidence label ─────────────────────────────
-- 'verified'       — untouched Live Mode session, engine-tracked start/end.
-- 'user_confirmed' — user has corrected the timing via session_time_corrections.
-- 'estimated'      — reserved for future use (e.g. a session ended by the
--                    auto-resolve sweep with no explicit user confirmation).
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS duration_confidence text NOT NULL DEFAULT 'verified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_duration_confidence_check'
  ) THEN
    ALTER TABLE public.live_sessions
      ADD CONSTRAINT live_sessions_duration_confidence_check
      CHECK (duration_confidence IN ('verified', 'user_confirmed', 'estimated'));
  END IF;
END $$;

-- ── session_time_corrections ──────────────────────────────────────────────
-- One row per correction made. The original timestamps a session started
-- with are never overwritten in live_sessions itself — this table is the
-- append-only record of what was originally recorded vs. what the user
-- corrected it to. live_sessions.started_at/ended_at/paused-accounting are
-- updated to the corrected values by the (Phase 2) correction endpoint, but
-- original_started_at/original_ended_at here always preserve what was true
-- before that user ever touched it.
CREATE TABLE IF NOT EXISTS public.session_time_corrections (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                uuid NOT NULL REFERENCES public.live_sessions(id),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  original_started_at       timestamptz NOT NULL,
  original_ended_at         timestamptz,

  corrected_started_at      timestamptz NOT NULL,
  corrected_ended_at        timestamptz NOT NULL,
  -- Array of { started_at, ended_at } objects, mirroring SessionPause shape.
  corrected_pause_intervals jsonb NOT NULL DEFAULT '[]'::jsonb,
  corrected_platform        text,
  corrected_completed       boolean NOT NULL DEFAULT true,

  corrected_by_user         boolean NOT NULL DEFAULT true,
  corrected_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_time_corrections_session_id_idx
  ON public.session_time_corrections(session_id);

ALTER TABLE public.session_time_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_time_corrections_select_own ON public.session_time_corrections;
CREATE POLICY session_time_corrections_select_own ON public.session_time_corrections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS session_time_corrections_insert_own ON public.session_time_corrections;
CREATE POLICY session_time_corrections_insert_own ON public.session_time_corrections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.session_time_corrections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_time_corrections TO service_role;

-- ── coaching_events ────────────────────────────────────────────────────────
-- Every coaching prompt shown during a session, with its optional
-- Performed/Skipped response folded in directly (action_status/
-- action_responded_at) — a prompt has exactly one current response, and
-- "may change later" just means updating these two fields again. Defaults
-- to 'unmarked'; never auto-set to 'skipped' by anything (see spec: no
-- response must ever be treated as skipped).
CREATE TABLE IF NOT EXISTS public.coaching_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            uuid NOT NULL REFERENCES public.live_sessions(id),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  type                  text NOT NULL,
  category              text NOT NULL CHECK (category IN (
    'supporter_engagement', 'new_supporter', 'returning_supporter',
    'goal_momentum', 'room_recovery', 'pace_management',
    'retention', 'session_timing', 'stream_ending'
  )),
  priority              integer NOT NULL DEFAULT 0,
  dedupe_key            text NOT NULL,

  title                 text NOT NULL,
  message               text NOT NULL,
  compact_message       text NOT NULL,

  related_tip_id        uuid REFERENCES public.live_tips(id),
  related_tipper_id      text,
  related_tipper_name   text,
  related_amount_usd    numeric,

  created_at            timestamptz NOT NULL DEFAULT now(),
  shown_at              timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz,
  dismissed_at          timestamptz,

  action_status         text NOT NULL DEFAULT 'unmarked'
                          CHECK (action_status IN ('unmarked', 'performed', 'skipped')),
  action_responded_at    timestamptz
);

CREATE INDEX IF NOT EXISTS coaching_events_session_id_idx ON public.coaching_events(session_id);
CREATE INDEX IF NOT EXISTS coaching_events_user_id_shown_at_idx ON public.coaching_events(user_id, shown_at DESC);

ALTER TABLE public.coaching_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coaching_events_select_own ON public.coaching_events;
CREATE POLICY coaching_events_select_own ON public.coaching_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS coaching_events_insert_own ON public.coaching_events;
CREATE POLICY coaching_events_insert_own ON public.coaching_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS coaching_events_update_own ON public.coaching_events;
CREATE POLICY coaching_events_update_own ON public.coaching_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.coaching_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaching_events TO service_role;

-- ── coaching_prompt_outcomes ───────────────────────────────────────────────
-- Raw before/after activity windows around each shown prompt. Stored for
-- later effectiveness analysis — nothing here is displayed as a conclusion
-- yet. One row per coaching event (1:1).
CREATE TABLE IF NOT EXISTS public.coaching_prompt_outcomes (
  coaching_event_id                uuid PRIMARY KEY REFERENCES public.coaching_events(id),
  session_id                       uuid NOT NULL REFERENCES public.live_sessions(id),
  user_id                          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  action_status                    text NOT NULL CHECK (action_status IN ('unmarked', 'performed', 'skipped')),
  prompt_shown_at                  timestamptz NOT NULL,

  earnings_before_5m                numeric NOT NULL DEFAULT 0,
  earnings_after_5m                 numeric NOT NULL DEFAULT 0,
  earnings_after_10m                 numeric NOT NULL DEFAULT 0,
  earnings_after_20m                 numeric NOT NULL DEFAULT 0,

  tips_before_5m                    integer NOT NULL DEFAULT 0,
  tips_after_5m                     integer NOT NULL DEFAULT 0,
  tips_after_10m                    integer NOT NULL DEFAULT 0,
  tips_after_20m                    integer NOT NULL DEFAULT 0,

  unique_tippers_before_5m          integer NOT NULL DEFAULT 0,
  unique_tippers_after_5m           integer NOT NULL DEFAULT 0,
  unique_tippers_after_10m          integer NOT NULL DEFAULT 0,
  unique_tippers_after_20m          integer NOT NULL DEFAULT 0,

  related_supporter_tipped_again_5m  boolean,
  related_supporter_tipped_again_10m boolean,

  pace_before_prompt                numeric,
  pace_after_10m                    numeric,

  captured_at                       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coaching_prompt_outcomes_session_id_idx
  ON public.coaching_prompt_outcomes(session_id);

ALTER TABLE public.coaching_prompt_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coaching_prompt_outcomes_select_own ON public.coaching_prompt_outcomes;
CREATE POLICY coaching_prompt_outcomes_select_own ON public.coaching_prompt_outcomes
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON public.coaching_prompt_outcomes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaching_prompt_outcomes TO service_role;

-- ── live_session_analysis_context ──────────────────────────────────────────
-- One row per session, capturing everything needed for future matched
-- comparisons (peak-window fit, goal usage, coaching counts) without
-- computing or displaying any conclusion now. Some fields (streaming plan
-- window, recommended-window fit) stay false/null until those separate
-- features exist — kept here now specifically to avoid a later migration
-- that would lose the ability to backfill comparison data.
CREATE TABLE IF NOT EXISTS public.live_session_analysis_context (
  session_id                          uuid PRIMARY KEY REFERENCES public.live_sessions(id),
  user_id                             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform                            text NOT NULL,

  started_at                          timestamptz NOT NULL,
  ended_at                            timestamptz,

  day_of_week                         integer NOT NULL,
  start_hour_local                    integer NOT NULL,
  timezone                            text NOT NULL,

  active_duration_minutes             numeric NOT NULL DEFAULT 0,
  paused_duration_minutes             numeric NOT NULL DEFAULT 0,

  total_earnings_usd                  numeric NOT NULL DEFAULT 0,
  total_tokens                        integer NOT NULL DEFAULT 0,
  tip_count                           integer NOT NULL DEFAULT 0,
  unique_tipper_count                 integer NOT NULL DEFAULT 0,

  actual_hourly_rate                  numeric,

  coaching_enabled                    boolean NOT NULL DEFAULT false,
  coaching_prompt_count               integer NOT NULL DEFAULT 0,
  performed_prompt_count              integer NOT NULL DEFAULT 0,
  skipped_prompt_count                integer NOT NULL DEFAULT 0,
  unmarked_prompt_count               integer NOT NULL DEFAULT 0,

  goal_used                           boolean NOT NULL DEFAULT false,
  streaming_plan_window_id            text,
  started_from_streaming_plan         boolean NOT NULL DEFAULT false,
  started_inside_recommended_window   boolean NOT NULL DEFAULT false,

  duration_confidence                 text NOT NULL DEFAULT 'verified'
    CHECK (duration_confidence IN ('verified', 'user_confirmed', 'estimated')),

  computed_at                          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_session_analysis_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_session_analysis_context_select_own ON public.live_session_analysis_context;
CREATE POLICY live_session_analysis_context_select_own ON public.live_session_analysis_context
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON public.live_session_analysis_context TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_session_analysis_context TO service_role;

-- ── feature_usage_events ───────────────────────────────────────────────────
-- Lightweight event log for future feature-adoption analysis. Never the
-- source of truth for earnings or tips — those always come from live_tips.
CREATE TABLE IF NOT EXISTS public.feature_usage_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    uuid REFERENCES public.live_sessions(id),

  feature       text NOT NULL CHECK (feature IN (
    'live_mode', 'coaching', 'coaching_action', 'session_correction',
    'pause_resume', 'goal_tracker', 'streaming_plan', 'peak_window'
  )),
  action        text NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,

  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_usage_events_user_id_occurred_at_idx
  ON public.feature_usage_events(user_id, occurred_at DESC);

ALTER TABLE public.feature_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_usage_events_select_own ON public.feature_usage_events;
CREATE POLICY feature_usage_events_select_own ON public.feature_usage_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS feature_usage_events_insert_own ON public.feature_usage_events;
CREATE POLICY feature_usage_events_insert_own ON public.feature_usage_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.feature_usage_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_usage_events TO service_role;

-- ── session_data_quality ───────────────────────────────────────────────────
-- Never a reason to delete a lower-quality session — only a flag for
-- whether it's eligible to be included in future matched-comparison
-- analysis once that's built.
CREATE TABLE IF NOT EXISTS public.session_data_quality (
  session_id                        uuid PRIMARY KEY REFERENCES public.live_sessions(id),
  user_id                           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  has_verified_start                boolean NOT NULL DEFAULT false,
  has_verified_end                  boolean NOT NULL DEFAULT false,
  has_estimated_end                 boolean NOT NULL DEFAULT false,
  has_user_correction               boolean NOT NULL DEFAULT false,

  contains_pause_intervals          boolean NOT NULL DEFAULT false,
  extension_connected_percent       numeric,

  duplicate_tip_count               integer NOT NULL DEFAULT 0,
  invalid_tip_count                 integer NOT NULL DEFAULT 0,

  coaching_data_complete            boolean NOT NULL DEFAULT false,
  outcome_windows_complete          boolean NOT NULL DEFAULT false,

  eligible_for_future_impact_analysis boolean NOT NULL DEFAULT false,
  ineligibility_reasons             text[] NOT NULL DEFAULT '{}',

  computed_at                       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_data_quality ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_data_quality_select_own ON public.session_data_quality;
CREATE POLICY session_data_quality_select_own ON public.session_data_quality
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON public.session_data_quality TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_data_quality TO service_role;

-- ── Coaching-response visibility setting (section 15) ──────────────────────
-- Disabling this only hides the Performed/Skip buttons — coaching itself,
-- and coaching history recording, are unaffected either way.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_coaching_action_buttons boolean NOT NULL DEFAULT true;
