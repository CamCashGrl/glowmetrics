# Canonical Analytics Rules — Final Business-Rule Reconciliation

Every implementation compared line-by-line against actual source, not assumed equivalent.
No code changed.

---

## BEST-TIME RECONCILIATION

| Rule | `get_user_insights` (SQL) | `computeBestTimes()` (client) | `bestWindows()` (StreamPlanner, client) | Recommended |
|---|---|---|---|---|
| Unit of analysis | Individual tips, grouped by hour/day | Individual tips, grouped by hour/day | **Sessions** (from `groupIntoSessions()`) — a fundamentally different unit | **Session-level**, per the reasoning below |
| Minimum sample size | `HAVING COUNT(*) >= 3` tips per hour bucket | `hourBucketSets[h].size >= 3` **distinct hour-occurrences** (not raw tip count) | No pre-filter — every bucket with ≥1 session appears, labeled by confidence tier instead | **Distinct-occurrence gating before inclusion** (computeBestTimes' approach) — raw tip count can be satisfied by one session with 3 tips in an hour, which is a materially weaker signal than 3 separate occurrences |
| Statistic used | **AVG(usd)** | **MEDIAN** (`calcMedian` of per-bucket amounts) | **Mean of session-level `usdHr`** | **Median** — matches `computeBestTimes()`'s existing, more outlier-resistant choice; one $500 whale tip shouldn't single-handedly declare an hour "best" |
| Timezone handling | `date_time AT TIME ZONE p_timezone` — correct, local-native bucketing | `toLocalHour()`/`toLocalDow()` — correct, local-native bucketing | **Buckets in raw UTC** (`s.start.getUTCDay()`/`getUTCHours()`), only converts to local for *display* via `localHr()`/`localDay()` | **Local-native bucketing** (the first two implementations' approach) — bucketing in UTC then relabeling for display risks misalignment at day boundaries; this is a real, previously undocumented discrepancy |
| Day-of-week handling | Local day name via `EXTRACT(DOW ... AT TIME ZONE)` | Local day name via `toLocalDow()` | Raw UTC day index | Local-native, same reasoning as timezone |
| Session requirement | None — tip-level only | None — tip-level only | Requires session grouping first (inherits the session-rule conflict documented separately) | Once sessions are canonical, best-time analysis should be **session-aware** (using session `usdHr`, not raw per-tip amounts) — this is `bestWindows()`'s genuinely better idea, just built on the wrong session rule today |
| Tip-count requirement | ≥3 per bucket (see above) | ≥3 distinct occurrences per bucket | None (confidence-labeled instead) | See minimum-sample-size row |
| Sparse-data handling | Bucket simply doesn't appear if below threshold | Same — silent omission; `earlySignalHour` exists as an explicit lower-confidence fallback, never shown as "Best Time" | **Every bucket appears, confidence-labeled** (`needs-testing`/`low`/`medium`/`high`) | **`bestWindows()`'s confidence-tier approach is materially better product design** — showing "this window is untested, here's why it's promising" is more useful than silence, provided it's never mislabeled as a confident fact. Recommend adopting confidence tiers as part of the canonical output, not discarding them. |
| Confidence calculation | Implicit binary (bucket exists or doesn't) | Same, plus a separate `earlySignalHour` one-tip-minimum fallback | Explicit 4-tier (`high`≥5, `medium`≥3, `low`≥2, `needs-testing`<2 sessions) | **Adopt `bestWindows()`'s explicit tiering**, recalibrated to session-count once sessions are canonical |
| Whale-window calculation | Not present | Not present | Present (`whaleKeys` in `PlanTab`, cross-referenced against `whales` prop) | **New capability, keep it** — no conflict, genuinely additive |
| New-tipper calculation | Not present | Not present | Present (`newTipperRate`) | **New capability, keep it** — genuinely additive |
| Avg $/hour calculation | `AVG(usd)` per hour bucket (tip-level) | N/A (this function returns $/tip median, not $/hour) | Mean of session `usdHr` (already hour-normalized at the session level) | Once session-based, `usdHr` per session is the more correct "$/hour" concept than either tip-level statistic |
| Minimum history requirement | `v_total_tips_count < 10` → returns `has_data: false` for the whole insight set | None found at this function's level (gating happens at the caller) | None found at this function's level | Keep the ≥10-tip gate at the service level, not per-calculation |
| Date-range requirement | All-time (no rolling window) for `best_hour`/`best_day`; separate 7-day/30-day windows for trend fields | All-time | All-time | All-time for the base best-time calculation, consistent across all three today — no conflict here |

### Material impact of these differences

**Yes, these differences currently produce different answers for the same account.**
`get_user_insights` and `computeBestTimes()` can disagree on which hour is "best" purely from
mean-vs-median on the same tip data whenever the distribution is skewed (any account with an
occasional large tip). `bestWindows()` can disagree with both because it's evaluating whole
sessions, not individual tips, and inherits Stream Planner's non-canonical session rule on
top of that.

### Recommended canonical rule (requires your approval — this changes visible numbers)

**Session-based, median statistic, local-native timezone bucketing, explicit confidence
tiers, gated at ≥3 sessions before "high" confidence, no display of ungated buckets as fact.**
This is not a pure adoption of any single existing implementation — it takes
`computeBestTimes()`'s statistic and timezone rigor, `bestWindows()`'s session-level unit of
analysis and confidence tiering (once corrected to the canonical session rule), and
`get_user_insights`'s existing server-side execution context. **This will change the exact
"best hour" shown to real users today** compared to at least one of the three current
implementations — flagging explicitly as a decision requiring your sign-off, not something to
silently ship.

---

## SESSION RECONCILIATION

| Rule | `detectSessions()` | `getSessionBreakdown()` | `groupIntoSessions()` (StreamPlanner) |
|---|---|---|---|
| Gap threshold | **3 hours** | N/A — consumes `analytics.sessions`, which **is** `detectSessions()`'s output directly (confirmed: `app/dashboard/page.js` line 2350, `const sessions = analytics?.sessions || []`) — **not a separate implementation** | **4 hours** |
| Platform boundary | **Platform change always starts a new session**, even within the gap window | Inherits `detectSessions()`'s rule | **No platform boundary** — a session can span multiple platforms; the session's `platform` field is assigned post-hoc by tip-count majority |
| Minimum duration | None explicit — `durationMinutes = Math.max(rawMinutes, 1)` (floors at 1 minute, marks `durationUnknown` if the raw gap is 0) | Inherits | `durationHrs = Math.max(0.5, ...)` — **floors at 30 minutes**, a real difference from `detectSessions()`'s 1-minute floor |
| Minimum tips | None — a single tip is a valid (very short) session | Inherits | None |
| Overlapping sessions | Not possible by construction (strictly sequential, sorted by timestamp) | Inherits | Same — not possible by construction |
| Timezone | Stores UTC `startTime`/`endTime` as ISO strings; day/hour derivation happens downstream via `toLocalHour`/`toLocalDow` at consumption time | Inherits | Session boundaries computed on raw `Date` objects from `date_time`; day/hour extracted via `getUTCDay()`/`getUTCHours()` at consumption time — **no local-timezone conversion in the grouping logic itself, only in display formatting** |
| Session start/end rule | First/last tip timestamp in the group | Inherits | Same — first/last tip timestamp |

### This is confirmed as a genuine, material rule conflict — not just redundant code

Two real differences, both capable of changing session counts and $/hr for real accounts:
(1) the 3hr-vs-4hr gap threshold, and (2) the platform-boundary rule. A creator who
tips-hops between two platforms within 4 hours produces **2 sessions** under
`detectSessions()` and **1 session** under `groupIntoSessions()`.

### Recommended canonical rule

**`detectSessions()`**, unchanged. It is already the documented, shared implementation
(explicit comment: "never duplicate this grouping logic elsewhere"), already used by both the
main dashboard analytics and Live Mode's baselines, and `getSessionBreakdown()` already
correctly consumes its output rather than recomputing anything. **This is the one
reconciliation in this document where the existing product/business rule should be preserved
exactly as-is** — Stream Planner's 4-hour/platform-agnostic rule has no documented rationale
found anywhere in the codebase and should be retired in favor of the established rule, not
the reverse. Flagging this as the one place your instruction ("preserve the existing rule
unless there's a clear reason to change it") points unambiguously in one direction.

---

## PLATFORM RECONCILIATION

| | `aggregateRows()`'s `platforms`/`platformVelocity` | `platformEfficiency()` (StreamPlanner) |
|---|---|---|
| Session source | `meaningfulSessions` (quality-filtered subset of `detectSessions()`'s output) | Its own `groupIntoSessions()` (non-canonical, per above) |
| $/hr calculation | `totalUSD / hours`, summed across all sessions for the platform | Same formula, different session population |
| Avg tip size | `totalUSD / tips` | `totalUSD / tipCount` — same concept |
| **`bestUtcDay`/`bestUtcHour` per platform** | **Not present** | **Present** — derived from the platform's own best-scoring session slot |

### Determination on `bestUtcDay`/`bestUtcHour`

**Genuinely valuable, not redundant** — this is a real gap in the canonical implementation,
not a duplicate. Recommend adding per-platform best-day/best-hour to the canonical platform
result, computed using the same session-based/median/local-timezone rule established in the
Best-Time Reconciliation above (once that's approved), rather than Stream Planner
recalculating it on its own non-canonical session set.

### Recommended canonical rule

`aggregateRows()`'s `platforms` calculation, **extended** with per-platform best-day/best-hour
using the canonical best-time rule. Session population becomes `detectSessions()`'s output
(via the session reconciliation above), not `meaningfulSessions`'s quality-filtered subset —
**flagging one open question**: should platform $/hr use all sessions or only
"meaningful" (quality-filtered) ones? This wasn't part of the explicitly requested
reconciliation scope but surfaced during this comparison — recommend keeping the existing
`meaningfulSessions` filter (it's the current, presumably intentional, behavior) unless you
want it reconsidered.

---

## MISSED REVENUE RECONCILIATION

| | `get_user_insights.missed_opportunity` | `missedRevenueByPlatform` | `generateLossAlerts().peak_missed` |
|---|---|---|---|
| Concept | "Your best hour today already passed — here's roughly what that cost you" (single number, today-scoped) | "Here's your cumulative missed revenue per platform, historically, from not streaming at each platform's best hour" | "You haven't streamed during your peak window in the last 3 days — estimated 3-day loss" |
| Time scope | Today only | All-time, per platform | Rolling 3-day window |
| Calculation | `AVG(usd) * COUNT(*) / distinct-days`, capped at $200 | `(bestHourAvg - overallAvg) * sessionsNotAtBestHour`, per platform | `bestHour.avg * 3` (a flat 3-day multiplier of the single best-hour average) |

### Determination: **B — related but different calculations, not the same concept**

These are not interchangeable. `missed_opportunity` answers "what did today's miss cost,"
`missedRevenueByPlatform` answers "what has under-scheduling cost you cumulatively, broken
down by platform," and `generateLossAlerts`'s version answers "you've been off your game for
3 days running." **Do not merge these into one number** — that would lose real, distinct
information each currently captures. The duplication problem here isn't that they compute the
same thing three ways; it's that **none of them besides `missed_opportunity` are server-side
or plan-gated**, and they're scattered across three code paths with three different formulas
that a user could see simultaneously without any of them cross-referencing the others.

### Recommended canonical rule

Keep all three as **distinct fields** in the canonical missed-revenue output (e.g.
`today_missed`, `cumulative_by_platform`, `recent_streak_missed`), computed once, server-side,
using the canonical best-time numbers from the Best-Time Reconciliation above as their shared
input — not three independent recomputations of "best hour" feeding three independent loss
formulas, which is the actual duplication problem, not the loss formulas themselves.

---

## MONTHLY GROWTH RECONCILIATION

| | `aggregateRows().monthlyData` | `page.js` inline `_momThisRev`/`_momPrevRev` | `DashboardGrowthCharts.monthlyUsdSeries()` |
|---|---|---|---|
| Grouping key | Calendar month (UTC) | Calendar month (UTC) | Calendar month (UTC) |
| Aggregation | `SUM(usd)` per month | `SUM(usd)` for current-month-start-to-now vs. prior-month-start-to-prior-month-end | `SUM(usd)` per month, last 6 entries |
| Growth formula | N/A at this layer (`bestMonth` is just the max, no % growth computed here) | `(thisRev - prevRev) / prevRev * 100` | `(thisMonth.usd - prevMonth.usd) / prevMonth.usd * 100` |

### Confirmed: numerically identical for all relevant cases

All three use the same calendar-month boundary and the same `SUM(usd)` aggregation. The two
growth-percentage calculations (`page.js` inline, `DashboardGrowthCharts`) use the identical
formula. **No business-rule conflict found** — this is pure redundant recomputation, safe to
consolidate without a product decision, unlike sessions or best-time.

### Recommended canonical rule

**`aggregateRows().monthlyData`/`bestMonth`, unchanged**, extended with the growth-percentage
field (currently computed twice, identically, downstream) added directly to its output so
neither `page.js` nor `DashboardGrowthCharts.js` needs to recompute it.

---

## FINAL CANONICAL ANALYTICS SPEC

| # | Insight | Canonical function | Canonical rule | Inputs | Output | Consumers | Free | Pro |
|---|---|---|---|---|---|---|---|---|
| 1 | Earnings | `aggregateRows()` totals | Sum of `tips.usd`, no change | `tips` | `totalUSD` | Everywhere | Full | Full |
| 2 | Monthly growth | `aggregateRows().monthlyData`/`bestMonth`, extended with growth % | Calendar-month `SUM(usd)`, no rule change — consolidation only | `tips` | Monthly series + growth % | `monthly` tab, `page.js` momentum block, `DashboardGrowthCharts.js` | Full | Full |
| 3 | Sessions | `detectSessions()`, unchanged | 3hr gap, platform-boundary — **preserved as-is per your instruction**, Stream Planner migrates to this | `tips` | Session array | `aggregateRows()`, Live Mode, `getSessionBreakdown()`, Stream Planner (after migration) | Full | Full |
| 4 | Platforms | `aggregateRows().platforms`, extended with per-platform best-day/hour | $/hr, avg tip on `meaningfulSessions`, + best-day/hour once Best-Time is canonical | `meaningfulSessions` | Per-platform stats | Platforms tab, Creator Report | Totals/hours | $/hr, avg tip, comparison |
| 5 | Best times | **New — extends `get_user_insights`** to session-based/median/confidence-tiered per the reconciliation above | Session-level median $/hr, local-native timezone bucketing, explicit confidence tiers, ≥3-session gate for "high" confidence | Canonical sessions | Day×hour grid with confidence | Daily Brief, Overview, Stream Planner, Creator Report, Opportunities | Directional signal only | Full grid |
| 6 | Missed revenue | **New — extends `get_user_insights`** with 3 distinct fields per the reconciliation above | Three distinct, clearly-labeled calculations (today/cumulative-by-platform/recent-streak), sharing canonical best-time input | Canonical sessions + best-time | 3 fields, not merged | Losing Money card → Opportunities | Qualitative signal | Full figures |
| 7 | Fan intelligence | `identifyWhales()`, unchanged | No rule conflict found | `tips` | Ranked fan array | Top Fans, Creator Report | Top 3 | Full |
| 8 | Churn/re-engagement | `generateWhaleAlerts()`, `generateLossAlerts()` (minus `peak_missed`), unchanged | No rule conflict found | `whales`, `tips`, `sessions` | Alert objects | AUDIENCE/Fans | Aggregate count | Named/detailed |
| 9 | Session opportunities | `getSessionBreakdown()`, needs a server wrapper — no rule conflict, just no server equivalent | Existing logic, unchanged | Session object | Insight text | Sessions tab | Raw timeline | Causal detail |
| 10 | Platform opportunities | Extends #4 | Comparison narrative over canonical platform stats | Canonical platforms | Comparison text | Platforms tab, Opportunities | Totals | Comparison |
| 11 | Timing opportunities | Extends #5 | Same canonical best-time grid, opportunity-framed | Canonical best-times | Opportunity cards | Opportunities | Count/category | Full detail |
| 12 | Recommendations | `generateNextMoves()`, unchanged | No rule conflict found | `tips`, `sessions`, `whales`, canonical predictions, `bestHour` (needs repointing to canonical best-time once #5 lands) | Prioritized action list | Creator Report, Opportunities | Move #1 | Full list |

---

## DECISIONS THAT GENUINELY REQUIRE YOUR APPROVAL

1. **Best-time canonical rule** (median, session-based, confidence-tiered) will change the
   exact "best hour" shown to real users compared to at least one current implementation —
   this is a visible-number change, not just an internal refactor.
2. **Session canonical rule** (`detectSessions()`'s 3hr/platform-boundary) will change Stream
   Planner's session counts and $/hr numbers once it stops using its own 4hr/platform-agnostic
   grouping.
3. **Platform $/hr session population** (all sessions vs. `meaningfulSessions` only) — an open
   question surfaced during reconciliation, not explicitly asked about, flagged rather than
   decided.
4. **Missed-revenue: keep as three distinct fields**, not merged into one number — recommended,
   but changes what several UI surfaces would eventually display (three figures instead of one
   composite figure).

## FINAL PROPOSED ARCHITECTURE

Unchanged in shape from the prior documents:
`RAW DATA → CANONICAL ANALYTICS ENGINE → SERVER-SIDE INSIGHT SERVICE → PLAN-AWARE REDACTION →
FREE PREVIEW / PRO FULL → UI`. What changes with this reconciliation: "canonical analytics
engine" for best-time and missed-revenue is **not** simply "whatever `get_user_insights`
already does" — it's a synthesis of the best-reasoned pieces of all three implementations,
as detailed above, that then gets built into an extended `get_user_insights` (or its
successor). For sessions, platforms, monthly growth, fan intelligence, and recommendations,
the existing canonical implementations are confirmed correct and unchanged.

## RECOMMENDED IMPLEMENTATION ORDER

1. Session canonicalization first (Stream Planner → `detectSessions()`) — lowest ambiguity,
   clearest existing precedent, and every other reconciliation (best-time, platforms) depends
   on knowing which session population it's built on.
2. Monthly growth consolidation — lowest risk, no rule conflict, quick win.
3. Best-time canonical rule (the largest, most consequential change) — build the extended
   `get_user_insights` grid once sessions are settled.
4. Platform extension (best-day/hour) — depends on #3.
5. Missed-revenue three-field consolidation — depends on #3.
6. Session-opportunity and recommendation server wrappers — lowest technical risk, no rule
   conflicts, can proceed once the entitlement contract (already specced) exists.

---
No code changed. No UI changed. No entitlement logic changed. Reconciliation only.
