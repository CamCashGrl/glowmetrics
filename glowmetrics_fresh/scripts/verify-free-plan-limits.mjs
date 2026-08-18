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

const constantsSrc = read('lib/constants.js')
const analyticsSrc = read('lib/analytics.js')
const live = read('app/live/page.js')
const moneyMap = read('app/dashboard/MoneyMap.js')

const checks = [
  ['Free platform limit is 3', /FREE_MAX_PLATFORMS\s*=\s*3/.test(plan)],

  // ── CamSoda is out of release scope ────────────────────────────────────
  // Its import path is unfinished. It must not be tracked, offered, or
  // counted anywhere in the product, while the public Token Calculator and
  // the /guides content keep quoting its published token rate.
  ['the supported set is an explicit list, not derived from the rate table',
    !/SUPPORTED_PLATFORMS\s*=\s*Object\.keys\(PLATFORM_TOKEN_RATES\)/.test(constantsSrc)],
  ['the CSV parser has no CamSoda detection branch',
    !/includes\('camsoda'\)/.test(analyticsSrc)],
  ['the upload platform selector is driven by the canonical set',
    /SUPPORTED_PLATFORMS\.map/.test(dashboard)],
  // The Token Calculator is a rate utility, not a tracking claim, and keeps
  // quoting CamSoda's published rate. It is the ONLY place in the dashboard
  // allowed to name it — pin the count so a selector, an import hint, or an
  // export walkthrough cannot quietly reappear.
  ['CamSoda survives in the dashboard only as the Token Calculator subtitle',
    (dashboard.match(/camsoda/gi) || []).length === 1 &&
    /Convert tokens to USD earnings[^<]*CamSoda/.test(dashboard)],
  ['the CSV export walkthrough no longer tells creators to upload CamSoda data',
    !/CamSoda broadcaster dashboard/.test(dashboard)],
  ['the preview platform list no longer hardcodes CamSoda', !/camsoda/i.test(preview)],
  ['the Live Mode platform selector no longer offers CamSoda', !/camsoda/i.test(live)],
  ['MoneyMap no longer buckets or colours CamSoda', !/camsoda/i.test(moneyMap)],
  ['the DB platform-cap filter is corrected by a follow-up migration, not an edit to the applied one',
    fs.existsSync(path.join(root, 'supabase/migrations/20260818_drop_camsoda_from_free_platform_cap_filter.sql'))],
  ['that follow-up migration removes camsoda from the guard filter',
    !/camsoda'\)/.test(read('supabase/migrations/20260818_drop_camsoda_from_free_platform_cap_filter.sql')
      .split('v_new_list')[1] || 'camsoda\')')],
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

// ── 'Unknown' must not consume a Free platform slot ────────────────────
// The CSV parser writes 'Unknown' for rows whose platform it cannot detect.
// That is an absence of a platform, so it must not spend one of the three
// Free slots — it was doing so in planLimits, the upload route, and both DB
// guards.
{
  const { uniquePlatforms, getFreePlatformState, splitFreePlatforms, FREE_MAX_PLATFORMS: CAP } =
    await import('../lib/planLimits.js')
  const { isSupportedPlatform, SUPPORTED_PLATFORMS, PLATFORM_TOKEN_RATES } =
    await import('../lib/constants.js')

  const row = (platform) => ({ platform, date_time: new Date().toISOString(), usd: 1 })

  extra.push(['Unknown is not a supported platform', !isSupportedPlatform('Unknown')])
  extra.push(['Every tracked platform is supported',
    ['Chaturbate','BongaCams','MyFreeCams','Stripchat'].every(isSupportedPlatform)])

  // CamSoda carries a token rate (the public Token Calculator quotes it) but
  // its import path is not shipped. Deriving the supported set from the rate
  // table promoted it into a tracked platform, so it passed upload validation
  // and spent one of a Free creator's three slots. Pin both halves: the rate
  // stays, the tracking claim does not.
  extra.push(['CamSoda is not a supported platform', !isSupportedPlatform('CamSoda')])
  extra.push(['CamSoda is not supported under any casing',
    !isSupportedPlatform('camsoda') && !isSupportedPlatform('CAMSODA') && !isSupportedPlatform(' CamSoda ')])
  extra.push(['CamSoda consumes no Free platform slot',
    uniquePlatforms([row('Chaturbate'), row('CamSoda')]).length === 1])
  extra.push(['a rate-table entry is no longer automatically a tracked platform',
    PLATFORM_TOKEN_RATES.CamSoda === 0.05 && !SUPPORTED_PLATFORMS.includes('CamSoda')])
  extra.push(['the supported set is exactly the four shipped platforms',
    SUPPORTED_PLATFORMS.length === 4])

  // 3 real + Unknown -> still 3 slots consumed.
  const threePlusUnknown = [row('Chaturbate'), row('BongaCams'), row('MyFreeCams'), row('Unknown')]
  extra.push(['3 real platforms + Unknown counts as 3 slots',
    uniquePlatforms(threePlusUnknown).length === 3])

  // Unknown-only -> 0 slots.
  extra.push(['Unknown-only data consumes 0 slots', uniquePlatforms([row('Unknown')]).length === 0])

  // A creator at the cap can still import Unknown rows.
  const atCap = ['chaturbate','bongacams','myfreecams']
  extra.push(['Unknown never needs a new slot even at the cap',
    getFreePlatformState(atCap, 'Unknown').allowed === true &&
    getFreePlatformState(atCap, 'Unknown').needsNewPlatform === false])
  extra.push(['Unknown rows are never blocked by the platform split',
    splitFreePlatforms([row('Unknown')], atCap).excluded.length === 0])

  // A genuine 4th supported platform still follows the split/lock behaviour.
  const fourth = splitFreePlatforms([row('Stripchat')], atCap)
  extra.push(['A 4th REAL platform is still split out for the locked preview',
    fourth.excluded.length === 1 && fourth.visible.length === 0])
  extra.push(['A 4th real platform is refused a slot', getFreePlatformState(atCap, 'Stripchat').allowed === false])
  extra.push(['An already-tracked platform never consumes another slot',
    getFreePlatformState(atCap, 'BongaCams').allowed === true])

  // Unknown alongside a blocked 4th: Unknown stays, Stripchat is split out.
  const mixed = splitFreePlatforms([row('Unknown'), row('Stripchat'), row('Chaturbate')], atCap)
  extra.push(['Unknown survives while a real 4th platform is locked',
    mixed.visible.some(r => r.platform === 'Unknown') &&
    mixed.excluded.every(r => r.platform === 'Stripchat')])
}

// ── Delete -> re-upload, and post-checkout unlock ─────────────────────
{
  const uploadSrc = read('app/api/upload/route.js')
  const dash = read('app/dashboard/page.js')

  // No permanent upload quota: csv_uploads / csv_upload_count are an audit
  // trail, never a gate. Verified against production too — the owner's
  // account has 19 csv_uploads rows and still imports.
  extra.push(['Upload route enforces no per-account upload quota',
    !/csv_upload_count/.test(uploadSrc) && !/uploadsRemaining|FREE_MAX_UPLOADS|upload_limit/.test(uploadSrc)])
  extra.push(['Upload route only refuses a file with no usable rows at all',
    /No valid rows found/.test(uploadSrc)])
  extra.push(['Deleting tips does not touch the csv_uploads audit trail',
    /from\("tips"\)\.delete\(\)/.test(dash) && !/from\(['"]csv_uploads['"]\)\.delete/.test(dash)])

  // Post-checkout entitlement refresh (priority 7).
  extra.push(['Returning from checkout re-reads entitlement', /refreshEntitlement/.test(dash)])
  extra.push(['It polls, because the Stripe webhook can land after the redirect',
    /attempt < 6/.test(dash)])
  extra.push(['It uses the single canonical plan predicate', /if \(isProPlan\(data\)\)/.test(dash)])
  extra.push(['It reloads data so full history appears without a re-upload',
    /loadData\(u\.id, true, \{ silent: true \}\)/.test(dash)])
  extra.push(['It never writes an entitlement client-side',
    !/from\(['"]profiles['"]\)[\s\S]{0,80}\.update\(\{[^}]*plan:/.test(dash)])

  // Honest unlock copy: history needs no re-upload; a blocked platform does.
  extra.push(['History card states it unlocks with no re-upload',
    /unlocks them instantly, with no re-upload/.test(dash)])
  extra.push(['Platform card no longer implies the whole upload must be redone',
    !/Upgrade, then re-upload this file/.test(dash)])
}

for (const [name, ok] of extra) {
  if (!ok) { console.error(`FAIL: ${name}`); extraFailed++ } else { console.log(`PASS: ${name}`) }
}
console.log(`\n${extra.length - extraFailed}/${extra.length} per-platform-window checks passed`)
if (extraFailed > 0) process.exit(1)
