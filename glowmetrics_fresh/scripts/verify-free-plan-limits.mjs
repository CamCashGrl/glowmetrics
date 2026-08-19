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
// The post-import result moved out of page.js into its own component. Checks
// about the result UI must see both files, or they silently pass/fail on the
// wrong one.
const importResult = read('app/dashboard/ImportResult.js')
const lockedModuleSrc = read('app/dashboard/components/LockedModule.js')
const upgradeCtx = read('lib/upgradeContext.js')
const commandCenter = read('app/dashboard/CommandCenter.js')
const conversionBand = read('app/dashboard/ConversionBand.js')
const resultUi = dashboard + '\n' + importResult + read('app/dashboard/components/HistoryTimeline.js') + read('app/dashboard/components/LockedValue.js')
const migration = read('supabase/migrations/20260817_free_plan_three_platform_31_day_history.sql')
const paidSessionsMigration = read('supabase/migrations/20260817b_free_platform_cap_counts_paid_sessions.sql')

// Every migration in the repo, including any outside this app directory.
// A same-named file at the REPO ROOT redefined both Free-tier platform guards
// from scratch and would have reverted the Unknown exclusion, the CamSoda
// exclusion, and the auth.uid() self-restriction on the SECURITY DEFINER
// check function. It is neutralised; these checks stop that class of file
// from coming back unnoticed.
// The canonical directory legitimately contains five historical migrations
// that built these guards up over time (20260806b is the one that ADDED the
// auth.uid() restriction). Those are the applied record and must stay. The
// hazard is a guard definition living OUTSIDE that directory, where it is
// applied out of order — or by hand — against a database whose guards have
// since moved on.
const repoRoot = path.resolve(root, '..')
const canonicalDir = path.join(root, 'supabase/migrations')
const strayMigrationDirs = [path.join(repoRoot, 'supabase/migrations')]
  .filter((d) => fs.existsSync(d) && path.resolve(d) !== path.resolve(canonicalDir))
const guardRedefiners = strayMigrationDirs.flatMap((dir) =>
  fs.readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => ({ file: path.join(dir, f), sql: fs.readFileSync(path.join(dir, f), 'utf8') }))
    // Only files that actually (re)define one of the two guards as a full body.
    .filter(({ sql }) => /create\s+or\s+replace\s+function\s+(public\.)?(check|enforce)_free_tier_platform_limit/i
      .test(stripSqlComments(sql)))
)

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')
}

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
  // ── No migration may retype the Free-tier guards ───────────────────────
  // Both guards must only ever be patched via pg_get_functiondef(), so a
  // hand-retyped body cannot silently drop a filter or a security check.
  ['no migration outside the canonical directory defines a Free-tier platform guard',
    guardRedefiners.length === 0,
    guardRedefiners.map(g => path.relative(repoRoot, g.file)).join(', ')],
  ['the superseded root-level migration is inert',
    !fs.existsSync(path.join(repoRoot, 'supabase/migrations/20260817_free_plan_three_platform_31_day_history.sql')) ||
    /SUPERSEDED/.test(fs.readFileSync(path.join(repoRoot, 'supabase/migrations/20260817_free_plan_three_platform_31_day_history.sql'), 'utf8'))],
  ['the live check function keeps its auth.uid() self-restriction',
    /auth\.uid\(\)/.test(read('supabase/migrations/20260806b_restrict_check_free_tier_platform_limit_to_self.sql'))],

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
  // Now also selects timezone, because the locked-insight previews run the
  // canonical engine server-side and every day/hour must be creator-local.
  ['Upload route reads plan', /select\('plan(, timezone)?'\)/.test(upload)],
  // The 4th platform must NOT fail the upload — the conversion spec requires
  // splitting so the extra platform becomes a locked preview instead.
  ['Upload route splits rather than rejecting a 4th platform',
    /platformAllowedRows/.test(upload) && /platformBlockedRows/.test(upload)],
  ['Upload route only errors when NOTHING is importable',
    /!platformAllowedRows\.length && platformBlockedRows\.length/.test(upload)],
  ['Upload route reports history truncation', /historyRemovedCount/.test(upload) && /historyLimited/.test(upload)],
  ['Dashboard imports the same Free history helper', /filterFreeHistory/.test(dashboard)],
  ['Dashboard exposes CSV history upgrade CTA', /csv_history/.test(dashboard) && /csv_locked_history/.test(resultUi) && /Unlock Pro/.test(resultUi)],
  ['Dashboard exposes 3-platform upgrade CTA', /csv_platform_limit/.test(dashboard) && /Compare More Platforms/.test(resultUi)],
  ['Dashboard no longer treats any single existing platform as the limit', /allPlatforms\.length\s*>=\s*FREE_MAX_PLATFORMS/.test(dashboard)],
  ['Preview no longer says Free is one platform',
    !/track more than one platform/.test(preview)],

  // ── Stale "1 platform" copy ────────────────────────────────────────────
  // The check above only matched one phrasing, so two other strings survived
  // the move to a 3-platform Free tier and were caught by rendering the page:
  // the dashboard's "YOUR PLAN" panel ("tracks 1 platform — import as much
  // history as you want from it, no limits" — wrong on BOTH counts) and the
  // preview's Platforms card helper. Match the number, not one sentence.
  ['no dashboard copy still claims Free tracks 1 platform',
    !/tracks?\s+(<[^>]+>)?\s*1 platform/.test(dashboard)],
  ['no preview copy still claims Free tracks 1 platform',
    !/tracks?\s+1 platform/.test(preview)],
  ['dashboard no longer promises unlimited history on Free',
    !/as much history as you want/.test(dashboard)],
  ['the plan panel states both Free limits from the shared constants',
    /up to \{FREE_MAX_PLATFORMS\} platforms/.test(dashboard) &&
    /\{FREE_HISTORY_DAYS\}-day analysis window/.test(dashboard)],
  // ── Post-import conversion experience ──────────────────────────────────
  // A multi-year upload used to headline the inserted count and then show the
  // Free window's numbers directly beneath it, with nothing between them —
  // "1,912 tips" followed by "13 tips" reads as a broken import.
  // The whole file is reported before any plan boundary appears. Headlining
  // the Free window on a multi-year file read "1,912 tips imported" followed
  // by "13 tips", which looks like a failed import though both are correct.
  ['the result leads with the whole file, not the Free slice',
    /CSV imported successfully/.test(resultUi) &&
    resultUi.indexOf('full?.tips') < resultUi.indexOf('Your Free snapshot')],
  ['the headline totals come from fullFileSummary',
    /full\?\.tips \?\? result\.inserted/.test(resultUi)],
  ['Free results name their window up front',
    /Free analyzes the most recent \{freeHistoryDays\} days of activity for each platform/.test(resultUi)],
  // Sparse data is still valid data. The notice must key off ABSOLUTE recent
  // activity — a creator with 412 recent tips out of 1,912 is long-tenured,
  // not sparse, and must not be told their activity is light.
  ['the sparse notice is judged on absolute activity, not a share of the file',
    /free\.tips < 30 \|\| free\.sessions < 3/.test(resultUi) &&
    !/\* 0\.25/.test(resultUi)],
  ['sparse copy never calls a thin window empty or failed',
    !/no data for this period/i.test(resultUi) && !/import failed/i.test(resultUi)],
  // The response mapping is a whitelist — a field missing from it never
  // reaches the UI, which is exactly how the previews silently vanished once.
  ['lockedInsights is whitelisted through to the UI',
    /lockedInsights: result\.lockedInsights \|\| null/.test(dashboard)],
  ['the previews read the server-computed insights, not a client recompute',
    /const li = !isPro \? result\.lockedInsights : null/.test(resultUi)],
  ['locked previews exist for trend, fans and sessions',
    /Long-term earnings trend/i.test(resultUi) &&
    /Deeper supporter intelligence/i.test(resultUi) &&
    /Session & performance patterns/i.test(resultUi)],
  // Best windows reuse Stream Planner's tier gate. A window seen once is not
  // a recommendation, so when nothing qualifies the UI must say so rather
  // than rank noise behind a blur.
  ['best-window previews reuse the canonical tier gate',
    /RECOMMENDABLE_TIERS = new Set\(\['supported', 'high'\]\)/.test(upload)],
  // When no slot clears the canonical tier gate this is an INSUFFICIENT-DATA
  // state, not a lock: no badge, no upgrade CTA, because upgrading would not
  // manufacture the evidence.
  ['the route withholds best windows instead of inventing them',
    /bestWindowsWithheld/.test(upload) &&
    /enough repeat sessions yet/.test(resultUi) &&
    /<InsufficientData/.test(resultUi)],
  ['locked insights are derived from ONE canonical engine run',
    /a = aggregateRows\(rows, tz\)/.test(upload) &&
    !/new Date\(\)\.getTimezoneOffset/.test(upload)],
  ['the route reads creator-local time from profiles, never the browser',
    /select\('plan, timezone'\)/.test(upload) && /creatorTz/.test(upload)],
  ['locked insights are Free-only', /!isPro \? buildLockedInsights/.test(upload)],

  // ── Contextual upgrade prompts ─────────────────────────────────────────
  // Every CTA, modal headline and benefit list resolves from ONE helper, so a
  // click on "Compare More Platforms" cannot open a pitch about history.
  ['upgrade context is resolved in one shared module',
    /export function resolveUpgradeContext/.test(upgradeCtx) &&
    /resolveUpgradeContext/.test(importResult) && /resolveUpgradeContext/.test(dashboard)],
  ['the contextual CTAs cover history, platforms and deeper analysis',
    /Unlock Full History →/.test(upgradeCtx) && /Compare More Platforms →/.test(upgradeCtx) &&
    /Unlock Your Deeper Analysis →/.test(upgradeCtx)],
  ['the upgrade helper computes no analytics of its own',
    !/aggregateRows|detectSessions|reduce\(/.test(upgradeCtx)],
  ['the modal benefit list is driven by the trigger, not hardcoded',
    /upgradeCopy\.benefits/.test(dashboard) && !/See ALL your top spenders/.test(dashboard)],
  ["the modal repeats the creator's own measured locked total",
    /upgradeValueLine/.test(dashboard) &&
    /upgradeValueLine\.usd/.test(dashboard) &&
    /additional earnings already saved/.test(dashboard)],
  // An invented statistic with no source behind it. Comment-stripped: the
  // code comment above the removal quotes the old line deliberately, to
  // explain why it went. Only shipped copy counts.
  ['the fabricated "30-60% of earning potential" claim is gone',
    !/30–60%|30-60%/.test(
      dashboard.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, ''))],
  ['no upgrade copy still claims Free tracks 1 platform',
    !/tracked 1 platform/.test(dashboard)],

  // ── Blueprint hierarchy on the result screen ───────────────────────────
  ['a personalised finding is offered before anything locked',
    /freeHighlight/.test(importResult) && /buildFreeHighlight/.test(upload)],
  ['that finding is evidence-gated, not shown for any single tip',
    /rows\.length < 3/.test(upload) && /days >= 3/.test(upload) && /top\.count >= 2/.test(upload)],
  ['the primary action is one unambiguous button',
    /Unlock Pro →/.test(importResult)],
  ['a reassurance block sits after the CTA',
    /without re-uploading/.test(importResult) && /no upload quota/.test(importResult)],

  // ── Dashboard conversion band: one contextual card, never a generic
  //    banner. This argument used to live inside the Command Center; it now
  //    sits above it in ConversionBand.js, so the Command Center is back to
  //    pure analytics rendering and the band owns the locked-value case.
  ['the dashboard carries the conversion argument past the import screen',
    /ConversionBand/.test(dashboard) && conversionBand.length > 0],
  ['the band only renders with a genuine, measured reason',
    /lockedHistory|platformCap|sparseRecent/.test(conversionBand) &&
    /conversionContext/.test(dashboard)],
  ['the band computes nothing locally — it reports what was measured upstream',
    !/aggregateRows|detectSessions/.test(conversionBand)],
  ['Command Center still computes nothing locally',
    !/aggregateRows/.test(commandCenter)],

  // ── The 31-day rule is an ANALYSIS window, never an import cap ─────────
  // Pricing said "Import up to 31 days of tip history per platform", which
  // understated what Free accepts (any date range, every row stored) and
  // implied Pro would need the same data uploaded again. Both claims are
  // false and they undercut the whole no-re-upload promise.
  // Comment-stripped: the code comment above the fix quotes the old string
  // deliberately, to explain why it was wrong. Only shipped copy counts.
  ['pricing never frames the 31-day rule as an import limit',
    !/[Ii]mport up to 31 days/.test(pricing.replace(/^\s*\/\/.*$/gm, ''))],
  ['pricing states the window is an analysis focus, per platform',
    /most recent 31 days per platform/.test(pricing)],
  ['pricing says older history stays saved', /older history stays saved/i.test(pricing)],
  ['pricing Pro benefit does not imply re-uploading stored history',
    !/full historical imports/.test(pricing) && /no re-upload/i.test(pricing)],
  // Preserved, correct claims — these must survive the rewrite.
  ['pricing still states the 3-platform Free cap', /up to 3 platforms on the Free plan/i.test(pricing)],
  ['pricing still offers more platforms on Pro', /additional platforms/i.test(pricing)],
  ['pricing still lists no CamSoda', !/camsoda/i.test(pricing)],

  // ── Import page must state both Free limits and the absence of a quota ─
  ['import page says the history window is PER PLATFORM',
    /history window per platform/.test(dashboard)],
  ['import page states there is no upload quota',
    /no limit on the number of imports/i.test(dashboard)],
  ['import page states deleting data does not block re-uploading',
    /deleting your imported data never blocks you from uploading again/i.test(dashboard)],
  ['import page states older history unlocks with Pro without re-upload',
    /unlocks with Pro — no re-upload needed/i.test(dashboard)],

  // Normalised (lowercased) platform names must not reach a creator's eyes.
  ['the locked preview restores canonical platform casing for display',
    /displayPlatforms\(lockedPreview\.currentPlatforms\)/.test(dashboard) &&
    /function displayPlatforms/.test(dashboard)],
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
  // The post-import result lives in its own component now; assertions about
  // its copy must see both files.
  const dash = read('app/dashboard/page.js') + '\n' + read('app/dashboard/ImportResult.js')

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
  // Assert the SUBSTANCE (already saved + no re-upload), not one sentence —
  // the previous wording pinned "unlocks them instantly" and broke on a
  // legitimate rewrite that still said the same thing.
  extra.push(['History card states it unlocks with no re-upload',
    /already saved/.test(dash) && /no re-upload/.test(dash)])
  extra.push(['Platform card no longer implies the whole upload must be redone',
    !/Upgrade, then re-upload this file/.test(dash)])
}

// ── Dashboard conversion layer + upgrade modal (Phases 6, 7, 13) ─────────
// The post-import screen's argument used to end at the dashboard door. These
// pin the three things that carry it through, and — more importantly — pin
// the honesty rules, since a conversion surface is exactly where a fabricated
// number would be most tempting and least visible.
{
  const band = read('app/dashboard/ConversionBand.js')

  // The band speaks only about conditions measured from real rows.
  extra.push(['Conversion band exists and is wired into the dashboard',
    /export default function ConversionBand/.test(band) &&
    /<ConversionBand/.test(dashboard) && /import ConversionBand/.test(dashboard)])
  extra.push(['Band renders nothing for Pro', /if \(isPro \|\| !context\) return null/.test(band)])
  extra.push(['Band shows at most ONE surface, not a banner per condition',
    /const band = lockedHistory/.test(band) && /if \(!band\) return null/.test(band)])
  extra.push(['Band covers the three named contexts',
    /dashboard_locked_history/.test(band) && /dashboard_platform_cap/.test(band) &&
    /dashboard_sparse_recent/.test(band)])

  // The context is MEASURED, and measured with the canonical helpers — not
  // re-derived with a second copy of the Free boundary or a local dollar sum.
  extra.push(['Conversion context uses the canonical Free-history split',
    /buildConversionContext/.test(dashboard) && /splitFreeHistory\(allRows\)/.test(dashboard)])
  extra.push(['Locked earnings come from the canonical engine, not a local sum',
    /runEngine\(excluded, timezone\)\?\.totalUSD/.test(dashboard)])
  extra.push(['Slot counting reuses uniquePlatforms()',
    /uniquePlatforms\(allRows\)/.test(dashboard)])
  extra.push(['Band context is null for Pro, so nothing renders',
    /if \(isPro \|\| !allRows\?\.length\) return null/.test(dashboard)])
  extra.push(['No locked-value claim without a measured figure',
    /if \(totalUsd > 0\)/.test(dashboard)])

  // Free history filtering itself is UNCHANGED — the band is additive.
  extra.push(['Free history filtering still runs through filterFreeHistory',
    /filterFreeHistory\(allData\)/.test(dashboard)])

  // Upgrade modal repeats the situation instead of pitching generically.
  extra.push(['Upgrade modal leads with what we found, not a price',
    /Unlock the insights we found in your data/.test(dashboard)])
  extra.push(['Upgrade modal CTA is the value, not the SKU',
    /Unlock Pro →/.test(dashboard) && !/Upgrade to Pro — \$19\.99\/mo/.test(dashboard)])
  extra.push(['Upgrade modal shows price and cancel terms at the CTA',
    /PRO_PRICE_MONTHLY_LABEL\} · \{PRO_PRICE_NOTE/.test(dashboard)])
  extra.push(['Upgrade modal benefits are per-situation, not one static list',
    /benefits: \[/.test(dashboard) && /upgradeCopy\.benefits/.test(dashboard)])
  extra.push(['The old generic benefit list is gone',
    !/AI fan behavior predictions/.test(dashboard)])
  extra.push(['Every dashboard band source has its own modal copy',
    /dashboard_locked_history: \{/.test(dashboard) &&
    /dashboard_platform_cap: \{/.test(dashboard) &&
    /dashboard_sparse_recent: \{/.test(dashboard)])
  // The figure now LEADS the block at heading weight rather than sitting
  // inside a sentence — same number, same source, stronger hierarchy.
  extra.push(['Modal repeats the creator\'s own measured figure when there is one',
    /upgradeValueLine/.test(dashboard) &&
    /\{upgradeValueLine\.usd\}/.test(dashboard) &&
    /additional earnings already saved/.test(dashboard)])
  extra.push(['Modal still uses the existing Stripe checkout path',
    /\/api\/stripe\/checkout/.test(dashboard) && /plan_type: 'standard_monthly'/.test(dashboard)])

  // Conversion measurement seam (Phase 13) — events only, no new tables.
  extra.push(['Result-screen impression is measurable',
    /import_result_viewed/.test(dashboard)])
  extra.push(['Locked-insight impressions reuse the existing pro_preview event',
    /trackProPreviewViewed\('csv_locked_history'\)/.test(dashboard) &&
    /pro_preview_viewed/.test(dashboard)])
  extra.push(['The unlock itself is a distinct step from the payment',
    /pro_unlocked/.test(dashboard) && /subscription_completed/.test(dashboard)])
  // The hook moved INTO the shared locked-state component: ImportResult now
  // passes surface="..." and LockedModule renders the attribute, so every
  // locked surface gets one by construction instead of per-card by hand.
  extra.push(['Conversion surfaces carry a stable attribution hook',
    /data-cc-surface/.test(band) &&
    /data-cc-surface=\{surface\}/.test(lockedModuleSrc) &&
    /surface = 'csv_locked_history'/.test(read('app/dashboard/components/HistoryTimeline.js')) &&
    /surface="csv_locked_trend"/.test(importResult) &&
    /data-cc-action/.test(dashboard)])
  extra.push(['No speculative tracking table was added',
    !/from\(['"]conversion_events['"]\)/.test(dashboard) &&
    !/create table.*funnel/i.test(dashboard)])
}

for (const [name, ok] of extra) {
  if (!ok) { console.error(`FAIL: ${name}`); extraFailed++ } else { console.log(`PASS: ${name}`) }
}
console.log(`\n${extra.length - extraFailed}/${extra.length} per-platform-window checks passed`)
if (extraFailed > 0) process.exit(1)
