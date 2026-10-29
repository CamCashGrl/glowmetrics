/**
 * @jest-environment node
 */
// Static guarantees about the Free Live Mode allowance migrations, their
// rollbacks and the client code. The behavior itself is proven by the SQL
// suite (supabase/tests/live_mode_allowance/run.sh) against a real Postgres.
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', '..')
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8')
const noComments = (sql) => sql.replace(/--.*$/gm, '')

const m1 = read('supabase/migrations/20261029_live_mode_free_allowance.sql')
const m2 = read('supabase/migrations/20261029b_private_interval_strict.sql')
const r1 = read('supabase/rollbacks/20261029_live_mode_free_allowance.rollback.sql')
const r2 = read('supabase/rollbacks/20261029b_private_interval_strict.rollback.sql')
const fn = (sql, name) => {
  const i = sql.indexOf(`FUNCTION public.${name}(`)
  if (i < 0) throw new Error(`function ${name} not found`)
  const end = sql.indexOf('$function$;', sql.indexOf('AS $function$', i) + 10)
  return sql.slice(i, end)
}

describe('entitlement: one definition, explicit unlimited', () => {
  const ent = noComments(fn(m1, 'live_mode_entitlement'))
  test('unlimited requires plan=pro AND status=active AND a Stripe subscription id', () => {
    expect(ent).toMatch(/p\.plan = 'pro'/)
    expect(ent).toMatch(/p\.subscription_status = 'active'/)
    expect(ent).toMatch(/p\.stripe_subscription_id IS NOT NULL/)
    expect(ent).toMatch(/ELSE 'capped'/)
  })
  test('trial, promo, goodwill or plan != free are not mentioned as unlimited paths', () => {
    expect(ent).not.toMatch(/trial|promo|plan_expires_at|<> 'free'|!= 'free'|'unlimited' *\)/i)
  })
  test('no other function re-implements the rule', () => {
    const others = noComments(m1).replace(ent, '')
    expect(others).not.toMatch(/subscription_status = 'active'/)
  })
  test('the app contains no entitlement logic of its own', () => {
    for (const f of ['lib/liveSession/allowanceView.js', 'app/api/live/session/start/route.js', 'app/api/live/session/route.js', 'app/live/useLiveSessionEngine.js']) {
      expect(noComments(read(f).replace(/\/\*[\s\S]*?\*\//g, ''))).not.toMatch(/subscription_status|stripe_subscription_id|plan\s*===?\s*'pro'/)
    }
  })
})

describe('creator-local week, never UTC', () => {
  const code = noComments(m1)
  test('no UTC anywhere in executable SQL', () => {
    expect(code).not.toMatch(/AT TIME ZONE 'UTC'|timezone\('UTC'|current_setting\('TimeZone'/i)
  })
  test('the week is built from the validated creator timezone', () => {
    const w = noComments(fn(m1, '_allowance_window'))
    expect(w).toMatch(/date_trunc\('week', v_local\)/)
    expect(w).toMatch(/AT TIME ZONE v_tz/)
    expect(w).toMatch(/_valid_iana_timezone\(v_tz\)/)
    expect(w).toMatch(/pg_timezone_names|_valid_iana_timezone/)
  })
  test('the app never computes a week', () => {
    for (const f of ['lib/liveSession/allowanceView.js', 'app/live/components/LiveModeAllowanceBar.js']) {
      expect(read(f)).not.toMatch(/getUTCDay|setUTCDate|startOfUtcWeek|date_trunc/)
    }
  })
})

describe('the cap is enforced in the database, first, everywhere', () => {
  test.each([
    'pause_live_session', 'resume_live_session', 'stop_live_session', 'resolve_live_session',
    'send_website_heartbeat', 'send_extension_heartbeat', 'clear_live_session_tips',
    'set_live_session_coaching_strategy', 'set_live_session_goal_tokens', 'start_live_session',
    'persist_extension_tip', 'get_live_mode_allowance',
  ])('%s calls _enforce_free_live_cap before doing anything else', (name) => {
    const body = noComments(fn(m1, name))
    const enforceAt = body.indexOf('_enforce_free_live_cap')
    expect(enforceAt).toBeGreaterThan(-1)
    // nothing that mutates sessions precedes it
    expect(body.slice(0, enforceAt)).not.toMatch(/UPDATE public\.live_sessions|INSERT INTO public\.live_sessions/)
  })
  test('sweeps, end_private_interval and start_private_interval enforce too', () => {
    expect(noComments(fn(m1, 'sweep_stale_live_session'))).toMatch(/_enforce_free_live_cap/)
    expect(noComments(fn(m1, 'sweep_all_stale_live_sessions'))).toMatch(/enforce_all_free_live_caps/)
    expect(noComments(fn(m2, 'end_private_interval'))).toMatch(/_enforce_free_live_cap/)
    expect(noComments(fn(m2, 'start_private_interval'))).toMatch(/_enforce_free_live_cap/)
  })
  test('the cap ends the session through the canonical finalize path at the cap instant', () => {
    const body = noComments(fn(m1, '_enforce_free_live_cap'))
    expect(body).toMatch(/ended_at = v_cap/)
    expect(body).toMatch(/_finalize_live_session_metrics\(v_result\.id\)/)
    expect(body).toMatch(/session_resolution_type = 'free_cap_reached'/)
    expect(body).not.toMatch(/ended_at = now\(\)/)
  })
  test('the allowance clock starts at counted_at and subtracts only explicit pauses', () => {
    const body = noComments(fn(m1, '_allowance_active_seconds'))
    expect(body).toMatch(/s\.counted_at/)
    expect(body).toMatch(/live_session_pauses/)
    expect(body).not.toMatch(/total_paused_seconds|started_at/)
  })
  test('a weekly start is counted by counted_at, stamped on the transition into live', () => {
    expect(noComments(m1)).toMatch(/WHEN \(NEW\.status = 'live' AND OLD\.status IS DISTINCT FROM 'live'\s+AND OLD\.counted_at IS NULL AND NEW\.counted_at IS NULL\)/)
    expect(noComments(fn(m1, '_assert_may_start_live'))).toMatch(/counted_at >= w\.week_start AND s\.counted_at < w\.week_end/)
  })
  test('the allowance week and timezone are snapshotted when a session is counted', () => {
    const body = noComments(fn(m1, '_stamp_live_session_counted'))
    for (const col of ['allowance_timezone', 'allowance_week_start', 'allowance_week_end']) expect(body).toContain(`NEW.${col}`)
  })
})

describe('no platform guessing', () => {
  test('start_live_session has no Chaturbate fallback and requires a strict platform', () => {
    const body = noComments(fn(m1, 'start_live_session'))
    expect(body).toMatch(/strict_canonical_platform\(p_platform\)/)
    expect(body).toMatch(/PLATFORM_REQUIRED/)
    expect(body).not.toMatch(/coalesce\([^)]*Chaturbate|'Chaturbate'\)\s*;/i)
    expect(body).not.toMatch(/Stripchat|CamSoda/)
  })
  test('strict_canonical_platform returns NULL for anything else', () => {
    const body = noComments(fn(m1, 'strict_canonical_platform'))
    expect(body).toMatch(/ELSE NULL/)
  })
  test('the strict private start has no session or Chaturbate fallback and does not lowercase', () => {
    const body = noComments(fn(m2, 'start_private_interval(\n  p_rate_per_minute numeric, p_platform text, p_username text)'.split('(')[0]))
    expect(body).toMatch(/strict_canonical_platform\(p_platform\)/)
    expect(body).not.toMatch(/stream_platform|lower\(|Chaturbate'\)/)
  })
  test('the legacy two-argument private start is retired and revoked', () => {
    expect(m2).toMatch(/PRIVATE_START_SIGNATURE_RETIRED/)
    expect(m2).toMatch(/REVOKE EXECUTE ON FUNCTION public\.start_private_interval\(numeric, text\) FROM PUBLIC, anon, authenticated/)
  })
  test('the extension and pages never default a platform', () => {
    const bg = read('..', 'chrome-extension', 'background.js')
    expect(bg).toMatch(/STRICT_PLATFORMS/)
    expect(read('..', 'chrome-extension', 'popup.js')).not.toMatch(/live_start', \{ platform: 'chaturbate'/)
    expect(read('app/dashboard/page.js')).toMatch(/const \[livePlatform, setLivePlatform\] = useState\(''\)/)
    expect(read('app/live/page.js')).toMatch(/const \[livePlatform, setLivePlatform\] = useState\(''\)/)
    expect(read('app/live/useLiveSessionEngine.js')).not.toMatch(/platform \|\| 'Chaturbate'|platform = 'Chaturbate'/)
  })
})

describe('data safety', () => {
  test('migrations are additive: no deletes, truncates, table drops or history writes', () => {
    for (const sql of [m1, m2]) {
      const code = noComments(sql)
      expect(code).not.toMatch(/\bDELETE\s+FROM\b|\bTRUNCATE\b|\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b|schema_migrations/i)
    }
  })
  test('migration 1 refuses to apply with entitlement drift or a running stream', () => {
    expect(m1).toMatch(/ENTITLEMENT_DRIFT/)
    expect(m1).toMatch(/camcash\.accept_entitlement_drift/)
    expect(m1).toMatch(/LIVE_SESSIONS_RUNNING/)
  })
  test('rollbacks never drop populated columns or data', () => {
    for (const sql of [r1, r2]) {
      const code = noComments(sql)
      expect(code).not.toMatch(/\bDROP\s+COLUMN\b|\bDROP\s+TABLE\b|\bDELETE\s+FROM\b|\bTRUNCATE\b|\bDROP\s+FUNCTION\b|schema_migrations/i)
    }
    expect(r1).toMatch(/NON-DESTRUCTIVE/); expect(r2).toMatch(/NON-DESTRUCTIVE/)
  })
  test('never_connected sessions are closed uncounted and not finalized into a show', () => {
    const body = noComments(fn(m1, '_expire_never_connected'))
    expect(body).toMatch(/session_resolution_type = 'never_connected'/)
    expect(body).toMatch(/counted_at IS NULL/)
    expect(body).toMatch(/interval '20 minutes'/)
    expect(body).not.toMatch(/_finalize_live_session_metrics/)
  })
})
