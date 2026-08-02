-- Bug fix caught by acceptance testing: sweep_stale_live_session() and
-- sweep_all_stale_live_sessions() (collapse_live_engine_state_machine
-- migration) set session_resolution_type = 'auto_ended_inactivity' on
-- auto-end, but that value was never added to the CHECK constraint,
-- causing every real 20-minute auto-end to fail with a constraint
-- violation instead of actually ending the session.
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_resolution_type_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_resolution_type_check
  CHECK (session_resolution_type IS NULL OR session_resolution_type IN (
    'normal_stop', 'still_live', 'end_at_last_heartbeat',
    'chosen_end_time', 'marked_invalid', 'auto_ended_inactivity'
  ));
