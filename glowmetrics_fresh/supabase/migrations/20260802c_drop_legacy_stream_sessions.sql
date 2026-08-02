-- CamCash Live Engine rewrite — Step 3: drop the legacy stream_sessions
-- table. Nothing in the app writes to it any more (the legacy
-- handleStartStream/handleStopStream handlers in app/live/page.js that used
-- to are deleted — see the collapse_live_engine_state_machine migration and
-- companion app changes). All 12 existing rows were verified as $0/0-token
-- placeholder rows from test/dev accounts only, created by that same broken
-- legacy handler — no real earnings data. fan_events is empty and unused
-- anywhere in the app; its FK to stream_sessions is dropped along with it,
-- but the table itself is left in place (not part of this rewrite's scope).
ALTER TABLE public.fan_events DROP CONSTRAINT IF EXISTS fan_events_stream_session_id_fkey;
DROP TABLE IF EXISTS public.stream_sessions;
