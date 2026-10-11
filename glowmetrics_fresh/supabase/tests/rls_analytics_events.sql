-- RLS checks for 20261015_analytics_events_lock_reads_and_funnel_inserts.
-- Run each block separately; every block rolls back (no data is written).
-- Replace :uid with any real auth.users id, :other with a different one.

-- 1. Public (anon) cannot read any analytics row; pre-signup insert still works.
begin;
set local role anon;
insert into analytics_events(event_name, user_id) values ('rls_test_anon_presignup', null); -- must succeed
select count(*) = 0 as anon_reads_nothing from analytics_events;                       -- expect true
rollback;

-- 2. Signed-in user sees only their own rows (not NULL-user rows, not others).
begin;
select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'role', 'authenticated')::text, true);
set local role authenticated;
select (select count(*) from analytics_events where user_id is null) = 0 as no_null_rows,
       (select count(*) from analytics_events where user_id <> :'uid'::uuid) = 0 as no_other_rows;
insert into checkout_events(user_id, status) values (:'uid'::uuid, 'rls_test');          -- must succeed
rollback;

-- 3. A user cannot insert a funnel event for someone else.
begin;
select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into checkout_events(user_id, status) values (:'other'::uuid, 'spoof');          -- must FAIL (42501)
rollback;
