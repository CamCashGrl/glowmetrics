-- ═══════════════════════════════════════════════════════════════════════
-- CAMCASH SESSION HUB + REPORT-READY LIVE MODE TRACKING
--
-- Adds the data layer needed to:
--  - separate uploaded (inferred) tip sessions from verified Live Mode
--    sessions in the UI
--  - record Pause/Resume + user corrections on Live Mode sessions without
--    ever overwriting the original recorded timestamps
--  - store optional Performed/Skipped coaching responses (defaulting to
--    "unmarked", never counted as skipped)
--  - capture raw coaching prompt outcome windows and session context for
--    future (separate) impact-analysis features
--  - flag sessions by data quality without deleting lower-quality sessions
--
-- This migration is purely additive: existing tables/columns are only
-- extended (nullable/defaulted columns), never altered destructively, and
-- no existing rows are touched.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. EXTEND stream_sessions FOR PAUSE/RESUME + CORRECTIONS ────────────
-- start_time/end_time remain the original, verified, recorded values —
-- corrections are layered on top via corrected_* columns + the append-only
-- session_time_corrections history table below. Never overwritten.

alter table stream_sessions add column if not exists pause_intervals jsonb not null default '[]'::jsonb;
alter table stream_sessions add column if not exists completed boolean not null default false;
alter table stream_sessions add column if not exists duration_confidence text not null default 'estimated';
alter table stream_sessions add column if not exists corrected_started_at timestamptz;
alter table stream_sessions add column if not exists corrected_ended_at timestamptz;
alter table stream_sessions add column if not exists corrected_pause_intervals jsonb;
alter table stream_sessions add column if not exists corrected_platform text;
alter table stream_sessions add column if not exists corrected_completed boolean;
alter table stream_sessions add column if not exists coaching_enabled boolean not null default true;

alter table stream_sessions drop constraint if exists stream_sessions_duration_confidence_check;
alter table stream_sessions add constraint stream_sessions_duration_confidence_check
  check (duration_confidence in ('verified', 'user_confirmed', 'estimated'));

-- ── 2. SESSION TIME CORRECTIONS (append-only history) ───────────────────
-- Every correction a user makes is preserved forever, even after a newer
-- correction is applied. stream_sessions.corrected_* always mirrors the
-- most recent row here for fast reads.

create table if not exists session_time_corrections (
  id                        bigserial primary key,
  user_id                   uuid references auth.users(id) on delete cascade not null,
  session_id                bigint references stream_sessions(id) on delete cascade not null,
  original_started_at       timestamptz not null,
  original_ended_at         timestamptz,
  corrected_started_at      timestamptz not null,
  corrected_ended_at        timestamptz not null,
  corrected_pause_intervals jsonb not null default '[]'::jsonb,
  corrected_platform        text,
  corrected_completed       boolean,
  corrected_by_user         boolean not null default true,
  corrected_at              timestamptz not null default now()
);

create index if not exists idx_session_corrections_session on session_time_corrections(session_id, corrected_at desc);

-- ── 3. STORED COACHING EVENTS ────────────────────────────────────────────
-- One row per coaching prompt actually shown during a Live Mode session.
-- category is intentionally a fixed, extensible enum per product spec —
-- some values may be unused today but the schema must not need a migration
-- when they come online.

create table if not exists coaching_events (
  id                  bigserial primary key,
  user_id             uuid references auth.users(id) on delete cascade not null,
  session_id          bigint references stream_sessions(id) on delete cascade not null,
  type                text not null default 'live_alert',
  category            text not null,
  priority            integer not null default 3,
  dedupe_key          text not null,

  title               text not null,
  message             text not null,
  compact_message     text not null,

  related_tip_id      text,
  related_tipper_id   text,
  related_tipper_name text,
  related_amount_usd  numeric(10,2),

  created_at          timestamptz not null default now(),
  shown_at            timestamptz not null default now(),
  expires_at          timestamptz,
  dismissed_at        timestamptz,

  action_status       text not null default 'unmarked',
  action_responded_at timestamptz,
  updated_at          timestamptz not null default now()
);

alter table coaching_events drop constraint if exists coaching_events_category_check;
alter table coaching_events add constraint coaching_events_category_check
  check (category in (
    'supporter_engagement', 'new_supporter', 'returning_supporter', 'goal_momentum',
    'room_recovery', 'pace_management', 'retention', 'session_timing', 'stream_ending'
  ));

alter table coaching_events drop constraint if exists coaching_events_action_status_check;
alter table coaching_events add constraint coaching_events_action_status_check
  check (action_status in ('unmarked', 'performed', 'skipped'));

create index if not exists idx_coaching_events_session on coaching_events(session_id, shown_at);
create index if not exists idx_coaching_events_user_status on coaching_events(user_id, action_status);

-- ── 4. COACHING PROMPT OUTCOME WINDOWS (raw data only, no conclusions) ──
-- coaching_event_id is unique so re-running the capture job for the same
-- event always upserts the same row instead of creating duplicates.

create table if not exists coaching_prompt_outcomes (
  id                                  bigserial primary key,
  user_id                             uuid references auth.users(id) on delete cascade not null,
  coaching_event_id                  bigint references coaching_events(id) on delete cascade not null unique,
  session_id                         bigint references stream_sessions(id) on delete cascade not null,

  action_status                      text not null default 'unmarked',
  prompt_shown_at                    timestamptz not null,

  earnings_before_5m                 numeric(10,2) not null default 0,
  earnings_after_5m                  numeric(10,2) not null default 0,
  earnings_after_10m                 numeric(10,2) not null default 0,
  earnings_after_20m                 numeric(10,2) not null default 0,

  tips_before_5m                     integer not null default 0,
  tips_after_5m                      integer not null default 0,
  tips_after_10m                     integer not null default 0,
  tips_after_20m                     integer not null default 0,

  unique_tippers_before_5m           integer not null default 0,
  unique_tippers_after_5m            integer not null default 0,
  unique_tippers_after_10m           integer not null default 0,
  unique_tippers_after_20m           integer not null default 0,

  related_supporter_tipped_again_5m  boolean,
  related_supporter_tipped_again_10m boolean,

  pace_before_prompt                 numeric(12,4),
  pace_after_10m                     numeric(12,4),

  captured_at                        timestamptz not null default now()
);

alter table coaching_prompt_outcomes drop constraint if exists coaching_prompt_outcomes_action_status_check;
alter table coaching_prompt_outcomes add constraint coaching_prompt_outcomes_action_status_check
  check (action_status in ('unmarked', 'performed', 'skipped'));

create index if not exists idx_coaching_outcomes_session on coaching_prompt_outcomes(session_id);

-- ── 5. LIVE SESSION ANALYSIS CONTEXT ─────────────────────────────────────
-- One row per session, captured at session end, for future matched
-- comparisons. Streaming-plan / goal fields stay false/null until those
-- separate beta features exist — this just avoids a later migration.

create table if not exists live_session_analysis_context (
  session_id                         bigint references stream_sessions(id) on delete cascade primary key,
  user_id                            uuid references auth.users(id) on delete cascade not null,
  platform                           text not null,

  started_at                        timestamptz not null,
  ended_at                          timestamptz,

  day_of_week                       smallint not null,
  start_hour_local                  smallint not null,
  timezone                          text not null,

  active_duration_minutes           numeric(10,2) not null default 0,
  paused_duration_minutes           numeric(10,2) not null default 0,

  total_earnings_usd                numeric(10,2) not null default 0,
  total_tokens                      integer not null default 0,
  tip_count                         integer not null default 0,
  unique_tipper_count               integer not null default 0,

  actual_hourly_rate                numeric(10,2),

  coaching_enabled                  boolean not null default true,
  coaching_prompt_count             integer not null default 0,
  performed_prompt_count            integer not null default 0,
  skipped_prompt_count              integer not null default 0,
  unmarked_prompt_count             integer not null default 0,

  goal_used                         boolean not null default false,
  streaming_plan_window_id          text,
  started_from_streaming_plan       boolean not null default false,
  started_inside_recommended_window boolean not null default false,

  duration_confidence               text not null default 'estimated',
  updated_at                         timestamptz not null default now()
);

alter table live_session_analysis_context drop constraint if exists live_session_analysis_context_duration_confidence_check;
alter table live_session_analysis_context add constraint live_session_analysis_context_duration_confidence_check
  check (duration_confidence in ('verified', 'user_confirmed', 'estimated'));

-- ── 6. FEATURE USAGE EVENTS (lightweight, not a source of truth) ───────
-- Never read from this table to compute earnings/tips/duration — it is
-- for future feature-adoption analysis only.

create table if not exists feature_usage_events (
  id           bigserial primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  session_id   bigint references stream_sessions(id) on delete set null,
  feature      text not null,
  action       text not null,
  metadata     jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);

alter table feature_usage_events drop constraint if exists feature_usage_events_feature_check;
alter table feature_usage_events add constraint feature_usage_events_feature_check
  check (feature in (
    'live_mode', 'coaching', 'coaching_action', 'session_correction',
    'pause_resume', 'goal_tracker', 'streaming_plan', 'peak_window'
  ));

create index if not exists idx_feature_usage_user on feature_usage_events(user_id, occurred_at desc);

-- ── 7. SESSION DATA QUALITY FLAGS ────────────────────────────────────────
-- Never used to delete/hide sessions — only to exclude them from future
-- impact-analysis features.

create table if not exists session_data_quality (
  session_id                          bigint references stream_sessions(id) on delete cascade primary key,
  user_id                             uuid references auth.users(id) on delete cascade not null,

  has_verified_start                  boolean not null default true,
  has_verified_end                    boolean not null default false,
  has_estimated_end                   boolean not null default false,
  has_user_correction                 boolean not null default false,

  contains_pause_intervals            boolean not null default false,
  extension_connected_percent         numeric(5,2),

  duplicate_tip_count                 integer not null default 0,
  invalid_tip_count                   integer not null default 0,

  coaching_data_complete               boolean not null default true,
  outcome_windows_complete             boolean not null default true,

  eligible_for_future_impact_analysis   boolean not null default false,
  ineligibility_reasons                 jsonb not null default '[]'::jsonb,

  updated_at                             timestamptz not null default now()
);

-- ── 8. COACHING PRIVACY SETTING ──────────────────────────────────────────

alter table profiles add column if not exists coaching_actions_visible boolean not null default true;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Same pattern as every other CamCash table: each user can only ever see
-- and write their own rows, enforced at the database level.

alter table session_time_corrections      enable row level security;
alter table coaching_events                enable row level security;
alter table coaching_prompt_outcomes       enable row level security;
alter table live_session_analysis_context  enable row level security;
alter table feature_usage_events           enable row level security;
alter table session_data_quality           enable row level security;

-- Corrections are append-only — select + insert, no update/delete policy —
-- so the correction history itself can never be edited or erased.
drop policy if exists "session_corrections_own_select" on session_time_corrections;
drop policy if exists "session_corrections_own_insert" on session_time_corrections;
create policy "session_corrections_own_select" on session_time_corrections for select using (auth.uid() = user_id);
create policy "session_corrections_own_insert" on session_time_corrections for insert with check (auth.uid() = user_id);

drop policy if exists "coaching_events_own_rw" on coaching_events;
create policy "coaching_events_own_rw" on coaching_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coaching_outcomes_own_rw" on coaching_prompt_outcomes;
create policy "coaching_outcomes_own_rw" on coaching_prompt_outcomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "analysis_context_own_rw" on live_session_analysis_context;
create policy "analysis_context_own_rw" on live_session_analysis_context
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Feature usage is an append-only log — select + insert only.
drop policy if exists "feature_usage_own_select" on feature_usage_events;
drop policy if exists "feature_usage_own_insert" on feature_usage_events;
create policy "feature_usage_own_select" on feature_usage_events for select using (auth.uid() = user_id);
create policy "feature_usage_own_insert" on feature_usage_events for insert with check (auth.uid() = user_id);

drop policy if exists "data_quality_own_rw" on session_data_quality;
create policy "data_quality_own_rw" on session_data_quality
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
