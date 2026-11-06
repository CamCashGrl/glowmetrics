# Brief — 2026-11-06 — Free vs Pro entitlements, pricing page, teasers (PLAN ONLY)

Read-only audit. No code, database, Stripe or Vercel changes were made.
Production checks were SELECT-only against Supabase project `hlsdlaibnayzbfflxclj`.

---

## 0. Findings to act on (data / billing integrity)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| F1 | **Critical** | **Stripe trial users get the Free plan during their trial.** The webhook sets `plan = status === 'active' ? 'pro' : 'free'`, so `trialing` gives `free`. Nothing in the UI reads a "trial" tier. The pricing page and dashboard still advertise a "7-day free trial". | `app/api/stripe/webhook/route.js:248,363`; hotfix commit `350b215` (Oct 18); `lib/stripe.js` `getUserPlanDetails` is never called |
| F2 | **Critical** | **The Free history window is browser-only.** RLS lets every user `SELECT` all of their own `tips`, `paid_sessions`, `live_tips` and `live_private_intervals`. The dashboard downloads full history and then filters it in JS. Any Free user can read all of their history straight from the Supabase REST API. | `pg_policies` (tips_own_select etc.); `app/dashboard/page.js:1655,1671,2026,2081,2234` |
| F3 | High | **Four different definitions of "Pro":** (a) `isProPlan`: plan is pro/unlimited, expiry ignored. (b) dashboard inline, same as (a). (c) `lib/stripe.js hasProAccess`: pro AND status active. (d) DB `is_live_mode_pro` / `get_user_insights` / `check_free_tier_platform_limit`: plan ≠ free AND not expired. They give different answers for trials, goodwill grants and expired grants. | `lib/planLimits.js:18`, `app/dashboard/page.js:1647`, `lib/stripe.js:38`, migration 20261103 §2a |
| F4 | High | **2 production profiles still have `plan='pro'`** although `trial_ends_at` passed on 2026-10-09. They have `subscription_status='none'`, no Stripe subscription and `plan_expires_at` NULL, so every Pro check still treats them as Pro. The goodwill-expiry cron only matches `subscription_status='goodwill_trial'`. **Not changed. Owner decision.** | profiles query |
| F5 | High | **The Nov 3 Live Mode migration IS applied in production**, although its header says "NOT YET APPLIED". Present in production: `get_live_mode_allowance`, `enforce_live_active_limit`, `start_live_session(text,text)`, the cron job `sweep-free-live-active-limits`; the 3 platform-limit triggers are dropped. The repo is also missing `gate_live_mode_pro_only`, which the migration itself references. | pg_proc / pg_trigger / cron.job |
| F6 | Medium | `check_free_tier_platform_limit` still enforces **3 platforms** when a Live session starts. Its error text says **"Creator Pro ($19.99/mo)"**, which is wrong: the price is $9.99. Its platform list also leaves out CamSoda. | production function body |
| F7 | Medium | Every checkout gets `trial_period_days: 7` unconditionally. There is no trial-eligibility check, so a canceled user can re-trial. `success_url` and `cancel_url` are built from the request `Origin` header. | `app/api/stripe/checkout/route.js:155,161` |
| F8 | Medium | Today's Free window is **anchored to each platform's newest tip**, not to the creator's calendar. On top of that, the **primary platform has unlimited history on Free**. | `lib/analytics.js:2298-2360` |
| F9 | Medium | **248 of 281 profiles have no saved timezone.** Calendar-day rules fall back to the browser zone and then UTC. The browser zone is client-supplied, so a Free user can shift the Live week boundary by up to about a day. | profiles query; `app/api/live/usage/route.js:20` |
| F10 | Medium | When a Free stream reaches its cap, the session's `ended_at` is set to the moment it hit 35 active minutes, even if that moment is in the past. Pro expiring during a long stream would therefore end it retroactively. Tips after that point stay stored, but session totals would understate them. The downgrade-during-session rule needs to be explicit. | migration 20261103 §2d |
| F11 | Low | The pricing page shows **"Most Popular"** on Pro. Production has **0** active paid subscriptions, so the claim is unsupported. | `app/pricing/PricingClient.js:415` |
| F12 | Low | `windowDays: 31` is hard-coded in 5 places in `app/dashboard/page.js` instead of using `FREE_ANALYSIS_WINDOW_DAYS`. | see F2 lines |

Production plan mix (today): free/none 272, free/canceled 7, pro/none 2 (F4). 139 profiles have no primary platform. 5 users have tips on more than one platform. 1 Free Live session has ended at the cap.

---

## 1. Current entitlement audit (file paths)

- Plan constants: `lib/planLimits.js` (FREE_PLATFORM_LIMIT=3, FREE_ANALYSIS_WINDOW_DAYS=31, isProPlan, resolvePlatformRoles, MODULE_DATA_THRESHOLDS)
- History gating (client only): `lib/analytics.js` `freeWindowStartByPlatform`, `applyFreeAnalysisWindow`, `summarizeWindowExclusion`, `accessibleDataset`
- Data loading (full history, RLS-scoped only): `lib/dataLoad/queries.js`, `fetchAllRows.js`, `resolveLoad.js`
- Dashboard gating: `app/dashboard/page.js` (isPro at 1647), `DashboardPreview.js`, `PlatformsIntelligence.js`, `SessionsOverview.js`, `MoneyMap.js`, `StreamPlanner.js`, `CommandCenter.js`, `Sidebar.js`, `PrimaryPlatformPrompt.js`, `SubscriptionManager.js`
- Teasers: `lib/proTeasers.js` (3 teasers; hard-coded "31 days")
- Primary platform: `app/api/profile/primary-platform`, migrations `20261010_lock_profile_entitlements`, `20261016_backfill_primary_platform_single_platform_free`
- Server insights: RPC `get_user_insights` (ownership-checked; computes `is_pro`)
- Live Mode: `app/api/live/session/*`, `app/api/live/usage/route.js`, `lib/liveSession/activeLimit.js`, `app/live/LiveModeAllowanceBar.js`, `app/live/useLiveSessionEngine.js`, migration `20261103_live_mode_free_allowance_and_private_mode.sql`
- Billing: `app/api/stripe/checkout|portal|webhook`, `lib/stripe.js`, crons `expire-goodwill-trials`, `check-subscription-drift`, `send-trial-*`
- Pricing: `app/pricing/page.js`, `app/pricing/PricingClient.js` (1,017 lines)
- Onboarding: `app/onboarding/page.js` (imports planLimits)

**Reusable as-is:** the Live allowance (RPCs, sweep, allowance bar, usage route), `resolvePlatformRoles`, `applyFreeAnalysisWindow` as the single client gate, `proTeasers` (honest-signal design), `MODULE_DATA_THRESHOLDS`, `lib/creatorTimezone.js` resolution order, the checkout price guard and stale-customer handling.

---

## 2. Proposed centralized policy (one rule, two mirrors)

**DB (authoritative):** generalize the existing `is_live_mode_pro` into `public.entitlement_tier(uid) → 'pro' | 'trial' | 'free'`. `is_live_mode_pro` becomes a thin wrapper, so no competing check is added. One window function, `public.free_window_start(uid)`, returns the start of today minus 29 days, at local midnight in the creator's zone (zone order: saved → UTC; the browser zone is not used for enforcement).

**JS (display only):** `lib/planLimits.js resolveEntitlement(profile)` mirrors the DB rule. A parity test runs the same fixture table against both. `isProPlan` callers migrate to it. A browser `isPro` is never used for authorization.

| Area | Free | Pro / trial* |
|---|---|---|
| Platforms analysed | 1 (`primary_pro_platform`) | All supported |
| CSV import | Unlimited for any platform; non-primary rows **stored but hidden** | Full |
| History | Last 30 calendar days (creator TZ), primary platform only | Full |
| Live Mode | 2 starts per creator-local week, 35 active minutes each | Unlimited |
| Fans | Top 3 names + totals | Full CRM / churn / trends |
| Money Map, Stream Planner, cross-platform, long-term trends, private analytics | Locked preview | Full |

\*Trial is **full Pro** under the recommended option. This needs your decision (D1).

---

## 3. Pricing page plan (PR-A, UI only; ships last or with neutral copy)

Keep the navy and glass styling and the existing brand accents. Hero: "Stop guessing. Start earning smarter." plus the subtitle you provided, kept compact. Two equal-height cards, in this order: name → benefit → price → billing toggle (Pro only) → one CTA → 5–7 highlights → "Compare all features" link.

- Free: "$0 / forever". CTA "Start Free"; a signed-in Free user sees "Current plan → Dashboard".
- Pro: "$9.99 / month" or "$99 / year — save 17%". The math: $119.88 a year at the monthly price, so annual saves $20.88, which is 17.4%. CTA "Unlock CamCash Pro". The trial CTA appears only when a new `GET /api/stripe/trial-eligibility` returns true.
- Remove "Most Popular" (F11).
- Add a comparison table with the 9 categories and Free / Limited / Pro marks. The table is generated from the policy table in `lib/planLimits.js`, so copy cannot drift from the real limits.
- Add 3 benefit blocks, using your copy.
- Viewports: 1366×625 and 1366×768 (cards and CTA above the fold), 1440×900, 1920×1080, 768, 390, 375. Verified with Playwright screenshots and an overflow assertion.

## 4. Teaser placement map (extend `lib/proTeasers.js`, no new engine)

| Page | Real-signal teaser | Fallback |
|---|---|---|
| Command Center | Older history exists (`excludedCount>0`) | none |
| Sessions | More than 30 days of sessions exist → "Compare sessions" | illustrative, labelled |
| Platforms | Hidden non-primary rows exist → cross-platform | none |
| Fans | Fans beyond the top 3 / lapsed fans (existing churn logic) | none |
| Money Map / Stream Planner | Labelled illustrative preview; **no premium data sent to the browser** | same |
| Live | Allowance bar (existing) plus an upgrade link at ≤1 stream left or ≤10 minutes left | — |
| Onboarding | After the first import, one card with "Continue free" kept visible | — |

Rules: at most one teaser per screen region, none for Pro or trial users, and every CTA goes to `/pricing` or checkout.

## 5. Frontend changes
Migrate `isProPlan` and the dashboard inline check to `resolveEntitlement`. Replace the 5 hard-coded `31` values. Change `applyFreeAnalysisWindow` to a calendar/TZ window covering the primary platform only (the same single function). Add a fan top-3 gate. Add Money Map / Planner previews. Pricing PR-A. Teaser copy.

## 6. Server / DB changes (one migration per PR)
1. `entitlement_tier`, `free_window_start` (wrapping the existing functions).
2. Replace the own-row SELECT policies on `tips`, `paid_sessions`, `live_tips`, `live_private_intervals` with plan-aware policies (Pro: all rows; Free: primary platform and `date_time >= free_window_start`). The studio-admin policies get the same predicate for the model's tier. Writes and import RPCs are unchanged. Benchmarked on the staging project first.
3. Change `check_free_tier_platform_limit` to 1 platform for Live start, with corrected copy.
4. Webhook: `trialing` → trial tier (if D1 = full Pro). `past_due` → keep access until Stripe cancels (D4).
5. Checkout: server-side trial eligibility (never subscribed and no prior `trial_ends_at`); build `success_url` from an env base URL instead of the `Origin` header.
6. Backfill the repo with the production-only `gate_live_mode_pro_only` definition (record only, no-op) and correct the Nov 3 header.

## 7. Conflicting migrations
- `20260910_free_tier_three_platform_limit`, `20260910b_…` and `20261016_backfill_primary_platform_single_platform_free` encode the 3-platform rule.
- `20260705*` platform triggers were already dropped by 20261103.
- 20261103 itself does not conflict and is reused unchanged except for the downgrade rule (F10).

## 8. Existing-user transition
Existing Free users lose full primary-platform history and 2 secondary platforms. This affects all 272 Free users; 5 have multi-platform data. Proposed:
- email plus an in-app banner 14 days before;
- no data is deleted, ever;
- an upgrade unlocks everything instantly, because RLS reads the tier on every query;
- 139 users have no primary platform: prompt them to choose one before cut-over; until then the newest-imported platform is shown with a "choose" banner (D3).

## 9. Checkout risks before launch
F1 (trial grants nothing), F7 (unconditional re-trials), F11 (Most Popular), F6 ($19.99 copy). Also confirm the Stripe trial setting matches the copy, and that PR #761 is deployed (Vercel auto-deploy was broken per the 2026-11-05 brief).

## 10. Test plan and sequence
Fixtures on the **Live Mode Testing** project (`qqvflqcxglkmeuahubwv`), never production. Accounts: free, pro active, trialing, expired trial, canceled, past_due, downgraded mid-session, no timezone, DST-week timezone.

Tests: RLS bypass via direct REST `select`; export routes; studio route; Live start/cap/sweep; TZ boundaries (00:00 local, DST); import accuracy; checkout in Stripe test mode; JS/DB parity.

**PR order:**
1. Policy module plus parity tests (no behaviour change).
2. Billing fixes (F1/F7, after decisions).
3. DB enforcement (RLS + window) on staging, then production with your approval.
4. Dashboard / fans / teasers.
5. Live 1-platform rule plus downgrade rule.
6. Pricing page (copy published only after 3–5 are verified).

---

## Decisions needed from owner
- **D1** Trial: full Pro for 7 days (recommended), or keep the "capped" trial and define the caps.
- **D2** Free imports of non-primary platforms: store and hide (recommended; matches 20261103), or refuse.
- **D3** Users with no primary platform at cut-over: prompt plus a temporary default, or window everything.
- **D4** past_due: keep Pro through Stripe's retry period (recommended), or downgrade immediately.
- **D5** Pro lapsing during a live stream: keep it running to the end of that stream (recommended), or cap from the moment of the downgrade (never retroactively).
- **D6** The 2 expired `plan='pro'` profiles (F4): downgrade them, or keep them as intentional grants.
- **D7** Notice period for existing Free users (14 days proposed).

## Tasks, most important first
### New / to do
1. (Critical) Decide D1; until then the advertised 7-day trial gives Free access (F1).
2. (Critical) Server-side history enforcement (F2) before any restrictive marketing copy.
3. (High) Centralize the entitlement rule (F3); resolve F4 (D6).
4. (High) Make the repo match production for 20261103 / gate_live_mode_pro_only (F5).
5. (Medium) F6 copy, F7 trial eligibility, F9 timezone prompt, F10 rule, F11 badge.
6. (Medium) Pricing page redesign and teasers (after 1–3).
### In progress
- Waiting for owner approval of this plan.
### Completed
- Read-only audit of code, Stripe flow and production DB state (this brief).
