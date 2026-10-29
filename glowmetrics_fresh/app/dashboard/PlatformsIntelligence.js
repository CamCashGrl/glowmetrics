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
  buildPlatformMonthlyHistory,
  buildNewFans,
  buildPlatformActivity,
  buildSinceLastVisit,
  formatHour,
} from '../../lib/platformIntelligenceAnalytics'
import { computeDataVaultStats } from './DashboardPreview'

// CamCash Platforms visual system. Colour jobs: teal = money / live /
// positive revenue; cyan = information; violet/purple = intelligence,
// premium, selected; pink = rare emphasis (Pro insight, special finding).
// Neon appears as light in the environment, never as card fills.
const CTA_GRADIENT = 'linear-gradient(90deg, #22E6D1 0%, #8B5CF6 52%, #FF3D9A 100%)'
const CTA_GLOW = '0 0 24px rgba(139,92,246,0.22), 0 0 18px rgba(34,230,209,0.12)'

const C = {
  bg: "#070914", card: "#0D1020", card2: "#12152A", border: "rgba(255,255,255,0.07)", border2: "rgba(255,255,255,0.10)",
  white: "#F7F8FC", text: "#A8B0C3", muted: "#727D96", cell: "#CBD2DF",
  cyan: "#23C7FF", teal: "#22E6D1", blue: "#23C7FF",
  indigo: "#8B5CF6", purple: "#A855F7", pink: "#FF3D9A",
  green: "#32E6A1", red: "#FF5C7C",
}

const PLATFORM_ACCENT = {
  chaturbate: C.purple, bongacams: C.pink, myfreecams: C.teal,
  camsoda: C.cyan, stripchat: C.indigo, flirt4free: C.pink,
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
        {note ? <span style={{ fontSize: 12, color: C.muted }}>{note}</span> : null}
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
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: C.pink, background: `${C.pink}14`, border: `1px solid ${C.pink}40`, borderRadius: 6, padding: '2px 7px', marginLeft: 8, verticalAlign: 'middle' }}>PRO</span>
}

function LockedRow({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', border: `1px dashed ${C.teal}44`, borderRadius: 8, background: `${C.teal}0a` }}>
      <span style={{ fontSize: 12, color: C.text }}>{text}</span>
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
      {trend.label === 'Inactive' ? '–' : up ? '↑' : down ? '↓' : '→'} {trend.pct > 0 ? '+' : ''}{Math.round(trend.pct)}%
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
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0' }}>
          <span style={{ color: C.cyan, fontSize: 12 }}>→</span>
          <span style={{ fontSize: 14, color: C.white, lineHeight: 1.5 }}>{m}</span>
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
              fontSize: 12, padding: '3px 9px', borderRadius: 6,
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
          { label: 'Earnings', value: fmt$0(snap.earnings), color: C.teal },
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
              <FactRow label="Timing gap" accent={C.teal}
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
  leading: { label: 'Leading right now', color: C.indigo },
  latest: { label: 'Latest stream', color: C.teal },
  gaining: { label: '↑ Gaining', color: C.green },
  cooling: { label: '↓ Cooling', color: C.blue },
  learning: { label: 'Still learning', color: C.muted },
  fresh: { label: '● New since last visit', color: C.green },
}
const BADGE_HELP = {
  leading: 'Highest earnings of your platforms in the analysed period',
  latest: 'Your most recent stream (30+ min, 2+ tips) was here',
  gaining: 'Last 30 days earned more than the 30 days before',
  cooling: 'Last 30 days earned less than the 30 days before',
  learning: 'Fewer than 3 meaningful sessions or 3 streamed hours on this platform',
  fresh: 'Tips arrived on this platform after your previous visit to this page',
}

function Badge({ kind }) {
  const b = BADGES[kind]
  if (!b) return null
  return (
    <span className="pl-badge" title={BADGE_HELP[kind]} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.035)', padding: '4px 10px',
      fontSize: 9, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.text, whiteSpace: 'nowrap',
    }}>{b.label}</span>
  )
}

// The one canonical glass surface. Thin low-opacity border, inset top
// highlight, soft drop shadow. `accent` is for the selected state only;
// `glow` adds ambient light.
const GLASS_BG = 'linear-gradient(145deg, rgba(18,21,42,0.80), rgba(8,10,22,0.90))'
const GLASS_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.045), 0 18px 50px rgba(0,0,0,0.28)'
function Glass({ children, style, accent, glow, className, onClick, ...rest }) {
  return (
    <div className={`pl-glass${onClick ? ' pl-click' : ''}${className ? ` ${className}` : ''}`} onClick={onClick}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 20, padding: 24, minWidth: 0,
        border: `1px solid ${accent ? `${accent}55` : 'rgba(255,255,255,0.07)'}`,
        background: GLASS_BG, backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        boxShadow: accent ? `${GLASS_SHADOW}, 0 0 44px -16px ${accent}88` : GLASS_SHADOW,
        ...style,
      }} {...rest}>
      {glow && <span aria-hidden className="pl-drift" style={{ position: 'absolute', top: -110, right: -80, width: 300, height: 300, borderRadius: '50%', background: glow, opacity: 0.10, filter: 'blur(100px)', pointerEvents: 'none' }} />}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

function Label({ children, style }) {
  return <div style={{ fontSize: 18, fontWeight: 600, color: C.white, letterSpacing: '-0.02em', ...style }}>{children}</div>
}

const eyebrow = { fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, lineHeight: 1.2 }

function BrandButton({ children, onClick, style }) {
  return (
    <button type="button" onClick={onClick} className="pl-brand" style={{
      background: CTA_GRADIENT, border: 'none', borderRadius: 12, padding: '0 20px', minHeight: 44,
      fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: C.white, cursor: 'pointer', whiteSpace: 'nowrap',
      boxShadow: CTA_GLOW, ...style,
    }}>{children}</button>
  )
}

function UpgradeLink({ children, onUpgrade, source }) {
  return <BrandButton onClick={() => onUpgrade?.(source)} style={{ minHeight: 42, fontSize: 13.5 }}>{children} →</BrandButton>
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

function PlatformPulse({ comparison, snapshot, recap, learning, newFans }) {
  const leader = comparison[0]
  const multi = comparison.length > 1
  const accent = accentFor(leader.platform)
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 24, padding: '36px 40px',
      border: '1px solid rgba(167,139,250,0.14)',
      background: 'linear-gradient(145deg, rgba(18,21,42,0.92), rgba(7,9,20,0.96))',
      backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 28px 70px rgba(0,0,0,0.38)',
    }}>
      {/* Neon as light in the environment, not as fill */}
      <span aria-hidden className="pl-drift" style={{ position: 'absolute', left: -112, top: -128, width: 360, height: 360, borderRadius: '50%', background: 'rgba(34,211,238,0.14)', filter: 'blur(110px)', pointerEvents: 'none' }} />
      <span aria-hidden className="pl-drift pl-drift-b" style={{ position: 'absolute', right: 0, bottom: -128, width: 300, height: 300, borderRadius: '50%', background: 'rgba(217,70,239,0.10)', filter: 'blur(100px)', pointerEvents: 'none' }} />

      <div className="pl-hero-grid" style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 40, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="pl-live" style={{ width: 6, height: 6, borderRadius: 3, background: C.teal, boxShadow: `0 0 10px ${C.teal}` }} />
            <span style={eyebrow}>Platform pulse</span>
          </div>
          <div style={{ fontSize: 48, fontWeight: 600, color: C.white, letterSpacing: '-0.045em', lineHeight: 1.02, marginTop: 18 }}>
            {multi ? <>{leader.platform}<br /><span style={{ color: C.text }}>is leading</span></> : <>Everything on<br /><span style={{ color: C.text }}>{leader.platform}</span></>}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 44, flexWrap: 'wrap', marginTop: 32 }}>
            <div>
              <div style={{ fontSize: 42, fontWeight: 700, color: C.white, letterSpacing: '-0.045em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                <Counter value={snapshot.totalEarnings} />
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>earnings</div>
            </div>
            {multi && (
              <div>
                <div style={{ fontSize: 42, fontWeight: 700, color: C.white, letterSpacing: '-0.045em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {leader.earningsPercent}<span style={{ color: accent, textShadow: `0 0 18px ${accent}88` }}>%</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>revenue share</div>
              </div>
            )}
          </div>

          <div style={{ fontSize: 13, color: C.muted, marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{plural(snapshot.totalTips, 'tip')}</span><span>·</span>
            <span>{plural(snapshot.sessions, 'session')}</span><span>·</span>
            <span>{plural(comparison.length, 'platform')}</span>
            {newFans?.total > 0 && <><span>·</span><span style={{ color: C.teal }}>+{plural(newFans.total, 'new fan')} this week</span></>}
          </div>

          {learning.isLearning && (
            <div style={{ fontSize: 14, color: C.text, marginTop: 16, lineHeight: 1.6, maxWidth: 520 }}>
              <span style={{ color: C.white, fontWeight: 600 }}>CamCash is still learning your platforms.</span>{' '}
              {[
                learning.sessionsNeeded > 0 ? plural(learning.sessionsNeeded, 'more meaningful session') : null,
                learning.hoursNeeded > 0 ? `${learning.hoursNeeded} more streamed hours` : null,
              ].filter(Boolean).join(' and ')} will unlock early patterns.
            </div>
          )}
        </div>

        {/* Latest stream: an inner translucent pane, not another card */}
        <div style={{
          borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.035)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          {recap ? (
            <>
              <div style={eyebrow}>Latest stream</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: C.teal, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 14, fontVariantNumeric: 'tabular-nums' }}>
                +<Counter value={recap.earned} />
              </div>
              <div style={{ fontSize: 14, color: C.white, marginTop: 10 }}>{recap.platform}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{plural(recap.tips, 'tip')} · {plural(recap.fans, 'fan')}</div>
              {recap.tookLead && <div style={{ fontSize: 12, color: C.purple, marginTop: 10 }}>Moved into the lead</div>}
            </>
          ) : (
            <>
              <div style={eyebrow}>Since your last stream</div>
              <div style={{ fontSize: 14, color: C.white, marginTop: 10, lineHeight: 1.55 }}>
                Stream again and CamCash will start showing what changed between sessions.
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>A stream counts once it runs 30+ minutes with 2+ tips.</div>
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
  const items = [
    { value: fmtSigned$(recap.earned), label: 'earned', color: C.teal },
    recap.returningFans === null
      ? { value: 'First stream here', label: '', color: C.text }
      : { value: plural(recap.returningFans, 'returning fan'), label: '', color: C.white },
    recap.newSpenders === null ? null : { value: recap.newSpenders ? plural(recap.newSpenders, 'new spender') : 'No new spenders', label: '', color: recap.newSpenders ? C.white : C.text },
    multi && recap.shareShiftPts
      ? { value: `${recap.shareShiftPts > 0 ? '+' : ''}${recap.shareShiftPts} pts`, label: 'revenue share', color: recap.shareShiftPts > 0 ? C.green : C.text }
      : dur ? { value: `${dur >= 60 ? `${Math.floor(dur / 60)}h ` : ''}${dur % 60}m`, label: 'streamed', color: C.white } : null,
  ].filter(Boolean)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 32px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.025)', padding: '16px 20px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: C.white }}>
        <span className="pl-live" style={{ width: 6, height: 6, borderRadius: 3, background: C.teal, boxShadow: `0 0 10px ${C.teal}` }} />
        Since your last stream
        <span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}>{streamWhen(recap.endTime, tz)}</span>
      </span>
      {items.map((it, i) => (
        <span key={i} style={{ fontSize: 14, color: it.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {it.value}{it.label && <span style={{ fontWeight: 400, color: C.muted }}> {it.label}</span>}
        </span>
      ))}
    </div>
  )
}

// ============================================
// 3 · PLATFORM CARDS
// ============================================

function PlatformCard({ row, extras, badges, selected, onSelect, leading }) {
  const accent = accentFor(row.platform)
  const mounted = useMounted()
  const fresh = badges.includes('fresh')
  const shownBadges = badges.filter(b => b !== 'fresh').slice(0, 1)
  return (
    <Glass accent={selected ? accent : undefined} onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      aria-pressed={selected} style={{
        background: leading
          ? `radial-gradient(circle at 0% 0%, ${accent}1a, transparent 55%), linear-gradient(150deg, rgba(17,20,40,0.76), rgba(8,10,22,0.88))`
          : 'linear-gradient(150deg, rgba(17,20,40,0.76), rgba(8,10,22,0.88))',
        ...(selected ? {} : { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 44px rgba(0,0,0,0.24)' }),
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: accent, boxShadow: `0 0 12px ${accent}b3`, flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: C.white, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.platform}</span>
          {fresh && <span title={BADGE_HELP.fresh} className="pl-live" style={{ width: 5, height: 5, borderRadius: 3, background: C.teal, boxShadow: `0 0 8px ${C.teal}`, flexShrink: 0 }} />}
        </div>
        <span style={{ fontSize: 12, color: selected ? accent : C.muted, whiteSpace: 'nowrap' }}>{selected ? 'Viewing ↓' : 'Details →'}</span>
      </div>
      <div style={{ minHeight: 22, marginTop: 14 }}>{shownBadges.map(b => <Badge key={b} kind={b} />)}</div>

      <div style={{ fontSize: 36, fontWeight: 700, color: C.white, marginTop: 18, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        <Counter value={row.earnings} />
      </div>
      <div style={{ fontSize: 13, color: C.text, marginTop: 8 }}>{row.earningsPercent}% of earnings</div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 18 }}>
        <div style={{ width: mounted ? `${row.earningsPercent}%` : 0, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${accent}99, ${accent})`, boxShadow: `0 0 12px ${accent}66`, transition: 'width 900ms cubic-bezier(.2,.8,.2,1)' }} />
      </div>

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 18, fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
        <span><span style={{ color: C.text }}>{fmtN(row.tips)}</span> tips</span>
        <span><span style={{ color: C.text }}>{fmtN(extras?.uniqueFans ?? 0)}</span> fans</span>
        <span><span style={{ color: C.text }}>{row.avgTipSize > 0 ? fmt$(row.avgTipSize) : '—'}</span> avg</span>
      </div>
      <div style={{ marginTop: 12, fontSize: 13, color: C.muted, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>30-day momentum</span>
        <TrendCell trend={row.trend} />
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
          <span key={p} style={{ fontSize: 12, color: C.text, border: `1px solid ${C.border}`, borderRadius: 999, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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

// Lightweight, platform-only activity feed. Every item is a dated event from
// buildPlatformActivity; nothing is shown when nothing happened.
function ActivityFeed({ items }) {
  if (!items.length) return null
  const shown = items.slice(0, 6)
  const chip = (it, i, dup) => (
    <span key={`${dup}${i}`} title={it.sub} aria-hidden={dup ? true : undefined} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.025)', padding: '6px 12px',
      fontSize: 12, color: C.text, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 3, background: accentFor(it.platform), boxShadow: `0 0 8px ${accentFor(it.platform)}`, flexShrink: 0 }} />
      <span style={{ color: C.white }}>{it.text}</span>
      <span style={{ color: C.muted }}>{it.sub}</span>
    </span>
  )
  const scrolls = shown.length >= 3
  const mask = scrolls ? 'linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)' : undefined
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
      <span style={{ ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span className="pl-live" style={{ width: 5, height: 5, borderRadius: 3, background: C.cyan, boxShadow: `0 0 8px ${C.cyan}` }} />Just updated
      </span>
      <div className="pl-ticker" style={{ flex: 1, minWidth: 0, overflow: 'hidden', WebkitMaskImage: mask, maskImage: mask }}>
        <div className={scrolls ? 'pl-marquee' : undefined} style={{ display: 'flex', gap: 8, width: scrolls ? 'max-content' : undefined, flexWrap: scrolls ? 'nowrap' : 'wrap' }}>
          {shown.map((it, i) => chip(it, i, ''))}
          {scrolls && shown.map((it, i) => chip(it, i, 'd'))}
        </div>
      </div>
    </div>
  )
}

// Free: the side-by-side comparison is Pro. The anchor column (primary
// platform, else the top earner) shows its real figures; the rest are locked.
function ComparisonTeaser({ comparison, anchor, onUpgrade }) {
  const a = comparison.find(p => p.platform === anchor) || comparison[0]
  const others = comparison.filter(p => p.platform !== a.platform)
  return (
    <Glass>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <Label>Cross-platform comparison <ProTag /></Label>
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 15 }}>
              <span style={{ color: C.white, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><PlatformCell platform={a.platform} /></span>
              <span style={{ color: C.white, fontWeight: 800, whiteSpace: 'nowrap' }}>{fmt$(a.earnings)}{a.usdPerHour > 0 && a.rateHours > 0 ? <span style={{ color: C.text, fontWeight: 600 }}> · {fmt$(a.usdPerHour)}/hr</span> : null}</span>
            </div>
            {others.map(p => (
              <div key={p.platform} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 15 }}>
                <span style={{ color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><PlatformCell platform={p.platform} /></span>
                <span style={{ color: C.teal, fontWeight: 800, fontSize: 12, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>PRO</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
            See which platform earns you more per hour, attracts higher-value fans, and is gaining momentum, side by side.
          </div>
          <div style={{ marginTop: 14 }}><UpgradeLink onUpgrade={onUpgrade} source="platforms_comparison">Unlock platform comparison</UpgradeLink></div>
        </div>
      </div>
    </Glass>
  )
}

// Pro, 2+ months: how the platform split moved month by month.
function MonthlyHistory({ months, platforms }) {
  const mounted = useMounted()
  const fmtMonth = (m) => { const [y, mo] = m.split('-'); return new Date(Date.UTC(+y, +mo - 1, 15)).toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }) }
  const shown = months.slice(-12)
  return (
    <Glass>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <Label>Platform history <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>· revenue split by month</span></Label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {platforms.map(p => <span key={p} style={{ fontSize: 12, color: C.text }}><PlatformCell platform={p} /></span>)}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 9 }}>
        {shown.map(m => (
          <div key={m.month} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 92px', gap: 12, alignItems: 'center', fontSize: 13 }}>
            <span style={{ color: C.text }}>{fmtMonth(m.month)}</span>
            <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
              {[...m.platforms].sort((x, y) => platforms.indexOf(x.platform) - platforms.indexOf(y.platform)).map(p => (
                <div key={p.platform} title={`${p.platform}: ${fmt$(p.usd)} (${p.pct}%)`} style={{ width: mounted ? `${p.pct}%` : 0, background: accentFor(p.platform), transition: 'width 900ms cubic-bezier(.2,.8,.2,1)' }} />
              ))}
            </div>
            <span style={{ color: C.white, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt$0(m.total)}</span>
          </div>
        ))}
      </div>
    </Glass>
  )
}

// ============================================
// 4 · WHERE YOUR MONEY COMES FROM
// ============================================

function MoneyBars({ comparison }) {
  const mounted = useMounted()
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...eyebrow, marginBottom: 20 }}>Where your money comes from</div>
      <div style={{ display: 'grid', gap: 20 }}>
        {comparison.map(p => {
          const accent = accentFor(p.platform)
          return (
            <div key={p.platform}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto 48px', gap: 16, alignItems: 'baseline', marginBottom: 9, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: 14, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.platform}</span>
                <span style={{ fontSize: 13, color: C.muted }}>{fmt$(p.earnings)}</span>
                <span style={{ fontSize: 14, color: C.white, fontWeight: 600, textAlign: 'right' }}>{p.earningsPercent}%</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: mounted ? `${Math.max(p.earningsPercent, p.earnings > 0 ? 1 : 0)}%` : 0, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${accent}99, ${accent})`, boxShadow: `0 0 12px ${accent}66`, transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Revenue split + CamCash Noticed: one intelligence surface.
function IntelligenceArea({ comparison, multi, noticedProps }) {
  return (
    <Glass style={{ padding: 28 }}>
      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: multi ? 'minmax(0,0.9fr) minmax(0,1.1fr)' : '1fr', gap: 44, alignItems: 'start' }}>
        {multi && <MoneyBars comparison={comparison} />}
        <Noticed {...noticedProps} />
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
  const [lead, ...rest] = shown
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', minWidth: 0, borderRadius: 20, padding: 24,
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(150deg, rgba(139,92,246,0.09), rgba(34,230,209,0.035), rgba(255,61,154,0.055))',
    }}>
      <span aria-hidden className="pl-drift" style={{ position: 'absolute', right: -60, top: -70, width: 220, height: 220, borderRadius: '50%', background: 'rgba(139,92,246,0.22)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ ...eyebrow, color: C.text, marginBottom: 16 }}><span style={{ color: C.purple }}>✦</span> CamCash noticed</div>
        {shown.length === 0 && freeTeasers.length === 0 ? (
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
            {multi
              ? 'Nothing stands out between your platforms yet. Findings appear here when the gap is big enough to be real.'
              : 'Findings appear here once a pattern in your data is strong enough to call out.'}
          </div>
        ) : (
          <>
            {lead && <div className="pl-chip" style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.65, color: C.white }}>{lead}</div>}
            {rest.slice(0, 3).map((t, i) => (
              <div key={i} className="pl-chip" style={{ animationDelay: `${(i + 1) * 70}ms`, marginTop: 12, fontSize: 13, lineHeight: 1.85, color: C.text }}>{t}</div>
            ))}
            {freeTeasers.slice(0, 2).map((c, i) => (
              <div key={c.id} style={{ marginTop: lead || i ? 18 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', color: C.pink }}>✦ PRO INSIGHT</span>
                  <span aria-hidden style={{ fontSize: 12, color: C.text, filter: 'blur(4px)', userSelect: 'none' }}>██████████ · ██%</span>
                </div>
                <div style={{ fontSize: 14, color: C.white, marginTop: 6, lineHeight: 1.55 }}>{c.teaser}</div>
                <button type="button" onClick={() => onUpgrade?.(`platforms_insight_${c.id}`)} style={{ marginTop: 6, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.pink }}>
                  {c.cta} →
                </button>
              </div>
            ))}
            {freeTeasers.length > 2 && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>+ {plural(freeTeasers.length - 2, 'more finding')} already found in your data</div>
            )}
          </>
        )}
      </div>
    </div>
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
              <th style={{ textAlign: 'left', padding: '20px 24px 14px', ...eyebrow }}>Platform comparison</th>
              {comparison.map(p => (
                <th key={p.platform} style={{ textAlign: 'right', padding: '20px 24px 14px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                <tr key={r.label} style={{ borderTop: '1px solid rgba(255,255,255,0.045)' }}>
                  <td style={{ padding: '11px 24px', fontSize: 13, color: C.text, whiteSpace: 'nowrap' }}>
                    {r.label}{r.note && <span style={{ color: C.muted, fontSize: 12, marginLeft: 6 }}>{r.note}</span>}
                  </td>
                  {comparison.map((p, i) => {
                    const v = vals[i]
                    const isBest = best !== null && v === best && v > 0
                    return (
                      <td key={p.platform} style={{ padding: '11px 24px', fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap', color: isBest ? C.white : C.cell, fontWeight: isBest ? 600 : 400 }}>
                        {r.render ? r.render(p) : v === null ? <span style={{ color: C.muted }}>—</span> : r.fmt(v)}
                        {isBest && !r.render && <span title="Best of your platforms" style={{ display: 'inline-block', width: 4, height: 4, borderRadius: 2, background: C.pink, marginLeft: 7, verticalAlign: 'middle', boxShadow: `0 0 6px ${C.pink}` }} />}
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

// Free: one consolidated, personal "what's already waiting" panel. Each line
// is a real count from this account; lines without data are left out, and
// the panel is hidden when nothing is waiting. No timers, no fake scarcity.
function UnlockPanel({ findings, platforms, hiddenTipCount, supporters, hasPlatformTiming, onUpgrade }) {
  const items = [
    findings > 0 && { text: `${plural(findings, 'cross-platform finding')} already found in your data` },
    platforms > 1 && { text: `Side-by-side comparison of your ${platforms} platforms: $/hr, fan value and momentum` },
    hiddenTipCount > 0 && { text: `${fmtN(hiddenTipCount)} older tips saved, with month-by-month platform history` },
    supporters > 3 && { text: `All ${fmtN(supporters)} supporters ranked on every platform` },
    hasPlatformTiming && { text: 'Best hour and day for each platform' },
  ].filter(Boolean)
  if (items.length === 0) return null
  return (
    <div style={{ borderRadius: 20, padding: 28, position: 'relative', overflow: 'hidden', border: '1px solid rgba(167,139,250,0.14)', background: GLASS_BG, boxShadow: GLASS_SHADOW }}>
      <div aria-hidden style={{ position: 'absolute', left: -80, bottom: -110, width: 280, height: 280, borderRadius: '50%', background: 'rgba(139,92,246,0.14)', filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 380px', minWidth: 0 }}>
          <div style={{ ...eyebrow, marginBottom: 12 }}>Your full picture</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: C.white, letterSpacing: '-0.025em' }}>It&apos;s already in your account</div>
          <div style={{ fontSize: 13.5, color: C.text, marginTop: 6, lineHeight: 1.55 }}>
            Everything below comes from data you&apos;ve already imported. It&apos;s all there when you upgrade, with no re-upload needed.
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            {items.map((it, i) => (
              <div key={i} className="pl-chip" style={{ animationDelay: `${i * 60}ms`, display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 14, color: C.text, lineHeight: 1.6 }}>
                <span style={{ width: 5, height: 5, borderRadius: 3, flexShrink: 0, marginTop: 8, background: C.purple, boxShadow: `0 0 8px ${C.purple}` }} />
                <span style={{ minWidth: 0 }}>{it.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: '0 1 auto' }}>
          <BrandButton onClick={() => onUpgrade?.('platforms_full_picture')} style={{ minHeight: 48, padding: '0 26px', fontSize: 15 }}>
            Unlock my full picture →
          </BrandButton>
        </div>
      </div>
    </div>
  )
}

// The viewer's previous visit, from their own browser. First paint is null
// (matches the server); the stored time is read after mount and replaced
// with now, so the next visit compares against this one.
const LAST_VISIT_KEY = 'cc_platforms_last_visit'
function usePreviousVisit() {
  const [prev, setPrev] = useState(null)
  const done = useRef(false)
  useEffect(() => {
    // Read-then-write exactly once per mount, even when React re-runs effects
    // (Strict Mode), or the second run would read back our own timestamp.
    if (done.current) return
    done.current = true
    try {
      const stored = Number(window.localStorage.getItem(LAST_VISIT_KEY))
      if (Number.isFinite(stored) && stored > 0) setPrev(stored)
      window.localStorage.setItem(LAST_VISIT_KEY, String(Date.now()))
    } catch { /* storage unavailable: no comparison, page still renders */ }
  }, [])
  return prev
}

function SinceLastVisit({ visit, tz }) {
  if (!visit) return null
  const when = streamWhen(new Date(visit.since).toISOString(), tz)
  if (visit.tips === 0) {
    return (
      <div style={{ fontSize: 13, color: C.muted }}>
        Nothing new since your last visit ({when}). New tips show up here after your next stream or import.
      </div>
    )
  }
  return (
    <div className="pl-chip" style={{ borderRadius: 16, padding: '14px 20px', border: '1px solid rgba(34,230,209,0.12)', background: 'linear-gradient(90deg, rgba(34,230,209,0.06), rgba(255,255,255,0.02) 55%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span className="pl-live" style={{ width: 6, height: 6, borderRadius: 3, background: C.teal, boxShadow: `0 0 10px ${C.teal}` }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>Since your last visit</span>
        <span style={{ fontSize: 22, fontWeight: 600, color: C.teal, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}>+<Counter value={visit.totalUSD} /></span>
        <span style={{ fontSize: 13, color: C.text }}>
          {plural(visit.tips, 'tip')}{visit.newFans ? ` · ${plural(visit.newFans, 'new fan')}` : ''}
          {visit.platforms.length > 1 ? ` · ${visit.platforms.map(p => `${p.platform} +${fmt$(p.usd)}`).join(' · ')}` : ` on ${visit.platforms[0].platform}`}
        </span>
        <span style={{ fontSize: 12, color: C.muted, marginLeft: 'auto' }}>since {when}</span>
      </div>
    </div>
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
            <span style={{ fontSize: 12, color: C.text, marginLeft: 6 }}>{n === 1 ? one : `${one}s`} {verb}</span>
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
            {extras?.biggestTip > 0 && <span style={{ fontSize: 12, color: C.text, whiteSpace: 'nowrap' }}>· biggest tip {fmt$(extras.biggestTip)} · {plural(extras.uniqueFans, 'fan')}</span>}
          </div>
          {onNavigate && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {links.map(([tab, label]) => (
                <button key={tab} type="button" onClick={() => onNavigate(tab)} style={{ fontSize: 13, fontWeight: 600, color: C.white, background: 'rgba(18,21,42,0.9)', border: '1px solid rgba(139,92,246,0.30)', borderRadius: 12, padding: '0 14px', minHeight: 36, cursor: 'pointer' }}>
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
  const history = useMemo(() => (isPro ? buildPlatformMonthlyHistory(analytics, tz) : null), [analytics, isPro, tz])
  const newFans = useMemo(() => buildNewFans(analytics), [analytics])
  const activity = useMemo(() => buildPlatformActivity(analytics, { recap }), [analytics, recap])
  const previousVisit = usePreviousVisit()
  const visit = useMemo(() => buildSinceLastVisit(analytics, previousVisit), [analytics, previousVisit])
  const freshPlatforms = useMemo(() => new Set((visit?.platforms || []).filter(p => p.usd > 0).map(p => p.platform)), [visit])

  const names = comparison.map(p => p.platform)
  const active = names.includes(selectedPlatform) ? selectedPlatform : null
  const multi = comparison.length > 1
  const onImport = onNavigate ? () => onNavigate('upload') : null

  const select = (p) => {
    setSelectedPlatform(prev => (prev === p ? null : p))
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }))
  }

  return (
    <div className="pl-root" style={{ maxWidth: 1280, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`
        .pl-root { max-width: 100%; }
        .pl-root section, .pl-root .pi-two-col > *, .pl-root .pl-grid > * { min-width: 0; }
        .pl-root table { font-variant-numeric: tabular-nums; }
        .pl-click { cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
        .pl-brand:hover { transform: translateY(-1px); box-shadow: 0 0 34px rgba(34,230,209,0.40), 0 0 40px rgba(255,61,154,0.34) !important; }
        .pl-brand { transition: transform .15s, box-shadow .15s; }
        .pl-click:hover { transform: translateY(-2px); border-color: rgba(167,139,250,0.26) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,0.055), 0 24px 60px rgba(0,0,0,0.34) !important; }
        .pl-click:focus-visible { outline: 2px solid ${C.pink}; outline-offset: 2px; }
        @keyframes plGlow { 0% { text-shadow: 0 0 0 transparent; } 30% { text-shadow: 0 0 18px rgba(255,61,154,0.75); } 100% { text-shadow: 0 0 0 transparent; } }
        .pl-glow { animation: plGlow 1.4s ease-out; }
        @keyframes plIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .pl-chip, .pl-badge { animation: plIn .45s ease-out both; }
        @keyframes plDot { 0%,100% { box-shadow: 0 0 0 0 rgba(34,230,209,0.6); } 50% { box-shadow: 0 0 0 4px rgba(34,230,209,0); } }
        .pl-dot { animation: plDot 2.4s ease-in-out 3; }
        /* Alive, never frantic: slow flowing neon borders, drifting light,
           a live pulse, a moving activity ticker. All off for reduced motion. */
        @keyframes plDrift { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(50px, 24px) scale(1.12); } }
        .pl-drift { animation: plDrift 14s ease-in-out infinite; }
        .pl-drift-b { animation-duration: 18s; animation-direction: reverse; }
        @keyframes plLive { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .45; transform: scale(.75); } }
        .pl-live { animation: plLive 1.8s ease-in-out infinite; }
        @keyframes plMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .pl-marquee { animation: plMarquee 38s linear infinite; }
        .pl-ticker:hover .pl-marquee { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .pl-neon, .pl-bar, .pl-gradtext, .pl-drift, .pl-live, .pl-marquee { animation: none !important; }
          .pl-glow, .pl-chip, .pl-badge, .pl-dot { animation: none !important; }
          .pl-click, .pl-click:hover, .pl-brand, .pl-brand:hover { transition: none; transform: none; }
        }
        @media (max-width: 900px) {
          .pl-root .pl-hero-grid { grid-template-columns: 1fr !important; }
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
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 600, color: C.white, letterSpacing: '-0.03em', lineHeight: 1.1 }}>Platforms</h1>
          <div style={{ fontSize: 14, lineHeight: '24px', color: C.muted, marginTop: 6 }}>
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
          <SinceLastVisit visit={visit} tz={tz} />
          <PlatformPulse comparison={comparison} snapshot={snapshot} recap={recap} learning={learning} newFans={newFans} />
          {!isPro && multi && (
            <div style={{ fontSize: 13, color: C.text, marginTop: -8, lineHeight: 1.55 }}>
              {fullHistoryPlatform && names.includes(fullHistoryPlatform)
                ? <>Free plan: <strong style={{ color: C.white }}>{fullHistoryPlatform}</strong> (your primary) includes its full history; other platforms show their latest 31 days, so shares compare different spans.</>
                : <>Free plan: each platform shows its latest 31 days of activity.</>}
            </div>
          )}
          <LatestStream recap={recap} tz={tz} multi={multi} />
          <ActivityFeed items={activity} />

          <div className="pl-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            {comparison.map(row => (
              <PlatformCard key={row.platform} row={row} extras={extras[row.platform]} badges={freshPlatforms.has(row.platform) ? ['fresh', ...(statuses[row.platform] || [])] : (statuses[row.platform] || [])}
                selected={active === row.platform} onSelect={() => select(row.platform)} leading={multi && row.platform === comparison[0].platform} />
            ))}
            {!multi && <ExpansionCard onImport={onImport} />}
          </div>

          {active && (
            <div>
              <PlatformDetail analytics={analytics} platformName={active} isPro={isPro} extras={extras[active]} onNavigate={onNavigate} detailRef={detailRef} />
            </div>
          )}

          <IntelligenceArea comparison={comparison} multi={multi}
            noticedProps={{ noticed, cross, isPro, onUpgrade, multi }} />

          {multi && (
            <div>
              {isPro
                ? <Comparison comparison={comparison} extras={extras} />
                : <ComparisonTeaser comparison={comparison} anchor={fullHistoryPlatform} onUpgrade={onUpgrade} />}
            </div>
          )}

          {isPro && multi && shift && <div><ShareShift shift={shift} /></div>}
          {isPro && history && <div><MonthlyHistory months={history} platforms={names} /></div>}
          {!isPro && (
            <UnlockPanel
              findings={cross.length}
              platforms={comparison.length}
              hiddenTipCount={hiddenTipCount}
              supporters={analytics.uniqueFanCount || 0}
              hasPlatformTiming={Object.values(analytics.platformBestTimes || {}).some(t => t?.hour || t?.bestDay)}
              onUpgrade={onUpgrade}
            />
          )}

          <Glass>
            <div style={{ ...eyebrow, marginBottom: 14 }}>Where to focus</div>
            <NextBestMove comparison={comparison} efficiency={efficiency} timeIntel={timeIntel} onOpenPlanner={onOpenPlanner} />
          </Glass>

          <DataCoverage coverage={coverage} />
        </>
      )}
    </div>
  )
}
