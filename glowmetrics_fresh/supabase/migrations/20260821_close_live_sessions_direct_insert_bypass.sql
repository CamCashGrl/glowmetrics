-- Close the direct-INSERT bypass on public.live_sessions.
--
-- WHY THIS EXISTS
-- 20260814c_gate_live_mode_pro_only.sql made Live Mode Pro-only by calling
-- check_live_mode_pro_entitlement() from INSIDE start_live_session(). That
-- closes the RPC path, and app/api/live/session/start/route.js plus /live
-- close the API and UI paths. But live_sessions carries a single permissive
-- policy (20260802f_consolidate_live_sessions_rls_policy.sql):
--
--   "Users manage own live sessions"  FOR ALL
--   USING/WITH CHECK ((select auth.uid()) = user_id)
--
-- and no INSERT trigger. So an authenticated Free creator holding only the
-- public anon key could POST a row straight to /rest/v1/live_sessions with
-- their own user_id and obtain a live session without ever calling the RPC —
-- bypassing the UI gate, the route guard AND the RPC guard at once. Compare
-- the Free platform cap, which has been trigger-enforced since
-- 20260705_enforce_free_tier_platform_limit.sql and is therefore not
-- bypassable this way. This migration brings Live Mode to the same standard.
--
-- HOW
-- A BEFORE INSERT row trigger that PERFORMs the EXISTING canonical
-- check_live_mode_pro_entitlement(auth.uid()). No second Pro-check function,
-- no second entitlement system, no re-statement of isProPlan()'s rules in
-- SQL — the plan/plan_expires_at semantics (free rejected, null rejected,
-- expired pro/trial rejected, active pro and active promo-code trial allowed)
-- live in that one function and are simply reused, so a future change to the
-- rule keeps applying here for free.
--
-- THE RECONNECT EXEMPTION IS MIRRORED, DELIBERATELY
-- start_live_session() skips both Free-tier checks when the caller already
-- has an unresolved session, so a creator who downgrades mid-stream can still
-- reconnect to and end that session. It then relies on the INSERT failing with
-- unique_violation and catches it to return the existing row. A BEFORE INSERT
-- trigger fires ahead of that unique index, so a naive trigger would raise
-- P0001 (uncaught) instead of unique_violation (caught) and would break
-- reconnect for exactly those downgraded users. The trigger therefore repeats
-- start_live_session()'s own in-progress predicate verbatim. This is mirroring
-- an EXEMPTION, not duplicating the entitlement rule.
--
-- NOT DESTRUCTIVE
-- No data is read, altered or deleted. No policy is changed, weakened or
-- dropped. No existing trigger is touched (live_sessions_updated_at BEFORE
-- UPDATE and the platform-limit triggers on tips/live_tips/paid_sessions all
-- stay exactly as they are). The trigger is INSERT-only, so UPDATE and DELETE
-- on existing sessions — heartbeats, pause/resume, end_live_session, the
-- pg_cron stale sweep — are untouched.
--
-- start_live_session() is, as of this migration, the ONLY function in the
-- schema that inserts into public.live_sessions (verified against pg_proc),
-- so no other server-side path is affected by the new guard.

create or replace function public.enforce_live_mode_pro_entitlement()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  -- auth.uid() is null for service-role and maintenance contexts (the pg_cron
  -- stale-session sweep, migrations, backfills). Those are not creator actions
  -- and must not be gated on a creator's plan; the bypass this migration
  -- closes is specifically an *authenticated* PostgREST caller.
  if auth.uid() is null then
    return new;
  end if;

  -- A row for somebody else is refused by the policy's WITH CHECK regardless.
  -- Returning here keeps the guard from reading a plan for a user id the
  -- caller supplied, which would turn this trigger into a Pro-status oracle.
  if new.user_id is distinct from auth.uid() then
    return new;
  end if;

  -- Mirrors start_live_session()'s in-progress exemption verbatim. See the
  -- header: without this, reconnecting to a session started before a
  -- downgrade would raise P0001 instead of the unique_violation that
  -- start_live_session() catches.
  if exists (
    select 1 from public.live_sessions
    where user_id = new.user_id
      and status in ('starting', 'live', 'inactive_warning', 'ending')
  ) then
    return new;
  end if;

  -- The canonical check. Raises LIVE_MODE_REQUIRES_PRO (P0001) for free,
  -- null-plan, and expired pro/trial; returns quietly for active pro,
  -- unlimited, and an unexpired promo-code trial grant.
  perform public.check_live_mode_pro_entitlement(auth.uid());

  return new;
end;
$$;

drop trigger if exists trg_enforce_live_mode_pro_entitlement on public.live_sessions;

create trigger trg_enforce_live_mode_pro_entitlement
  before insert on public.live_sessions
  for each row
  execute function public.enforce_live_mode_pro_entitlement();

-- ────────────────────────────────────────────────────────────────────────
-- Stale user-facing error text on the Free platform cap.
--
-- Both halves of the platform-cap guard still name a plan called "Standard",
-- which this product does not sell — it sells Creator Pro (/pricing, $19.99
-- per month, still canonical as of this migration). check_free_tier_platform_
-- limit()'s copy additionally reads "Free tier tracks Live Mode on up to 3
-- platforms", which since 20260814c has been false: Free cannot use Live Mode
-- on any number of platforms.
--
-- The two functions are maintained as a pair (see 20260817c and 20260818,
-- which both patch them together), so both are corrected here; leaving one
-- behind would keep "Standard" reachable from the tips/live_tips/paid_sessions
-- import path. No other database error text is touched.
--
-- Patched via pg_get_functiondef() rather than retyping either body, the same
-- technique 20260818 uses, so no unrelated logic can drift. The old literal is
-- asserted present before rewriting; a definition already carrying the new
-- text is skipped (idempotent), and one carrying neither raises rather than
-- guessing.
-- ────────────────────────────────────────────────────────────────────────

DO $patch$
DECLARE
  v_def  text;
  v_new  text;
  v_proc text;
  v_old  text;
  v_procs text[] := ARRAY['check_free_tier_platform_limit', 'enforce_free_tier_platform_limit'];
  v_olds  text[] := ARRAY[
    'Free tier tracks Live Mode on up to 3 platforms. Upgrade to Standard ($19.99/mo) to use Live Mode on multiple platforms.',
    'Free tier tracks up to 3 platforms. Upgrade to Standard ($19.99/mo) to track multiple platforms.'
  ];
  v_replacement text := 'Free tracks up to 3 platforms. Upgrade to Creator Pro ($19.99/mo) to track more.';
  i int;
BEGIN
  FOR i IN 1 .. array_length(v_procs, 1) LOOP
    v_proc := v_procs[i];
    v_old  := v_olds[i];

    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_proc AND p.prokind = 'f';

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Function public.% not found', v_proc;
    END IF;

    -- Already migrated (idempotent re-run) — skip without failing.
    IF position(v_replacement IN v_def) > 0 THEN
      CONTINUE;
    END IF;

    IF position(v_old IN v_def) = 0 THEN
      RAISE EXCEPTION 'Expected the stale platform-limit message in %, found neither it nor the corrected text', v_proc;
    END IF;

    v_new := replace(v_def, v_old, v_replacement);

    IF position('Standard' IN v_new) > 0 THEN
      RAISE EXCEPTION '"Standard" still present in % after rewrite', v_proc;
    END IF;
    IF position('Live Mode' IN v_new) > 0 THEN
      RAISE EXCEPTION 'Live Mode still implied as a Free capability in % after rewrite', v_proc;
    END IF;

    EXECUTE v_new;
  END LOOP;
END
$patch$;
