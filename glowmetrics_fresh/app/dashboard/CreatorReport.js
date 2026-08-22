"use client"
// Creator Report — a single-screen summary of the most important insights in
// a user's imported data. All numbers here are read directly off the shared
// `analytics` object (lib/analytics.js: aggregateRows/generateInsights/
// generateNextMoves) — nothing here recomputes a formula that already has a
// single source of truth elsewhere (see the formula-requirements rules).
import { useEffect } from 'react'
import { track as gtmTrack } from '../../lib/track'
import { PLATFORM_TOKEN_RATES } from '../../lib/constants'

// Imported tip data can carry any casing ('chaturbate', 'ChatUrBate', etc.)
// — display the canonical spelling from the one source of truth instead of
// showing whatever casing happened to be in this user's file.
const PLATFORM_DISPLAY_NAMES = Object.fromEntries(
  Object.keys(PLATFORM_TOKEN_RATES).map(name => [name.toLowerCase(), name])
)
const displayPlatform = (p) => (p && PLATFORM_DISPLAY_NAMES[p.toLowerCase()]) || p

import { assessReadiness, nextUnlock, unlockCopy, isBaseline } from '../../lib/readiness'

const C = {
  cyan: '#22D3EE', pink: '#EC4899', gold: '#F59E0B', green: '#10B981',
  white: '#F1F5F9', muted: '#94A3B8', dim: '#5A6270', purple: '#a855f7', red: '#f87171',
}

const fmtHour = h => {
  const n = parseInt(h)
  if (h == null || isNaN(n)) return null
  return n === 0 ? '12 AM' : n < 12 ? `${n} AM` : n === 12 ? '12 PM' : `${n - 12} PM`
}

const fmtUsd = v => `$${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

// Same accent/glow language as the overview tab's stat-grid-4 cards
// (.stat-card / .card-glow-* / fadeUp are declared globally in
// app/dashboard/page.js and apply here too since this always renders
// inside that page) — kept in sync intentionally, not redefined.
const STAT_ACCENTS = [
  { accent: '#f472b6', glowClass: 'card-glow-pink' },
  { accent: '#22d3ee', glowClass: 'card-glow-cyan' },
  { accent: '#a78bfa', glowClass: 'card-glow-violet' },
  { accent: '#fbbf24', glowClass: 'card-glow-gold' },
]

function StatCard({ icon, label, value, sub, index = 0 }) {
  const { accent, glowClass } = STAT_ACCENTS[index % STAT_ACCENTS.length]
  return (
    <div className={`stat-card ${glowClass}`} style={{ borderRadius: 16, padding: '13px 16px', background: 'rgba(15,20,32,0.75)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', minWidth: 0, position: 'relative', overflow: 'hidden', animation: `fadeUp 0.3s ease ${index * 0.06}s both` }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${accent}80,${accent}20)`, borderRadius: '16px 16px 0 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 16, opacity: 0.75 }}>{icon}</span>
      </div>
      <div title={typeof value === 'string' ? value : undefined} style={{ fontSize: 'clamp(18px, 2vw, 22px)', fontWeight: 900, color: accent, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  )
}

// What a locked recommendation is about, without giving away the advice.
// Keyed off the icon generateInsights()/nextMoves already assigns, so this
// stays in step with the engine without needing a new field on each move.
const LOCKED_MOVE_LABELS = {
  '⏰': 'A timing change for your next stream',
  '📅': 'A scheduling change for the week ahead',
  '🐳': 'An action on one of your highest-value fans',
  '👑': 'An action on one of your highest-value fans',
  '📉': 'A drop in your recent numbers worth addressing',
  '📈': 'A trend in your recent numbers worth acting on',
  '🎯': 'A platform-level change to where you stream',
  '💰': 'A change to how you earn per hour streamed',
}
function lockedMoveLabel(move) {
  return LOCKED_MOVE_LABELS[move?.icon] || 'Another recommendation from your history'
}

export default function CreatorReport({ analytics, tips = [], isPro = false, onUpgrade, engineInsights = null }) {
  // "What changed" — the one dimension Creator Report lacked entirely
  // before (a static all-time snapshot, same headline totals Overview
  // already shows). Reads the canonical month-over-month growthPct already
  // computed once in analytics.monthlyData (lib/analytics.js) — no new
  // calculation, same source Overview's own momentum indicator uses, so
  // this can't disagree with it. A full "periodic performance review"
  // restructuring (what worked/didn't, narrative framing per period) is
  // real, larger follow-up work — this is the bounded, safe piece of it
  // available without that redesign.
  const _monthly = analytics?.monthlyData || []
  const _latestMonth = _monthly.length ? _monthly[_monthly.length - 1] : null
  const monthGrowthPct = _latestMonth?.growthPct ?? null

  const totalUSD    = analytics?.totalUSD || 0
  const hourlyRate   = analytics?.estimatedHourlyRate || 0
  // Phase 1B: reads the canonical best-time result (lib/analytics/bestTimes.js
  // — session-based, median $/hour, confidence-tiered) instead of the legacy
  // tip-level computeBestTimes() output, per the approved Best-Time Migration
  // Matrix (same underlying field the dashboard header now reads too, so
  // this page and Overview can no longer disagree on "Best Streaming Time").
  // bestDay is derived from the SAME bestWindow as bestHour below — previously
  // bestDay alone still read the legacy analytics.bestDay (tip-level, mean-
  // based), which can name a different day than the canonical bestWindow
  // (confirmed on a real account: legacy bestDay = Friday, canonical
  // bestWindow = Wednesday) — the exact single-component, two-source
  // contradiction this migration exists to eliminate.
  const _canonicalBestWindow = analytics?.canonicalBestTimes?.bestWindow
  const bestHour     = _canonicalBestWindow
    ? { hour: _canonicalBestWindow.localHour, avg: _canonicalBestWindow.medianUsdPerHour }
    : null
  const bestDay      = _canonicalBestWindow
    ? { day: _canonicalBestWindow.localDay, avg: _canonicalBestWindow.medianUsdPerHour }
    : null
  const topSupporter = analytics?.topTippers?.[0] || null
  const platforms    = analytics?.platforms || []
  // Reads the ONE canonical answer (analytics.bestPlatformByRate), which
  // ranks by usdPerHour — the same statistic this card displays underneath
  // the name — and excludes the parser's "Unknown" bucket plus any platform
  // with no measurable streamed hours.
  //
  // This previously deferred to engineInsights.summary.best_platform, which
  // ranks by AVERAGE USD PER TIP (get_user_insights: AVG(usd) ... HAVING
  // COUNT(*) >= 5). On the owner's real account that crowned "Unknown" — 13
  // undetected-platform tips averaging $13.51 each, against Chaturbate's
  // $0.36 across 4,835 tips — and then rendered "$0.00/hr" beneath it,
  // because Unknown has no qualifying session hours. Two different
  // statistics under one claim, headlined by a bucket that is not a
  // platform at all.
  const topPlatform = analytics?.bestPlatformByRate || null
  const rankableCount = analytics?.rankablePlatformCount ?? 0
  const insights     = analytics?.insights || []
  const nextMoves    = analytics?.nextMoves || []

  // "Opportunity" = the highest-priority insight that isn't a downward-momentum
  // callout. "Warning" = a downward-momentum insight if one exists — the only
  // insight type in generateInsights() that's inherently a caution, not a win.
  const warningInsight     = insights.find(i => i.icon === '📉') || null
  const opportunityInsight = insights.find(i => i !== warningInsight) || null

  const hasEnoughData = tips.length >= 10 && (analytics?.meaningfulSessionCount || 0) >= 2

  const track = (name, props) => { try { gtmTrack(name, props) } catch (_) {} }

  useEffect(() => {
    track('creator_report_viewed', { hasEnoughData, isPro })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── SNAPSHOT + READINESS ──────────────────────────────────────────────
  // This block replaces a hard `if (!hasEnoughData) return <warming up/>`
  // wall that fired below 10 tips OR 2 sessions. A creator who had just
  // finished their first import — the moment they are deciding whether this
  // product is worth anything — was told to come back later.
  //
  // Every number here is a real count off the canonical analytics object.
  // Nothing is inferred, and no pattern is claimed at baseline.
  const sessionCount = analytics?.meaningfulSessionCount || 0
  const fanCount = analytics?.uniqueFanCount ?? 0
  const tipCount = tips.length
  const whaleCount = (analytics?.whales || []).length
  const platformCount = platforms.length
  const readiness = assessReadiness({ tips: tipCount, sessions: sessionCount })
  const readyItems = readiness.filter(r => r.ready)
  const pendingItems = readiness.filter(r => !r.ready)
  const next = nextUnlock(readiness)
  const baseline = isBaseline({ tips: tipCount, sessions: sessionCount })

  const snapshot = [
    { label: fanCount === 1 ? 'fan' : 'fans', value: fanCount },
    { label: sessionCount === 1 ? 'session' : 'sessions', value: sessionCount },
    { label: tipCount === 1 ? 'tip' : 'tips', value: tipCount },
    { label: platformCount === 1 ? 'platform' : 'platforms', value: platformCount },
  ]

  const Readiness = () => (
    <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)', padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 10 }}>What CamCash is learning</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {readiness.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
            <span aria-hidden="true" style={{ color: r.ready ? C.green : C.muted, fontWeight: 900, flexShrink: 0 }}>{r.ready ? '✓' : '○'}</span>
            <span style={{ color: r.ready ? C.white : C.text, minWidth: 0, flex: 1 }}>{r.label}</span>
            {/* Progress is stated as the creator's REAL counts, never as an
                invented percentage or confidence score. */}
            <span style={{ color: C.muted, fontSize: 11.5, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {r.ready ? 'Ready' : `${r.have} / ${r.need} ${r.metric}`}
            </span>
          </div>
        ))}
      </div>
      {next && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.text, lineHeight: 1.55 }}>
          {unlockCopy(next)} More data makes this smarter.
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 4 }}>🧾 Your Creator Report</div>
        {/* The snapshot, in the creator's own numbers. Personalised sentence
            rather than another KPI grid — the dashboard already owns those. */}
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65, marginTop: 6, marginBottom: 4 }}>
          CamCash is tracking{' '}
          {snapshot.map((s2, i) => (
            <span key={s2.label}>
              <strong style={{ color: C.white }}>{s2.value}</strong> {s2.label}
              {i < snapshot.length - 2 ? ', ' : i === snapshot.length - 2 ? ' and ' : ''}
            </span>
          ))}
          {whaleCount > 0 && <>, including <strong style={{ color: C.white }}>{whaleCount}</strong> {whaleCount === 1 ? 'whale' : 'whales'}</>}.
        </div>
        {/* One session is not a pattern, and the report says so rather than
            dressing a single stream up as a trend. */}
        {baseline && (
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 4 }}>
            This is your baseline. As you add sessions, CamCash can tell one-off
            results apart from patterns — we&apos;re still learning your best
            streaming window.
          </div>
        )}
        <div style={{ fontSize: 13, color: C.muted }}>Built from your imported tip history — here's what your numbers actually say.</div>
      </div>

      {/* ── STAT GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard index={0} icon="💰" label="Total Earnings" value={fmtUsd(totalUSD)} sub={monthGrowthPct !== null ? `${monthGrowthPct >= 0 ? '↑' : '↓'} ${Math.abs(monthGrowthPct)}% vs last month` : `${tips.length} tips tracked`} />
        <StatCard index={1} icon="⏱️" label="Avg $/Hour" value={hourlyRate > 0 ? fmtUsd(hourlyRate) : 'Not enough data yet'} />
        <StatCard index={2} icon="📅" label="Best Streaming Day" value={bestDay?.day || 'Not enough data yet'} sub={_canonicalBestWindow ? `${_canonicalBestWindow.sessionCount} qualifying session${_canonicalBestWindow.sessionCount === 1 ? '' : 's'}` : null} />
        <StatCard index={3} icon="⏰" label="Best Streaming Time" value={fmtHour(bestHour?.hour) || 'Not enough data yet'} sub={bestHour ? `${fmtUsd(bestHour.avg)}/hr median` : null} />
        <StatCard index={0} icon="👑" label="Top Supporter" value={topSupporter?.username || 'Not enough data yet'} sub={topSupporter ? `${fmtUsd(topSupporter.usd)} lifetime` : null} />
        <StatCard
          index={1}
          icon="🎯"
          label="Most Profitable Platform"
          value={topPlatform ? displayPlatform(topPlatform.platform) : 'Not enough data yet'}
          sub={topPlatform
            ? `${fmtUsd(topPlatform.usdPerHour)}/hr${rankableCount > 1 ? ` · best of ${rankableCount}` : ''}`
            : 'Needs a platform with measurable streamed hours'}
        />
      </div>

      {/* ── OPPORTUNITY + WARNING ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        {opportunityInsight && (
          <div style={{ borderRadius: 16, padding: '16px 18px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>💡 Biggest Opportunity</div>
            <div style={{ fontSize: 13, color: C.white, lineHeight: 1.6 }}>{opportunityInsight.text}</div>
          </div>
        )}
        <div style={{ borderRadius: 16, padding: '16px 18px', background: warningInsight ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${warningInsight ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: warningInsight ? C.red : C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>⚠️ Worth Watching</div>
          <div style={{ fontSize: 13, color: warningInsight ? C.white : C.muted, lineHeight: 1.6 }}>
            {warningInsight ? warningInsight.text : "No red flags in your recent data — nothing here needs attention right now."}
          </div>
        </div>
      </div>

      {/* ── RECOMMENDED ACTIONS ── */}
      {/* Locked moves used to render their real text under filter: blur(3px).
          A blur communicates "there is something here" and nothing else — the
          creator cannot tell whether the thing behind it is worth $19.99, and
          squinting at obscured text they generated reads as a taunt. Each
          locked row now states what the recommendation is ABOUT, derived from
          the move's own icon, while the advice itself stays Pro. Same amount
          withheld, but the value is legible. */}
      <div style={{ borderRadius: 18, padding: '18px 20px', background: 'rgba(12,16,34,0.78)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <Readiness />
        <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 12 }}>🎯 Recommended For Your Next Stream</div>
        {nextMoves.length === 0 && (
          <div style={{ fontSize: 13, color: C.muted }}>Not enough data yet to build recommendations — import more history.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nextMoves.slice(0, 3).map((move, i) => {
            const locked = !isPro && i > 0
            return (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
                <span style={{ fontSize: 16 }}>{move.icon}</span>
                <div style={{ flex: 1 }}>
                  {locked ? (
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                      {lockedMoveLabel(move)} <span style={{ color: C.muted }}>— included with Pro</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: C.white, lineHeight: 1.6 }}>{move.text}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {!isPro && nextMoves.length > 1 && (
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <button
              onClick={() => { track('creator_report_upgrade_click', { source: 'recommended_actions' }); onUpgrade?.() }}
              style={{ padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#06101A', background: `linear-gradient(90deg, ${C.cyan}, ${C.purple}, ${C.pink})` }}>
              Unlock all {nextMoves.length} recommended actions
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
