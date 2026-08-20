-- Free accounts can see the insights that DESCRIBE their data. Pro keeps the
-- ones that tell them what to DO about it.
--
-- Before this, get_user_insights returned 'insights', NULL to every free
-- caller — the entire insight feed, which is the moment a creator realizes
-- the product understands their data. A free account with 23,209 imported
-- tips generated 2 insights and was shown none of them. That is the single
-- largest thing withheld from Free, and it is withheld at exactly the point
-- where value would otherwise be proven.
--
-- The feed is not one kind of thing, so it is no longer gated as one:
--
--   FREE — describes their own history. These are observations a creator
--   could in principle work out from their own data, and seeing them is what
--   makes the product feel real rather than like a locked demo.
--     session_length  "Your peak earning rate is in the <bucket> window"
--     dropoff         "Tips slow down after N minutes"
--     trend           "Earnings up/down N% vs your previous period"
--
--   PRO — tells them what to do next, or compares across platforms.
--     go_live_now     "GO LIVE NOW — this hour earns +N% more"    (live intelligence)
--     wait            "Low earning window right now — wait it out" (live intelligence)
--     platform        "<A> pays 1.8x more per tip than <B>"        (cross-platform)
--
-- daily_plan, missed_opportunity, session_optimization and summary remain
-- Pro-only and are untouched here: they are recommendations and
-- cross-platform rankings, not observations. go_live_status stays reduced to
-- its bare status for free callers, exactly as before.
--
-- insights_locked_count now counts only what is actually withheld, so the
-- "N more with Pro" copy stays honest instead of counting insights the
-- creator can already see.
--
-- ── HOW THIS IS APPLIED ────────────────────────────────────────────────────
-- The deployed function is ~21KB and this migration changes two lines of it.
-- Rather than restate the whole body — where a transcription slip would
-- silently alter analytics that every dashboard surface reads — it patches
-- the live definition in place: read pg_get_functiondef, replace two exact
-- tokens, re-execute. Every step is guarded and RAISES on anything
-- unexpected, so this fails loudly rather than half-applying or silently
-- doing nothing.

DO $do$
DECLARE
  v_def         text;
  v_patched     text;
  v_occurrences int;

  -- Tokens verified to appear exactly once in the deployed definition.
  c_old_insights CONSTANT text := $tok$'insights', NULL,$tok$;
  c_old_locked   CONSTANT text := $tok$'insights_locked_count', v_insights_count,$tok$;

  c_new_insights CONSTANT text := $tok$'insights', (SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb) FROM jsonb_array_elements(COALESCE(v_result->'insights', '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord) WHERE elem->>'type' IN ('session_length', 'dropoff', 'trend')),$tok$;
  c_new_locked   CONSTANT text := $tok$'insights_locked_count', (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(v_result->'insights', '[]'::jsonb)) AS e(elem) WHERE elem->>'type' NOT IN ('session_length', 'dropoff', 'trend')),$tok$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'get_user_insights' AND n.nspname = 'public';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'public.get_user_insights not found — nothing to patch';
  END IF;

  -- Each token must appear exactly once, or this is not the function we
  -- inspected and the patch must not proceed.
  v_occurrences := (length(v_def) - length(replace(v_def, c_old_insights, ''))) / length(c_old_insights);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 occurrence of the insights redaction token, found %', v_occurrences;
  END IF;

  v_occurrences := (length(v_def) - length(replace(v_def, c_old_locked, ''))) / length(c_old_locked);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 occurrence of the locked-count token, found %', v_occurrences;
  END IF;

  v_patched := replace(v_def, c_old_insights, c_new_insights);
  v_patched := replace(v_patched, c_old_locked, c_new_locked);

  IF v_patched = v_def THEN
    RAISE EXCEPTION 'patch produced no change — aborting rather than reporting success';
  END IF;

  EXECUTE v_patched;
END
$do$;
