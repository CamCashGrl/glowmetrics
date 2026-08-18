// Regression checks for the Free 3-platform / 31-day conversion boundary.
// This test is intentionally source-level: the final enforcement is split
// between API/import filtering and Supabase trigger/RPC migration.

import fs from 'fs'
import path from 'path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const plan = read('lib/planLimits.js')
const upload = read('app/api/upload/route.js')
const dashboard = read('app/dashboard/page.js')
const preview = read('app/dashboard/DashboardPreview.js')
const pricing = read('app/pricing/PricingClient.js')
const migration = read('supabase/migrations/20260817_free_plan_three_platform_31_day_history.sql')
const paidSessionsMigration = read('supabase/migrations/20260817b_free_platform_cap_counts_paid_sessions.sql')

const extra = []
let extraFailed = 0

const checks = [
  ['Free platform limit is 3', /FREE_MAX_PLATFORMS\s*=\s*3/.test(plan)],
  ['Free history window is 31 days', /FREE_HISTORY_DAYS\s*=\s*31/.test(plan)],
  ['Free history is filtered without deleting rows', /filterFreeHistory/.test(dashboard) && /setTips\(visibleData\)/.test(dashboard)],
  ['Upload route reads plan', /select\('plan'\)/.test(upload)],
  // The 4th platform must NOT fail the upload — the conversion spec requires
  // splitting so the extra platform becomes a locked preview instead.
  ['Upload route splits rather than rejecting a 4th platform',
    /platformAllowedRows/.test(upload) && /platformBlockedRows/.test(upload)],
  ['Upload route only errors when NOTHING is importable',
    /!platformAllowedRows\.length && platformBlockedRows\.length/.test(upload)],
  ['Upload route reports history truncation', /historyRemovedCount/.test(upload) && /historyLimited/.test(upload)],
  ['Dashboard imports the same Free history helper', /filterFreeHistory/.test(dashboard)],
  ['Dashboard exposes CSV history upgrade CTA', /csv_history/.test(dashboard) && /Unlock Full History/.test(dashboard)],
  ['Dashboard exposes 3-platform upgrade CTA', /csv_platform_limit/.test(dashboard) && /Compare More Platforms/.test(dashboard)],
  ['Dashboard no longer treats any single existing platform as the limit', /allPlatforms\.length\s*>=\s*FREE_MAX_PLATFORMS/.test(dashboard)],
  ['Preview no longer says Free is one platform',
    !/track more than one platform/.test(preview)],
  ['Preview gates multi-platform on the shared constant, not on being free at all',
    /platformCount >= FREE_MAX_PLATFORMS/.test(preview)],
  ['Preview lets Free compare platforms it is entitled to',
    /platformComparison:\s*\{\s*needsData: platformCount < 2, requiresPro: false/.test(preview)],
  ['Pricing says up to 3 platforms', /Track up to 3 platforms/.test(pricing) || /up to 3 cam platforms/.test(pricing)],
  ['Pricing says 31-day CSV history', /31 days of tip history per platform/.test(pricing) || /31-day history window per platform/.test(pricing)],
  ['DB trigger uses 3-platform ceiling', /existing_platform_count\s*>=\s*3/.test(migration)],
  ['A migration exists that raises the DB cap to 3', /existing_platform_count >= 3/.test(migration)],
  ['A migration exists that adds paid_sessions to the cap count',
    /paid_sessions/.test(paidSessionsMigration)],
  ['Cap migrations are idempotent (safe to re-run)',
    /already migrated/.test(paidSessionsMigration) && /CONTINUE;/.test(migration)],
  ['Cap migrations patch the live definition rather than retyping the body',
    /pg_get_functiondef/.test(migration) && /pg_get_functiondef/.test(paidSessionsMigration)],
  ['Both DB guards are patched, not just the insert trigger', /check_free_tier_platform_limit/.test(migration) && /enforce_free_tier_platform_limit/.test(migration)],
]

let passed = 0
for (const [name, ok] of checks) {
  if (!ok) {
    console.error(`FAIL: ${name}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${name}`)
    passed++
  }
}

console.log(`\n${passed}/${checks.length} checks passed`)
if (passed !== checks.length) process.exit(1)

// ── Per-platform Free history window ───────────────────────────────────
// The Free rule is 31 days PER PLATFORM. filterFreeHistory/splitFreeHistory
// previously anchored ONE global window to the newest row in the whole
// upload, so a platform whose data ended earlier vanished entirely. On the
// owner's real account (Chaturbate last tip 2026-07-02, BongaCams
// 2026-03-19) that hid 2,814 tips / $754.29 of legitimately-allowed
// BongaCams data — Free showed nothing for a platform the creator is
// entitled to see, which reads as "the import failed".
{
  const { filterFreeHistory, splitFreeHistory } = await import('../lib/planLimits.js')
  const iso = (d) => new Date(d).toISOString()
  const rows = [
    { platform: 'Chaturbate', date_time: iso('2026-07-02'), usd: 10 },
    { platform: 'Chaturbate', date_time: iso('2026-06-20'), usd: 10 },
    { platform: 'BongaCams',  date_time: iso('2026-03-19'), usd: 10 },
    { platform: 'BongaCams',  date_time: iso('2026-03-05'), usd: 10 },
    { platform: 'BongaCams',  date_time: iso('2025-01-01'), usd: 10 }, // outside its own window
  ]

  const kept = filterFreeHistory(rows).rows
  const keptBonga = kept.filter((r) => r.platform === 'BongaCams').length
  const keptCb = kept.filter((r) => r.platform === 'Chaturbate').length

  extra.push(['Each platform keeps its own 31-day window (BongaCams not erased by Chaturbate being newer)', keptBonga === 2])
  extra.push(['The newer platform still keeps its own rows', keptCb === 2])
  extra.push(['Rows outside a platform\'s OWN window are still excluded', kept.length === 4])
  extra.push(['Per-platform windows are reported for messaging',
    Boolean(filterFreeHistory(rows).windowsByPlatform?.bongacams?.windowStart)])

  const split = splitFreeHistory(rows)
  extra.push(['splitFreeHistory agrees with filterFreeHistory', split.visible.length === kept.length])
  extra.push(['Excluded rows are preserved, not dropped', split.excluded.length === 1])
  extra.push(['Nothing is lost across the split', split.visible.length + split.excluded.length === rows.length])

  // Undated rows must stay visible rather than silently disappearing.
  const withUndated = [...rows, { platform: 'Chaturbate', date_time: 'not-a-date', usd: 5 }]
  extra.push(['Rows with an unparseable date are kept, not dropped',
    filterFreeHistory(withUndated).rows.some((r) => r.date_time === 'not-a-date')])
}

for (const [name, ok] of extra) {
  if (!ok) { console.error(`FAIL: ${name}`); extraFailed++ } else { console.log(`PASS: ${name}`) }
}
console.log(`\n${extra.length - extraFailed}/${extra.length} per-platform-window checks passed`)
if (extraFailed > 0) process.exit(1)
