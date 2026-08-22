'use client'
// ════════════════════════════════════════════════════════════════════
// SESSIONS — D8 / D10.
//
// This tab used to render every session as a full report: a stat grid, a
// 5-minute earnings chart, a pacing bar, top contributors, insights and
// recommendations, all expanded, all at once. One session was roughly a
// screen; a creator with a real history scrolled past dozens of them to
// reach the one they wanted.
//
// The hierarchy is now: whole-history stats once at the top → compact
// scannable rows → detail on demand. NOTHING was deleted — every field the
// old card rendered still exists, either in the row or behind "View
// details" (see the inventory in scripts/verify-sessions-tab.mjs).
//
// This component computes nothing. getSessionBreakdown() is the same
// function that used to run inline in page.js, moved verbatim to
// lib/sessions/breakdown.js.
// ════════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react'
import { getSessionBreakdown, PERFORMANCE_BADGE } from '../../lib/sessions/breakdown'
import Button from '../../components/ui/Button'

const C = {
  white: '#f1f5f9', text: '#cbd5e1', muted: '#94a3b8', dim: '#64748b',
  cyan: '#22d3ee', green: '#10b981', gold: '#f59e0b', pink: '#ec4899',
  red: '#f87171', indigo: '#7c5cff', border: 'rgba(255,255,255,0.08)',
}

export const SESSIONS_PER_PAGE = 10

const card = (extra = {}) => ({
  background: 'rgba(15,20,32,0.75)',
  border: `1px solid ${C.border}`,
  backdropFilter: 'blur(20px)',
  borderRadius: 14,
  ...extra,
})

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`
const fmtInt = (n) => Number(n || 0).toLocaleString('en-US')

export function fmtDuration(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0))
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

const clock = (dt) => new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// ── WHOLE-HISTORY STATS ─────────────────────────────────────────────
// Reads `allSessions`, never the current page — a creator's totals must not
// change when they turn a page. Each tile answers something the compact
// rows below cannot: the rows show one session, these show the shape of the
// whole history.
function OverallStats({ allSessions }) {
  const stats = useMemo(() => {
    if (!allSessions.length) return null
    const totalUSD = allSessions.reduce((s, x) => s + (x.totalUSD || 0), 0)
    const totalMins = allSessions.reduce((s, x) => s + (x.durationMinutes || 0), 0)
    const timed = allSessions.filter(x => !x.durationUnknown && x.durationMinutes > 0)
    const timedMins = timed.reduce((s, x) => s + x.durationMinutes, 0)
    return {
      count: allSessions.length,
      totalUSD,
      totalHours: totalMins / 60,
      // Weighted across sessions with a known duration only — averaging
      // per-session rates would let a 3-minute session count as much as a
      // 3-hour one, and sessions with an unknown duration have no rate.
      avgPerHour: timedMins > 0 ? (timed.reduce((s, x) => s + x.totalUSD, 0) / (timedMins / 60)) : null,
      avgDuration: timed.length ? timedMins / timed.length : null,
      best: Math.max(...allSessions.map(x => x.totalUSD || 0)),
    }
  }, [allSessions])

  if (!stats) return null
  const tiles = [
    { label: 'Sessions', value: fmtInt(stats.count), color: C.cyan },
    { label: 'Streaming time', value: `${Math.round(stats.totalHours)}h`, color: C.indigo },
    { label: 'Total earned', value: fmtUsd0(stats.totalUSD), color: C.green },
    { label: 'Avg $/hour', value: stats.avgPerHour !== null ? fmtUsd(stats.avgPerHour) : 'Not enough data yet', color: C.gold },
    { label: 'Avg session', value: stats.avgDuration !== null ? fmtDuration(stats.avgDuration) : 'Not enough data yet', color: C.text },
    { label: 'Best session', value: fmtUsd0(stats.best), color: C.pink },
  ]
  return (
    <div className="cc-session-stats" style={card({ padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 22 })}>
      {tiles.map(t => (
        <div key={t.label} style={{ padding: '14px 16px', minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>{t.label}</div>
          <div style={{ fontSize: t.value.length > 12 ? 12 : 'clamp(15px, 1.2vw, 20px)', fontWeight: 800, color: t.value.length > 12 ? C.muted : t.color, whiteSpace: t.value.length > 12 ? 'normal' : 'nowrap' }}>{t.value}</div>
        </div>
      ))}
    </div>
  )
}

function DetailBlock({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

// ── COMPACT ROW + DETAIL ────────────────────────────────────────────
// Exported so the expanded state can be rendered directly in verification:
// static SSR has no hydration, so a harness cannot click "View details".
export function SessionRow({ s, allSessions, isOpen, onToggle, liveSession, onOpenReport }) {
  // Only computed when the row is actually open — the whole point of the
  // redesign is that a closed row costs nothing.
  const bd = useMemo(
    () => (isOpen ? getSessionBreakdown(s, allSessions) : null),
    [isOpen, s, allSessions]
  )
  const perf = bd ? PERFORMANCE_BADGE[bd.performance] : null
  const dateLabel = new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div style={card({ marginBottom: 10, overflow: 'hidden' })}>
      <div className="cc-session-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 3 }}>
            {dateLabel} <span style={{ color: C.muted, fontWeight: 600 }}>· {s.platform}</span>
          </div>
          {/* The three facts that decide whether this session is worth
              opening. Duration/earnings/rate on one line, audience on the
              next — no metric repeated between them. */}
          <div style={{ fontSize: 13, color: C.text }}>
            {s.durationUnknown ? 'Duration unknown' : fmtDuration(s.durationMinutes)} · <strong style={{ color: C.green }}>{fmtUsd(s.totalUSD)}</strong>
            {s.usdPerHour !== null && s.usdPerHour !== undefined && <> · <strong style={{ color: C.cyan }}>{fmtUsd(s.usdPerHour)}/hr</strong></>}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {fmtInt(s.tipCount)} tip{s.tipCount === 1 ? '' : 's'} · {fmtInt(s.uniqueFans)} fan{s.uniqueFans === 1 ? '' : 's'}
            {liveSession ? <span style={{ color: C.cyan }}> · Live Mode</span> : null}
          </div>
        </div>
        <button
          onClick={onToggle}
          aria-expanded={isOpen}
          className="cc-session-toggle"
          style={{ minHeight: 44, padding: '12px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {isOpen ? 'Hide details' : 'View details'}
        </button>
      </div>

      {isOpen && bd && (
        <div style={{ padding: '4px 18px 18px', borderTop: `1px solid ${C.border}` }}>
          {perf && (
            <div style={{ margin: '14px 0 16px' }}>
              <span style={{ padding: '3px 10px', borderRadius: 20, background: perf.bg, border: `1px solid ${perf.border}`, fontSize: 11, fontWeight: 700, color: perf.color }}>{perf.label}</span>
              <span style={{ fontSize: 12, color: C.muted, marginLeft: 10 }}>{clock(s.startTime)} → {clock(s.endTime)}</span>
            </div>
          )}

          {/* Restored in D8 — this comparison was dropped when the tab was
              rebuilt, and is the one field the field inventory missed. It
              sits above Earnings because it is the only line here that says
              whether this session was good, rather than what it contained. */}
          {bd.revenueGap && (
            <div style={{ padding: '11px 14px', borderRadius: 10, marginBottom: 16,
              background: bd.revenueGap.isUnder ? 'rgba(248,113,113,0.06)' : 'rgba(16,185,129,0.06)',
              border: `1px solid ${bd.revenueGap.isUnder ? 'rgba(248,113,113,0.25)' : 'rgba(16,185,129,0.25)'}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: bd.revenueGap.isUnder ? C.red : C.green }}>
                {bd.revenueGap.isUnder
                  ? `${fmtUsd0(bd.revenueGap.gap)} below your ${bd.revenueGap.samePlatform ? s.platform : 'recent'} average of ${fmtUsd0(bd.revenueGap.expected)} — a ${bd.revenueGap.gapPct}% shortfall`
                  : `${fmtUsd0(bd.revenueGap.gap)} above your ${bd.revenueGap.samePlatform ? s.platform : 'recent'} average of ${fmtUsd0(bd.revenueGap.expected)}`}
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>
                Compared against your last {bd.revenueGap.basedOn} comparable session{bd.revenueGap.basedOn === 1 ? '' : 's'}.
              </div>
            </div>
          )}

          <DetailBlock title="Earnings">
            <div className="cc-session-detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
              {[
                { label: 'Tokens', value: fmtInt(s.totalTokens), color: C.indigo },
                { label: 'Avg tip', value: fmtUsd(s.avgTipSize), color: C.gold },
                { label: '$/min', value: s.usdPerMinute !== null && s.usdPerMinute !== undefined ? fmtUsd(s.usdPerMinute) : '—', color: C.cyan },
                { label: 'Largest tip', value: fmtUsd(Math.max(0, ...(s.tips || []).map(t => Number(t.usd) || 0))), color: C.green },
              ].map(m => (
                <div key={m.label} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: m.color, whiteSpace: 'nowrap' }}>{m.value}</div>
                </div>
              ))}
            </div>
          </DetailBlock>

          {bd.buckets.length > 1 && (
            <DetailBlock title="⏱ Earnings timeline (5-min buckets)">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
                {bd.buckets.map((b, i) => {
                  const max = Math.max(...bd.buckets.map(x => x.usd), 0.01)
                  return <div key={i} title={`${b.label}: ${fmtUsd(b.usd)}`} style={{ flex: 1, minWidth: 2, height: `${Math.max(2, (b.usd / max) * 100)}%`, borderRadius: 2, background: b.usd > 0 ? `linear-gradient(180deg, ${C.cyan}, ${C.indigo})` : 'rgba(255,255,255,0.06)' }} />
                })}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                First half {bd.firstHalfPct}% · second half {100 - bd.firstHalfPct}%
              </div>
            </DetailBlock>
          )}

          {bd.topTippers.length > 0 && (
            <DetailBlock title="🏆 Top contributors">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bd.topTippers.map((t, i) => (
                  <div key={t.username} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ flexShrink: 0 }}>{['🥇', '🥈', '🥉'][i]}</span>
                    <span style={{ color: C.white, fontWeight: 600, minWidth: 0, wordBreak: 'break-word', flex: 1 }}>{t.username}</span>
                    <span style={{ color: C.green, fontWeight: 700, flexShrink: 0 }}>{fmtUsd(t.usd)}</span>
                    <span style={{ color: C.muted, fontSize: 11, flexShrink: 0 }}>{t.pct}%</span>
                  </div>
                ))}
              </div>
            </DetailBlock>
          )}

          {/* ── LIVE MODE ──────────────────────────────────────────
              Three genuinely different states, never conflated: this
              session had a Live Mode record and coaching fired; it had a
              record but no prompts; or it was never streamed through Live
              Mode at all. The last is not an empty state — it is a fact
              about the session. */}
          <DetailBlock title="Live Mode">
            {!liveSession ? (
              <div style={{ fontSize: 12.5, color: C.dim }}>This session did not use Live Mode.</div>
            ) : liveSession.coaching.delivered === 0 ? (
              <div style={{ fontSize: 12.5, color: C.dim }}>Live Mode ran, but no coaching prompts fired during this session.</div>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>
                  <strong style={{ color: C.white }}>{liveSession.coaching.delivered}</strong> prompt{liveSession.coaching.delivered === 1 ? '' : 's'} ·{' '}
                  <strong style={{ color: C.green }}>{liveSession.coaching.performed}</strong> performed ·{' '}
                  <strong style={{ color: C.muted }}>{liveSession.coaching.skipped}</strong> skipped
                </div>
                {liveSession.coaching.performedRate !== null && (
                  <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 10 }}>
                    {liveSession.coaching.performedRate}% followed, of {liveSession.coaching.resolved} resolved
                    {liveSession.coaching.byType.length > 0 && ` · most prompted: ${liveSession.coaching.byType[0].type}`}
                  </div>
                )}
                {liveSession.coaching.moments.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '7px 0', borderTop: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, color: m.status === 'performed' ? C.green : C.dim, flexShrink: 0, marginTop: 2 }}>
                      {m.status === 'performed' ? '✓' : m.status === 'skipped' ? '—' : '·'}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.white }}>{m.title}</div>
                      {/* Observation, never attribution — see
                          OUTCOME_WINDOW_MINUTES in lib/liveSession. */}
                      <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3 }}>
                        {m.outcome
                          ? `Next ${m.outcome.windowMinutes} min: ${fmtInt(m.outcome.tokens)} tokens from ${m.outcome.tips} tip${m.outcome.tips === 1 ? '' : 's'}`
                          : 'Outcome measurement not available yet.'}
                      </div>
                    </div>
                  </div>
                ))}
                {onOpenReport && (
                  <div style={{ marginTop: 12 }}>
                    <Button onClick={() => onOpenReport(liveSession.id)} style={{ minHeight: 44, padding: '13px 22px', fontSize: 13 }}>
                      View Stream Report
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DetailBlock>

          {/* Streaming Plan — only when the Live Mode record carries a
              canonical window match. Never invents a baseline. */}
          {liveSession?.plan && (
            <DetailBlock title="Streaming Plan">
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>
                {liveSession.plan.matched
                  ? liveSession.plan.comparison
                    ? `You streamed during a planned ${liveSession.plan.day} window — ${fmtUsd(Math.abs(liveSession.plan.comparison.deltaUsdPerHour))}/hr ${liveSession.plan.comparison.above ? 'above' : 'below'} your usual ${fmtUsd(liveSession.plan.baselineUsdPerHour)}/hr there.`
                    : `You streamed during a planned ${liveSession.plan.day} window. Not enough historical data to measure improvement yet.`
                  : 'This session was outside your planned windows.'}
              </div>
            </DetailBlock>
          )}

          {bd.insights.length > 0 && (
            <DetailBlock title="💡 What happened">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bd.insights.map((ins, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
                    <span style={{ color: C.cyan, flexShrink: 0 }}>→</span><span style={{ minWidth: 0 }}>{ins}</span>
                  </div>
                ))}
              </div>
            </DetailBlock>
          )}

          {bd.recommendations.length > 0 && (
            <DetailBlock title="🚀 Do this next time">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bd.recommendations.map((rec, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
                    <span style={{ color: C.pink, flexShrink: 0 }}>→</span><span style={{ minWidth: 0 }}>{rec}</span>
                  </div>
                ))}
              </div>
            </DetailBlock>
          )}
        </div>
      )}
    </div>
  )
}

export default function Sessions({
  allSessions = [], rawSessionCount = 0, lowSignalCount = 0,
  meaningfulOnly = true, onToggleMeaningful,
  page = 0, onPageChange,
  liveSessionsById = {}, onOpenReport,
}) {
  const [openId, setOpenId] = useState(null)

  const sorted = useMemo(
    () => [...allSessions].sort((a, b) => new Date(b.startTime) - new Date(a.startTime)),
    [allSessions]
  )
  const totalPages = Math.max(1, Math.ceil(sorted.length / SESSIONS_PER_PAGE))
  const safePage = Math.min(Math.max(0, page), totalPages - 1)
  const pageStart = safePage * SESSIONS_PER_PAGE
  const pageSessions = sorted.slice(pageStart, pageStart + SESSIONS_PER_PAGE)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.white, marginBottom: 4 }}>🎥 Sessions</h1>
          <p style={{ fontSize: 13, color: C.muted }}>What happened in each stream, newest first.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, flexShrink: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: C.muted }}>
            <input type="checkbox" checked={meaningfulOnly} onChange={e => onToggleMeaningful?.(e.target.checked)} style={{ accentColor: C.cyan }} />
            Meaningful sessions only
          </label>
          {lowSignalCount > 0 && <span style={{ fontSize: 11, color: C.muted }}>({lowSignalCount} low-signal hidden)</span>}
        </div>
      </div>

      <OverallStats allSessions={sorted} />

      {sorted.length === 0 && (
        <div style={card({ padding: 40, textAlign: 'center' })}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎥</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.white }}>
            {rawSessionCount > 0 ? 'No sessions match this filter' : 'No sessions yet'}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            {rawSessionCount > 0
              ? 'Every session in this range was too small to analyse. Turn the filter off to see them all.'
              : 'Sessions are grouped automatically from your tip history. Import a CSV and they appear here.'}
          </div>
          {rawSessionCount > 0 && meaningfulOnly && (
            <button onClick={() => onToggleMeaningful?.(false)} style={{ marginTop: 14, minHeight: 44, padding: '12px 20px', borderRadius: 10, background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)', color: C.cyan, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              Show all sessions
            </button>
          )}
        </div>
      )}

      {pageSessions.map((s, i) => {
        const id = `${s.platform}-${new Date(s.startTime).getTime()}`
        return (
          <SessionRow
            key={id}
            s={s}
            allSessions={sorted}
            isOpen={openId === id}
            onToggle={() => setOpenId(openId === id ? null : id)}
            liveSession={liveSessionsById[id] || null}
            onOpenReport={onOpenReport}
          />
        )
      })}

      {totalPages > 1 && (
        <div className="cc-session-pager" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '18px 0 4px' }}>
          <button onClick={() => onPageChange?.(Math.max(0, safePage - 1))} disabled={safePage === 0}
            style={{ minHeight: 44, padding: '12px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: safePage === 0 ? C.muted : C.text, fontSize: 13, fontWeight: 700, cursor: safePage === 0 ? 'default' : 'pointer', opacity: safePage === 0 ? 0.45 : 1 }}>
            Previous
          </button>
          {(() => {
            const WINDOW = 5
            let from = Math.max(0, safePage - Math.floor(WINDOW / 2))
            const to = Math.min(totalPages, from + WINDOW)
            from = Math.max(0, to - WINDOW)
            return Array.from({ length: to - from }, (_, k) => from + k).map(n => (
              <button key={n} onClick={() => onPageChange?.(n)} aria-current={n === safePage ? 'page' : undefined}
                style={{ minWidth: 44, minHeight: 44, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  background: n === safePage ? 'rgba(34,211,238,0.14)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${n === safePage ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  color: n === safePage ? C.cyan : C.text }}>
                {n + 1}
              </button>
            ))
          })()}
          <button onClick={() => onPageChange?.(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}
            style={{ minHeight: 44, padding: '12px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: safePage >= totalPages - 1 ? C.muted : C.text, fontSize: 13, fontWeight: 700, cursor: safePage >= totalPages - 1 ? 'default' : 'pointer', opacity: safePage >= totalPages - 1 ? 0.45 : 1 }}>
            Next
          </button>
          <div style={{ width: '100%', textAlign: 'center', fontSize: 11.5, color: C.muted, marginTop: 4 }}>
            Page {safePage + 1} of {totalPages} · showing {pageStart + 1}–{Math.min(pageStart + SESSIONS_PER_PAGE, sorted.length)} of {sorted.length} sessions
          </div>
        </div>
      )}
    </div>
  )
}
