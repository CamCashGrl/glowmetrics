# Brief: why signups aren't becoming subscriptions (2026-10-11)
Read-only investigation. No code, formulas, or data were changed.

## Findings (prod DB, aggregates only)
- 234 users: 230 free, 4 pro. 13 have a Stripe customer ID. 64 signed up in the last 30 days.
- 157 of 234 (67%) have NO tip data at all. Most users never activate.
- Of the 77 users with data: 67 have 1 platform, 9 have 2, 1 has "4".
- Free tier allows 3 platforms in the DB (migration 20260910 and 20261013), but the landing page and FAQ say the free plan is "1 platform". The paid feature we advertise is free in practice.
- A third plan model exists: primary platform gets full history, the others get 31 days (api/profile/primary-platform).
- click_events, checkout_events, csv_upload_events and free_trial_events all have 0 rows. Funnel tracking is not recording.
- Platform values are inconsistent: "Chaturbate"/"chaturbate", "BC"/"BongaCams", "Unknown". This breaks per-platform counts and can mis-count the platform limit.
- 2 pro accounts have no Stripe customer ID, and 1 free account does have one. Need to check whether these are comps, tests, or a sync bug.
- Checkout asks for a card up front for the 7-day trial.

## Tasks, most important first
1. NEW: Fix activation. 67% never import data, so the paywall is never reached.
2. NEW: Decide on ONE free-tier rule (1 platform vs 3 platforms vs primary-platform history). Then align the DB trigger and the copy. Needs approval.
3. NEW: Repair funnel tracking (all event tables have 0 rows).
4. NEW: Normalize platform names and audit their effect on metrics and the limit trigger. Needs approval.
5. NEW: Reconcile pro vs Stripe mismatches (3 accounts).
6. LATER: Contextual paywalls, ROI copy, and exit survey (after 1 to 3).
Completed: diagnosis. In progress: none.

---
# Update 2 (same day)

## Done
- Chaturbate casing normalized in prod (migration 20261014 + rollback file). 1,614 rows relabeled, 186,926 total Chaturbate rows, no rows lost, IDs backed up. Live extension and mirror writers now store "Chaturbate".

## Critical findings
- PRICE MISMATCH: the site says $9.99/mo, but checkout charged $19.99/mo (Stripe price "Monthly Sub", price_1T8h90…). This is true of every monthly checkout through Oct 9. A $9.99 price (price_1UOVqL…, plus a $9.99 7-day-trial price) exists but has not been confirmed as the one checkout uses. One annual customer canceled with the reason "too_expensive".
- Stripe totals: 8 subscriptions ever. 1 active but set to cancel (emmyfox2), 1 past_due (niemeyerb101, still pro), 6 canceled. 4 customers abandoned checkout without a subscription.
- Pro but no Stripe customer: daphneoncam@gmail.com, daphne+test@camcashgrl.com (owner and test comps?).
- Web tracking stopped on 2026-09-18. Only extension events are recorded since. The typed event tables (click/checkout/csv/trial) have no INSERT policy, so all their writes fail. lib/track.js sends `event_name`, but /api/track reads `eventName`.
- SECURITY: analytics_events policy "users_read_own_analytics" lets anyone read every row with user_id IS NULL. The admin read policy is hardcoded to UUID e42d59be…, which is not the owner's account.
- Funnel up to Sep 18: 90 signup_success, 45 onboarding_import_completed (50%), 13 pricing views, 8 paywall_hit, 2 trial checkouts, 2 subscription_completed. 17 users hit onboarding_paste_parse_failed (104 times).

## Tasks, most important first
1. Point production STRIPE_MONTHLY_PRICE_ID at the $9.99 price (needs approval; Vercel env + redeploy).
2. Fix /api/track (accept event_name; server-side insert) and find what stopped on Sep 18.
3. Fix the analytics_events read policy (data exposure). Needs approval.
4. Website copy: choose the free-tier rule (DB = 3 platforms; copy says 1). Needs a decision.
5. niemeyerb101 is past_due but still pro. Decide on grace or downgrade.
6. Onboarding paste-parse failures (17 users).
7. BC/Unknown platform rows.
