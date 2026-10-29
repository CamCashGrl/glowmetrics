"use client"
import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  buildBusinessSnapshot,
  buildPlatformComparison,
  buildEfficiencyComparison,
  buildTimeIntelligence,
  buildCamCashNoticed,
  buildPlatformSnapshot,
  buildDataCoverage,
  buildPlatformExtras,
  buildLatestStreamRecap,
  buildPlatformStatuses,
  buildLearningState,
  buildCrossPlatformInsights,
  buildShareShift,
  formatHour,
} from '../../lib/platformIntelligenceAnalytics'
import { computeDataVaultStats } from './DashboardPreview'
import { card, Chip, HERO_GRADIENT } from './CommandCenter'

// Visual language is the Command Center's: its glass card, chip, hero
// gradient, type scale and brand-gradient CTA.
const CTA_GRADIENT = 'linear-gradient(90deg,#22D3EE 0%,#7C5CFF 48%,#EC4899 100%)'

const C = {
  card: "#0d1322", card2: "#111829", border: "#1e2d45", border2: "#2a3f5f",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7", red: "#F87171", indigo: "#7C5CFF",
}

const PLATFORM_ACCENT = {
  chaturbate: C.purple, bongacams: C.red, myfreecams: C.gold,
  camsoda: C.green, stripchat: C.blue, flirt4free: C.pink,
}
const accentFor = (p) => PLATFORM_ACCENT[(p || '').toLowerCase().trim()] || C.cyan

const fmt$ = (n) => n === null || n === undefined ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt$0 = (n) => n === null || n === undefined ? '—' : `$${Math.round(Number(n)).toLocaleString('en-US')}`
const fmtN = (n) => n === null || n === undefined ? '—' : new Intl.NumberFormat('en-US').format(Math.round(n))
const fmtH = (n) => n === null || n === undefined ? '—' : `${Number(n).toFixed(1)}h`

// ============================================
// COMPACT PRIMITIVES
// Dense by construction: no fixed heights, no oversized type, 14–20px padding.
// ============================================

function Section({ title, note, children, style }) {
  return (
    <section style={{ marginBottom: 20, ...style }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.text }}>
          {title}
        </h2>
        {note ? <span style={{ fontSize: 11, color: C.muted }}>{note}</span> : null}
      </div>
      {children}
    </section>
  )
}

export function MetricStrip({ items }) {
  return (
    <div className="pi-strip" style={{
      display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      gap: 1, background: C.border, border: `1px solid ${C.border}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      {items.map((it, i) => (
        <div key={i} style={{ background: C.card, padding: '10px 12px', minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {it.label}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: it.color || C.white, marginTop: 2, lineHeight: 1.2 }}>
            {it.value}
          </div>
          {it.sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{it.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// Dense table. Scrolls inside its own container on narrow screens.
function DataTable({ columns, rows }) {
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 420 }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{
                textAlign: c.align || 'right', padding: '8px 12px', background: C.card2,
                color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}`,
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ background: ri % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
              {r.map((cell, ci) => (
                <td key={ci} style={{
                  textAlign: columns[ci].align || 'right', padding: '7px 12px',
                  color: C.white, whiteSpace: 'nowrap', borderTop: ri ? `1px solid ${C.border}` : 'none',
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FactRow({ label, facts, accent = C.cyan }) {
  return (
    <div style={{ padding: '9px 12px', borderLeft: `2px solid ${accent}`, background: 'rgba(255,255,255,0.02)', borderRadius: '0 8px 8px 0' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted }}>{label}</div>
      <div style={{ fontSize: 13, color: C.white, fontWeight: 600, marginTop: 2 }}>{facts}</div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ padding: '12px 14px', fontSize: 12, color: C.muted, border: `1px dashed ${C.border2}`, borderRadius: 10 }}>{children}</div>
}

function ProTag() {
  return <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', color: C.gold, border: `1px solid ${C.gold}55`, borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>PRO</span>
}

function LockedRow({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', border: `1px dashed ${C.gold}44`, borderRadius: 8, background: `${C.gold}0a` }}>
      <span style={{ fontSize: 11 }}>🔒</span>
      <span style={{ fontSize: 11.5, color: C.text }}>{text}</span>
      <ProTag />
    </div>
  )
}

function ShareBar({ percent, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <div style={{ width: 46, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, percent || 0))}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ minWidth: 30, textAlign: 'right' }}>{percent === null || percent === undefined ? '—' : `${percent}%`}</span>
    </div>
  )
}

// Shows a trend only when the engine measured one against a real prior period.
function TrendCell({ trend }) {
  if (!trend || trend.pct === null) {
    return <span style={{ color: C.muted }} title="No earlier period to compare against">—</span>
  }
  const up = trend.pct > 10, down = trend.pct < -10
  const color = up ? C.green : down ? C.red : C.text
  return (
    <span style={{ color, whiteSpace: 'nowrap' }} title={`${fmt$(trend.prior30USD)} → ${fmt$(trend.last30USD)} (last 30 days vs prior 30)`}>
      {trend.emoji} {trend.pct > 0 ? '+' : ''}{Math.round(trend.pct)}%
    </span>
  )
}

export function PlatformCell({ platform }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: accentFor(platform), flexShrink: 0 }} />
      {platform}
    </span>
  )
}

// Suggestions restate figures the engine produced; nothing is inferred beyond them.
function NextBestMove({ comparison, efficiency, timeIntel, onOpenPlanner }) {
  const moves = []

  if (efficiency.length >= 2) {
    const best = efficiency[0]
    const worst = efficiency[efficiency.length - 1]
    if (best.usdPerHour >= worst.usdPerHour * 1.25) {
      moves.push(`Shift hours from ${worst.platform} (${fmt$(worst.usdPerHour)}/hr) toward ${best.platform} (${fmt$(best.usdPerHour)}/hr).`)
    }
  }
  if (timeIntel?.hasPattern && timeIntel.confidence?.level !== 'Very Low') {
    const parts = []
    if (timeIntel.bestDay) parts.push(timeIntel.bestDay.day)
    if (timeIntel.bestHour) parts.push(`around ${timeIntel.bestHour.label}`)
    if (parts.length) moves.push(`Protect ${parts.join(' ')} — your strongest recorded window (${timeIntel.confidence.label.toLowerCase()}).`)
  }
  if (comparison.length === 1) {
    moves.push('You have one platform with enough data to analyse. A second gives CamCash something to compare against.')
  }

  const planner = onOpenPlanner ? (
    <div><BrandButton onClick={onOpenPlanner}>Build your stream plan →</BrandButton></div>
  ) : null

  if (moves.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <Empty>Once there is enough data to compare platforms and times, suggested moves appear here.</Empty>
        {planner}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {moves.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 13px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <span style={{ color: C.cyan, fontSize: 12 }}>→</span>
          <span style={{ fontSize: 12.5, color: C.white, lineHeight: 1.45 }}>{m}</span>
        </div>
      ))}
      {planner && <div style={{ marginTop: 2 }}>{planner}</div>}
    </div>
  )
}

// Coverage of the analysis window, in days actually imported. No estimate of
// what is "missing" — that number is not knowable from the data on file.
function DataCoverage({ coverage }) {
  if (!coverage || coverage.historyDays === 0) return null
  const complete = coverage.historyDays >= coverage.windowDays

  return (
    <Section
      title="Your data"
      note={coverage.hasMoreThanWindow
        ? `${fmtN(coverage.historyDays)} days on file · ${coverage.windowDays}-day window analysed`
        : `${fmtN(coverage.historyDays)} of ${coverage.windowDays} days imported`}
    >
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
        {!complete && (
          <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${coverage.windowCoveragePct}%`, height: '100%', background: C.cyan, borderRadius: 2 }} />
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {coverage.milestones.map((m, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, padding: '3px 9px', borderRadius: 6,
              color: m.done ? C.white : C.muted,
              background: m.done ? `${C.green}14` : 'transparent',
              border: `1px solid ${m.done ? `${C.green}44` : C.border}`,
            }}>
              <span style={{ color: m.done ? C.green : C.muted }}>{m.done ? '✓' : `${m.days}d`}</span>
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ============================================
// SPLIT VIEW — single platform
// ============================================

function SplitView({ analytics, platformName, isPro }) {
  const snap = useMemo(() => buildPlatformSnapshot(analytics, platformName), [analytics, platformName])
  const accent = accentFor(platformName)

  if (!snap) {
    return <Empty>{platformName} has no meaningful session data yet, so there is nothing reliable to break down.</Empty>
  }

  return (
    <>
      <Section title={`${platformName} snapshot`}>
        <MetricStrip items={[
          { label: 'Earnings', value: fmt$0(snap.earnings), color: C.green },
          { label: 'Share', value: `${snap.earningsPercent}%` },
          { label: 'Tips', value: fmtN(snap.tips) },
          { label: 'Hours', value: snap.hours > 0 ? fmtH(snap.hours) : '—' },
          // Sub-label names the hours the rate divides by, which is a subset of
          // Hours beside it — without it the two read as failing to divide.
          { label: '$ / hour', value: snap.usdPerHour > 0 ? fmt$(snap.usdPerHour) : '—', sub: snap.rateHours > 0 ? `est · ${fmt$0(snap.rateUSD)} / ${snap.rateHours}h` : null, color: snap.usdPerHour > 0 ? accent : C.muted },
          { label: 'Sessions', value: fmtN(snap.sessions) },
        ]} />
      </Section>

      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="Performance" style={{ marginBottom: 0 }}>
          <MetricStrip items={[
            { label: '$ / session', value: snap.sessions > 0 ? fmt$(snap.earningsPerSession) : '—' },
            { label: 'Avg tip', value: snap.avgTipSize > 0 ? fmt$(snap.avgTipSize) : '—' },
            { label: 'Time share', value: `${snap.hoursPercent}%` },
          ]} />
          {snap.missedRevenue && (
            <div style={{ marginTop: 8 }}>
              <FactRow label="Timing gap" accent={C.gold}
                facts={`Sessions at ${formatHour(snap.missedRevenue.bestHour)} typically earn ${snap.missedRevenue.multiplier}× your average here.`} />
            </div>
          )}
        </Section>

        <Section title="Revenue mix" style={{ marginBottom: 0 }}>
          {snap.revenueMix.length === 0 ? (
            <Empty>No revenue-type detail recorded for this platform.</Empty>
          ) : (
            <DataTable
              columns={[{ label: 'Type', align: 'left' }, { label: 'Count' }, { label: 'Avg' }, { label: 'Earnings' }, { label: 'Share' }]}
              rows={snap.revenueMix.slice(0, 6).map(t => [
                t.type, fmtN(t.count), fmt$(t.avgUsd), fmt$(t.usd),
                <ShareBar key="s" percent={t.pct} color={accent} />,
              ])}
            />
          )}
        </Section>

      </div>

      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title={`When ${platformName} pays`} style={{ marginBottom: 0 }}>
          {!snap.bestHour && !snap.bestDay ? (
            <Empty>Not enough repeat activity on this platform to name a reliable time.</Empty>
          ) : !isPro ? (
            <LockedRow text={`Best hour and day for ${platformName}`} />
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {snap.bestHour && (
                <FactRow label="Best hour" accent={accent}
                  facts={`${snap.bestHour.label} · ${fmt$(snap.bestHour.avg)} typical · ${fmtN(snap.bestHour.sessionCount)} sessions`} />
              )}
              {snap.bestDay && (
                <FactRow label="Best day" accent={C.purple}
                  facts={`${snap.bestDay.day} · ${fmt$(snap.bestDay.avg)} typical · ${fmtN(snap.bestDay.activeDays)} days`} />
              )}
              {snap.hourly.length > 1 && (
                <DataTable
                  columns={[{ label: 'Hour', align: 'left' }, { label: 'Typical' }, { label: 'Sessions' }]}
                  rows={snap.hourly.slice(0, 6).map(h => [
                    formatHour(h.hour), fmt$(h.avg), fmtN(h.sessionCount),
                  ])}
                />
              )}
            </div>
          )}
        </Section>
        <Section title="Day of week" style={{ marginBottom: 0 }}>
          {snap.weekdays.length === 0 ? (
            <Empty>No weekday has three separate active days yet, so there is no dependable pattern to show.</Empty>
          ) : (
            <DataTable
              // No total column: these come from every tip, while the earnings
              // above count meaningful sessions only, so a total here would
              // invite a sum that does not match the snapshot.
              columns={[{ label: 'Day', align: 'left' }, { label: 'Typical day' }, { label: 'Active days' }]}
              rows={snap.weekdays.map(d => [
                d.day, fmt$(d.avg), fmtN(d.activeDays),
              ])}
            />
          )}
        </Section>
      </div>

      <Section title={`Supporters on ${platformName}`} note="Identities are never merged across platforms">
        {snap.topFans.length === 0 ? (
          <Empty>No supporters recorded on this platform yet.</Empty>
        ) : (
          <>
            <DataTable
              columns={[{ label: 'Supporter', align: 'left' }, { label: 'Tips' }, { label: 'Total' }, { label: 'Share' }]}
              rows={snap.topFans.slice(0, isPro ? 10 : 3).map(f => [
                f.username, fmtN(f.tipCount), fmt$(f.earnings),
                <ShareBar key="s" percent={f.earningsPercent} color={C.pink} />,
              ])}
            />
            {!isPro && snap.topFans.length > 3 && (
              <div style={{ marginTop: 6 }}><LockedRow text="Full supporter list for this platform" /></div>
            )}
          </>
        )}
      </Section>
    </>
  )
}

// ============================================
// MOTION
// Values ease from their previous figure to the new one when the data
// changes (an import, a Live update). The first paint renders the real value,
// so server and client markup match. Reduced-motion users get no animation.
// ============================================

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function useCountUp(value, duration = 650) {
  const [display, setDisplay] = useState(value)
  const [changed, setChanged] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (from === value || !Number.isFinite(from) || !Number.isFinite(value)) { setDisplay(value); return }
    setChanged(true)
    const glow = setTimeout(() => setChanged(false), 1400)
    if (prefersReducedMotion()) { setDisplay(value); return () => clearTimeout(glow) }
    let raf
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (value - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); clearTimeout(glow) }
  }, [value, duration])
  return [display, changed]
}

function Counter({ value, format = fmt$, style }) {
  const [display, changed] = useCountUp(value)
  return <span className={changed ? 'pl-glow' : undefined} style={style}>{format(display)}</span>
}

// Bars grow from zero once mounted, and to their new width on every change.
function useMounted() {
  const [m, setM] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(id) }, [])
  return m
}

// ============================================
// SMALL PIECES
// ============================================

const BADGES = {
  leading: { label: 'Leading right now', color: C.pink },
  latest: { label: 'Latest stream', color: C.cyan },
  gaining: { label: '↑ Gaining', color: C.green },
  cooling: { label: 'Cooling', color: C.blue },
  learning: { label: 'Still learning', color: C.muted },
}
const BADGE_HELP = {
  leading: 'Highest earnings of your platforms in the analysed period',
  latest: 'Your most recent stream (30+ min, 2+ tips) was here',
  gaining: 'Last 30 days earned more than the 30 days before',
  cooling: 'Last 30 days earned less than the 30 days before',
  learning: 'Fewer than 3 meaningful sessions or 3 streamed hours on this platform',
}

function Badge({ kind }) {
  const b = BADGES[kind]
  if (!b) return null
  return (
    <span className="pl-badge" title={BADGE_HELP[kind]} style={{
      fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
      color: b.color === C.muted ? C.text : b.color, background: `${b.color}14`,
      border: `1px solid ${b.color}40`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
    }}>{b.label}</span>
  )
}

function Glass({ children, style, accent, className, onClick, ...rest }) {
  return (
    <div className={`pl-glass${onClick ? ' pl-click' : ''}${className ? ` ${className}` : ''}`} onClick={onClick}
      style={card({ position: 'relative', padding: 20, minWidth: 0, ...(accent ? { border: `1px solid ${accent}40` } : {}), ...style })} {...rest}>
      {children}
    </div>
  )
}

function Label({ children, style }) {
  return <div style={{ fontSize: 16, fontWeight: 800, color: C.white, letterSpacing: '-0.01em', ...style }}>{children}</div>
}

const eyebrow = { fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted }

function BrandButton({ children, onClick, style }) {
  return (
    <button type="button" onClick={onClick} className="pl-brand" style={{
      background: CTA_GRADIENT, border: 'none', borderRadius: 10, padding: '11px 20px',
      fontSize: 14, fontWeight: 700, color: C.white, cursor: 'pointer', whiteSpace: 'nowrap',
      boxShadow: '0 4px 18px rgba(124,92,255,0.30)', ...style,
    }}>{children}</button>
  )
}

function UpgradeLink({ children, onUpgrade, source }) {
  return <BrandButton onClick={() => onUpgrade?.(source)} style={{ padding: '9px 16px', fontSize: 13 }}>{children} →</BrandButton>
}

const fmtSigned$ = (n) => `${n >= 0 ? '+' : '−'}${fmt$(Math.abs(n))}`
const plural = (n, one, many = `${one}s`) => `${fmtN(n)} ${n === 1 ? one : many}`

function streamWhen(iso, tz) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleString('en-US')
  }
}

// ============================================
// 1 · PLATFORM PULSE
// ============================================

function PlatformPulse({ comparison, snapshot, recap, learning }) {
  const leader = comparison[0]
  const multi = comparison.length > 1
  return (
    <div style={{
      background: HERO_GRADIENT, backdropFilter: 'blur(20px)', border: '1px solid rgba(34,211,238,0.28)',
      borderRadius: 22, padding: 34, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', right: -70, top: -70, width: 300, height: 300, borderRadius: '50%', background: 'rgba(236,72,153,0.12)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <div style={{ ...eyebrow, fontSize: 12, color: C.cyan, marginBottom: 14 }}>Platform pulse</div>
          <div style={{ fontSize: 38, fontWeight: 800, color: C.white, letterSpacing: '-0.035em', lineHeight: 1.12 }}>
            {multi ? <>{leader.platform} is leading</> : <>Everything on {leader.platform}</>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginTop: 14 }}>
            {multi && (
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.pink, background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.3)', padding: '5px 12px', borderRadius: 20 }}>
                {leader.earningsPercent}% of earnings
              </span>
            )}
            <span style={{ fontSize: 13, color: C.text }}>
              <strong style={{ color: C.white }}>{plural(snapshot.totalTips, 'tip')}</strong> across {plural(comparison.length, 'platform')} · {plural(snapshot.sessions, 'meaningful session')}
            </span>
          </div>
          <div style={{ marginTop: 22 }}>
            <div style={eyebrow}>Total platform earnings</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: C.white, letterSpacing: '-0.03em', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              <Counter value={snapshot.totalEarnings} />
            </div>
          </div>
          {learning.isLearning && (
            <div style={{ fontSize: 13.5, color: C.text, marginTop: 14, lineHeight: 1.6, maxWidth: 520 }}>
              <strong style={{ color: C.white }}>CamCash is still learning your platforms.</strong>{' '}
              {[
                learning.sessionsNeeded > 0 ? plural(learning.sessionsNeeded, 'more meaningful session') : null,
                learning.hoursNeeded > 0 ? `${learning.hoursNeeded} more streamed hours` : null,
              ].filter(Boolean).join(' and ')} will unlock early patterns.
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 300px', minWidth: 260, textAlign: 'right' }}>
          {recap ? (
            <>
              <div style={eyebrow}>Your latest stream</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: C.green, letterSpacing: '-0.03em', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
                +<Counter value={recap.earned} />
              </div>
              <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>
                on <strong style={{ color: C.white }}>{recap.platform}</strong> · {plural(recap.tips, 'tip')} from {plural(recap.fans, 'fan')}
              </div>
              {recap.tookLead && (
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.pink, marginTop: 10 }}>{recap.platform} moved into the lead</div>
              )}
            </>
          ) : (
            <>
              <div style={eyebrow}>Since your last stream</div>
              <div style={{ fontSize: 15, color: C.white, marginTop: 10, lineHeight: 1.5 }}>
                Stream again and CamCash will start showing what changed between sessions.
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>A stream counts once it runs 30+ minutes with 2+ tips.</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// 2 · LATEST STREAM RECAP + ACTIVITY
// ============================================

function LatestStream({ recap, tz, multi }) {
  if (!recap) return null
  const dur = recap.durationMinutes
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <span className="pl-dot" style={{ width: 8, height: 8, borderRadius: 4, background: C.green }} />
        <Label>Since your last stream</Label>
        <span style={{ fontSize: 13, color: C.muted }}>{streamWhen(recap.endTime, tz)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 11 }}>
        <Chip icon="💸" title="Earned" value={fmtSigned$(recap.earned)} sub={`${recap.platform} · ${plural(recap.tips, 'tip')}`} accent={C.green} />
        <Chip icon="🔁" title="Returning fans"
          value={recap.returningFans === null ? 'First stream here' : plural(recap.returningFans, 'fan')}
          sub={recap.returningFans === null ? 'Compared from your next stream' : 'tipped again'} accent={recap.returningFans ? C.cyan : C.muted} />
        <Chip icon="✨" title="New spenders"
          value={recap.newSpenders === null ? '—' : plural(recap.newSpenders, 'spender')}
          sub={recap.newSpenders === null ? 'Needs an earlier stream' : 'tipped for the first time'} accent={recap.newSpenders ? C.pink : C.muted} />
        {multi && recap.shareShiftPts !== null ? (
          <Chip icon="📊" title="Revenue share" value={`${recap.shareShiftPts > 0 ? '+' : ''}${recap.shareShiftPts} pts`}
            sub={recap.tookLead ? `${recap.platform} moved into the lead` : `${recap.platform} after this stream`} accent={recap.shareShiftPts > 0 ? C.green : C.blue} />
        ) : dur ? (
          <Chip icon="⏱️" title="Streamed" value={`${dur >= 60 ? `${Math.floor(dur / 60)}h ` : ''}${dur % 60}m`} sub={plural(recap.fans, 'fan') + ' tipped'} accent={C.gold} />
        ) : null}
      </div>
    </div>
  )
}

// ============================================
// 3 · PLATFORM CARDS
// ============================================

function PlatformCard({ row, extras, badges, selected, onSelect }) {
  const accent = accentFor(row.platform)
  const mounted = useMounted()
  const trend = row.trend
  return (
    <Glass accent={selected ? accent : undefined} onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      aria-pressed={selected} style={{ padding: 16, overflow: 'hidden' }}>
      <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 5, background: accent, boxShadow: `0 0 10px ${accent}`, flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 800, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.platform}</span>
        </div>
        <span style={{ fontSize: 11, color: selected ? accent : C.muted, whiteSpace: 'nowrap' }}>{selected ? 'Viewing ↓' : 'Details →'}</span>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', minHeight: 20, marginTop: 9 }}>
        {badges.map(b => <Badge key={b} kind={b} />)}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: C.white, marginTop: 10, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        <Counter value={row.earnings} />
      </div>
      <div style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{row.earningsPercent}% of your earnings</div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 8 }}>
        <div style={{ width: mounted ? `${row.earningsPercent}%` : 0, height: '100%', background: `linear-gradient(90deg, ${accent}99, ${accent})`, borderRadius: 2, transition: 'width 900ms cubic-bezier(.2,.8,.2,1)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginTop: 12 }}>
        {[
          ['Tips', fmtN(row.tips)],
          ['Fans', fmtN(extras?.uniqueFans ?? 0)],
          ['Avg tip', row.avgTipSize > 0 ? fmt$(row.avgTipSize) : '—'],
        ].map(([l, v]) => (
          <div key={l} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted }}>{l}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.white, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${C.border}`, fontSize: 11.5, color: C.text, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>30-day momentum</span>
        <TrendCell trend={trend} />
      </div>
    </Glass>
  )
}

function ExpansionCard({ onImport }) {
  return (
    <Glass style={{ padding: 16, border: `1px dashed ${C.border2}`, background: 'rgba(15,20,32,0.45)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Streaming somewhere else too?</div>
      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>
        Add another platform and CamCash can compare where your fans spend more and where your time pays better.
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['Chaturbate', 'MyFreeCams', 'BongaCams'].map(p => (
          <span key={p} style={{ fontSize: 10.5, color: C.text, border: `1px solid ${C.border}`, borderRadius: 999, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: accentFor(p) }} />{p}
          </span>
        ))}
      </div>
      {onImport && (
        <div><BrandButton onClick={onImport}>Import another platform →</BrandButton></div>
      )}
    </Glass>
  )
}

// ============================================
// 4 · WHERE YOUR MONEY COMES FROM
// ============================================

function MoneyBars({ comparison }) {
  const mounted = useMounted()
  return (
    <Glass>
      <Label style={{ marginBottom: 16 }}>Where your money comes from</Label>
      <div style={{ display: 'grid', gap: 12 }}>
        {comparison.map(p => {
          const accent = accentFor(p.platform)
          return (
            <div key={p.platform}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, marginBottom: 7 }}>
                <span style={{ color: C.white, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.platform}</span>
                <span style={{ color: C.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt$(p.earnings)} <span style={{ color: C.white, fontWeight: 800, marginLeft: 6 }}>{p.earningsPercent}%</span>
                </span>
              </div>
              <div style={{ height: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 7, overflow: 'hidden' }}>
                <div style={{ width: mounted ? `${Math.max(p.earningsPercent, p.earnings > 0 ? 1 : 0)}%` : 0, height: '100%', borderRadius: 7, background: `linear-gradient(90deg, ${accent}88, ${accent})`, boxShadow: `0 0 12px ${accent}55`, transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }} />
              </div>
            </div>
          )
        })}
      </div>
    </Glass>
  )
}

// ============================================
// 5 · CAMCASH NOTICED
// Engine-backed observations stay visible on every plan (as before). The
// cross-platform findings are Pro: Free sees that a real one exists, with the
// platform names and figures withheld.
// ============================================

function Noticed({ noticed, cross, isPro, onUpgrade, multi }) {
  const freeTeasers = isPro ? [] : cross
  const shown = isPro ? [...cross.map(c => c.text), ...noticed.map(n => n.text)] : noticed.map(n => n.text)
  return (
    <Glass accent={C.purple}>
      <Label style={{ marginBottom: 14 }}><span style={{ color: C.pink }}>✦</span> CamCash noticed</Label>
      {shown.length === 0 && freeTeasers.length === 0 ? (
        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
          {multi
            ? 'Nothing stands out between your platforms yet. Findings appear here when the gap is big enough to be real.'
            : 'Findings appear here once a pattern in your data is strong enough to call out.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {shown.slice(0, 4).map((t, i) => (
            <div key={i} className="pl-chip" style={{ animationDelay: `${i * 70}ms`, display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 14, color: C.white, lineHeight: 1.55, padding: '14px 15px', borderRadius: 12, background: i === 0 ? `${C.indigo}18` : `${C.indigo}0d`, border: `1px solid ${i === 0 ? `${C.indigo}50` : `${C.indigo}28`}` }}>
              <span style={{ fontSize: 17, flexShrink: 0 }}>💡</span><span style={{ minWidth: 0 }}>{t}</span>
            </div>
          ))}
          {freeTeasers.slice(0, 2).map(c => (
            <div key={c.id} style={{ padding: '14px 15px', borderRadius: 12, border: `1px solid ${C.pink}40`, background: HERO_GRADIENT }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.09em', color: C.pink }}>✦ PRO INSIGHT</div>
              <div style={{ fontSize: 14, color: C.white, marginTop: 5, lineHeight: 1.5 }}>{c.teaser}</div>
              <div aria-hidden style={{ fontSize: 12, color: C.text, marginTop: 4, filter: 'blur(4px)', userSelect: 'none' }}>████████ earns ██% more per ███</div>
              <div style={{ marginTop: 10 }}><UpgradeLink onUpgrade={onUpgrade} source={`platforms_insight_${c.id}`}>{c.cta}</UpgradeLink></div>
            </div>
          ))}
        </div>
      )}
    </Glass>
  )
}

// ============================================
// 6 · PLATFORM COMPARISON
// ============================================

function Comparison({ comparison, extras }) {
  const rows = [
    { label: 'Earnings', get: p => p.earnings, fmt: fmt$ },
    { label: 'Revenue share', get: p => p.earningsPercent, fmt: v => `${v}%` },
    { label: 'Tips', get: p => p.tips, fmt: fmtN },
    { label: 'Unique fans', get: p => extras[p.platform]?.uniqueFans ?? 0, fmt: fmtN },
    { label: 'Avg tip', get: p => p.avgTipSize, fmt: fmt$ },
    { label: 'Biggest tip', get: p => extras[p.platform]?.biggestTip ?? 0, fmt: fmt$ },
    { label: 'Sessions', get: p => p.sessions, fmt: fmtN, note: '30+ min, 2+ tips' },
    // $/hr only from sessions with a reliable length (engine rule).
    { label: 'Est. $/hr', get: p => (p.rateHours > 0 && p.usdPerHour > 0 ? p.usdPerHour : null), fmt: fmt$, note: 'timed sessions only' },
    { label: '30-day momentum', get: p => (p.trend?.pct ?? null), render: p => <TrendCell trend={p.trend} /> },
  ]
  return (
    <Glass style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 140 + comparison.length * 130, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '16px 20px', fontSize: 16, color: C.white, fontWeight: 800 }}>Platform comparison</th>
              {comparison.map(p => (
                <th key={p.platform} style={{ textAlign: 'right', padding: '16px 20px', color: C.white, fontWeight: 800, whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <PlatformCell platform={p.platform} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => {
              const vals = comparison.map(r.get)
              const finite = vals.filter(v => v !== null && Number.isFinite(v))
              const best = finite.length > 1 ? Math.max(...finite) : null
              return (
                <tr key={r.label} style={{ borderTop: `1px solid ${C.border}`, background: ri % 2 ? 'rgba(255,255,255,0.012)' : 'transparent' }}>
                  <td style={{ padding: '10px 20px', color: C.text, whiteSpace: 'nowrap' }}>
                    {r.label}{r.note && <span style={{ color: C.muted, fontSize: 10.5, marginLeft: 6 }}>{r.note}</span>}
                  </td>
                  {comparison.map((p, i) => {
                    const v = vals[i]
                    const isBest = best !== null && v === best && v > 0
                    return (
                      <td key={p.platform} style={{ padding: '10px 20px', textAlign: 'right', whiteSpace: 'nowrap', color: isBest ? C.white : '#cbd5e1', fontWeight: isBest ? 800 : 500 }}>
                        {r.render ? r.render(p) : v === null ? <span style={{ color: C.muted }}>—</span> : r.fmt(v)}
                        {isBest && !r.render && <span title="Best of your platforms" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: 3, background: C.pink, marginLeft: 6, verticalAlign: 'middle', boxShadow: `0 0 6px ${C.pink}` }} />}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Glass>
  )
}

// ============================================
// 7 · REVENUE SPLIT OVER TIME (Pro) / teaser (Free)
// ============================================

function ShareShift({ shift }) {
  return (
    <Glass>
      <Label style={{ marginBottom: 14 }}>Revenue split <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>· last 30 days vs the 30 before</span></Label>
      <div style={{ display: 'grid', gap: 7 }}>
        {shift.map(r => (
          <div key={r.platform} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 70px 80px', gap: 10, fontSize: 12.5, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.white }}><PlatformCell platform={r.platform} /></span>
            <span style={{ textAlign: 'right', color: C.muted }}>{r.priorPct}%</span>
            <span style={{ textAlign: 'right', color: C.white, fontWeight: 700 }}>{r.lastPct}%</span>
            <span style={{ textAlign: 'right', fontWeight: 700, color: r.shiftPts > 0 ? C.green : r.shiftPts < 0 ? C.blue : C.text }}>
              {r.shiftPts > 0 ? '+' : r.shiftPts < 0 ? '−' : '±'}{Math.abs(r.shiftPts)} pts
            </span>
          </div>
        ))}
      </div>
    </Glass>
  )
}

function HistoryTeaser({ hiddenTipCount, onUpgrade }) {
  return (
    <Glass style={{ border: `1px dashed ${C.pink}55` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>
            How your platform split is moving <ProTag />
          </div>
          <div style={{ fontSize: 12, color: C.text, marginTop: 4, lineHeight: 1.5 }}>
            {hiddenTipCount > 0
              ? `${fmtN(hiddenTipCount)} of your older tips sit outside the free 31-day window. Pro compares each platform's share and momentum across your full history.`
              : 'Pro compares each platform’s revenue share and momentum month over month, across your full history.'}
          </div>
        </div>
        <UpgradeLink onUpgrade={onUpgrade} source="platforms_history">Unlock platform history</UpgradeLink>
      </div>
    </Glass>
  )
}

// ============================================
// 8 · LOW-DATA / NEW ACCOUNT
// ============================================

function LearningPanel({ learning, onImport }) {
  const counts = [
    [learning.platforms, 'platform', 'connected'],
    [learning.sessions, 'session', 'analysed'],
    [learning.tips, 'tip', 'analysed'],
  ]
  return (
    <Glass accent={C.purple} style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>CamCash is learning your platforms</div>
      <div style={{ fontSize: 12.5, color: C.text, marginTop: 5, lineHeight: 1.55, maxWidth: 620 }}>
        {learning.tips > 0
          ? <>Import or stream a little more and we&apos;ll begin comparing where your income, fans and strongest sessions come from.</>
          : <>Import your tip history or stream with the CamCash extension, and this page will show where your money comes from and what changed after every stream.</>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        {counts.filter(([n]) => n > 0).map(([n, one, verb]) => (
          <div key={one} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: C.white, fontVariantNumeric: 'tabular-nums' }}>{fmtN(n)}</span>
            <span style={{ fontSize: 11.5, color: C.text, marginLeft: 6 }}>{n === 1 ? one : `${one}s`} {verb}</span>
          </div>
        ))}
      </div>
      {onImport && (
        <div style={{ marginTop: 18 }}><BrandButton onClick={onImport}>Import tips →</BrandButton></div>
      )}
    </Glass>
  )
}

// ============================================
// 9 · PLATFORM DETAIL
// The single-platform breakdown, with deep analysis linked to its own page
// rather than rebuilt here.
// ============================================

function PlatformDetail({ analytics, platformName, isPro, extras, onNavigate, detailRef }) {
  const accent = accentFor(platformName)
  const links = [
    ['whales', 'Fans'],
    ['sessions', 'Sessions'],
    ['planner', 'Stream planner'],
  ]
  return (
    <div ref={detailRef} style={{ scrollMarginTop: 16 }}>
      <Glass accent={accent} style={{ padding: 18, marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ width: 9, height: 9, borderRadius: 5, background: accent, flexShrink: 0 }} />
            <span style={{ fontSize: 16, fontWeight: 800, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{platformName} in detail</span>
            {extras?.biggestTip > 0 && <span style={{ fontSize: 11.5, color: C.text, whiteSpace: 'nowrap' }}>· biggest tip {fmt$(extras.biggestTip)} · {plural(extras.uniqueFans, 'fan')}</span>}
          </div>
          {onNavigate && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {links.map(([tab, label]) => (
                <button key={tab} type="button" onClick={() => onNavigate(tab)} style={{ fontSize: 11.5, fontWeight: 700, color: C.white, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border2}`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}>
                  {label} →
                </button>
              ))}
            </div>
          )}
        </div>
        <SplitView analytics={analytics} platformName={platformName} isPro={isPro} />
      </Glass>
    </div>
  )
}

// ============================================
// PAGE
// ============================================

export default function PlatformsIntelligence({
  analytics = null, tips = [], isPro = false, onOpenPlanner = null,
  onNavigate = null, onUpgrade = null, tz = null, hiddenTipCount = 0,
  fullHistoryPlatform = null,
}) {
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const detailRef = useRef(null)

  // Coverage reads the account's real import span via the canonical vault
  // helper rather than deriving its own.
  const coverage = useMemo(() => buildDataCoverage(computeDataVaultStats(tips)), [tips])
  const snapshot = useMemo(() => buildBusinessSnapshot(analytics), [analytics])
  const comparison = useMemo(() => buildPlatformComparison(analytics), [analytics])
  const efficiency = useMemo(() => buildEfficiencyComparison(analytics), [analytics])
  const timeIntel = useMemo(() => buildTimeIntelligence(analytics), [analytics])
  const extras = useMemo(() => buildPlatformExtras(analytics), [analytics])
  const recap = useMemo(() => buildLatestStreamRecap(analytics), [analytics])
  const statuses = useMemo(() => buildPlatformStatuses(analytics, recap), [analytics, recap])
  const learning = useMemo(() => buildLearningState(analytics), [analytics])
  const noticed = useMemo(() => buildCamCashNoticed(analytics), [analytics])
  const cross = useMemo(() => buildCrossPlatformInsights(analytics), [analytics])
  const shift = useMemo(() => (isPro ? buildShareShift(analytics) : null), [analytics, isPro])

  const names = comparison.map(p => p.platform)
  const active = names.includes(selectedPlatform) ? selectedPlatform : null
  const multi = comparison.length > 1
  const onImport = onNavigate ? () => onNavigate('upload') : null

  const select = (p) => {
    setSelectedPlatform(prev => (prev === p ? null : p))
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }))
  }

  return (
    <div className="pl-root" style={{ maxWidth: 1280, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <style>{`
        .pl-root { max-width: 100%; }
        .pl-root section, .pl-root .pi-two-col > *, .pl-root .pl-grid > * { min-width: 0; }
        .pl-root table { font-variant-numeric: tabular-nums; }
        .pl-click { cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
        .pl-brand:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(124,92,255,0.45) !important; }
        .pl-brand { transition: transform .15s, box-shadow .15s; }
        .pl-click:hover { transform: translateY(-2px); border-color: rgba(236,72,153,0.35) !important; box-shadow: 0 14px 34px -18px rgba(236,72,153,0.45) !important; }
        .pl-click:focus-visible { outline: 2px solid ${C.pink}; outline-offset: 2px; }
        @keyframes plGlow { 0% { text-shadow: 0 0 0 transparent; } 30% { text-shadow: 0 0 18px rgba(236,72,153,0.75); } 100% { text-shadow: 0 0 0 transparent; } }
        .pl-glow { animation: plGlow 1.4s ease-out; }
        @keyframes plIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .pl-chip, .pl-badge { animation: plIn .45s ease-out both; }
        @keyframes plDot { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.6); } 50% { box-shadow: 0 0 0 4px rgba(16,185,129,0); } }
        .pl-dot { animation: plDot 2.4s ease-in-out 3; }
        @media (prefers-reduced-motion: reduce) {
          .pl-glow, .pl-chip, .pl-badge, .pl-dot { animation: none !important; }
          .pl-click, .pl-brand:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(124,92,255,0.45) !important; }
        .pl-brand { transition: transform .15s, box-shadow .15s; }
        .pl-click:hover { transition: none; transform: none; }
        }
        @media (max-width: 1000px) {
          .pl-root .pl-pulse-grid { grid-template-columns: 1fr 1fr !important; }
          .pl-root .pl-pulse-grid > :last-child { grid-column: 1 / -1; border-left: none !important; padding-left: 0 !important; }
          .pl-root .pi-two-col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .pl-root .pl-pulse-grid { grid-template-columns: 1fr !important; }
          .pl-root .pl-pulse-grid > * { border-left: none !important; padding-left: 0 !important; }
          .pi-strip { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, color: C.white, letterSpacing: '-0.025em' }}>Platforms</h1>
          <div style={{ fontSize: 15, color: C.muted, marginTop: 6 }}>
            See where your money is coming from — and what changed since your last stream.
          </div>
        </div>
        {recap && (
          <span style={{ fontSize: 12.5, color: C.muted, whiteSpace: 'nowrap' }}>
            Updated through {streamWhen(recap.endTime, tz)}
          </span>
        )}
      </div>

      {!analytics || comparison.length === 0 ? (
        <LearningPanel learning={learning} onImport={onImport} />
      ) : (
        <>
          <PlatformPulse comparison={comparison} snapshot={snapshot} recap={recap} learning={learning} />
          {!isPro && multi && (
            <div style={{ fontSize: 12.5, color: C.text, marginTop: -10 }}>
              {fullHistoryPlatform && names.includes(fullHistoryPlatform)
                ? <>Free plan: <span style={{ color: C.white }}>{fullHistoryPlatform}</span> (your primary) includes its full history; other platforms show their latest 31 days, so shares compare different spans.</>
                : <>Free plan: each platform shows its latest 31 days of activity.</>}
            </div>
          )}
          <LatestStream recap={recap} tz={tz} multi={multi} />

          <div className="pl-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {comparison.map(row => (
              <PlatformCard key={row.platform} row={row} extras={extras[row.platform]} badges={statuses[row.platform] || []}
                selected={active === row.platform} onSelect={() => select(row.platform)} />
            ))}
            {!multi && <ExpansionCard onImport={onImport} />}
          </div>

          {active && (
            <div>
              <PlatformDetail analytics={analytics} platformName={active} isPro={isPro} extras={extras[active]} onNavigate={onNavigate} detailRef={detailRef} />
            </div>
          )}

          <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: multi ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 14, alignItems: 'start' }}>
            {multi && <MoneyBars comparison={comparison} />}
            <Noticed noticed={noticed} cross={cross} isPro={isPro} onUpgrade={onUpgrade} multi={multi} />
          </div>

          {multi && (
            <div>
              <Comparison comparison={comparison} extras={extras} />
            </div>
          )}

          {multi && (isPro
            ? (shift && <div><ShareShift shift={shift} /></div>)
            : <div><HistoryTeaser hiddenTipCount={hiddenTipCount} onUpgrade={onUpgrade} /></div>
          )}

          <Glass>
            <Label style={{ marginBottom: 14 }}>⚡ Your next best move</Label>
            <NextBestMove comparison={comparison} efficiency={efficiency} timeIntel={timeIntel} onOpenPlanner={onOpenPlanner} />
          </Glass>

          <DataCoverage coverage={coverage} />
        </>
      )}
    </div>
  )
}
