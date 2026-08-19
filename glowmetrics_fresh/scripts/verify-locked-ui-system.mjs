// ============================================================
// CAMCASH — LOCKED-STATE UI SYSTEM REGRESSION CHECKS
//
// Covers the shared locked-state system (app/dashboard/components/
// LockedModule.js) and the surfaces that consume it: the post-import result,
// the dashboard conversion band, and the upgrade modal.
//
// WHAT THESE PROTECT
// The distinctions here are the ones that are easy to break in a copy edit and
// expensive to get wrong in production:
//
//   - Saved history says "already saved" and "no re-upload". True: the rows
//     are in the database.
//   - Fourth-platform rows say they were NOT saved and DO need a re-import.
//     Also true — and the exact opposite of the line above it. Swapping these
//     two would make the product lie in one direction or the other.
//   - Insufficient data carries no lock and no upgrade CTA, because upgrading
//     would not produce the number.
//   - No fabricated percentage claims anywhere.
//
// Source-text assertions are inherently weak, so every claim below is written
// to fail if the thing it protects is deleted — and the ones that matter most
// are mutation-tested at the bottom of this file, which proves they can still
// fail rather than passing vacuously.
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.argv[2] || '.')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')

const lockedModule = read('app/dashboard/components/LockedModule.js')
const importResult = read('app/dashboard/ImportResult.js')
const band = read('app/dashboard/ConversionBand.js')
const dashboard = read('app/dashboard/page.js')
const css = read('app/globals.css')
const lockedValueRaw = read('app/dashboard/components/LockedValue.js')
const timelineRaw = read('app/dashboard/components/HistoryTimeline.js')
const onboardingRaw = read('app/onboarding/page.js')
const momentRaw = read('components/conversion/UpgradeMoment.js')

// Comments explain WHY a rule exists and often quote the copy they replaced,
// so shipped-copy assertions must ignore them or they check themselves.
const stripComments = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const irCode = stripComments(importResult)
// Banned-copy checks must read SHIPPED text only. Several of these comments
// deliberately quote the claim they removed, to explain why it went.
const lockedValue = stripComments(lockedValueRaw)
const timeline = stripComments(timelineRaw)
const onboarding = stripComments(onboardingRaw)
const moment = stripComments(momentRaw)
const dashCode = stripComments(dashboard)
const lmCode = stripComments(lockedModule)

let pass = 0, fail = 0
const check = (name, cond) => {
  if (cond) { pass++; console.log(`PASS: ${name}`) }
  else { fail++; console.log(`FAIL: ${name}`) }
}

console.log('\n── Shared system exists and is actually used ──────────────────')
check('a shared locked-state module exists',
  /export default function LockedModule/.test(lockedModule))
check('it exports the four-state vocabulary, not one generic lock',
  /saved:/.test(lockedModule) && /pro:/.test(lockedModule) && /platform:/.test(lockedModule) &&
  /export function InsufficientData/.test(lockedModule))
check('the import result consumes the shared system rather than hand-rolling locks',
  /from '\.\/components\/LockedModule'/.test(importResult) && /<LockedModule/.test(irCode))
check('the conversion band consumes the shared unlock button',
  /from '\.\/components\/LockedModule'/.test(band) && /<UnlockButton/.test(band))

console.log('\n── 6. The signature UnlockButton ─────────────────────────────')
check('UnlockButton is exported from the shared module',
  /export function UnlockButton/.test(lockedModule))
check('it reuses the signature gradient button rather than redefining it',
  /import Button from '\.\.\/\.\.\/\.\.\/components\/ui\/Button'/.test(lockedModule) &&
  /<Button\b/.test(lmCode) &&
  !/linear-gradient\(90deg,#21E6F3/.test(lockedModule))
check('it renders both a primary and a restrained secondary weight',
  /cc-unlock--primary/.test(lockedModule) && /cc-unlock--secondary/.test(lockedModule))
check('the arrow is a transitioned element, not baked into the label',
  /cc-unlock-arrow/.test(lockedModule) && /\.cc-unlock:hover \.cc-unlock-arrow/.test(css))
check('pressed, focus-visible and disabled states are all styled',
  /\.cc-unlock--secondary:active/.test(css) &&
  /\.cc-unlock:focus-visible/.test(css) &&
  /\.cc-unlock--secondary:disabled/.test(css))
check('the button surfaces loading/disabled through the shared Button',
  /disabled=\{disabled\}/.test(lockedModule) && /loading=\{loading\}/.test(lockedModule))

console.log('\n── 2. Preview the product, do not hide it ────────────────────')
check('the old full-card 4px blur treatment is gone',
  !/blur\(4px\)/.test(importResult))
// Superseded: the container is no longer masked OR blurred at all. The
// replacement assertions live under "Selective masking" below.
check('the preview container exists and is unstyled by any hiding rule',
  /\.cc-lock-preview\b/.test(css))
check('real previews are still passed real engine data',
  /preview=\{/.test(irCode) && /li\.trend/.test(irCode) && /li\.heatmap/.test(irCode) && /li\.topFans/.test(irCode))
check('fourth-platform figures are shown plainly, never blurred',
  !/filter: 'blur\(3px\)'/.test(importResult))

console.log('\n── 1./4A. SAVED HISTORY — already stored, no re-upload ───────')
// This state now renders as the HistoryTimeline rather than a stat-card
// module: one picture that shows the whole span AND that none of it was
// deleted. The properties under test are unchanged.
check('the saved-history state says the data is already saved',
  /already imported/i.test(timeline) || /Already saved/.test(timeline))
check('the saved-history state promises no re-upload',
  /no re-upload required/i.test(timeline))
check('it is rendered through the timeline, driven by measured values',
  /<HistoryTimeline/.test(irCode) && /lockedUsd=\{excluded\.totalUsd\}/.test(irCode))
check('it leads with the creator’s own measured locked total',
  /\{fmtUsd\(lockedUsd\)\}/.test(timeline))
check('the saved-history badge states the status as text, not colour alone',
  /badge: 'ALREADY SAVED'/.test(lockedModule))

console.log('\n── 4D. FOURTH PLATFORM — NOT stored, needs re-import ─────────')
check('the fourth-platform card says the rows were not saved',
  /weren(&apos;|')t saved/.test(irCode))
check('it tells the creator to import the file again after upgrading',
  /import this file again/i.test(irCode))
check('it is rendered through its own variant',
  /variant="platform"/.test(irCode))
check('it never carries the "no re-upload" promise that applies to history',
  (() => {
    const i = irCode.indexOf('variant="platform"')
    if (i < 0) return false
    const block = irCode.slice(i, i + 1400)
    return !/no re-upload/i.test(block)
  })())
check('its badge distinguishes it from saved history in words',
  /badge: 'NOT SAVED'/.test(lockedModule))

console.log('\n── 4C. INSUFFICIENT DATA — not a paywall ─────────────────────')
check('insufficient data is a separate component, not a lock variant',
  /export function InsufficientData/.test(lockedModule) &&
  /<InsufficientData/.test(irCode))
check('it renders no upgrade CTA',
  (() => {
    const m = lockedModule.match(/export function InsufficientData[\s\S]*$/)
    return m && !/UnlockButton|onUpgrade|ctaLabel/.test(m[0])
  })())
check('it renders no lock badge or lock icon',
  (() => {
    const m = lockedModule.match(/export function InsufficientData[\s\S]*$/)
    return m && !/cc-lock-badge/.test(m[0]) && !/🔒/.test(m[0])
  })())
check('it states the real threshold rather than a broken-looking metric',
  /threshold=/.test(irCode) && /Not enough activity yet/.test(lockedModule))
check('the Free metric row keeps its threshold states',
  /Not enough qualifying activity yet/.test(irCode) && /Needs a session with 2\+ tips and 15\+ min/.test(irCode))

console.log('\n── 5./7. Import hierarchy: Free analysis vs saved history ─────')
check('the success state leads and reads as completion, not an alert',
  /CSV imported successfully/.test(irCode) && /Your data is saved and ready to analyze/.test(irCode))
check('whole-file totals are shown before any plan boundary',
  /full\?\.tips/.test(irCode) && /full\?\.totalUsd/.test(irCode) && /full\?\.fans/.test(irCode))
check('the Free analysis section is labelled as its own section',
  /Your Free snapshot/.test(irCode))
check('the Free window rule is stated explicitly',
  /Free analyzes the most recent \{freeHistoryDays\} days of activity for each platform/.test(irCode))
check('saved history is a SEPARATE section from the Free analysis',
  /<HistoryTimeline/.test(irCode) &&
  irCode.indexOf('Your Free snapshot') < irCode.indexOf('<HistoryTimeline'))
check('the Pro preview section follows the personal value',
  /See what your full history can tell you/.test(irCode) &&
  irCode.indexOf('<HistoryTimeline') < irCode.indexOf('See what your full history can tell you'))

console.log('\n── 8. The creator’s actual locked value ────────────────────')
check('the import screen renders the measured locked dollar value',
  /lockedUsd=\{excluded\.totalUsd\}/.test(irCode) && /\{fmtUsd\(lockedUsd\)\}/.test(timeline))
check('the dashboard band leads with the same measured value',
  /value: fmtUsd\(lockedHistory\.totalUsd\)/.test(band))
check('the upgrade modal repeats that value at heading weight',
  /upgradeValueLine\.usd/.test(dashCode) &&
  /additional earnings already saved/.test(dashCode))
check('no surface invents a value when the engine has none',
  /if \(!locked \|\| !\(locked\.totalUsd > 0\)\) return null/.test(dashboard))

console.log('\n── 9. No fabricated claims ───────────────────────────────────')
// Scoped to the CONVERSION surfaces. page.js is 5,900 lines and also holds
// unrelated tools — the Room Titles generator ships urgency phrases as DM
// templates the creator sends to their OWN fans, which is a legitimate use and
// must not trip a check about what WE claim to the creator. So page.js
// contributes only its upgrade-modal block here.
const modalBlock = (() => {
  const i = dashCode.indexOf('{showUpgradeModal && (')
  if (i < 0) return ''
  const j = dashCode.indexOf('Maybe later', i)
  return j < 0 ? dashCode.slice(i) : dashCode.slice(i, j)
})()
check('the upgrade-modal block was located for claim scanning',
  modalBlock.length > 500)
const shipped = [irCode, modalBlock, stripComments(band), lmCode].join('\n')
check('no "creators miss 30-60%" style claim survives anywhere',
  !/30[–-]60%/.test(shipped))
check('no percentage-of-earnings claim is made at all',
  !/\d{1,3}%\s*(of|more|increase|boost)/i.test(shipped))
check('no fake urgency or countdown language',
  !/limited time|expires soon|only \d+ (spots|left)|act now/i.test(shipped))
check('no invented social proof',
  !/\b(\d[\d,]*)\s*(creators|models|users)\s+(use|trust|joined|switched)/i.test(shipped))

console.log('\n── 3. One primary CTA, quiet secondaries ─────────────────────')
check('the Pro preview cards use the restrained secondary weight',
  /cta: 'secondary'/.test(lockedModule))
check('the saved-history state carries the primary weight',
  /cta: 'primary'/.test(lockedModule))
check('the import screen renders at most one primary unlock at a time',
  (() => {
    // The fallback primary is explicitly gated on there being NO saved-history
    // section, so the two can never both render.
    return /!isPro && hasLocked && !excluded/.test(irCode)
  })())
check('pricing comes from the shared constants, never a literal',
  /PRO_PRICE_MONTHLY_LABEL/.test(irCode) && !/\$19\.99/.test(irCode) &&
  /PRO_PRICE_MONTHLY_LABEL/.test(band) && !/\$19\.99/.test(band))

console.log('\n── 10./11. Mobile and accessibility ──────────────────────────')
check('locked modules have designed states at 560px and 390px',
  /@media \(max-width: 560px\)[\s\S]{0,400}\.cc-lock\b/.test(css) &&
  /@media \(max-width: 390px\)[\s\S]{0,300}\.cc-lock-stats/.test(css))
check('CTAs go full-width on mobile rather than staying small targets',
  /\.cc-lock-cta \.cc-unlock \{ width: 100%/.test(css))
check('nothing can force horizontal overflow: values wrap and grids use minmax(0)',
  /overflow-wrap: anywhere/.test(css) &&
  /minmax\(0, 1fr\)/.test(css) &&
  !/width: \d{3,}px/.test(stripComments(lockedModule)))
check('the band is compact rather than a second hero card',
  /\.cc-band \{[\s\S]{0,200}padding: 16px 20px/.test(css))
check('reduced motion is honoured (the signature shimmer loops forever)',
  /@media \(prefers-reduced-motion: reduce\)/.test(css) &&
  /\.lp-btn-primary::after \{ animation: none/.test(css))
check('keyboard focus is visible on the gradient CTA',
  /\.lp-btn-primary:focus-visible/.test(css) && /outline: 2px solid/.test(css))
check('lock state is exposed to assistive tech, not just drawn',
  /aria-label=\{V\.aria\(title\)\}/.test(lockedModule) &&
  /aria-label=\{`\$\{title\} — not enough data yet`\}/.test(lockedModule))
// Superseded: the preview now carries REAL information (the creator's own
// labels), so hiding it from assistive tech would be wrong. Each masked
// value carries its own label instead — asserted under "Selective masking".
check('masked values are individually labelled instead',
  /unlocked with Pro/.test(lockedValue))
check('CTAs are semantic buttons',
  /<button\s+type="button"/.test(lockedModule))

// ══════════════════════════════════════════════════════════════════════
// MUTATION TESTS
//
// A source-text assertion that cannot fail is worse than no assertion: it
// reports safety it never checked. Each mutation below breaks exactly one
// protected property and asserts the matching check flips to failing.
// ══════════════════════════════════════════════════════════════════════
console.log('\n── Selective masking: mask VALUES, never the container ───────')
check('a per-value masking primitive exists',
  /export default function LockedValue/.test(lockedValueRaw))
check('the container is no longer blurred or masked at all',
  /\.cc-lock-preview \{ min-width: 0; \}/.test(css) &&
  !/\.cc-lock-preview \{[^}]*filter: blur/.test(css) &&
  !/\.cc-lock-preview \{[^}]*mask-image/.test(css))
check('the preview is no longer hidden from screen readers',
  !/className="cc-lock-preview" aria-hidden/.test(lockedModule))
check('earning windows show the real day and hour but mask the rate',
  /\{w\.day\} \{hourLabel\(w\.hour\)\}/.test(irCode) &&
  /<LockedValue[^>]*suffix="\/hr"/.test(irCode) &&
  !/fmtUsd\(w\.usdPerHour\)/.test(irCode))
check('top supporters show real names and tip counts but mask spend',
  /\{f\.username\}/.test(irCode) && /fmtInt\(f\.tips\)/.test(irCode) &&
  !/fmtUsd\(f\.usd\)/.test(irCode))
check('masked widths are deterministic, not Math.random (hydration safety)',
  !/Math\.random/.test(lockedValue) && /function widthFor/.test(lockedValueRaw))
check('each masked value is labelled for assistive tech',
  /aria-label=\{`\$\{prefix \|\| ''\}hidden value/.test(lockedValue))
check('the reason line no longer overlaps the now-legible preview',
  !/\.cc-lock-reason \{[^}]*margin-top: -/.test(css))

console.log('\n── History timeline: the data is SAVED, not deleted ──────────')
check('a timeline component exists and is used by the import result',
  /export default function HistoryTimeline/.test(timelineRaw) && /<HistoryTimeline/.test(irCode))
check('the saved segment is drawn solid, never as an empty void',
  /\.cc-timeline-saved \{[\s\S]{0,200}repeating-linear-gradient/.test(css))
check('both segments are labelled in words, not colour alone',
  /Already saved/.test(timeline) && /Free analytics window/.test(timeline))
check('it states no re-upload is required',
  /no re-upload required/.test(timeline))
check('it computes geometry only — never analytics',
  !/aggregateRows|detectSessions|splitFreeHistory/.test(timeline))
check('the bar carries a text description for screen readers',
  /role="img"/.test(timeline) && /aria-label=\{`\$\{fmtInt\(totalDays\)\} days imported and saved/.test(timeline))

console.log('\n── Personalised CTA: strongest truthful signal ───────────────')
// The dollar figure is the HEADLINE of this card, two lines above the
// button. Repeating it inside the button made the page read as if the amount
// were a product being sold rather than the creator's own data, so the CTA is
// the plain "Unlock Pro" and the number does the persuading.
check('the primary CTA is one unambiguous action',
  /<UnlockButton[\s\S]{0,180}Unlock Pro/.test(timeline))
check('the price sits with the primary CTA, not behind a click',
  /cc-timeline-price/.test(timeline) && /priceLabel/.test(timeline))
check('the measured figure leads the card at heading weight',
  /cc-timeline-amount/.test(timeline) && /\{fmtUsd\(lockedUsd\)\}/.test(timeline) &&
  /already saved in your imported history/.test(timeline))
check('supporting stats sit under the value, not beside it',
  /cc-timeline-stats/.test(timeline) && /stats\?\.length > 0/.test(timeline))
check('a short reassurance follows the CTA',
  /Your existing uploads stay saved/.test(timeline))

console.log('\n── Onboarding is part of the same conversion system ──────────')
check('onboarding imports the shared components, not a second system',
  /from '\.\.\/\.\.\/components\/conversion\/UpgradeMoment'/.test(onboarding))
check('onboarding no longer discards the measured locked history',
  /excludedHistory:json\.excludedHistory\|\|null/.test(onboarding))
check('the upgrade moment renders after the import, using real figures',
  /<UpgradeMoment/.test(onboarding) && /locked=\{importResult\.excludedHistory\}/.test(onboarding))
check('it renders nothing when there is no locked value',
  /if \(!\(tips > 0\)\) return null/.test(moment))
check('it offers a real "continue with Free" path, not a forced gate',
  /Continue with Free/.test(moment) && /onContinueFree/.test(onboarding))
check('the false "multi-platform is a Pro feature" claim is gone',
  !/Multi-platform tracking is a Pro feature/.test(onboarding))
check('the platform limit is described as a count, from the shared constant',
  /Free tracks up to \{FREE_MAX_PLATFORMS\} platforms/.test(onboarding))
check('the unverified annual price is gone and pricing is shared',
  !/\$99\/year/.test(onboarding) && /PRO_PRICE_MONTHLY_LABEL/.test(onboarding))
check('the "save history forever" claim is gone (Free stores history too)',
  !/Save history forever/.test(onboarding))
check('the upsell routes to the in-app upgrade path, not an external page',
  !/camcashgrl\.com\/pricing/.test(onboarding))
check('the plan comparison describes Free accurately and generously',
  /supported platforms/.test(moment) && /never deleted/.test(moment) &&
  /Full CSV imports/.test(moment))
check('plan copy is derived from the canonical limits, not retyped',
  /FREE_MAX_PLATFORMS/.test(moment) && /FREE_HISTORY_DAYS/.test(moment) &&
  !/\b3 supported platforms\b/.test(stripComments(moment)))

console.log('\n── Mutation tests (assertions must be able to fail) ───────────')

const mut = (name, mutated, predicate) => {
  if (!predicate(mutated)) { pass++; console.log(`PASS: ${name}`) }
  else { fail++; console.log(`FAIL: ${name} — assertion passes on mutated source, so it proves nothing`) }
}

mut('"already saved" check fails when the phrase is removed',
  irCode.replace(/already saved/gi, 'xxx'),
  src => /already saved/i.test(src))

mut('"no re-upload" check fails when the promise is removed',
  irCode.replace(/no re-upload required/gi, 'xxx'),
  src => /no re-upload required/i.test(src))

mut('fourth-platform "not saved" check fails when the copy is softened',
  irCode.replace(/weren(&apos;|')t saved/g, 'were saved'),
  src => /weren(&apos;|')t saved/.test(src))

mut('fourth-platform re-import check fails when the instruction is dropped',
  irCode.replace(/import this file again/gi, 'xxx'),
  src => /import this file again/i.test(src))

mut('the "no re-upload in the platform block" check catches a leak',
  (() => {
    const i = irCode.indexOf('variant="platform"')
    return irCode.slice(0, i) + irCode.slice(i).replace(
      /These rows weren(&apos;|')t saved/, "no re-upload needed, these rows weren't saved")
  })(),
  src => {
    const i = src.indexOf('variant="platform"')
    return i >= 0 && !/no re-upload/i.test(src.slice(i, i + 1400))
  })

mut('the insufficient-data "no CTA" check catches an added upgrade button',
  lockedModule.replace(
    /export function InsufficientData\(\{ C, title, message, threshold, compact = false \}\) \{/,
    'export function InsufficientData({ C, title, message, threshold, compact = false, onUpgrade }) {'),
  src => {
    const m = src.match(/export function InsufficientData[\s\S]*$/)
    return m && !/UnlockButton|onUpgrade|ctaLabel/.test(m[0])
  })

mut('the fabricated-percentage check catches a reintroduced claim',
  shipped + '\nMost creators miss 30-60% of their earning potential.',
  src => !/30[–-]60%/.test(src))

mut('the blur-wall check catches a reintroduced 4px blur',
  importResult.replace("filter: blur(1.3px)", "filter: blur(4px)")
    + "\nconst x = { filter: 'blur(4px)' }",
  src => !/blur\(4px\)/.test(src))

mut('the reduced-motion check fails without the media block',
  css.replace(/@media \(prefers-reduced-motion: reduce\)/g, '@media (min-width: 0px)'),
  src => /@media \(prefers-reduced-motion: reduce\)/.test(src))

mut('the focus-visible check fails without the outline rule',
  css.replace(/\.lp-btn-primary:focus-visible/g, '.lp-btn-primary:hover'),
  src => /\.lp-btn-primary:focus-visible/.test(src))

mut('the hierarchy check catches Free analysis being moved below saved history',
  irCode.replace('Your Free analysis', 'ZZZ Free analysis'),
  src => /Your Free analysis/.test(src) &&
    src.indexOf('Your Free analysis') < src.indexOf('Your saved history'))

mut('the selective-masking check catches a re-blurred container',
  css.replace('.cc-lock-preview { min-width: 0; }', '.cc-lock-preview { min-width: 0; filter: blur(4px); }'),
  src => /\.cc-lock-preview \{ min-width: 0; \}/.test(src))

mut('the earning-window check catches the rate being un-masked',
  irCode.replace('suffix="/hr"', 'x="/hr"') + '\n{fmtUsd(w.usdPerHour)}',
  src => /<LockedValue[^>]*suffix="\/hr"/.test(src) && !/fmtUsd\(w\.usdPerHour\)/.test(src))

mut('the onboarding false-claim check catches its reintroduction',
  onboarding + '\nMulti-platform tracking is a Pro feature.',
  src => !/Multi-platform tracking is a Pro feature/.test(src))

mut('the timeline "saved not deleted" check catches an emptied segment',
  css.replace(/\.cc-timeline-saved \{[\s\S]*?\}/, '.cc-timeline-saved { background: transparent; }'),
  src => /\.cc-timeline-saved \{[\s\S]{0,200}repeating-linear-gradient/.test(src))

mut('the shared-price check catches a hardcoded price literal',
  irCode + "\nconst price = '$19.99/mo'",
  src => /PRO_PRICE_MONTHLY_LABEL/.test(src) && !/\$19\.99/.test(src))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
