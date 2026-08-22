// The direct-INSERT bypass on public.live_sessions.
//
// Live Mode was gated in three places — the dashboard tab, /live, the start
// API route, and start_live_session() itself — and still leaked, because
// live_sessions carries one permissive ALL policy and had no INSERT trigger.
// An authenticated Free creator with nothing but the public anon key could
// POST a row to /rest/v1/live_sessions with their own user_id and get a live
// session without touching any of those four gates.
//
// 20260821_close_live_sessions_direct_insert_bypass.sql closes it with a
// BEFORE INSERT trigger that PERFORMs the EXISTING canonical
// check_live_mode_pro_entitlement(). These checks pin that shape: the right
// event, the canonical function, no second entitlement rule, no weakened
// policy, and the reconnect exemption that keeps a downgraded creator able to
// finish the session they were already streaming.
//
// The behavioural half of this (a Free INSERT actually being refused by
// Postgres) lives in scripts/verify-live-sessions-insert-gate.sql, which runs
// every plan shape against the real database inside a transaction it rolls
// back. This file is the source-level guard that survives in CI without
// database credentials, matching how the rest of scripts/ is written.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const MIG = '../supabase/migrations/20260821_close_live_sessions_direct_insert_bypass.sql'
const raw = read(MIG)
// SQL line comments carry the rationale, including quotations of the copy that
// was removed. Assertions about what the migration DOES must read the stripped
// body, or a comment mentioning "Standard" would look like a live claim.
const sql = raw.replace(/^\s*--.*$/gm, '')

// The trigger function body only — so "duplicated logic" checks cannot be
// satisfied or defeated by the unrelated error-message DO block below it.
const fnStart = sql.indexOf('function public.enforce_live_mode_pro_entitlement')
const fnBody = sql.slice(fnStart, sql.indexOf('$$;', fnStart))

// ══════════════════════════════════════════════════════════════════════
// 1. THE TRIGGER EXISTS, ON THE RIGHT TABLE AND THE RIGHT EVENT.
// ══════════════════════════════════════════════════════════════════════
check('a trigger is created on public.live_sessions',
  /create trigger trg_enforce_live_mode_pro_entitlement\s+before insert on public\.live_sessions/i.test(sql))
check('it fires per row, before the insert lands',
  /before insert on public\.live_sessions\s+for each row/i.test(sql))
check('it is INSERT-only — UPDATE and DELETE on live sessions stay untouched',
  !/before (update|delete)[\s\S]{0,60}live_sessions/i.test(sql) &&
  !/before insert or update/i.test(sql) &&
  !/\bfor all\b/i.test(sql))
check('it is re-runnable — the trigger is dropped if present before creating',
  /drop trigger if exists trg_enforce_live_mode_pro_entitlement on public\.live_sessions/i.test(sql))

// ══════════════════════════════════════════════════════════════════════
// 2. IT REUSES THE CANONICAL ENTITLEMENT FUNCTION.
// ══════════════════════════════════════════════════════════════════════
check('the guard calls the existing check_live_mode_pro_entitlement',
  /perform public\.check_live_mode_pro_entitlement\(auth\.uid\(\)\)/i.test(fnBody))
check('no second Pro-check function is defined',
  (sql.match(/create (or replace )?function/gi) || []).length === 1)
check('the plan rule is NOT restated in SQL — no plan literal in the trigger',
  !/'free'/i.test(fnBody) && !/'pro'/i.test(fnBody) && !/'unlimited'/i.test(fnBody),
  fnBody.slice(0, 200))
check('expiry is NOT re-derived in the trigger — plan_expires_at is never read',
  !/plan_expires_at/i.test(fnBody))
check('the trigger never reads the profiles table itself',
  !/from profiles/i.test(fnBody) && !/from public\.profiles/i.test(fnBody))
check('no second subscription system is introduced',
  !/stripe/i.test(sql) && !/subscription/i.test(sql) && !/allow.?list/i.test(sql))

// ══════════════════════════════════════════════════════════════════════
// 3. THE EXEMPTIONS ARE THE ONES start_live_session() ALREADY MAKES.
//
// A BEFORE INSERT trigger fires ahead of the partial unique index that
// start_live_session() relies on: it lets the insert fail with
// unique_violation and catches it to return the in-progress row. Without
// the same in-progress predicate here, a creator who downgraded mid-stream
// would get an uncaught P0001 instead, and could no longer reconnect to or
// end the session they were already running.
// ══════════════════════════════════════════════════════════════════════
{
  const start = read('../supabase/migrations/20260814c_gate_live_mode_pro_only.sql')
  const statuses = /'starting'\s*,\s*'live'\s*,\s*'inactive_warning'\s*,\s*'ending'/
  check('the reconnect exemption is present in the trigger', statuses.test(fnBody))
  check('it is the SAME predicate start_live_session() uses, not a new one',
    statuses.test(start) &&
    /status in \('starting', ?'live', ?'inactive_warning', ?'ending'\)/i.test(fnBody.replace(/\s+/g, ' ')))
  check('a service-role/maintenance context is exempt, so the pg_cron sweep still runs',
    /if auth\.uid\(\) is null then\s*return new;/i.test(fnBody))
  check('a row for another user is left to the RLS policy, not turned into a plan oracle',
    /new\.user_id is distinct from auth\.uid\(\)/i.test(fnBody))
}

// ══════════════════════════════════════════════════════════════════════
// 4. NOTHING EXISTING IS WEAKENED OR DROPPED.
// ══════════════════════════════════════════════════════════════════════
check('the RLS policy on live_sessions is not dropped or altered',
  !/drop policy/i.test(sql) && !/alter policy/i.test(sql) && !/create policy/i.test(sql))
check('row level security is never disabled',
  !/disable row level security/i.test(sql))
check('the existing platform-limit triggers are not touched',
  !/trg_enforce_platform_limit/i.test(sql))
check('the updated_at trigger is not touched',
  !/live_sessions_updated_at/i.test(sql))
check('no destructive statement is present',
  !/\bdrop table\b/i.test(sql) && !/\bdelete from\b/i.test(sql) &&
  !/\btruncate\b/i.test(sql) && !/\bdrop column\b/i.test(sql) && !/\balter table\b/i.test(sql))

// ══════════════════════════════════════════════════════════════════════
// 5. THE STALE PLATFORM-LIMIT ERROR TEXT.
//
// Both halves of the Free platform cap named a plan called "Standard", which
// this product does not sell, and check_free_tier_platform_limit's copy also
// told the reader that Free "tracks Live Mode on up to 3 platforms" — false
// since 20260814c made Live Mode Pro-only.
// ══════════════════════════════════════════════════════════════════════
{
  const m = sql.match(/v_replacement text := '([^']*)'/)
  check('a replacement message is defined', !!m, sql.slice(sql.indexOf('v_replacement'), 200))
  const msg = m ? m[1] : ''
  check('the corrected message does not name a "Standard" plan', !/Standard/.test(msg), msg)
  check('the corrected message does not imply Free can use Live Mode',
    !/Live Mode/i.test(msg), msg)
  check('the corrected message names Creator Pro', /Creator Pro/.test(msg), msg)
  check('the canonical $19.99/mo price is preserved', /\$19\.99\/mo/.test(msg), msg)
  check('the message stays actionable — it says what to do, not just what failed',
    /Upgrade/i.test(msg), msg)
  check('it stays concise enough for an error response', msg.length > 0 && msg.length <= 120, `${msg.length} chars`)

  // The rewrite must be self-checking rather than fire-and-forget: it asserts
  // the stale literal is there before replacing, and asserts the stale wording
  // is gone afterwards, so a partially-migrated database fails loudly.
  check('the rewrite refuses to run against an unrecognised definition',
    /RAISE EXCEPTION 'Expected the stale platform-limit message/i.test(sql))
  check('the rewrite re-checks that "Standard" is gone afterwards',
    /position\('Standard' IN v_new\) > 0/.test(sql))
  check('the rewrite re-checks that the Free/Live Mode implication is gone afterwards',
    /position\('Live Mode' IN v_new\) > 0/.test(sql))
  check('it is idempotent — an already-corrected definition is skipped, not failed',
    /position\(v_replacement IN v_def\) > 0/.test(sql) && /CONTINUE;/.test(sql))
  check('both halves of the platform cap are corrected together',
    /'check_free_tier_platform_limit', 'enforce_free_tier_platform_limit'/.test(sql))
  check('the bodies are patched via pg_get_functiondef, so no unrelated logic drifts',
    /pg_get_functiondef/.test(sql) && /replace\(v_def, v_old, v_replacement\)/.test(sql))
}

// ══════════════════════════════════════════════════════════════════════
// 6. NO OTHER MIGRATION ALREADY DOES THIS (duplicate/conflict guard).
// ══════════════════════════════════════════════════════════════════════
{
  const { readdirSync } = await import('fs')
  const dir = new URL('../supabase/migrations/', import.meta.url)
  const files = readdirSync(dir).filter(f => f.endsWith('.sql'))
  const owners = files.filter(f =>
    /before insert on public\.live_sessions/i.test(readFileSync(new URL(f, dir), 'utf8')))
  check('exactly one migration creates an INSERT trigger on live_sessions',
    owners.length === 1 && owners[0] === '20260821_close_live_sessions_direct_insert_bypass.sql',
    owners.join(', '))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
