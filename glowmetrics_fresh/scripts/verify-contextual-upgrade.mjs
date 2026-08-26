// Standalone verification for 2C-4 — contextual conversion.
//
// LOGIC half mirrors lib/upgradeContexts.js against fixtures; SOURCE half
// reads the real files, because "no in-dashboard CTA bounces to /pricing" and
// "the modal is accessible" are properties of the source, not return values.
//
// Cases (the 18 required by 2C-4) are grouped in the sections below.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`) }
}

const MODAL_RAW = read('app/dashboard/ContextualUpgradeModal.jsx')
const MODAL     = stripComments(MODAL_RAW)
const CTXS_RAW  = read('lib/upgradeContexts.js')
const CTXS      = stripComments(CTXS_RAW)
const PAGE      = read('app/dashboard/page.js')
const CHECKOUT  = read('app/api/stripe/checkout/route.js')
const PLANS     = read('lib/stripe-plans.js')
const DASH_FILES = {
  'StreamPlanner.js': read('app/dashboard/StreamPlanner.js'),
  'MoneyMap.js':      read('app/dashboard/MoneyMap.js'),
  'Sidebar.js':       read('app/dashboard/Sidebar.js'),
  'page.js':          PAGE,
}

// ── mirrored from lib/upgradeContexts.js ────────────────────────────────────
const fmtHour = (h) => {
  const hh = ((Number(h) % 24) + 24) % 24
  return hh === 0 ? '12 AM' : hh < 12 ? `${hh} AM` : hh === 12 ? '12 PM' : `${hh - 12} PM`
}
function discovery(source, a = {}) {
  const bw = a?.canonicalBestTimes?.bestWindow || null
  const ov = a?.bestWindowFanOverlap || null
  const label = bw ? `${bw.localDay}s ${fmtHour(bw.localHour)}–${fmtHour(bw.localHour + 2)}` : null
  if (source === 'window_fan_overlap') {
    if (!bw || !ov?.count) return []
    const out = [`${ov.count} repeat fan${ov.count === 1 ? ' has' : 's have'} tipped during your strongest window.`]
    if (ov.topSupporterCount > 0) out.push(`${ov.topSupporterCount} ${ov.topSupporterCount === 1 ? 'is' : 'are'} among your Top Supporters.`)
    return out
  }
  if (source === 'peak_window') {
    if (!bw) return []
    return [`${label} is your highest median rate at $${bw.medianUsdPerHour}/hr,`,
            `measured over ${bw.sessionCount} session${bw.sessionCount === 1 ? '' : 's'}.`]
  }
  if (source === 'platform_comparison') {
    const best = a?.bestPlatformByRate
    const plats = (a?.platforms || []).filter(p => p.medianUsdPerHour > 0)
    if (!best || plats.length < 2) return []
    return [`${best.platform} currently shows your highest median rate at $${best.medianUsdPerHour}/hr across ${plats.length} platforms with measurable sessions.`]
  }
  return []
}

const A = {
  canonicalBestTimes: { bestWindow: { localDay: 'Wednesday', localHour: 5, medianUsdPerHour: 9.52, sessionCount: 4 } },
  bestWindowFanOverlap: { count: 5, topSupporterCount: 3 },
  bestPlatformByRate: { platform: 'BongaCams', medianUsdPerHour: 3.89 },
  platforms: [{ medianUsdPerHour: 3.89 }, { medianUsdPerHour: 2.10 }],
}

console.log('\n1-3. Each discovery produces its own contextual ask')
check('fan discovery preserves both counts', discovery('window_fan_overlap', A),
  ['5 repeat fans have tipped during your strongest window.', '3 are among your Top Supporters.'])
check('peak window states rate AND evidence, separately', discovery('peak_window', A),
  ['Wednesdays 5 AM–7 AM is your highest median rate at $9.52/hr,', 'measured over 4 sessions.'])
check('platform comparison names the measured difference', discovery('platform_comparison', A).length, 1)
check('one platform is not a comparison', discovery('platform_comparison', { ...A, platforms: [{ medianUsdPerHour: 3.89 }] }), [])
check('no window means no fabricated fan discovery', discovery('window_fan_overlap', {}), [])
check('no window means no fabricated peak discovery', discovery('peak_window', {}), [])
check('zero overlap produces no discovery to sell',
  discovery('window_fan_overlap', { ...A, bestWindowFanOverlap: { count: 0, topSupporterCount: 0 } }), [])
check('a discovery is never invented when the insight is absent',
  /hasDiscovery: discovery\.length > 0/.test(CTXS), true)
check('the eyebrow falls back when there is no discovery',
  /eyebrow: discovery\.length \? base\.eyebrow : 'Creator Pro'/.test(CTXS), true)

console.log('\n4. The modal renders the triggering context')
check('it renders the discovery lines', /context\.discovery\[0\]/.test(MODAL), true)
check('it renders the unlock explanation', /\{context\.unlock\}/.test(MODAL), true)
check('it renders the contextual CTA, not a generic one', /\{context\.primaryCta\}/.test(MODAL), true)
check('the insight id travels with every event', (MODAL.match(/insight_id/g) || []).length >= 3, true)
check('no generic "Feature locked" framing', /(Feature locked|feature is locked|🔒)/.test(MODAL), false)
check('no generic "See what Pro unlocks"', /See what Pro unlocks/.test(MODAL), false)

console.log('\n5-7. Real Stripe checkout, correct plans, no hardcoded price')
check('posts to the existing checkout route', /fetch\('\/api\/stripe\/checkout'/.test(MODAL), true)
check('monthly maps to a real plan alias', /PLAN_MONTHLY = 'standard_monthly'/.test(MODAL), true)
check('annual maps to a real plan alias', /PLAN_ANNUAL = 'standard_annual'/.test(MODAL), true)
check('standard_monthly resolves in stripe-plans', /standard_monthly: 'monthly'/.test(PLANS), true)
check('standard_annual resolves in stripe-plans', /standard_annual: 'annual'/.test(PLANS), true)
check('both plans are offered', MODAL.includes('PLAN_MONTHLY') && MODAL.includes('PLAN_ANNUAL'), true)
check('no price id is hardcoded in the modal', /price_[A-Za-z0-9]/.test(MODAL), false)
check('no price id is hardcoded in the context catalogue', /price_[A-Za-z0-9]/.test(CTXS), false)
// The early-adopter env is a $9.99 price; a standard purchase must never
// resolve to it before the standard names.
check('early-adopter env stays last for monthly',
  PLANS.indexOf("'STRIPE_PRICE_EARLY_ADOPTER_MONTHLY'") > PLANS.indexOf("'STRIPE_PRICE_STANDARD_MONTHLY'"), true)
check('early-adopter env stays last for annual',
  PLANS.indexOf("'STRIPE_PRICE_EARLY_ADOPTER_ANNUAL'") > PLANS.indexOf("'STRIPE_PRICE_STANDARD_ANNUAL'"), true)
check('the modal never names an early-adopter plan', /early_adopter/.test(MODAL), false)
check('there is only one checkout implementation',
  (MODAL.match(/stripe\.checkout|new Stripe\(/g) || []), [])

console.log('\n8-9. Cancellation and success both return cleanly')
check('the route accepts an upgrade source', /body\.upgrade_source/.test(CHECKOUT), true)
check('the source is validated by shape before entering a URL',
  /\^\[a-z0-9_\]\{1,40\}\$/.test(CHECKOUT), true)
check('success carries the context back', /success=true&plan=\$\{planType\}\$\{ctxParam\}/.test(CHECKOUT), true)
check('in-dashboard cancel returns to the dashboard',
  /\/dashboard\?canceled=true&ctx=\$\{upgradeSource\}/.test(CHECKOUT), true)
check('other callers keep the original cancel destination',
  /\/start-trial\?canceled=true/.test(CHECKOUT), true)
check('success return lands on the relevant tab', /if \(tab\) \{ setActiveTab\(tab\)/.test(PAGE), true)
check('cancel shows no success state', /checkout_canceled[\s\S]{0,200}setShowUpgradeModal\(false\)/.test(PAGE), true)
check('cancel does not reopen the same modal',
  /canceled === 'true'[\s\S]{0,400}setShowUpgradeModal\(true\)/.test(PAGE), false)
check('params are stripped so a refresh cannot replay',
  (PAGE.match(/window\.history\.replaceState\(\{\}, '', window\.location\.pathname\)/g) || []).length >= 2, true)

console.log('\n10. An already-Pro creator is never sold to')
check('the modal branches on isPro', /isPro \? \(/.test(MODAL), true)
check('the Pro branch offers the deeper action instead', /onProAction/.test(MODAL), true)
// The Pro branch is everything between `isPro ? (` and the `) : (` that opens
// the selling branch. No checkout call may appear inside it.
const proBranch = MODAL.slice(MODAL.indexOf('isPro ? ('), MODAL.indexOf(') : ('))
check('the Pro branch exists', proBranch.length > 100, true)
check('checkout cannot start from the Pro branch', /startCheckout/.test(proBranch), false)
check('no plan selector is shown to a Pro user', /PLAN_ANNUAL/.test(proBranch), false)
check('the trial line is not shown to a Pro user',
  /isPro \? \([\s\S]{0,1200}trialEligible/.test(MODAL), false)

console.log('\n11. Free keeps the factual dashboard')
// 2C-4 must not newly lock anything. These free surfaces are asserted intact.
check('the fan roster is still free',
  /ALL SUPPORTERS[\s\S]{0,600}the full roster, free/.test(read('app/dashboard/Fans.js')), true)
check('the Money Map heatmap tab is still free',
  /tab==="map" && <MoneyMapTab/.test(DASH_FILES['MoneyMap.js']), true)
check('the free platform limit rule is unchanged',
  /freePlatformLimitReached: !isPro && trackedPlatformCount >= FREE_MAX_PLATFORMS/.test(read('app/dashboard/DashboardPreview.js')), true)
check('no new isPro gate was added to the discovery block',
  (read('app/dashboard/WindowFanOverlap.jsx').match(/isPro &&/g) || []).length, 2)

console.log('\n12. No unsupported or hyped language')
const BANNED = [
  'likely to tip', 'usually online', 'will earn', 'guarantee', 'guaranteed',
  'maximize your income', 'make more money', 'earning potential',
  'limited time', 'act now', 'only today', 'spots left', 'hurry',
  'predictions', 'forecasts', 'projected',
]
for (const phrase of BANNED) {
  check(`modal never says "${phrase}"`, MODAL.toLowerCase().includes(phrase), false)
  check(`contexts never say "${phrase}"`, CTXS.toLowerCase().includes(phrase), false)
}
// The retired modal sold exactly this, and it was never true.
// Stripped of comments: the retired bullet must be gone from the CODE. The
// commented record of why it was removed is allowed to survive.
check('the AI-prediction bullet is gone from the dashboard',
  /AI fan behavior predictions/.test(stripComments(PAGE)), false)
check('the old six-bullet generic copy table is gone', /const UPGRADE_COPY = \{/.test(PAGE), false)
check('tonightStream is not surfaced by the conversion layer',
  /tonightStream/.test(MODAL + CTXS), false)

console.log('\n13-15. Accessibility and mobile')
check('role="dialog"', /role="dialog"/.test(MODAL), true)
check('aria-modal="true"', /aria-modal="true"/.test(MODAL), true)
check('labelled by its own heading', /aria-labelledby=\{titleId\}/.test(MODAL), true)
check('described by its own body', /aria-describedby=\{descId\}/.test(MODAL), true)
check('Escape closes it', /e\.key === 'Escape'/.test(MODAL), true)
check('focus is remembered on open', /returnFocusRef\.current = /.test(MODAL), true)
check('focus is returned on close', /el\.focus\(\)/.test(MODAL), true)
check('Tab cycles rather than escaping the dialog', /e\.key !== 'Tab'/.test(MODAL), true)
check('the listener is removed on unmount', /removeEventListener\('keydown'/.test(MODAL), true)
check('the close control is reachable and labelled', /aria-label="Close"/.test(MODAL), true)
check('the plan switch is a labelled radiogroup', /role="radiogroup"/.test(MODAL), true)
check('errors are announced', /role="alert"/.test(MODAL), true)
check('mobile is a bottom sheet', /alignItems: 'flex-end'/.test(MODAL), true)
check('it becomes a centred dialog above 620px', /@media \(min-width: 620px\)/.test(MODAL), true)
check('the sheet can scroll rather than clipping on a short screen',
  /max-height: 92vh/.test(MODAL), true)
check('backdrop click dismisses', /e\.target === e\.currentTarget/.test(MODAL), true)

console.log('\n16-18. Nothing else moved')
check('no in-dashboard CTA links to /pricing any more',
  Object.entries(DASH_FILES).filter(([, src]) => /href="\/pricing"|push\('\/pricing'\)/.test(src)).map(([n]) => n), [])
check('the modal still offers the full comparison as the secondary path',
  /href="\/pricing"/.test(MODAL), true)
check('the conversion layer touches no analytics',
  /(aggregateRows|computeIntelligence|calculateConfidence)/.test(MODAL + CTXS), false)
check('the context catalogue computes nothing',
  /(reduce\(|percentile|median\()/.test(CTXS.replace(/medianUsdPerHour/g, '')), false)
check('no migration or schema change ships with this step',
  /(CREATE TABLE|ALTER TABLE|create table|alter table)/.test(MODAL + CTXS + CHECKOUT), false)
check('no SEO/blog/sitemap import',
  /(app\/blog|app\/guides|sitemap|robots)/.test(MODAL + CTXS), false)
check('Stripe products, prices and webhooks are untouched by the modal',
  /(products\.|prices\.|webhook)/.test(MODAL), false)

console.log('\n19. Tracking distinguishes which discovery converts')
for (const ev of [
  'contextual_upgrade_opened', 'contextual_upgrade_checkout_started',
  'contextual_upgrade_cancelled',
]) check(`${ev} is emitted`, MODAL.includes(ev), true)
check('contextual_upgrade_completed is emitted on return', PAGE.includes('contextual_upgrade_completed'), true)
check('every event carries feature_name', (MODAL.match(/feature_name/g) || []).length >= 4, true)
check('the existing transport is reused', /from '\.\.\/\.\.\/lib\/track'/.test(MODAL), true)
check('no second analytics transport', /(gtag\(|analytics\.track|mixpanel)/.test(MODAL), false)
check('existing funnel events still fire', PAGE.includes("track('upgrade_click'") && PAGE.includes("gtmTrack('paywall_hit'"), true)

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
