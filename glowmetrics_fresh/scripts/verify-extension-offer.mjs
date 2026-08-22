// The Live Tracker extension moved out of onboarding and into the Creator Pro
// conversion flow.
//
// It used to be the last step before the dashboard, with the CTA "Install Live
// Tracker — it's free". That was wrong twice over: Live Mode is Pro-only and
// server-enforced, so a Free creator installing it got an extension feeding a
// session check_live_mode_pro_entitlement refuses to create; and an extension
// does nothing until the creator actually streams, so the highest-friction ask
// sat at the lowest-intent moment.
//
// These checks pin the new placement AND the two properties that must survive
// it: the extension is never presented as required, and it is never shown to
// someone who cannot use Live Mode.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const onbRaw = read('../app/onboarding/page.js')
const onb = strip(onbRaw)
const offerRaw = read('../app/dashboard/ExtensionOffer.js')
const offer = strip(offerRaw)
const dashRaw = read('../app/dashboard/page.js')
const dash = strip(dashRaw)

// ══════════════════════════════════════════════════════════════════════
// 1-2. THE ONBOARDING INSTALL STEP IS GONE, AND ONBOARDING STILL FINISHES.
// ══════════════════════════════════════════════════════════════════════
check('the standalone "Install Live Tracker" step is gone',
  !/Install Live Tracker/.test(onb))
check('onboarding carries no extension CTA at all',
  !/camcashgrl\.com\/extension/.test(onb) && !/camcash-extension\.zip/.test(onb) &&
  !/Set up live tracking/.test(onb))
check('the Live Mode preview survives — the demo still sells the feature',
  /function LiveModeDemo/.test(onb) && /Live Mode Preview/.test(onb))
// The preview now advances to the final completion card rather than the
// dashboard directly — see verify-onboarding-flow.mjs for the full sequence.
// What matters here is unchanged: it advances without installing anything.
check('the preview step advances without installing',
  /function LiveModeDemo\(\{onContinue,isPro=false\}\)/.test(onb) &&
  /<LiveModeDemo onContinue=\{\(\)=>\{celebrate\(\);setStep\('done'\)\}\}/.test(onb))
check('onboarding can complete without any install — the step just advances',
  !/onInstall/.test(onb))
// The rest of onboarding must be untouched by this change.
check('CSV import, completion tracking and dashboard redirect still exist',
  /handleCsvUpload/.test(onb) &&
  // Pin the track() CALL: `onboarding_completed` is also a profiles column,
  // so a bare match passes even with the funnel event deleted.
  /track\('onboarding_completed'/.test(onb) &&
  /router\.push\('\/dashboard'\)/.test(onb))

// ══════════════════════════════════════════════════════════════════════
// 3. THE OFFER SURFACES ON CREATOR PRO SUCCESS — AND ONLY THERE.
// ══════════════════════════════════════════════════════════════════════
check('the dashboard imports the shared offer, not a second implementation',
  /import ExtensionOffer, \{ isExtensionOfferDismissed \} from '\.\/ExtensionOffer'/.test(dash))
check('it is raised at the post-checkout moment, not on page load',
  /gtmTrack\('pro_unlocked'[\s\S]{0,400}?setShowExtensionOffer\(true\)/.test(dash))
// pro_unlocked fires only inside the isProPlan(data) branch of the Stripe
// return handler, so the offer cannot precede real entitlement.
check('the offer starts hidden, so it cannot precede the return handler',
  /const \[showExtensionOffer, setShowExtensionOffer\] = useState\(false\)/.test(dash))
check('that moment sits behind an observed isProPlan(), not behind checkout completing',
  dash.indexOf('if (isProPlan(data))') < dash.indexOf('setShowExtensionOffer(true)') &&
  dash.indexOf('setShowExtensionOffer(true)') < dash.indexOf('await new Promise(r => setTimeout(r, 1500))'))
check('a previous dismissal suppresses it, so it never becomes a nag',
  /if \(!isExtensionOfferDismissed\(\)\) setShowExtensionOffer\(true\)/.test(dash))

// ══════════════════════════════════════════════════════════════════════
// 4. FREE NEVER SEES IT — NO FALSE SIGNAL THAT LIVE MODE IS AVAILABLE.
// ══════════════════════════════════════════════════════════════════════
check('the component refuses to render without Pro',
  /if \(!isPro \|\| gone\) return null/.test(offer))
check('isPro defaults to false, so an unpassed prop fails closed',
  /isPro = false/.test(offer))
check('both render sites pass the real entitlement through',
  (dash.match(/<ExtensionOffer C=\{C\} isPro=\{isPro\}/g) || []).length === 2)
check('the Live Mode reminder is additionally gated on isPro at the call site',
  /activeTab === "live" && isPro && !showExtensionOffer && !isExtensionOfferDismissed\(\)/.test(dash))

// ══════════════════════════════════════════════════════════════════════
// 5. IT IS NEVER PRESENTED AS REQUIRED.
// ══════════════════════════════════════════════════════════════════════
check('the copy states Live Mode works without it',
  /Live Mode works without the extension/.test(offer))
check('the optionality is labelled, not buried',
  /Optional: Live Mode works without the extension/.test(offer))
check('it never says the extension is needed, required, or must be installed',
  !/don.t forget/i.test(offer) && !/\brequired\b/i.test(offer) &&
  !/you (must|need to) (install|add)/i.test(offer) && !/\bmandatory\b/i.test(offer))
check('it does not re-describe the extension as free, which Live Mode is not',
  !/it's free/i.test(offer) && !/— Free/.test(offer))

// ══════════════════════════════════════════════════════════════════════
// 6. "MAYBE LATER" ACTUALLY DISMISSES.
// ══════════════════════════════════════════════════════════════════════
check('the secondary CTA is wired to the dismiss handler',
  /variant="secondary"\s*\n\s*onClick=\{dismiss\}/.test(offer) && /Maybe later/.test(offer))
check('dismissing hides it in this render AND persists the choice',
  /setGone\(true\)/.test(offer) &&
  /localStorage\.setItem\(EXTENSION_DISMISS_KEY, '1'\)/.test(offer))
check('the persisted choice is what the reader consults',
  /getItem\(EXTENSION_DISMISS_KEY\) === '1'/.test(offer))
check('storage access is guarded — a blocked localStorage must not break the page',
  (offer.match(/catch \(_\)/g) || []).length >= 2)

// ══════════════════════════════════════════════════════════════════════
// 7. LIVE MODE STAYS USABLE WITHOUT THE EXTENSION.
// ══════════════════════════════════════════════════════════════════════
{
  const i = dash.indexOf('activeTab === "live" && isPro')
  const j = dash.indexOf('activeTab === "live" && (isPro ? <LiveEnginePage embedded />')
  check('the reminder renders BEFORE the engine, never instead of it', i > -1 && j > i)
  check('the engine is still rendered unconditionally for Pro',
    /activeTab === "live" && \(isPro \? <LiveEnginePage embedded \/>/.test(dash))
  // The website heartbeat is what makes the extension optional in fact and not
  // just in copy — see 20260802g, which fixed creators being stuck waiting for
  // an extension that never connected.
  const mig = read('../supabase/migrations/20260802g_website_heartbeat_also_starts_session.sql')
  check('the website heartbeat still starts a session on its own',
    /WHEN status = 'starting' THEN 'live'/.test(mig))
}

// ══════════════════════════════════════════════════════════════════════
// 8-9. CANONICAL BUTTON, AND NO COMPETING CTA.
// ══════════════════════════════════════════════════════════════════════
check('the extension CTA uses the canonical Button',
  /import Button from '\.\.\/\.\.\/components\/ui\/Button'/.test(offer) &&
  /<Button\s*\n?\s*as="a"\s*\n?\s*href="\/camcash-extension\.zip"/.test(offer))
check('no hand-rolled gradient or bespoke anchor stands in for it',
  !/linear-gradient\(90deg,#21E6F3/.test(offer) && !/<a\s+href="\/camcash-extension/.test(offer))
check('both CTAs meet the 44px touch target',
  (offer.match(/minHeight: 44/g) || []).length === 2)
check('exactly one extension offer component exists',
  (dash.match(/<ExtensionOffer/g) || []).length === 2 && !/ExtensionDownloadButton/.test(dash))
check('the download still fires the funnel event',
  /track\('extension_download_clicked'/.test(offer))

// ══════════════════════════════════════════════════════════════════════
// 10. ENTITLEMENT IS UNTOUCHED.
// ══════════════════════════════════════════════════════════════════════
{
  const ent = read('../lib/liveSession/entitlement.js')
  const gate = read('../supabase/migrations/20260821_close_live_sessions_direct_insert_bypass.sql')
  const start = read('../app/api/live/session/start/route.js')
  check('resolveLiveModeAccess still delegates to the canonical isProPlan',
    /import \{ isProPlan \} from '\.\.\/plan\.js'/.test(ent) && /isProPlan\(profile\)/.test(ent))
  check('the start route still refuses a caller the guard rejects',
    /resolveLiveModeAccess\(supabase, user\)/.test(start) && /if \(!allowed\)/.test(strip(start)))
  check('the live_sessions INSERT trigger still performs the canonical check',
    /perform public\.check_live_mode_pro_entitlement\(auth\.uid\(\)\)/.test(gate))
  check('nothing in this change touches the entitlement predicate',
    !/isProPlan/.test(offer) && !/plan_expires_at/.test(offer))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
