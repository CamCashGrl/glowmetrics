"use client"
// Creator Report — a single-screen summary of the most important insights in
// a user's imported data. All numbers here are read directly off the shared
// `analytics` object (lib/analytics.js: aggregateRows/generateInsights/
// generateNextMoves) — nothing here recomputes a formula that already has a
// single source of truth elsewhere (see the formula-requirements rules).
import { useEffect } from 'react'
import { track as gtmTrack } from '../../lib/track'

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

function StatCard({ icon, label, value, sub }) {
  return (
    <div style={{ borderRadius: 16, padding: '16px 18px', background: 'rgba(12,16,34,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{icon}</span>{label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.white }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function CreatorReport({ analytics, tips = [], isPro = false, onUpgrade }) {
  const totalUSD    = analytics?.totalUSD || 0
  const hourlyRate   = analytics?.estimatedHourlyRate || 0
  const bestDay      = analytics?.bestDay || null
  const bestHour     = analytics?.bestHour || null
  const topSupporter = analytics?.topTippers?.[0] || null
  const platforms    = analytics?.platforms || []
  const topPlatform  = platforms.length > 1 ? [...platforms].sort((a, b) => b.usdPerHour - a.usdPerHour)[0] : null
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

  if (!hasEnoughData) {
    return (
      <div style={{ borderRadius: 22, padding: '48px 32px', textAlign: 'center', background: 'rgba(12,16,34,0.78)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 8 }}>Your Creator Report is warming up</div>
        <div style={{ fontSize: 13, color: C.muted, maxWidth: 420, margin: '0 auto' }}>
          Import a bit more tip history — at least 10 tips across 2+ sessions — and CamCash will build a full report of your earnings, best times, and next moves.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 4 }}>🧾 Your Creator Report</div>
        <div style={{ fontSize: 13, color: C.muted }}>Built from your imported tip history — here's what your numbers actually say.</div>
      </div>

      {/* ── STAT GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon="💰" label="Total Earnings" value={fmtUsd(totalUSD)} sub={`${tips.length} tips tracked`} />
        <StatCard icon="⏱️" label="Avg $/Hour" value={hourlyRate > 0 ? fmtUsd(hourlyRate) : 'Not enough data yet'} />
        <StatCard icon="📅" label="Best Streaming Day" value={bestDay?.day || 'Not enough data yet'} sub={bestDay ? `~${fmtUsd(bestDay.avg)} avg` : null} />
        <StatCard icon="⏰" label="Best Streaming Time" value={fmtHour(bestHour?.hour) || 'Not enough data yet'} sub={bestHour ? `~${fmtUsd(bestHour.avg)} avg per session` : null} />
        <StatCard icon="👑" label="Top Supporter" value={topSupporter?.username || 'Not enough data yet'} sub={topSupporter ? `${fmtUsd(topSupporter.usd)} lifetime` : null} />
        <StatCard
          icon="🎯"
          label="Most Profitable Platform"
          value={topPlatform ? topPlatform.platform : (platforms.length === 1 ? platforms[0].platform : 'Add a 2nd platform to compare')}
          sub={topPlatform ? `${fmtUsd(topPlatform.usdPerHour)}/hr` : (platforms.length <= 1 && !isPro ? 'Creator Pro compares all your platforms' : null)}
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
      <div style={{ borderRadius: 18, padding: '18px 20px', background: 'rgba(12,16,34,0.78)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 12 }}>🎯 Recommended For Your Next Stream</div>
        {nextMoves.length === 0 && (
          <div style={{ fontSize: 13, color: C.muted }}>Not enough data yet to build recommendations — import more history.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nextMoves.slice(0, 3).map((move, i) => {
            const locked = !isPro && i > 0
            return (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
                <span style={{ fontSize: 16 }}>{locked ? '🔒' : move.icon}</span>
                <div style={{ flex: 1 }}>
                  {locked ? (
                    <div style={{ fontSize: 13, color: C.muted, filter: 'blur(3px)', userSelect: 'none' }}>{move.text}</div>
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
              Unlock all {nextMoves.length} recommended actions — Upgrade to Pro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
