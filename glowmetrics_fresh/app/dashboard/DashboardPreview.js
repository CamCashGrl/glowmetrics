'use client'
// ============================================================
// CAMCASH — LOW DATA DASHBOARD STATES
// DashboardPreview.js
//
// Exports:
//   getDashboardStage()     — decide which state to render
//   EmptyDashboard          — zero tips
//   DashboardPreview        — tips imported but not enough for full analytics
//   LockedInsightCard       — used inside full dashboard for cards needing more data
//
// Usage in page.js:
//   import { getDashboardStage, EmptyDashboard, DashboardPreview, LockedInsightCard } from './DashboardPreview'
//
//   const stage = getDashboardStage({ tipCount: tips.length, ... })
//   if (stage === 'empty')   return <EmptyDashboard onImport={...} />
//   if (stage === 'preview') return <DashboardPreview tips={tips} analytics={analytics} onAddHistory={...} onContinue={...} />
//   // else: render full dashboard normally
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── BRAND TOKENS ─────────────────────────────────────────────
const C = {
  bg:       '#05070f',
  card:     '#0d1117',
  card2:    '#111827',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(255,255,255,0.12)',
  cyan:     '#22D3EE',
  pink:     '#EC4899',
  indigo:   '#7C5CFF',
  gold:     '#F59E0B',
  green:    '#10B981',
  white:    '#F1F5F9',
  text:     '#94A3B8',
  muted:    '#475569',
  grad:     'linear-gradient(90deg,#22D3EE,#7C5CFF,#EC4899)',
}

const card = (extra = {}) => ({
  background:    'rgba(13,17,23,0.85)',
  border:        '1px solid rgba(255,255,255,0.07)',
  borderRadius:  16,
  backdropFilter:'blur(20px)',
  padding:       '20px 22px',
  position:      'relative',
  overflow:      'hidden',
  ...extra,
})

const safeNum = (v, fallback = 0) => {
  const n = parseFloat(v)
  return isNaN(n) || !isFinite(n) ? fallback : n
}

const fmt$ = (v) => `$${safeNum(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtN = (v) => safeNum(v).toLocaleString('en-US')

// ── LEVEL SYSTEM ──────────────────────────────────────────────
function getLevel(tipCount) {
  if (tipCount === 0)    return { label: 'Empty',          pct: 0,   color: C.muted,  next: 1   }
  if (tipCount < 25)     return { label: 'First Import',   pct: Math.round((tipCount/25)*20),   color: C.cyan,   next: 25  }
  if (tipCount < 50)     return { label: 'Getting Started',pct: Math.round(20+(tipCount-25)/25*20), color: C.indigo, next: 50  }
  if (tipCount < 200)    return { label: 'Insights Ready', pct: Math.round(40+(tipCount-50)/150*30), color: C.gold,   next: 200 }
  if (tipCount < 1000)   return { label: 'Strong Analytics',pct: Math.round(70+(tipCount-200)/800*25), color: C.pink,  next: 1000}
  return                        { label: 'Power User',     pct: 100, color: C.green,  next: null}
}

// ============================================================
// getDashboardStage — the single decision function
// ============================================================
export function getDashboardStage({ tipCount = 0, sessionCount = 0, totalEarnings = 0 }) {
  if (tipCount === 0) return 'empty'
  if (
    tipCount >= 50 ||
    sessionCount >= 3 ||
    totalEarnings >= 25
  ) return 'ready'
  return 'preview'
}

// ── Readiness checks — use these in the full dashboard too ───
export const canShowBestHours      = ({ tipCount, sessionCount }) => tipCount >= 25 && sessionCount >= 3
export const canShowWhales         = ({ uniqueFanCount, totalEarnings }) => uniqueFanCount >= 5 && totalEarnings >= 50
export const canShowPlatformComp   = ({ platformCount, sessionCount }) => platformCount >= 2 && sessionCount >= 4
export const canShowSessionPerf    = ({ sessionCount }) => sessionCount >= 3
export const canShowRetention      = ({ uniqueFanCount, dateRangeDays }) => uniqueFanCount >= 10 && dateRangeDays >= 7
export const canShowHourlyRate     = ({ sessionCount }) => sessionCount >= 3

// ============================================================
// LockedInsightCard — drop into full dashboard for unready cards
// ============================================================
export function LockedInsightCard({ title, description, requirements = [], onAddHistory }) {
  return (
    <div style={{ ...card(), border: '1px solid rgba(124,92,255,0.18)', background: 'rgba(124,92,255,0.04)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,rgba(124,92,255,0.5),transparent)' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,92,255,0.12)', border: '1px solid rgba(124,92,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🔒</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 11, color: C.text, lineHeight: 1.6, marginBottom: 10 }}>{description}</div>
          {requirements.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {requirements.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted, marginBottom: 4 }}>
                  <span style={{ color: C.indigo }}>◦</span>{r}
                </div>
              ))}
            </div>
          )}
          {onAddHistory && (
            <button onClick={onAddHistory} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(124,92,255,0.4)', background: 'rgba(124,92,255,0.1)', color: C.indigo, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Add More History
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// EmptyDashboard — tipCount === 0
// ============================================================
export function EmptyDashboard({ onImport, onDemo }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {/* Logo mark */}
        <div style={{ width: 72, height: 72, borderRadius: 22, background: C.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 24px', boxShadow: '0 0 40px rgba(34,211,238,0.2), 0 0 80px rgba(236,72,153,0.1)' }}>$</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.white, letterSpacing: '-0.025em', marginBottom: 10 }}>Your dashboard is ready</div>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7, marginBottom: 32, maxWidth: 360, margin: '0 auto 32px' }}>
          Import your first tip history to start seeing your CamCash insights.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
          <button onClick={onImport} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: C.grad, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 24px rgba(34,211,238,0.2)' }}>
            Import Tip History →
          </button>
          {onDemo && (
            <button onClick={onDemo} style={{ width: '100%', padding: '13px', borderRadius: 13, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              View Demo Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// DashboardPreview — main low-data state
// ============================================================
export function DashboardPreview({ tips = [], analytics, onAddHistory, onContinue }) {
  const router = useRouter()

  // ── Derive safe values from real data only ────────────────
  const tipCount      = tips.length
  const totalUSD      = safeNum(tips.reduce((s, t) => s + safeNum(t.usd), 0))
  const totalTokens   = tips.reduce((s, t) => s + (parseInt(t.tokens) || 0), 0)
  const hasUSD        = totalUSD > 0
  const earningsLabel = hasUSD ? fmt$(totalUSD) : totalTokens > 0 ? `${fmtN(totalTokens)} tokens` : '—'
  const isEstimated   = !hasUSD && totalTokens > 0

  const platforms     = [...new Set(tips.map(t => t.platform).filter(Boolean))]
  const platformCount = platforms.length

  const fans          = [...new Set(tips.map(t => (t.username || '').toLowerCase()).filter(Boolean))]
  const fanCount      = fans.length

  const dates         = tips.map(t => new Date(t.date_time || t.dateRaw)).filter(d => !isNaN(d)).sort((a, b) => a - b)
  const dateFrom      = dates[0] || null
  const dateTo        = dates[dates.length - 1] || null
  const dateRangeDays = dateFrom && dateTo ? Math.max(1, Math.round((dateTo - dateFrom) / 86400000)) : 0

  const avgTip        = tipCount > 0 ? totalUSD / tipCount : 0
  const maxTip        = safeNum(Math.max(...tips.map(t => safeNum(t.usd))))
  const recentTips    = [...tips].sort((a, b) => new Date(b.date_time || b.dateRaw) - new Date(a.date_time || a.dateRaw)).slice(0, 8)
  const mostRecentTip = recentTips[0] || null

  // Top supporters
  const fanTotals = {}
  const fanCounts = {}
  let biggestSingle = null, biggestSingleAmt = 0
  tips.forEach(t => {
    const u = (t.username || 'anonymous').toLowerCase()
    fanTotals[u] = safeNum(fanTotals[u]) + safeNum(t.usd)
    fanCounts[u] = (fanCounts[u] || 0) + 1
    if (safeNum(t.usd) > biggestSingleAmt) { biggestSingleAmt = safeNum(t.usd); biggestSingle = t.username }
  })
  const topByTotal    = Object.entries(fanTotals).sort((a, b) => b[1] - a[1])[0]
  const topByCount    = Object.entries(fanCounts).sort((a, b) => b[1] - a[1])[0]

  // Level
  const level = getLevel(tipCount)

  // Status line
  const statusParts = [
    `${fmtN(tipCount)} tips imported`,
    `${fmtN(fanCount)} fan${fanCount !== 1 ? 's' : ''} found`,
    isEstimated ? `${earningsLabel} estimated` : `${earningsLabel} detected`,
    `${platformCount} platform${platformCount !== 1 ? 's' : ''} connected`,
  ]

  const fmtDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const fmtDateTime = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(circle at 20% 30%, rgba(34,211,238,0.12), transparent 45%), radial-gradient(circle at 80% 70%, rgba(236,72,153,0.10), transparent 45%), ${C.bg}`, fontFamily: "'Inter',system-ui,sans-serif", color: C.white, padding: '32px 24px', boxSizing: 'border-box' }}>

      {/* ── HEADER ── */}
      <div style={{ maxWidth: 900, margin: '0 auto 28px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.cyan, marginBottom: 8 }}>Your First CamCash Preview</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: C.white, letterSpacing: '-0.025em', marginBottom: 8 }}>
          We found your first tips.
        </h1>
        <p style={{ fontSize: 14, color: C.text, marginBottom: 14, lineHeight: 1.6 }}>
          Your full dashboard gets smarter as you import more history.
        </p>
        {/* Status line */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {statusParts.map((s, i) => (
            <div key={i} style={{ padding: '4px 12px', borderRadius: 100, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', fontSize: 11, color: C.text, fontWeight: 600 }}>
              {s}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: 16 }}>

        {/* ── ROW 1: Import Complete + Dashboard Strength ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>

          {/* Import Complete */}
          <div style={card()}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,rgba(16,185,129,0.6),transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>First Import Complete</div>
            </div>
            {[
              ['Tips imported',   fmtN(tipCount)],
              ['Fans detected',   fmtN(fanCount)],
              ['Earnings',        isEstimated ? `~${earningsLabel}` : earningsLabel],
              ['Platform(s)',     platforms.length ? platforms.join(', ') : '—'],
              ['Date range',      dateFrom && dateTo ? `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}` : '—'],
              ['Most recent tip', mostRecentTip ? fmtDateTime(mostRecentTip.date_time || mostRecentTip.dateRaw) : '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', fontSize: 11, color: 'rgba(148,163,184,0.85)', lineHeight: 1.6 }}>
              Your first import is complete. Add more history to unlock stronger insights.
            </div>
          </div>

          {/* Dashboard Strength */}
          <div style={card()}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${level.color}88,transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: `${level.color}18`, border: `1px solid ${level.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📊</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Dashboard Strength</div>
                <div style={{ fontSize: 11, color: level.color, fontWeight: 700 }}>{level.label}</div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: C.muted }}>{level.pct}% strength</span>
                {level.next && <span style={{ fontSize: 10, color: C.muted }}>{level.next - tipCount} more tips to next level</span>}
              </div>
              <div style={{ height: 8, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${level.pct}%`, background: `linear-gradient(90deg,${level.color},${level.color}99)`, borderRadius: 100, boxShadow: `0 0 12px ${level.color}55`, transition: 'width 0.6s ease' }} />
              </div>
            </div>
            {/* Level milestones */}
            {[
              { label: 'First Import',    req: 1 },
              { label: 'Getting Started', req: 25 },
              { label: 'Insights Ready',  req: 50 },
              { label: 'Strong Analytics',req: 200 },
              { label: 'Power User',      req: 1000 },
            ].map(({ label, req }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 11 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: tipCount >= req ? C.green : 'rgba(255,255,255,0.06)', border: tipCount >= req ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#04101b' }}>
                  {tipCount >= req ? '✓' : ''}
                </div>
                <span style={{ color: tipCount >= req ? C.white : C.muted, fontWeight: tipCount >= req ? 600 : 400 }}>{label} — {req}+ tips</span>
              </div>
            ))}
            <div style={{ marginTop: 14, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
              Your trends are still forming. Import more tips to unlock best stream times, fan patterns, and session performance.
            </div>
          </div>
        </div>

        {/* ── ROW 2: Earnings Snapshot + Top Supporters ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>

          {/* Earnings Snapshot */}
          <div style={card()}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.6),transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💵</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Earnings Snapshot</div>
            </div>
            {hasUSD ? (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Total detected earnings</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.gold }}>{fmt$(totalUSD)}</div>
                  {isEstimated && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Estimated from token count</div>}
                </div>
                {[
                  ['Tips imported',  fmtN(tipCount)],
                  ['Average tip',    avgTip > 0 ? fmt$(avgTip) : '—'],
                  ['Largest tip',    maxTip > 0 ? fmt$(maxTip) : '—'],
                  ['Most recent',    mostRecentTip ? fmt$(safeNum(mostRecentTip.usd)) : '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                    <span style={{ color: C.muted, fontSize: 11 }}>{label}</span>
                    <span style={{ color: C.white, fontWeight: 700 }}>{val}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted, fontSize: 12 }}>
                {totalTokens > 0 ? `${fmtN(totalTokens)} tokens detected — USD values not found in import` : 'No earnings data found in import'}
              </div>
            )}
          </div>

          {/* Top Supporters */}
          <div style={card()}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,rgba(236,72,153,0.6),transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⭐</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Top Supporters So Far</div>
            </div>
            {topByTotal ? (
              <>
                {[
                  { label: 'Top supporter', icon: '👑', value: topByTotal[0], sub: fmt$(topByTotal[1]) + ' total' },
                  { label: 'Most frequent', icon: '🔄', value: topByCount?.[0] || '—', sub: `${topByCount?.[1] || 0} tips` },
                  { label: 'Biggest single', icon: '💎', value: biggestSingle || '—', sub: maxTip > 0 ? fmt$(maxTip) : '—' },
                  { label: 'Most recent',   icon: '⏱', value: mostRecentTip?.username || '—', sub: mostRecentTip ? fmtDateTime(mostRecentTip.date_time || mostRecentTip.dateRaw) : '—' },
                ].map(({ label, icon, value, sub }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 1 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{value}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.text }}>{sub}</div>
                  </div>
                ))}
                <div style={{ marginTop: 12, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                  Import more history to see who your real whales and repeat supporters are.
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted, fontSize: 12 }}>No supporter data yet</div>
            )}
          </div>
        </div>

        {/* ── ROW 3: Recent Activity + What CamCash Is Learning ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>

          {/* Recent Activity */}
          <div style={card()}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,rgba(34,211,238,0.5),transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Recent Tip Activity</div>
            </div>
            {recentTips.length > 0 ? (
              <div>
                {recentTips.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < recentTips.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyan, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{t.username || 'anonymous'}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{fmtDateTime(t.date_time || t.dateRaw)}{t.platform ? ` · ${t.platform}` : ''}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>
                      {safeNum(t.usd) > 0 ? fmt$(t.usd) : t.tokens ? `${t.tokens} tkn` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted, fontSize: 12 }}>No recent activity</div>
            )}
          </div>

          {/* What CamCash Is Learning */}
          <div style={card()}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,rgba(124,92,255,0.5),transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧠</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>What CamCash Is Learning</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              {[
                { label: 'Earnings detected',          done: hasUSD || totalTokens > 0 },
                { label: 'Fans detected',              done: fanCount > 0 },
                { label: 'Platform detected',          done: platformCount > 0 },
                { label: 'Recent tip activity',        done: recentTips.length > 0 },
              ].map(({ label, done }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)', border: done ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: done ? C.green : C.muted, flexShrink: 0 }}>
                    {done ? '✓' : ''}
                  </div>
                  <span style={{ color: done ? C.white : C.muted, fontWeight: done ? 600 : 400 }}>{label}</span>
                  {done && <span style={{ marginLeft: 'auto', fontSize: 10, color: C.green, fontWeight: 700 }}>Preview unlocked</span>}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Trends still forming</div>
            {[
              ['Best stream times',    'Needs 3+ sessions, 25+ tips'],
              ['Whale detection',      'Needs 5+ fans, $50+ history'],
              ['Session performance',  'Needs 3+ sessions'],
              ['Platform comparison',  'Needs 2+ platforms'],
              ['Fan return patterns',  'Needs 7+ days of activity'],
            ].map(([label, reason]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 11 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }} />
                <span style={{ color: C.muted }}>{label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(100,116,139,0.6)' }}>{reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── UNLOCK CTA ── */}
        <div style={{ ...card({ background: 'rgba(124,92,255,0.06)', border: '1px solid rgba(124,92,255,0.2)' }) }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,rgba(34,211,238,0.7),rgba(124,92,255,0.7),rgba(236,72,153,0.7))' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 6 }}>Unlock Your Full Dashboard</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginBottom: 12 }}>
                Add more history so CamCash can find your best hours, highest-value fans, session performance, and earning patterns.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Import 50+ tips', '3+ sessions', 'Multiple days of history'].map(r => (
                  <div key={r} style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10, color: C.text }}>
                    ◦ {r}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 180 }}>
              <button onClick={onAddHistory} style={{ padding: '12px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(90deg,#22D3EE,#7C5CFF,#EC4899)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 20px rgba(34,211,238,0.2)', whiteSpace: 'nowrap' }}>
                Add More History →
              </button>
              <button onClick={onContinue} style={{ padding: '11px 22px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Continue to Dashboard
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
