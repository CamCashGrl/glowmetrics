# Best-Time Migration Matrix

Documentation only — no migration performed in this pass. Written to distinguish
legitimate feature-specific timing logic from actual conflicting sources of truth,
per your request after the Phase 1 verification report. Covers every remaining
independent "best time" / "peak hour" calculation found in the codebase, plus the
three parallel "missed revenue" calculations and the confidence-tier language
resolution.

---

## Confidence-tier language — resolved, final

Three independent confidence vocabularies exist today for time-slot confidence:

| System | Tiers | Thresholds (session/sample count) |
|---|---|---|
| `computeBestTimes()` (legacy) | shown / not-shown (binary), + separate uncapped "early signal" | `count >= 3` to show at all; earlySignalHour has no floor |
| `computeCanonicalBestTimes()` (new) | insufficient / promising / supported / high | `<2` / `2–3` / `4–5` / `6+` |
| StreamPlanner's `ConfBadge` | untested / needs-testing / low / medium / high | `0` / `<2` / `2` / `3` / `>=5` |

**Decision: the canonical system's tiers and thresholds are the resolved standard —
`<2 insufficient, 2–3 promising, 4–5 supported, 6+ high`.** This is what's already
implemented in `lib/analytics/bestTimes.js` and covered by the 49 passing checks in
`scripts/verify-canonical-analytics.mjs`. This resolves the earlier wording
discrepancy from the original spec (an earlier round's worked-example table vs. a
later summary restatement) in favor of the worked-example version, since it's the
more precise one and is already the tested, running implementation — re-deriving a
different threshold now would mean re-verifying against zero live consumers for no
benefit.

**Resolved user-facing labels**, chosen to match existing product language rather
than invent new terms:

| Tier | User-facing label | Existing precedent |
|---|---|---|
| `insufficient` | *(not shown as a candidate — no label)* | Matches `computeBestTimes()`'s current "return null" behavior and StreamPlanner's "untested"/"needs-testing" |
| `promising` | **"Early Signal"** | Already live UI copy — `page.js:3708-3712` labels `analytics.earlySignalHour` this exact way today |
| `supported` | **"Best Time"** (standard confidence) | Matches StreamPlanner's "medium" tier's practical meaning |
| `high` | **"Best Time"** (high confidence) | Matches StreamPlanner's "high" tier |

Whether `supported` vs. `high` get visually distinguished (badge color, a
confidence dot, etc.) is a UI decision, not a data-contract decision — left for
whichever phase actually migrates a consumer, not decided here. The **label and
threshold contract** is what's being locked in now, since that's what "used
broadly" refers to — every future consumer should read `tier` from
`computeCanonicalBestTimes()` and map it through this exact table, not invent its
own copy or its own thresholds.

**Not migrating StreamPlanner's `ConfBadge` in this pass** — noted in its matrix row
below as a real, current inconsistency (its thresholds are close but not identical:
a "low" tier at exactly 2 that canonical's `promising` absorbs into a 2–3 range).

---

## Best-time implementations

| # | Consumer | Current implementation | What it calculates differently | Legitimate or accidental duplication? | Should consume canonical? | Migration risk | Required regression tests | Recommended phase |
|---|---|---|---|---|---|---|---|---|
| 1 | **Overview/dashboard header** ("Peak Hour" chip, `page.js`) | `computeBestTimes()` → `analytics.bestHour` | Tip-level (not session-level); **median** of per-active-hour-bucket totals; `count >= 3` distinct hour-buckets to show; local-tz correct | **Accidental duplication** — same concept, same statistic family (median), just tip-level instead of session-level. No feature reason this needs to differ from canonical. | **Yes** | Medium — header is the single most-seen number in the product; a value change here is highly visible to every active user on their next load | Before/after diff across a real account sample (whale-heavy, sparse, exact-threshold); confirm header hour matches `canonicalBestTimes.bestWindow.localHour` for accounts where both have data; confirm graceful fallback to "Early Signal" copy when canonical only has a `promising` bucket | **Phase 1B** — highest visibility, but the calculation is genuinely the same concept at a different granularity, so risk is about *change management*, not *correctness ambiguity* |
| 2 | **Creator Report** (`CreatorReport.js:117`, "Best Streaming Time" stat card) | `analytics.bestHour` (same `computeBestTimes()` source as #1) | Same as #1 | **Accidental duplication** (same source as #1 — migrating #1 effectively migrates this too, since it reads the same `analytics.bestHour` field) | **Yes** | Low — bundled with #1's migration since it's the same field, not a separate calculation | Same as #1, plus confirm Creator Report's "~$X avg per session" sub-label still reads correctly from `bestWindow.medianUsdPerHour` (session-based) instead of `bestHour.avg` (tip-bucket-based) — these are not guaranteed to be numerically close | **Phase 1B**, bundled with #1 |
| 3 | **Live Mode** (`app/live/page.js`, Peak Hour Countdown) | `computeBestTimes()` called directly on live session data | Same formula as #1, but computed over the *live/real-time* tip stream, not the historical CSV import — an intentionally different data source (today's live data vs. all-time history) | **Legitimate feature-specific difference in scope** (live vs. historical), but the **formula itself** (tip-level median, `>=3` floor) is still the same accidental duplication as #1 if/when it's computed over historical data elsewhere in the same component | **Partially** — the *formula* should become canonical; the *live-data scope* is correct and must be preserved, not merged into the historical grid | **High** — Live Mode is real-time, revenue-countdown UX; a wrong or laggy peak-hour value here has immediate on-stream impact, unlike a dashboard tab a creator checks once | Live-session simulation with injected tips crossing a session boundary; verify peak-hour countdown timing math (`peakEnd`, `inPeak`, minutes-remaining) still works if `computeBestTimes()`'s return shape changes; explicit before/after on a recorded live session's peak-hour output | **Separate, high-risk work — not bundled with #1.** Explicitly flagged for its own phase given the real-time UX stakes |
| 4 | **Platforms / platform heatmap** (`page.js` Platform tab, per-platform-per-day heatmap) | `platformBestTimes` — inline in `aggregateRows()` | Tip-level, **mean-of-medians** structurally identical to #1's approach but scoped per-platform, plus a full day×hour grid (`bestHourByDay`) that canonical's per-platform extension (`platforms[].bestLocalDay/Hour`) doesn't yet expose (canonical only exposes a single best window per platform, not a full grid) | **Accidental duplication at the single-best-window level; legitimate gap at the full-grid level** — the heatmap needs the whole grid, and canonical's per-platform output today is single-window only | **Yes, but requires extending canonical's per-platform output to a full grid first** — not a drop-in swap | **Medium-high** — the heatmap is a dense, always-visible feature; a full-grid extension of `platforms[].` is new surface area, not just repointing an existing field | Full grid-shape comparison (all day×hour cells, not just the top one) between `platformBestTimes[p].allHours`/`allDays`/`bestHourByDay` and a to-be-built canonical per-platform grid equivalent; verify `missedRevenueByPlatform` (row 8 below) still resolves correctly if this migrates first | **Phase 1B for the single-best-window pieces already exposed** (`bestLocalDay`/`bestLocalHour` are already there and unused by the heatmap); **separate phase for the full-grid extension** |
| 5 | **Stream Planner** (`bestWindows()`/`platformEfficiency()`, `StreamPlanner.js`) | UTC-based day×hour grid, session-based (already migrated to `detectMeaningfulSessions()` in Phase 1), own `avgUsdPerHr` (mean, not median), own 5-tier confidence (`ConfBadge`: untested/needs-testing/low/medium/high), cross-referenced against `detectWhales()`'s UTC-based `bestUtcDay/bestUtcHour` | UTC bucketing (not local-native); mean not median; whale-window cross-reference has no canonical equivalent at all | **Mixed** — the UTC-vs-local difference and mean-vs-median difference are accidental duplication (no feature reason Stream Planner needs a different statistic or a different timezone convention than everywhere else); the **whale cross-reference** is a legitimate feature this specific view needs that canonical doesn't compute | **Yes, for the grid/statistic; the whale cross-reference needs its own canonical extension first** | **High** — explicitly the reason Phase 1 deferred this: migrating requires also migrating `detectWhales()`'s UTC encoding, which is real additional scope, and Stream Planner is a primary planning tool creators act on directly | Full day×hour grid comparison (median vs. mean will produce different values on skewed data — must document, not silently accept); whale-window correlation must be re-verified after any whale-encoding change; `ConfBadge` label mapping onto the resolved 4-tier system above | **Separate, explicitly high-risk phase** — matches your original Phase 1 scope boundary; do not fold into Phase 1B |
| 6 | **Onboarding preview** (`app/onboarding/page.js`, CSV-upload teaser) | Inline `hourCounts` — **token-weighted** (not USD), **browser-local hours** (`Date.getHours()`, the *browser's* device timezone, not the creator's saved/resolved timezone), no minimum-sample floor at all | Token-weighted instead of dollar-weighted; raw browser-local time instead of the resolved-timezone contract; unfloored (will confidently show a "best hour" off a single tip) | **Accidental duplication in spirit, but low-stakes** — this is a one-time upload teaser, not a persisted analytics surface, and its inaccuracy (no floor) is arguably fine for a "sneak peek before you sign up" UX, though the browser-vs-resolved-timezone gap is a real correctness issue if the browser's device timezone differs from the creator's eventual saved preference | **Optional** — low value relative to migration effort, given it's shown once, pre-account, before `profiles.timezone` even exists yet for that user | **Low** — isolated component, no persisted state, easy to test in isolation | Before/after screenshot comparison on the same sample CSV; confirm the "no floor" behavior is either preserved intentionally (documented) or explicitly gated to match canonical's `insufficient` tier | **Low priority — defer indefinitely unless product wants onboarding-preview accuracy specifically revisited** |
| 7 | **`get_user_insights` (SQL RPC)** | PL/pgSQL, tip-level, **mean** (`AVG(usd)`) grouped by `EXTRACT(HOUR FROM date_time AT TIME ZONE p_timezone)`, `HAVING COUNT(*) >= 3`, local-tz correct via `AT TIME ZONE` | Mean instead of median (can diverge meaningfully on outlier-heavy/whale-heavy accounts — the exact scenario Phase 1's canonical grid was built to handle correctly via median); otherwise structurally similar to #1 (`>=3` floor, local-tz) | **Accidental duplication** — no feature reason the Daily Brief needs a different statistic than everywhere else; this is the same "median vs mean on whale accounts" problem the whole canonical effort exists to fix, just re-appearing in SQL | **Yes, in spirit — but cannot literally call the same JS function** (SQL can't import Node modules); requires either (a) a Postgres-side median reimplementation kept in lockstep with `bestTimes.js`, or (b) retiring the SQL computation and having `get_user_insights` call the new `/api/insights` route / have Next.js own this response entirely | **High** — `get_user_insights` is `SECURITY DEFINER`, already carries the IDOR-fix and plan-aware redaction history from this engagement; touching it again is inherently higher-stakes than a client-side file, and a SQL median reimplementation is a second place the confidence-tier/threshold contract must be kept in sync by hand | Full parity test suite between the SQL output and `computeCanonicalBestTimes()` on the same fixture accounts (whale-heavy, sparse, exact-threshold, DST-crossing); confirm plan-aware redaction still holds if the underlying calculation source changes; re-run the existing `get_user_insights` IDOR/ownership tests to confirm no regression | **Separate, high-risk phase** — architecturally the most involved item on this list (SQL/Node boundary), recommend last, not bundled into Phase 1B |
| 8 | **`missedRevenueByPlatform`** (`lib/analytics.js`, feeds Platform tab "Missed Revenue" cards) | Tip-level, per-platform, `bestHourAvg > overallAvg * 1.2` threshold, **`sessionsNotAtBestHour` computed by comparing `bestHourData.hour` (a local-tz hour, from `platformBestTimes`) against `new Date(s.startTime).getUTCHours()` (raw UTC hour)** | Same mean/median and local-tz issues as row 4, **plus a confirmed internal timezone-comparison bug**: it compares a local-tz hour to a UTC hour directly, which will silently miscount "sessions not at best hour" whenever the creator's tz offset isn't a whole multiple that happens to cancel out | **Accidental duplication AND a real, currently-shipping bug** — this is the clearest case on this matrix of "not legitimate feature-specific logic," found during this verification pass, not previously flagged | **Yes** | **Medium** — fixing the tz-comparison bug in place (without full canonical migration) would change `missedRevenue` numbers for any creator not in UTC, which needs its own before/after documentation regardless of whether the fix comes via a patch or via full canonical migration | Before/after `missedRevenue` figures per platform across a timezone-diverse account sample (UTC, UTC+, UTC-); confirm the fix (or migration) doesn't change figures for UTC-based accounts, since those were accidentally correct before | **Phase 1B candidate** — either patch the tz-comparison bug immediately (smallest possible fix, arguably worth doing sooner given it's a confirmed bug, not just a duplication) or fold directly into the canonical `computeMissedRevenue()` migration; recommend flagging to you as a decision point rather than picking unilaterally |
| 9 | **`computeCanonicalBestTimes()`** (`lib/analytics/bestTimes.js`) | Session-based, median $/hour per local-tz day×hour bucket, 4-tier confidence (this matrix's resolved standard) | — (this is the canonical target) | — | — (is the canonical source) | — | Already covered — 49 passing checks in `scripts/verify-canonical-analytics.mjs` | Already shipped in Phase 1; consumers listed above migrate *to* this |

---

## Missed-revenue implementations (included per your original verification-report finding)

| # | Consumer | Current implementation | Legitimate or accidental? | Migration risk | Recommended phase |
|---|---|---|---|---|---|
| A | Platform tab "Missed Revenue" cards | `missedRevenueByPlatform` (see row 8 above — includes the confirmed tz-comparison bug) | Accidental + bug | Medium | Phase 1B (bug fix decision needed from you — see row 8) |
| B | Daily Brief | `get_user_insights`'s `missed_opportunity` (SQL) | Accidental (mean vs. median, same root cause as row 7) | High (same SQL/Node boundary issue as row 7) | Bundle with row 7's SQL migration — do not migrate independently, since they'd otherwise need the SQL median fix twice |
| C | *(no live consumer)* | `computeMissedRevenue()` (`lib/analytics/missedRevenue.js`) | — (canonical target) | — | Already shipped; A and B migrate *to* this |

---

## Summary — what's accidental duplication vs. legitimate feature logic

**Accidental duplication (same concept, should converge on canonical):**
Dashboard header (#1), Creator Report (#2, same field as #1), the *formula* portion of Live Mode (#3), the single-best-window portion of Platforms (#4), the grid/statistic portion of Stream Planner (#5), `get_user_insights` (#7), `missedRevenueByPlatform` (#8, plus a confirmed bug).

**Legitimate feature-specific logic (should NOT simply be pointed at canonical as-is):**
Live Mode's *live-vs-historical data scope* (#3 — the countdown must stay real-time), Stream Planner's *whale-window cross-reference* (#5 — no canonical equivalent exists yet, needs its own extension), Platforms' *full day×hour grid* (#4 — canonical only exposes a single best window per platform today, not the whole grid the heatmap needs).

**Lowest priority / optional:**
Onboarding preview (#6) — isolated, pre-account, low-stakes teaser.

---

## What I'm asking you to decide before any Phase 1B work starts

1. **Row 8's bug** (`missedRevenueByPlatform`'s UTC/local-tz comparison mismatch) — patch in place now as a standalone bugfix, or fold into a full canonical migration later? It's a confirmed correctness bug independent of the broader duplication question.
2. **Phase 1B scope** — my read of this matrix is that rows 1, 2, and the already-exposed part of row 4 are the lowest-risk, highest-value candidates for a Phase 1B (same formula family, already-computed canonical fields, no new surface area required). Rows 3, 5, and 7 are each independently high-risk and, per this matrix, should not be bundled together or rushed.

No code changed in this pass. Waiting on your approval of this matrix before any migration begins.
