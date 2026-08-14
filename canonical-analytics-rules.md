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

## ADDENDUM — FINAL DECISIONS (A–D), PER APPROVAL ROUND 2

Four items resolved by direct investigation, not guessed at, per your instruction.

### A. `meaningfulSessions` vs. all canonical sessions for platform $/hr

**Traced `classifySession()` (`lib/analytics.js`, inside `aggregateRows()`):**
```
mins < 2  && usd === 0   → 'invalid'
mins < 15 && usd < 10    → 'low_signal'
else                      → 'meaningful'
```
`meaningfulSessions = sessions.filter(s => s.sessionQuality === 'meaningful')`.
`allValidSessions = sessions.filter(s => s.sessionQuality !== 'invalid')` (includes
`low_signal`, used only for a "how much low-signal data exists" count, not for stats).

**Where it's used today — confirmed by direct grep, not assumed:** `platforms` (the platform
$/hr calculation itself), `insights`, `predictions`, `lossAlerts`, `nextMoves`,
`timedSessions`/hourly-rate eligibility, and `page.js`'s own month-over-month comparison
block (line 3420+) **all** already filter to `meaningfulSessions`. This is not an isolated
choice — it's the load-bearing population for nearly every downstream statistic in the
current app.

**Would switching to all sessions materially change platform rankings?** Yes, and in the
wrong direction — including `low_signal` sessions (sub-15-minute, sub-$10 sessions, by
definition low-information blips) would pull $/hr averages toward noise, and `invalid`
sessions (near-zero-duration, zero-revenue — likely accidental tip-tracker artifacts, not
real streams) have no place in a $/hr calculation at all.

**Recommendation: B — `meaningfulSessions`.** This isn't a new decision — it's confirming the
existing, already-pervasive convention should extend to the canonical best-time/platform work
too, rather than introducing a second population definition alongside it.

### B. Exact confidence thresholds

Three named categories, per your instruction not to blur "insufficient" into "promising":

| Category | Threshold | Presentation rule |
|---|---|---|
| **Insufficient data** | < 2 meaningful sessions in the day×hour bucket | **Never shown as a best-time claim of any kind** — the bucket simply doesn't appear as a candidate |
| **Promising / early signal** | Exactly 2 sessions, OR 1 session performing notably above the account's overall median $/hr (reusing the existing `untestedWindows()`/`earlySignalHour` logic: "one session already beat your average") | Shown, but **explicitly labeled** "early signal — needs more data," never labeled "best time" or presented as fact |
| **Statistically supported** | ≥ 3 meaningful sessions in the bucket | Eligible to be shown as "best window." Two sub-tiers for UI nuance only (both count as statistically supported, neither is "insufficient"): **medium** (3–4 sessions), **high** (≥5 sessions) |

The ≥3-session threshold is not arbitrary — it's the same minimum both `get_user_insights`
and `computeBestTimes()` already independently converged on (as tip-count/occurrence gates);
this reconciliation carries that same number forward as the session-count gate, keeping
continuity with what's already been in production rather than inventing a new number.

### C. Exact mathematical definition of "best"

**Best window = the day×hour bucket, among all buckets meeting the "statistically supported"
threshold (≥3 meaningful sessions), with the highest median session `$/hour`.** Median, not
mean — per the earlier reconciliation, to avoid one large-tip session distorting the result.
If no bucket meets the statistically-supported threshold, there is no "best window" to
declare — the system falls back to showing the best available "promising/early signal"
candidate, always labeled as such, never substituted silently for a real "best time" claim.
Ties (identical median $/hr) resolve to the bucket with the higher session count, then the
more recent bucket if still tied.

### D. Exact creator timezone source

**Traced directly:** the app has **no persisted per-user timezone preference in `profiles`**.
Every dashboard call site computes it fresh, client-side, at the moment of use:
```js
const userTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
```
confirmed duplicated inline at **five separate locations** in `app/dashboard/page.js` (lines
1942, 2022, 2139, 3891, and the `get_user_insights` RPC call site at 2195 which passes it as
`p_timezone`) — itself a minor duplication worth a one-line helper extraction, though outside
this reconciliation's scope. **`app/live/page.js` uses a second, different mechanism** —
`liveTimezone`, a user-selectable value persisted in `localStorage` (`cc_live_timezone`),
defaulting to the same `Intl.DateTimeFormat()` detection only on first use. This is a real,
previously undocumented inconsistency: the main dashboard always trusts the browser's current
detected timezone with no override, while Live Mode allows the user to override it and
remembers their choice.

**Implication for the canonical server-side service:** the server has no independent way to
know a user's timezone — it must be supplied by the client on every call, exactly as
`get_user_insights` already does via `p_timezone`. **Recommendation:** standardize on the
dashboard's pattern (live-detected via `Intl`, passed explicitly per request) as canonical for
all server-side insight calls; treat Live Mode's persisted-override behavior as a deliberate,
separate UX choice for that specific surface, not something to unify away without a product
decision — flagging the inconsistency rather than silently resolving it in either direction.

### DST verification (new this round)

Traced `toLocalHour()`/`toLocalDow()`/`toLocalDateStr()` (`lib/analytics.js`, 47–78): all
three use `Intl.DateTimeFormat` with `timeZone: tz` set to the IANA zone string (e.g.
`"America/New_York"`), never a fixed UTC offset. The ECMAScript `Intl` API resolves IANA zone
names against their actual DST transition rules — **DST is handled correctly** by
construction, not by any extra logic needing to be written. Server-side, `get_user_insights`'s
`date_time AT TIME ZONE p_timezone` behaves identically in Postgres when `p_timezone` is a
named zone (confirmed it always is, since the client passes the same
`Intl.DateTimeFormat().resolvedOptions().timeZone` string both places). **One minor,
previously unflagged risk:** each client function silently falls back to raw
`getUTCHours()`/`getUTCDay()` if `Intl.DateTimeFormat` throws (e.g. a malformed zone string),
with no signal to the caller that a fallback occurred — worth a log line when this happens,
not a blocking issue, and not a DST correctness bug (the fallback itself is DST-agnostic UTC,
just silently different from the intended local-time answer).

---

## FINAL IMPLEMENTATION-READY SPECIFICATION

Consolidated reference — every prior section's decision, in one place, in the structure
requested.

| Metric | Canonical function/source | Exact rule | Inputs | Output | Timezone behavior | Confidence rule | Free contract | Pro contract | Migrating consumers | Deprecated/duplicate |
|---|---|---|---|---|---|---|---|---|---|---|
| Earnings | `aggregateRows()` totals | `SUM(tips.usd)` | `tips` | `totalUSD` | N/A | N/A | Full | Full | None — already single-sourced | None |
| Monthly growth | `aggregateRows().monthlyData`/`bestMonth`, extended with growth % | Calendar-month (local) `SUM(usd)`, growth % = `(this-prev)/prev*100` | `tips` | Monthly series + growth % | Local-native (via `toLocalDateStr`) | N/A | Full | Full | `page.js` inline block, `DashboardGrowthCharts.js` | Both consumers' independent recomputation retired once they read the extended field |
| Sessions | `detectSessions()`, unchanged | 3hr gap; platform change always starts a new session; start/end = first/last tip timestamp | `tips` | Session array | N/A (session boundaries are timestamp-based; local-hour/day derived downstream) | N/A | Full | Full | Stream Planner | `groupIntoSessions()` (4hr gap, no platform boundary, 30-min duration floor) — retired |
| Platforms | `aggregateRows().platforms`, extended with per-platform best-day/hour | $/hr = `SUM(usd)/SUM(hours)` over **`meaningfulSessions`** (session quality ≥ 'meaningful': ≥2min duration or nonzero $, ≥15min or ≥$10) | `meaningfulSessions` | Per-platform `usdPerHour`/`tokensPerHour`/`avgTipSize` + best-day/hour once Best-Time lands | Local-native, once best-day/hour is added | N/A for totals; inherits Best-Time's tiers for the added best-day/hour fields | Totals/hours only | $/hr, avg tip, comparison, best-day/hour | Stream Planner's `platformEfficiency()` | `platformEfficiency()` — retired |
| Best times | Extended `get_user_insights` (or a new server insight module it consumes — see Architecture Rule below) | Best window = bucket with **highest median session $/hour** among buckets with **≥3 meaningful sessions**. Session-level, not tip-level. | `meaningfulSessions` (canonical, post session-migration) | Day×hour grid, each cell tagged `insufficient` / `promising` / `supported` (medium/high) | **Local-native** — `Intl`-based, DST-correct (see above); timezone supplied per-request by the client (`Intl.DateTimeFormat().resolvedOptions().timeZone`), no persisted server-side preference | See table below | Directional signal + real-time in-window boolean only (unchanged from PR #407) | Full grid, all confidence tiers | `buildDailyBrief()`, Sticky Bar, Losing Money, Smart Insights, Stream Planner's `bestWindows()`, Creator Report's Best Streaming Time card, `missedRevenueByPlatform`'s internal bucketing, `generateLossAlerts()`'s `peak_missed` branch | `computeBestTimes()` (kept as a documented reference implementation of the median/local-timezone approach, but no longer the operative path once the server grid exists — **flagging this as a call for you**: retire entirely or keep as a client-side fallback for when the server hasn't loaded yet); `predictRevenue()` (dead code, safe to delete outright) |
| Missed revenue | Extended `get_user_insights`, three distinct fields sharing canonical best-time input | `today_missed` (today's passed best-hour vs. actual), `cumulative_by_platform` (historical, per platform), `recent_streak_missed` (rolling 3-day) — **kept separate, never merged into one number** | Canonical sessions + canonical best-time grid | 3 named fields | Local-native, inherited from Best-Time | Inherited from Best-Time | Qualitative pattern signal only | Full figures, all 3 fields | "Losing Money" card → Opportunities | `missedRevenueByPlatform`, `generateLossAlerts()`'s `peak_missed` branch — both retired once the 3-field service exists |
| Fan intelligence | `identifyWhales()`, unchanged | No rule conflict found this round | `tips` | Ranked fan array | N/A | N/A | Top 3 | Full list | None structurally — needs a server wrapper + row-limit redaction, not a calculation change | None |
| Churn/re-engagement | `generateWhaleAlerts()`, `generateLossAlerts()` minus `peak_missed` | No rule conflict found | `whales`, `tips`, `sessions` | Alert objects | N/A | N/A | Aggregate count only (already-approved disposition change) | Named fans, $ values, suggested action | "Losing Money" card → AUDIENCE/Fans | None — needs a server wrapper + the approved redaction, not a calculation change |
| Session opportunities | `getSessionBreakdown()`, needs a server wrapper | No rule conflict — confirmed this function already consumes canonical `detectSessions()` output via `analytics.sessions`, not a separate implementation | Session object | Insight/recommendation text | Inherits session timestamps | N/A | Raw timeline | Causal detail | Sessions tab | None |
| Platform opportunities | Extends the Platforms row | Comparison narrative over canonical platform stats | Canonical platforms | Comparison text | N/A | N/A | Totals | Comparison | Platforms tab, Opportunities (new) | None |
| Timing opportunities | Extends the Best-Times row | Same grid, opportunity-framed | Canonical best-times | Opportunity cards | Inherited | Inherited | Count/category | Full detail | Opportunities (new) | None |
| Recommendations | `generateNextMoves()`, unchanged, repointed | No rule conflict — needs its `bestHour` input repointed from `computeBestTimes()`'s output to the new canonical best-time grid once it exists | `tips`, `sessions`, `whales`, canonical best-time | Prioritized action list | Inherited | N/A | Move #1 | Full list | Creator Report, Opportunities | CSS-blur gate on moves #2+ retired in favor of server-side truncation |

### Confidence tiers, final (session-count based, per meaningfulSessions)

| Tier | Threshold | Can be labeled "best"? |
|---|---|---|
| Insufficient | < 2 meaningful sessions in the bucket | No — never appears as a candidate |
| Promising / early signal | Exactly 2 sessions, or 1 session beating the account's overall median $/hr | No — shown only as "early signal, needs more data" |
| Supported (medium) | 3–4 meaningful sessions | Yes |
| Supported (high) | ≥ 5 meaningful sessions | Yes, highest confidence label |

### Architecture rule, restated per your Section 9 instruction

`get_user_insights` must **not** become the monolith that owns all twelve calculations
inline. The recommended split: a new server-side module (plain JS or a set of focused SQL
functions, matching whichever of `lib/analytics.js`'s functions are being reused) computes
each canonical metric; a thin, shared redaction layer (per `entitlement-contract.md`, already
approved) applies the Free/Pro split; `get_user_insights` (or its successor endpoint) becomes
the **orchestration point that calls these**, not the place the business logic itself lives.
This keeps calculation and entitlement genuinely separate, as instructed.

### Migration order (unchanged from the prior round, restated for completeness)

1. Sessions (`detectSessions()` — Stream Planner migrates off `groupIntoSessions()`).
2. Monthly growth (low-risk consolidation).
3. Best-time canonical grid (largest, most consequential — depends on #1).
4. Platform extension (best-day/hour — depends on #3).
5. Missed-revenue 3-field consolidation (depends on #3).
6. Session-opportunity, platform-opportunity, and recommendation server wrappers (lowest
   technical risk, no rule conflicts, gated only on the entitlement contract existing).

### Testing requirements, final

Fixtures needed before any consumer migrates, covering every edge case requested: a
whale-heavy account (one large tip skewing mean but not median — proves the median choice
matters), a sparse account (<10 tips, confirms the `has_data:false` gate), an account at
exactly the minimum threshold (exactly 10 tips, exactly 3 sessions in one bucket — boundary
condition), a multi-platform account with platform-switching mid-session (proves the
session/platform-boundary rule produces the expected 2-session split, not 1), a session
crossing midnight local time (proves day-bucket assignment uses the session's start time
consistently), and an account with tip history spanning a DST transition (proves the
`Intl`-based local-hour conversion doesn't shift by an hour incorrectly across the transition
date). Each canonical function should have a fixture-driven test asserting its exact output
against hand-computed expected values for these cases before Stream Planner, Creator Report,
or any other consumer is repointed to it.

---
No code changed. No UI changed. No entitlement logic changed. Reconciliation only.
