-- Reconciles main's migration history with what's actually deployed.
--
-- This function was already applied live to production directly during
-- PR #407 ("Make get_user_insights plan-aware"), which redacts Pro-
-- exclusive fields (daily_plan, missed_opportunity, session_optimization,
-- insights, summary) for free callers — free/Pro previously received the
-- identical payload, the free/Pro distinction was purely client-side JSX
-- hiding. That PR's branch was never merged to main, so this migration
-- file was missing from main's history even though the change is live —
-- a real deployment-hygiene gap: rebuilding the database from main's
-- migration files alone would silently regress to the pre-#407 (IDOR-fixed
-- but not plan-aware) version. This file captures the function AS-DEPLOYED
-- (pulled directly via pg_get_functiondef against production), so
-- migration history matches reality; it is a no-op against the live
-- database (CREATE OR REPLACE of an identical definition).
--
-- No calculation logic changed by this file — Pro users get exactly the
-- same numbers as before. Only what's *returned* to a free caller differs,
-- and that redaction has been live since PR #407.

CREATE OR REPLACE FUNCTION public.get_user_insights(p_user_id uuid, p_timezone text DEFAULT 'UTC'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_tips_count INTEGER;
  v_current_hour INTEGER := EXTRACT(HOUR FROM NOW() AT TIME ZONE p_timezone)::INTEGER;
  v_today_dow INTEGER := EXTRACT(DOW FROM NOW() AT TIME ZONE p_timezone)::INTEGER;
  v_today_local DATE := (NOW() AT TIME ZONE p_timezone)::DATE;

  v_current_hour_avg NUMERIC;
  v_overall_hourly_avg NUMERIC;
  v_current_hour_multiplier NUMERIC;
  v_best_hour INTEGER;
  v_best_hour_avg NUMERIC;
  v_second_best_hour INTEGER;
  v_second_best_hour_avg NUMERIC;

  v_best_day TEXT;
  v_best_day_avg NUMERIC;
  v_best_day_multiplier NUMERIC;
  v_overall_daily_avg NUMERIC;

  v_best_platform TEXT;
  v_best_platform_avg NUMERIC;
  v_worst_platform TEXT;
  v_worst_platform_avg NUMERIC;

  v_last_30_avg NUMERIC;
  v_prev_30_avg NUMERIC;
  v_trend_pct NUMERIC;

  v_today_best_hour INTEGER;
  v_today_best_hour_avg NUMERIC;

  v_short_session_epm NUMERIC;
  v_medium_session_epm NUMERIC;
  v_long_session_epm NUMERIC;
  v_xlong_session_epm NUMERIC;
  v_best_session_bucket TEXT;
  v_peak_decay_minute NUMERIC;

  v_avg_tip_gap_minutes NUMERIC;

  v_streak_days INTEGER := 0;
  v_today_earnings NUMERIC;
  v_avg_daily_earnings NUMERIC;
  v_today_pacing_pct NUMERIC;
  v_best_day_earnings NUMERIC;

  v_best_hour_passed BOOLEAN := false;
  v_missed_estimated NUMERIC;

  v_this_week_hour_avg NUMERIC;
  v_all_time_hour_avg NUMERIC;
  v_hour_trending_pct NUMERIC;

  v_plan TEXT;
  v_plan_expires_at TIMESTAMPTZ;
  v_is_pro BOOLEAN;
  v_result JSONB;
  v_insights_count INT;

BEGIN
  -- Security fix (already live): SECURITY DEFINER + caller-supplied
  -- p_user_id requires an explicit ownership check.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '28000';
  END IF;

  SELECT plan, plan_expires_at INTO v_plan, v_plan_expires_at
  FROM profiles WHERE id = p_user_id;
  v_is_pro := v_plan IS NOT NULL AND v_plan <> 'free'
    AND (v_plan_expires_at IS NULL OR v_plan_expires_at > NOW());

  SELECT COUNT(*) INTO v_total_tips_count
  FROM tips WHERE user_id = p_user_id;

  IF v_total_tips_count < 10 THEN
    RETURN jsonb_build_object(
      'has_data', false,
      'is_pro', v_is_pro,
      'message', 'Upload more data to unlock insights — need at least 10 tips',
      'insights', '[]'::jsonb,
      'go_live_status', NULL,
      'daily_plan', NULL,
      'momentum', NULL
    );
  END IF;

  SELECT AVG(usd) INTO v_overall_hourly_avg
  FROM tips WHERE user_id = p_user_id AND usd > 0;

  SELECT AVG(usd) INTO v_current_hour_avg
  FROM tips
  WHERE user_id = p_user_id AND usd > 0
    AND EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone) = v_current_hour
  HAVING COUNT(*) >= 3;

  IF v_overall_hourly_avg > 0 AND v_current_hour_avg IS NOT NULL THEN
    v_current_hour_multiplier := ROUND((v_current_hour_avg / v_overall_hourly_avg)::NUMERIC, 2);
  END IF;

  SELECT EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone)::INTEGER, AVG(usd)
  INTO v_best_hour, v_best_hour_avg
  FROM tips WHERE user_id = p_user_id AND usd > 0
  GROUP BY EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone)
  HAVING COUNT(*) >= 3
  ORDER BY AVG(usd) DESC LIMIT 1;

  SELECT EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone)::INTEGER, AVG(usd)
  INTO v_second_best_hour, v_second_best_hour_avg
  FROM tips WHERE user_id = p_user_id AND usd > 0
    AND EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone) != COALESCE(v_best_hour, -1)
  GROUP BY EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone)
  HAVING COUNT(*) >= 3
  ORDER BY AVG(usd) DESC LIMIT 1;

  SELECT TRIM(TO_CHAR(date_time AT TIME ZONE p_timezone, 'Day')), AVG(usd)
  INTO v_best_day, v_best_day_avg
  FROM tips WHERE user_id = p_user_id AND usd > 0
  GROUP BY TRIM(TO_CHAR(date_time AT TIME ZONE p_timezone, 'Day')), EXTRACT(DOW FROM date_time AT TIME ZONE p_timezone)
  HAVING COUNT(*) >= 3
  ORDER BY AVG(usd) DESC LIMIT 1;

  SELECT AVG(usd) INTO v_overall_daily_avg FROM tips WHERE user_id = p_user_id AND usd > 0;
  IF v_overall_daily_avg > 0 AND v_best_day_avg IS NOT NULL THEN
    v_best_day_multiplier := ROUND((v_best_day_avg / v_overall_daily_avg)::NUMERIC, 1);
  END IF;

  SELECT platform, AVG(usd) INTO v_best_platform, v_best_platform_avg
  FROM tips WHERE user_id = p_user_id AND usd > 0 AND platform IS NOT NULL
  GROUP BY platform HAVING COUNT(*) >= 5
  ORDER BY AVG(usd) DESC LIMIT 1;

  SELECT platform, AVG(usd) INTO v_worst_platform, v_worst_platform_avg
  FROM tips WHERE user_id = p_user_id AND usd > 0 AND platform IS NOT NULL
  GROUP BY platform HAVING COUNT(*) >= 5
  ORDER BY AVG(usd) ASC LIMIT 1;

  SELECT COALESCE(AVG(usd), 0) INTO v_last_30_avg
  FROM tips WHERE user_id = p_user_id AND usd > 0 AND date_time >= NOW() - INTERVAL '30 days';

  SELECT COALESCE(AVG(usd), 0) INTO v_prev_30_avg
  FROM tips WHERE user_id = p_user_id AND usd > 0
    AND date_time >= NOW() - INTERVAL '60 days' AND date_time < NOW() - INTERVAL '30 days';

  IF v_prev_30_avg > 0 THEN
    v_trend_pct := ROUND(((v_last_30_avg - v_prev_30_avg) / v_prev_30_avg * 100)::NUMERIC, 0);
  END IF;

  SELECT EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone)::INTEGER, AVG(usd)
  INTO v_today_best_hour, v_today_best_hour_avg
  FROM tips WHERE user_id = p_user_id AND usd > 0
    AND EXTRACT(DOW FROM date_time AT TIME ZONE p_timezone) = v_today_dow
  GROUP BY EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone)
  HAVING COUNT(*) >= 2
  ORDER BY AVG(usd) DESC LIMIT 1;

  IF v_best_hour IS NOT NULL THEN
    SELECT AVG(usd) INTO v_this_week_hour_avg
    FROM tips WHERE user_id = p_user_id AND usd > 0
      AND EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone) = v_best_hour
      AND date_time >= NOW() - INTERVAL '7 days';

    SELECT AVG(usd) INTO v_all_time_hour_avg
    FROM tips WHERE user_id = p_user_id AND usd > 0
      AND EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone) = v_best_hour;

    IF v_all_time_hour_avg > 0 AND v_this_week_hour_avg IS NOT NULL THEN
      v_hour_trending_pct := ROUND(((v_this_week_hour_avg - v_all_time_hour_avg) / v_all_time_hour_avg * 100)::NUMERIC, 0);
    END IF;
  END IF;

  WITH ordered_tips AS (
    SELECT usd, date_time,
      LAG(date_time) OVER (ORDER BY date_time) AS prev_dt
    FROM tips WHERE user_id = p_user_id AND usd > 0
  ),
  sessions AS (
    SELECT usd, date_time,
      SUM(CASE WHEN prev_dt IS NULL OR EXTRACT(EPOCH FROM date_time - prev_dt)/60 > 90 THEN 1 ELSE 0 END)
        OVER (ORDER BY date_time) AS session_num
    FROM ordered_tips
  ),
  session_positions AS (
    SELECT session_num, usd,
      EXTRACT(EPOCH FROM date_time - MIN(date_time) OVER (PARTITION BY session_num))/60 AS minutes_in
    FROM sessions
  )
  SELECT
    AVG(CASE WHEN minutes_in BETWEEN 0 AND 15 THEN usd END),
    AVG(CASE WHEN minutes_in BETWEEN 15 AND 30 THEN usd END),
    AVG(CASE WHEN minutes_in BETWEEN 30 AND 60 THEN usd END),
    AVG(CASE WHEN minutes_in > 60 THEN usd END)
  INTO v_short_session_epm, v_medium_session_epm, v_long_session_epm, v_xlong_session_epm
  FROM session_positions;

  v_best_session_bucket := CASE
    WHEN GREATEST(COALESCE(v_short_session_epm,0), COALESCE(v_medium_session_epm,0), COALESCE(v_long_session_epm,0), COALESCE(v_xlong_session_epm,0)) = COALESCE(v_short_session_epm,0) THEN '0–15 min'
    WHEN GREATEST(COALESCE(v_short_session_epm,0), COALESCE(v_medium_session_epm,0), COALESCE(v_long_session_epm,0), COALESCE(v_xlong_session_epm,0)) = COALESCE(v_medium_session_epm,0) THEN '15–30 min'
    WHEN GREATEST(COALESCE(v_short_session_epm,0), COALESCE(v_medium_session_epm,0), COALESCE(v_long_session_epm,0), COALESCE(v_xlong_session_epm,0)) = COALESCE(v_long_session_epm,0) THEN '30–60 min'
    ELSE '60+ min'
  END;

  SELECT MIN(minutes_in) INTO v_peak_decay_minute
  FROM (
    WITH ordered_tips AS (
      SELECT usd, date_time,
        LAG(date_time) OVER (ORDER BY date_time) AS prev_dt
      FROM tips WHERE user_id = p_user_id AND usd > 0
    ),
    sessions AS (
      SELECT usd, date_time,
        SUM(CASE WHEN prev_dt IS NULL OR EXTRACT(EPOCH FROM date_time - prev_dt)/60 > 90 THEN 1 ELSE 0 END)
          OVER (ORDER BY date_time) AS session_num
      FROM ordered_tips
    ),
    positioned AS (
      SELECT session_num, usd,
        ROUND(EXTRACT(EPOCH FROM date_time - MIN(date_time) OVER (PARTITION BY session_num))/60)::INTEGER AS minutes_in
      FROM sessions
    ),
    bucketed AS (
      SELECT minutes_in, AVG(usd) AS avg_usd
      FROM positioned
      WHERE minutes_in <= 90
      GROUP BY minutes_in
      HAVING COUNT(*) >= 3
    )
    SELECT minutes_in FROM bucketed
    WHERE avg_usd < v_overall_hourly_avg * 0.8
    ORDER BY minutes_in ASC
  ) decay_subq;

  SELECT AVG(gap_minutes) INTO v_avg_tip_gap_minutes
  FROM (
    SELECT EXTRACT(EPOCH FROM date_time - LAG(date_time) OVER (ORDER BY date_time))/60 AS gap_minutes
    FROM tips WHERE user_id = p_user_id AND usd > 0
  ) gaps
  WHERE gap_minutes BETWEEN 1 AND 90;

  WITH daily AS (
    SELECT DATE(date_time AT TIME ZONE p_timezone) AS d, SUM(usd) AS daily_usd
    FROM tips WHERE user_id = p_user_id AND usd > 0
    GROUP BY DATE(date_time AT TIME ZONE p_timezone)
  ),
  streaks AS (
    SELECT d, daily_usd,
      d - (ROW_NUMBER() OVER (ORDER BY d))::INTEGER AS grp
    FROM daily
    WHERE daily_usd > 0
  )
  SELECT COUNT(*) INTO v_streak_days
  FROM streaks
  WHERE grp = (SELECT grp FROM streaks ORDER BY d DESC LIMIT 1);

  SELECT COALESCE(SUM(usd), 0) INTO v_today_earnings
  FROM tips WHERE user_id = p_user_id AND DATE(date_time AT TIME ZONE p_timezone) = v_today_local;

  SELECT AVG(daily_usd) INTO v_avg_daily_earnings
  FROM (
    SELECT DATE(date_time AT TIME ZONE p_timezone) AS d, SUM(usd) AS daily_usd
    FROM tips WHERE user_id = p_user_id AND usd > 0
    GROUP BY DATE(date_time AT TIME ZONE p_timezone)
  ) daily_totals;

  IF v_avg_daily_earnings > 0 THEN
    v_today_pacing_pct := ROUND((v_today_earnings / v_avg_daily_earnings * 100)::NUMERIC, 0);
  END IF;

  SELECT MAX(daily_usd) INTO v_best_day_earnings
  FROM (
    SELECT DATE(date_time AT TIME ZONE p_timezone) AS d, SUM(usd) AS daily_usd
    FROM tips WHERE user_id = p_user_id AND usd > 0
    GROUP BY DATE(date_time AT TIME ZONE p_timezone)
  ) d;

  IF v_best_hour IS NOT NULL AND v_best_hour < v_current_hour THEN
    v_best_hour_passed := true;
    SELECT AVG(usd) * COUNT(*) / NULLIF(COUNT(DISTINCT DATE(date_time AT TIME ZONE p_timezone)), 0) INTO v_missed_estimated
    FROM tips
    WHERE user_id = p_user_id AND usd > 0
      AND EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone) = v_best_hour;
    v_missed_estimated := LEAST(ROUND(v_missed_estimated::NUMERIC, 2), 200);
    IF EXISTS (
      SELECT 1 FROM tips
      WHERE user_id = p_user_id AND usd > 0
        AND DATE(date_time AT TIME ZONE p_timezone) = v_today_local
        AND EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone) = v_best_hour
    ) THEN
      v_best_hour_passed := false;
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'has_data', true,
    'is_pro', v_is_pro,
    'generated_at', NOW(),

    'go_live_status', jsonb_build_object(
      'current_hour', v_current_hour,
      'current_hour_avg', ROUND(COALESCE(v_current_hour_avg, 0)::NUMERIC, 2),
      'overall_avg', ROUND(COALESCE(v_overall_hourly_avg, 0)::NUMERIC, 2),
      'multiplier', COALESCE(v_current_hour_multiplier, 0),
      'status', CASE
        WHEN v_current_hour_avg IS NULL THEN 'unknown'
        WHEN v_current_hour_multiplier >= 1.5 THEN 'high'
        WHEN v_current_hour_multiplier >= 0.9 THEN 'warm'
        ELSE 'low'
      END,
      'next_best_hour', v_best_hour,
      'next_best_hour_avg', ROUND(COALESCE(v_best_hour_avg, 0)::NUMERIC, 2)
    ),

    'daily_plan', jsonb_build_object(
      'best_hour', v_today_best_hour,
      'best_hour_avg', ROUND(COALESCE(v_today_best_hour_avg, 0)::NUMERIC, 2),
      'second_best_hour', v_second_best_hour,
      'second_best_hour_avg', ROUND(COALESCE(v_second_best_hour_avg, 0)::NUMERIC, 2),
      'optimal_session_length', v_best_session_bucket,
      'decay_at_minute', v_peak_decay_minute
    ),

    'momentum', jsonb_build_object(
      'streak_days', COALESCE(v_streak_days, 0),
      'today_earnings', ROUND(COALESCE(v_today_earnings, 0)::NUMERIC, 2),
      'avg_daily_earnings', ROUND(COALESCE(v_avg_daily_earnings, 0)::NUMERIC, 2),
      'today_pacing_pct', COALESCE(v_today_pacing_pct, 0),
      'best_day_earnings', ROUND(COALESCE(v_best_day_earnings, 0)::NUMERIC, 2),
      'trend_pct', COALESCE(v_trend_pct, 0)
    ),

    'missed_opportunity', CASE WHEN v_best_hour_passed AND v_missed_estimated > 0
      THEN jsonb_build_object(
        'hour', v_best_hour,
        'estimated_loss', v_missed_estimated
      )
      ELSE NULL
    END,

    'session_optimization', jsonb_build_object(
      'avg_0_15', ROUND(COALESCE(v_short_session_epm, 0)::NUMERIC, 2),
      'avg_15_30', ROUND(COALESCE(v_medium_session_epm, 0)::NUMERIC, 2),
      'avg_30_60', ROUND(COALESCE(v_long_session_epm, 0)::NUMERIC, 2),
      'avg_60_plus', ROUND(COALESCE(v_xlong_session_epm, 0)::NUMERIC, 2),
      'best_bucket', v_best_session_bucket,
      'decay_at_minute', v_peak_decay_minute,
      'avg_tip_gap_minutes', ROUND(COALESCE(v_avg_tip_gap_minutes, 0)::NUMERIC, 1)
    ),

    'insights', (
      SELECT jsonb_agg(insight ORDER BY priority)
      FROM (

        SELECT 1 AS priority, jsonb_build_object(
          'type', 'go_live_now',
          'impact', 'critical',
          'title', 'GO LIVE NOW — this hour earns +' || ROUND((v_current_hour_multiplier - 1) * 100)::TEXT || '% more',
          'body', 'Right now (' ||
            CASE WHEN v_current_hour = 0 THEN '12 AM'
                 WHEN v_current_hour < 12 THEN v_current_hour || ' AM'
                 WHEN v_current_hour = 12 THEN '12 PM'
                 ELSE (v_current_hour - 12) || ' PM' END ||
            ') historically averages $' || ROUND(v_current_hour_avg::NUMERIC, 2) || '/tip — ' || v_current_hour_multiplier || 'x your normal.' ||
            CASE WHEN v_hour_trending_pct > 20 THEN ' This hour is also trending up ' || v_hour_trending_pct || '% this week.' ELSE '' END,
          'action', 'Open your stream now — this window closes in ~' || (60 - EXTRACT(MINUTE FROM NOW() AT TIME ZONE p_timezone))::INTEGER || ' minutes'
        ) AS insight
        WHERE v_current_hour_multiplier >= 1.5

        UNION ALL

        SELECT 1, jsonb_build_object(
          'type', 'wait',
          'impact', 'warning',
          'title', 'Low earning window right now — wait it out',
          'body', 'This hour averages $' || ROUND(COALESCE(v_current_hour_avg, 0)::NUMERIC, 2) || '/tip vs your $' || ROUND(v_overall_hourly_avg::NUMERIC, 2) || ' average. Next peak: ' ||
            CASE WHEN v_best_hour IS NULL THEN 'unknown'
                 WHEN v_best_hour = 0 THEN '12 AM'
                 WHEN v_best_hour < 12 THEN v_best_hour || ' AM'
                 WHEN v_best_hour = 12 THEN '12 PM'
                 ELSE (v_best_hour - 12) || ' PM' END || ' ($' || ROUND(COALESCE(v_best_hour_avg,0)::NUMERIC, 2) || '/tip avg).',
          'action', 'Go live at ' ||
            CASE WHEN v_best_hour IS NULL THEN 'your peak hour'
                 WHEN v_best_hour = 0 THEN '12 AM'
                 WHEN v_best_hour < 12 THEN v_best_hour || ' AM'
                 WHEN v_best_hour = 12 THEN '12 PM'
                 ELSE (v_best_hour - 12) || ' PM' END || ' for your best results'
        )
        WHERE v_current_hour_multiplier < 0.7 AND v_current_hour_avg IS NOT NULL

        UNION ALL

        SELECT 2, jsonb_build_object(
          'type', 'session_length',
          'impact', 'high',
          'title', 'Your peak earning rate is in the ' || v_best_session_bucket || ' window',
          'body', CASE v_best_session_bucket
            WHEN '0–15 min' THEN 'Tips drop off quickly after 15 min. Avg $' || ROUND(v_short_session_epm::NUMERIC, 2) || '/tip in first 15 min vs $' || ROUND(COALESCE(v_medium_session_epm,0)::NUMERIC, 2) || ' after. Run shorter sessions and restart more often.'
            WHEN '15–30 min' THEN 'Your sweet spot is 15–30 minutes. Avg $' || ROUND(v_medium_session_epm::NUMERIC, 2) || '/tip in that window. After 30 min tips slow to $' || ROUND(COALESCE(v_long_session_epm,0)::NUMERIC, 2) || '/tip.'
            WHEN '30–60 min' THEN 'You warm up slowly — earnings peak at 30–60 min ($' || ROUND(v_long_session_epm::NUMERIC, 2) || '/tip). Don''t cut sessions short.'
            ELSE 'Your biggest tips come in long sessions (60+ min). Avg $' || ROUND(v_xlong_session_epm::NUMERIC, 2) || '/tip — stay live longer.'
          END,
          'action', CASE v_best_session_bucket
            WHEN '0–15 min' THEN 'Run 15-min focused sessions, end cleanly, restart — repeat'
            WHEN '15–30 min' THEN 'Aim for 20–25 min sessions consistently'
            WHEN '30–60 min' THEN 'Commit to 45–60 min minimum per session'
            ELSE 'Run 60–90 min sessions for maximum yield'
          END
        )
        WHERE v_best_session_bucket IS NOT NULL

        UNION ALL

        SELECT 3, jsonb_build_object(
          'type', 'dropoff',
          'impact', 'medium',
          'title', 'Tips slow down after ' || ROUND(COALESCE(v_peak_decay_minute, v_avg_tip_gap_minutes * 3, 20))::INTEGER || ' minutes — re-engage or reset',
          'body', 'Your avg gap between tips is ' || ROUND(COALESCE(v_avg_tip_gap_minutes, 0)::NUMERIC, 0) || ' minutes. ' ||
            CASE WHEN v_peak_decay_minute IS NOT NULL
                 THEN 'Earnings start dropping at the ' || v_peak_decay_minute || '-min mark.'
                 ELSE 'After long gaps, introduce a goal, game, or direct ask to reset momentum.' END,
          'action', 'Set a re-engagement trigger at the ' || ROUND(COALESCE(v_peak_decay_minute, v_avg_tip_gap_minutes * 2, 15))::INTEGER || '-minute mark'
        )
        WHERE v_avg_tip_gap_minutes IS NOT NULL AND v_avg_tip_gap_minutes < 60

        UNION ALL

        SELECT 4, jsonb_build_object(
          'type', 'platform',
          'impact', 'medium',
          'title', v_best_platform || ' pays ' || ROUND((v_best_platform_avg / NULLIF(v_worst_platform_avg,0))::NUMERIC, 1) || 'x more per tip than ' || v_worst_platform,
          'body', 'Avg tip: $' || ROUND(v_best_platform_avg::NUMERIC, 2) || ' on ' || v_best_platform || ' vs $' || ROUND(v_worst_platform_avg::NUMERIC, 2) || ' on ' || v_worst_platform || '. Same effort, very different payoff.',
          'action', 'Shift streaming time toward ' || v_best_platform
        )
        WHERE v_best_platform IS NOT NULL AND v_worst_platform IS NOT NULL
          AND v_best_platform != v_worst_platform
          AND v_best_platform_avg > v_worst_platform_avg * 1.3

        UNION ALL

        SELECT 5, jsonb_build_object(
          'type', 'trend',
          'impact', CASE WHEN v_trend_pct > 0 THEN 'positive' ELSE 'warning' END,
          'title', CASE WHEN v_trend_pct > 0
                        THEN 'Earnings up ' || v_trend_pct || '% this month'
                        ELSE 'Earnings down ' || ABS(v_trend_pct) || '% — fix this now' END,
          'body', CASE WHEN v_trend_pct > 0
                       THEN 'Avg tip $' || ROUND(v_last_30_avg::NUMERIC, 2) || ' this month vs $' || ROUND(v_prev_30_avg::NUMERIC, 2) || ' last month.' ||
                            CASE WHEN v_hour_trending_pct > 0 AND v_best_hour IS NOT NULL
                                 THEN ' Your best hour (' || CASE WHEN v_best_hour = 0 THEN '12 AM' WHEN v_best_hour < 12 THEN v_best_hour || ' AM' WHEN v_best_hour = 12 THEN '12 PM' ELSE (v_best_hour-12) || ' PM' END || ') is also up ' || v_hour_trending_pct || '% this week.'
                                 ELSE '' END
                       ELSE 'Avg tip dropped from $' || ROUND(v_prev_30_avg::NUMERIC, 2) || ' to $' || ROUND(v_last_30_avg::NUMERIC, 2) || '. Check if you''ve been going live outside peak hours.'
                  END,
          'action', CASE WHEN v_trend_pct > 0 THEN 'Keep hitting your peak windows — momentum is real'
                         ELSE 'Strictly stream during peak hours only this week' END
        )
        WHERE v_trend_pct IS NOT NULL AND ABS(v_trend_pct) >= 5

      ) subq
    ),

    'summary', jsonb_build_object(
      'best_hour', v_best_hour,
      'best_hour_avg', ROUND(COALESCE(v_best_hour_avg,0)::NUMERIC, 2),
      'best_day', v_best_day,
      'best_platform', v_best_platform,
      'today_best_hour', v_today_best_hour,
      'overall_avg', ROUND(COALESCE(v_overall_hourly_avg,0)::NUMERIC, 2),
      'trend_pct', v_trend_pct
    )
  ) INTO v_result;

  -- Redact Pro-exclusive fields for free callers. Same numbers Pro always
  -- got (nothing above changed) — only what's returned to a non-Pro caller
  -- changes here.
  IF NOT v_is_pro THEN
    v_insights_count := jsonb_array_length(COALESCE(v_result->'insights', '[]'::jsonb));
    v_result := v_result || jsonb_build_object(
      'go_live_status', jsonb_build_object('status', v_result->'go_live_status'->>'status'),
      'daily_plan', NULL,
      'missed_opportunity', NULL,
      'session_optimization', NULL,
      'insights', NULL,
      'insights_locked_count', v_insights_count,
      'summary', NULL
    );
  END IF;

  RETURN v_result;
END;
$function$;
