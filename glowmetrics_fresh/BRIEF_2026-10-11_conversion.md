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
