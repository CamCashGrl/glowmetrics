# CamCash Sessions — Pre-Build Audit & Implementation Plan (read-only)
Date: 2026-11-04 · Branch inspected: claude/admiring-knuth-4ckebf @ 671f1a1 · App root: glowmetrics_fresh/
No files changed, nothing committed, no DB/production access used. Local tests: `npx jest lib/sessions app/dashboard/__tests__/sessions-overview.test.js lib/analytics/__tests__/batch1-scope-timezone.test.js` → 5 suites, 140 tests passing.

## 1. Existing architecture (data flow)
Supabase (tips, paid_sessions, live_sessions/live_private_intervals via useRecentShows, planned_streams)
→ app/dashboard/page.js loads (tips ~L2200 canonicalPlatform; paid_sessions ~L2257; planned_streams loadPlannedStreams L1424, limit 500)
→ `accessibleDataset()` lib/analytics.js:2410 (THE only Free/Pro history gate) → `accessible.{tips,shows,paidSessions}`
→ `<SessionsOverview>` app/dashboard/page.js:5375 (props: tips, shows, paidSessions, isPro, primaryPlatform, plannedStreams, tz=creatorTz, live)
→ app/dashboard/SessionsOverview.js (774 lines) computes everything via lib/sessions/normalize.js (953 lines):
- buildSessionHistory (L169): live (finalized live_sessions) + free_chat/imported (detectSessions on unlinked tips) + private (groupPaidSessions)
- filterSessionHistory (L184), sessionsMode (L611), dailySessionStats (L233), overallSessionStats (L649), sessionPerformance (L703)
- Per-session: sessionBuckets (L793), sessionFanDrivers (L858), sessionVsTypical (L898), matchPlannedStream (L929), sessionTimeline (L563)
UI pieces in SessionsOverview.js: Hero / OverallHero / PlatformCard / SessionPerformanceCards / Activation / SessionRow (L377) / BucketsView (L434) / FanDriversView (L489) / ScheduleView (L520) / Details (L568, tabs overview|timeline|schedule|fans). ROWS = 5 (L44).
Grouping engine: lib/analytics/sessions.js — SESSION_GAP_MS = 60 min, isValidSession = ≥30 min AND ≥2 tips, detectSessions (splits on gap OR platform change).
Timezone: lib/creatorTimezone.js (zonedHour/zonedYMD…), creatorTz passed down; SessionsOverview formats all times with `timeZone: tz`.
Legacy dead code: page.js:5399 "SESSION BREAKDOWN ENGINE" (5-min buckets, spikes, generic coaching strings) gated by `showDetailedBreakdown`, which is never set true. Comment says "kept pending approval to remove".

## 2. Reusable — preserve
- sessionBuckets (already the bucket engine: chronological, start/end per bucket, public/private USD, tip count, zero buckets kept, peak share only with ≥3 earning buckets, Live private marked estimated).
- sessionFanDrivers (per-session tippers, USD, count, share, new/returning).
- sessionVsTypical (median comparison with sample size, null below 5).
- matchPlannedStream (no_plans / unscheduled / on_schedule / early / late, overlap % for Live).
- accessibleDataset Free gating; creatorTz plumbing; fanKey (platform:username, never merged cross-platform).
- 60-min grouping + meaningful-session rule (unchanged).

## 3. Original bucket feature
- Current: commit a5749de (2026-10-09) "Session Details tabs — Timeline buckets and Fans who drove the session" → sessionBuckets + BucketsView (bar chart + bucket table + peak callout) inside Details "timeline" tab. Still live.
- Older: page.js:5399 legacy breakdown (introduced via #640 / 9fb57fb era, re-touched 613d2d5): 5-min fixed buckets over first→last tip, peak bucket, half split, tipper map, "spikes", hardcoded coaching sentences. NOT recommended for restoration (generic filler, duplicate formulas, operates on ungated `sessions`).
- Feasibility: HIGH — the new graph should be a new presentation of sessionBuckets. Missing pieces: per-bucket full contributor list (sessionBuckets only returns topFan + uniqueFans; the Map is built then discarded), per-bucket tip-count already present. Requires a small additive change to return `fans[]` per bucket (no formula change).

## 4. Feature readiness matrix
| Feature | Status | Reason |
|---|---|---|
| Session Pulse – new session ready | Partial | useRecentShows has isNew/acknowledge for Live only; imported sessions have no "seen" state |
| Pulse – upcoming strong window | Partial | canonicalBestTimes.bestWindow (analytics.js ~L1922) = one local day+hour with tier; no multi-hour window |
| Pulse – opportunity from previous results | Missing | no defined rule; must be specified, not invented |
| Pulse – verified milestone | Missing | no milestone source for sessions |
| Pulse – low-data state | Ready | Activation / NotEnough components |
| Recent Sessions (5, platform-first, local time, type, earnings, vs, selected) | Ready/Partial | rows exist; title is sessionTitle() not platform-first; type labels exist |
| Browse more history | Missing | rows hard-sliced to 5, no paging |
| Selected summary: outperform/underperform w/ baseline, n | Partial | sessionVsTypical has medianUSD, n, basis; no confidence tier; 'all' fallback mixes types/platforms |
| Peak-window status inside/outside/unknown | Partial | needs a matcher vs bestWindow (1-hour); not built |
| Planner status scheduled/not/unknown | Ready | matchPlannedStream |
| Bucket graph w/ start/end, earnings, tips, zeros, selection | Ready (engine) / Partial (UI) | no bucket click/selection yet |
| Per-bucket tipper list + USD + counts | Partial | engine discards per-bucket fan list |
| Earnings/Tips toggle | Ready (data) | count per bucket exists |
| Reverse tipper→bucket highlight | Partial | derivable from same events, needs per-bucket fans |
| Verified zero vs data unavailable | Partial | Live (exact span) zeros are verified; imported zeros are within first→last tip only; no "unavailable" concept for Live tracking gaps |
| Biggest driver insight | Ready | sessionFanDrivers[0] |
| Concentration | Ready | peak.sharePct / fan sharePct |
| First vs second half | Partial | detectSessions has firstHalfUPM/secondHalfUPM for imported only; not for Live; must reuse, not recompute |
| New vs returning | Ready | sessionFanDrivers.returning (Free = "in available history") |
| Longest tip-free interval | Missing | simple from events, but a new formula → needs approval |
| First tip timing | Ready for Live (exact start), N/A for imported (span starts at first tip by definition) |
| Similar-session comparison | Partial | sessionVsTypical 'same' basis |
| Contextual Pro teaser | Partial | lib/proTeasers.js + summarizeWindowExclusion exist; none in Sessions |

## 5. Data-integrity risks (report-only, nothing changed)
1. sessionVsTypical fallback 'all' compares e.g. a Live show to imported sessions on other platforms; compares raw totalUSD, so a 35-min imported session is judged against multi-hour shows. Recommend: only show when basis==='same' (or label clearly). Needs approval.
2. Free gating can cut a session that straddles the 31-day window start: detectSessions runs on already-windowed tips, so the oldest visible session may be partial and still marked under/over-performing.
3. Imported durations are first→last tip; any "duration", $/hr, or "first tip timing" for imported must stay labeled as activity span (current code does this correctly).
4. Peak window is a single hour+day from bestWindow; "inside peak window" for a multi-hour session needs a defined overlap rule (approval).
5. Planner: imported sessions match on first tip, not true start — "late" can be false for imported data. planned_streams fetch capped at 500 rows (fine today; production had 0 rows on 2026-10-09).
6. Live private interval earnings are spread proportionally across buckets (labeled estimated) and have no fan attribution → per-bucket tipper totals will not sum to bucket total for Live. UI must show "Private (no tipper detail)".
7. Live multi-platform shows: sessionVsTypical uses platforms[0] only.
8. Legacy page.js:5399 block contains duplicate bucket/half/tipper formulas and generic coaching — dead but present; should be removed in a separate approved PR.
9. detectSessions fans Set uses username.toLowerCase() (crash risk on null username) while normalize uses fanKey — minor; verify uploads always set username.

## 6. Entitlement matrix (today)
| | Free | Pro |
|---|---|---|
| Platforms | FREE_PLATFORM_LIMIT = 3 (planLimits.js) | all |
| History | full on primary platform; rolling 31 days (anchored to each platform's latest row) on others; all 31-day if no primary | full |
| Sessions tab data | accessible.* (gated) — list, buckets, fans, vs-typical, planner all computed on gated data | full |
| Fan "New" label | "New in your available history" outside primary | "New" |
| Detail tabs (timeline/schedule/fans) | available | available |
Compatible teasers: (a) below Recent Sessions when summarizeWindowExclusion shows real excluded sessions on non-primary platforms; (b) at the history-browse boundary (31 days) on non-primary platforms. Not compatible without a policy decision: locking bucket graph/fans, which Free has today (would silently remove Free functionality).

## 7. Incremental plan (each PR independently testable; no migrations required for PR1–6)
- PR1 Engine (additive): sessionBuckets returns per-bucket `fans[]` (username, platform, usd, count) + `verified` flag (Live = exact; imported = within activity span). Tests: low-data (1 tip, 2 tips/31 min), high-data (500 tips, 3 platforms), Live with private intervals, DST day in America/New_York. No UI change.
- PR2 Bucket graph UI: interactive chart (Earnings/Tips toggle, zero buckets visible, selected bucket, contributor panel, tipper→bucket highlight, single neutral palette). Tests: RTL click/keyboard selection, a11y, mobile width.
- PR3 Recent Sessions list: platform-first row, local time, type label, "Imported" as secondary chip, "Browse more" paging over existing filterSessionHistory (Free bounded by gated data). No new metrics.
- PR4 Selected summary: show vs-typical with baseline/n/basis, suppress mixed-basis (pending decision), planner status from matchPlannedStream, peak-window status via a new pure matcher against bestWindow (pending decision).
- PR5 Insights (2–3): driver, concentration, timing/planner — only from existing outputs; new formulas (tip-free gap) only if approved.
- PR6 Session Pulse: states from existing data (isNew Live show, upcoming bestWindow in creatorTz, low-data). Imported "new session seen" state needs PR6b.
- PR6b (migration, optional): per-user "last seen session" marker (e.g. profiles column) with RLS — only if approved.
- PR7 Pro teaser at real gated boundary using summarizeWindowExclusion; no mock numbers.
- PR8 Cleanup: remove legacy page.js:5399 block (needs explicit approval).
Each PR: local jest + next build + Playwright screenshot with fixture accounts; draft PR, never merged by me.

## 8. Decisions needing approval
1. Comparison baseline: restrict outperform/underperform to same platform+type (hide otherwise), or keep 'all' fallback with label?
2. Compare on total earnings only (current), or also earnings per activity-hour for Live only?
3. Peak-window rule: session "inside" if its start hour = bestWindow hour, or any overlap with that hour?
4. Longest tip-free interval / first-tip timing (Live only) — approve as new formulas?
5. Persisted "seen" state for imported sessions (migration) — yes/no?
6. Should any part of Sessions become Pro-only, or teasers only at existing 31-day boundary?
7. Approve removing the dead legacy breakdown block in page.js.
8. Free partial-session at the window edge: flag it, or exclude it from comparisons?
