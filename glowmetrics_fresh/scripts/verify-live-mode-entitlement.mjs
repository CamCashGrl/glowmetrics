// Live Mode is a Creator Pro feature — and this suite exists because it
// previously was not enforced anywhere that mattered.
//
// The dashboard tab hid Live Mode from Free, but /live carried no plan check
// and app/api/live/session/start explicitly documented "every authenticated
// account can start it, no flag, no allow-list". A Free creator could
// navigate straight to /live, start a session, and get the whole product —
// including everything Tasks D/E layered on top of it (post-stream report,
// coaching feed, Streaming Plan feedback).
//
// These checks test the SERVER boundary, not the rendered tab. The guard is
// imported and RUN against a fake Supabase client so the plan branches are
// actually exercised.

import { readFileSync } from 'fs'
import { resolveLiveModeAccess, LIVE_MODE_PRO_REQUIRED } from '../lib/liveSession/entitlement.js'
import { isProPlan } from '../lib/plan.js'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const startRaw = read('../app/api/live/session/start/route.js')
const start = strip(startRaw)
const liveRaw = read('../app/live/page.js')
const live = strip(liveRaw)
const entRaw = read('../lib/liveSession/entitlement.js')

// A minimal stand-in for the RLS-scoped client the route passes in. Records
// what was queried so we can prove the lookup is scoped to the auth user.
function fakeSupabase(profile, spy = {}) {
  return {
    from(table) { spy.table = table; return this },
    select(cols) { spy.cols = cols; return this },
    eq(col, val) { spy.eqCol = col; spy.eqVal = val; return this },
    maybeSingle: async () => ({ data: profile }),
  }
}
const USER = { id: 'user-123' }
const future = new Date(Date.now() + 7 * 86400000).toISOString()
const past = new Date(Date.now() - 86400000).toISOString()

// ══════════════════════════════════════════════════════════════════════
// 1. THE GUARD ITSELF — every plan shape, executed.
// ══════════════════════════════════════════════════════════════════════
const access = (profile, user = USER) => resolveLiveModeAccess(fakeSupabase(profile), user)

check('a Pro plan is allowed', (await access({ plan: 'pro', plan_expires_at: null })).allowed === true)
check('an unlimited plan is allowed', (await access({ plan: 'unlimited', plan_expires_at: null })).allowed === true)
check('a free plan is refused', (await access({ plan: 'free', plan_expires_at: null })).allowed === false)
check('a null plan is refused', (await access({ plan: null, plan_expires_at: null })).allowed === false)
check('a missing profile is refused', (await access(null)).allowed === false)
check('an unauthenticated caller is refused', (await access({ plan: 'pro' }, null)).allowed === false)

// The promo-code trial is the product's only trial. It grants a Pro plan with
// an expiry, so it must unlock Live Mode and must stop unlocking it on lapse.
check('an UNEXPIRED trial grant is allowed — the promo trial unlocks Live Mode',
  (await access({ plan: 'pro', plan_expires_at: future })).allowed === true)
check('an EXPIRED trial grant is refused — the trial really ends',
  (await access({ plan: 'pro', plan_expires_at: past })).allowed === false)
check('the guard delegates to the canonical isProPlan, not a second rule',
  /import \{ isProPlan \} from '\.\.\/plan\.js'/.test(entRaw) &&
  isProPlan({ plan: 'pro', plan_expires_at: past }) === false)

// ══════════════════════════════════════════════════════════════════════
// 2. THE LOOKUP IS SCOPED TO THE SERVER-RESOLVED USER.
// ══════════════════════════════════════════════════════════════════════
{
  const spy = {}
  await resolveLiveModeAccess(fakeSupabase({ plan: 'pro' }, spy), USER)
  check('the plan is read from profiles', spy.table === 'profiles')
  check('only plan fields are selected', /plan/.test(spy.cols) && /plan_expires_at/.test(spy.cols))
  check('the row is pinned to the auth user id, never a client-supplied one',
    spy.eqCol === 'id' && spy.eqVal === USER.id)
  check('the caller\'s own RLS-scoped client is used, not a service-role client',
    !/supabaseAdmin|SERVICE_ROLE/.test(entRaw))
}

// ══════════════════════════════════════════════════════════════════════
// 3. THE START ROUTE ACTUALLY CALLS IT — and before it reveals anything.
// ══════════════════════════════════════════════════════════════════════
check('the start route imports the guard',
  /resolveLiveModeAccess, LIVE_MODE_PRO_REQUIRED/.test(start))
check('the start route refuses a caller the guard rejects',
  /const \{ allowed \} = await resolveLiveModeAccess\(supabase, user\)/.test(start) &&
  /if \(!allowed\)/.test(start))
check('the refusal happens BEFORE any session lookup — a Free caller learns nothing',
  start.indexOf('resolveLiveModeAccess') < start.indexOf("from('live_sessions')"))
check('the refusal is a payment-required status with an upgrade destination',
  LIVE_MODE_PRO_REQUIRED.status === 402 &&
  LIVE_MODE_PRO_REQUIRED.body.code === 'live_mode_requires_pro' &&
  LIVE_MODE_PRO_REQUIRED.body.upgradeUrl === '/pricing')
check('the "no flag, no allow-list" claim is gone from the route',
  !/no flag, no allow-list/.test(startRaw))
check('no second subscription system was invented',
  !/stripe|Stripe/.test(entRaw) && !/plan === 'pro'/.test(strip(entRaw)))

// ══════════════════════════════════════════════════════════════════════
// 4. /live PRESENTS A PRO STATE, NOT A WORKING-LOOKING PRODUCT.
// ══════════════════════════════════════════════════════════════════════
check('/live resolves the plan from the profile', /setLiveIsPro\(isProPlan\(prof\)\)/.test(live))
check('/live imports the canonical plan helper',
  /import \{ isProPlan \} from '\.\.\/\.\.\/lib\/plan'/.test(live))
check('a signed-in Free creator gets the Pro state instead of the engine',
  /if \(user && liveIsPro === false\) return \(/.test(live))
check('the Pro state renders before the engine, so no controls leak',
  live.indexOf('liveIsPro === false') < live.indexOf("authStatus === 'connecting'"))
check('an unresolved plan renders neither state — no upgrade flash for Pro',
  /useState\(null\)/.test(live.slice(live.indexOf('liveIsPro'), live.indexOf('liveIsPro') + 120)))
check('the upgrade CTA uses the canonical signature Button, not a new gradient',
  /<Button as="a" href="\/pricing"/.test(live))
check('it links to the existing pricing page — no second plan UI',
  /href="\/pricing"/.test(live) && !/PlanComparison/.test(live))
check('the creator is given a way back, not a dead end',
  /<Button as="a" href="\/dashboard" variant="secondary"/.test(live))
check('CTAs meet the 44px touch target',
  (live.match(/minHeight: 44/g) || []).length >= 2)
check('the Pro state explains what Free keeps, not just what it loses',
  /stay exactly as they are on Free/.test(live))

// ══════════════════════════════════════════════════════════════════════
// 5. NO FABRICATION IN THE PRO STATE.
// ══════════════════════════════════════════════════════════════════════
{
  const i = live.indexOf('liveIsPro === false')
  const block = live.slice(i, i + 3000)
  check('the Pro state claims no viewer conversion — the data does not exist',
    !/viewer/i.test(block) && !/conversion rate/i.test(block))
  // Scoped to visible copy: a raw /\d+%/ over the block also matches CSS
  // values like '100%' and 'minmax(190px, 1fr)', which are not claims.
  const copy = (block.match(/>[^<>{}]{8,}</g) || []).join(' ')
  check('the Pro state quotes no invented figures',
    !/\d+\s*%/.test(copy) && !/\$\s*\d/.test(copy), copy.slice(0, 160))
}


// ══════════════════════════════════════════════════════════════════════
// 6. THE SIGNED-OUT MARKETING CARD MATCHES THE ENTITLEMENT.
//
// The signed-out /live page sold the product as "completely free during
// beta" / "100% free during beta" and listed "AI coach with 6 strategy
// modes" as something a free signup delivers. Live Mode is Pro, and the
// product is priced at /pricing, so both lines promised what signup does
// not give. This section pins the contradiction closed.
// ══════════════════════════════════════════════════════════════════════
// Read the STRIPPED source: the in-place comment quotes the old copy in order
// to explain why it went, and that quotation is not a rendered claim.
check('the signed-out card no longer claims the product is free during beta',
  !/free during beta/i.test(live) && !/completely free/i.test(live))
check('the AI coach is not offered as a free-signup feature',
  !/'AI coach with 6 strategy modes'/.test(live))
check('the AI coach is labelled Creator Pro where it is still listed',
  /AI coach with 6 strategy modes — Creator Pro/.test(live))
check('the signed-out card still says what a free account genuinely gives',
  /Free account, no card required/.test(live) &&
  /Historical session breakdowns/.test(live))
check('Live Mode is named as Pro in the signed-out copy, not silently omitted',
  /Live Mode[^<]*is part of Creator Pro/.test(live))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
