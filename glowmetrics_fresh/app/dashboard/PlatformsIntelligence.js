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
  buildDailySeries,
  formatHour,
} from '../../lib/platformIntelligenceAnalytics'
import { computeDataVaultStats } from './DashboardPreview'

// CamCash Platforms visual system. Colour jobs: teal = money / live /
// positive revenue; cyan = information; violet/purple = intelligence,
// premium, selected; pink = rare emphasis (Pro insight, special finding).
// Neon appears as light in the environment, never as card fills.
const CTA_GRADIENT = 'linear-gradient(90deg, #16F4FF 0%, #7C5CFF 48%, #FF2BAE 100%)'
const CTA_GLOW = '0 0 24px rgba(22,244,255,0.28), 0 0 34px rgba(255,43,174,0.26), 0 14px 34px rgba(0,0,0,0.45)'

const C = {
  bg: "#050713", card: "#0D1126", card2: "#10142A", border: "rgba(255,255,255,0.07)", border2: "rgba(255,255,255,0.10)",
  white: "#FFFFFF", text: "#D7D9EA", muted: "#8D93AA", cell: "#D7D9EA",
  cyan: "#48E9FF", teal: "#16F4FF", blue: "#48E9FF",
  indigo: "#7C5CFF", purple: "#D83DFF", pink: "#FF2BAE",
  green: "#32E6A1", red: "#FF5C7C",
}

const PLATFORM_ACCENT = {
  chaturbate: C.teal, bongacams: C.pink, myfreecams: C.indigo,
  camsoda: C.cyan, stripchat: C.indigo, flirt4free: C.pink,
}
export const accentFor = (p) => PLATFORM_ACCENT[(p || '').toLowerCase().trim()] || C.cyan

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
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {it.label}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: it.color || C.white, marginTop: 2, lineHeight: 1.2 }}>
            {it.value}
          </div>
          {it.sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{it.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// Dense table. Scrolls inside its own container on narrow screens.
function DataTable({ columns, rows }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.045)', borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 420 }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{
                textAlign: c.align || 'right', padding: '8px 12px', background: C.card2,
                color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
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
      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted }}>{label}</div>
      <div style={{ fontSize: 13, color: C.white, fontWeight: 700, marginTop: 2 }}>{facts}</div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ padding: '12px 14px', fontSize: 12, color: C.muted, border: `1px dashed ${C.border2}`, borderRadius: 10 }}>{children}</div>
}

function ProTag() {
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: C.pink, background: `${C.pink}14`, border: `1px solid ${C.pink}40`, borderRadius: 6, padding: '2px 7px', marginLeft: 8, verticalAlign: 'middle' }}>PRO</span>
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
    <span
      className="pl-badge"
      title={BADGE_HELP[kind]}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.045)',
        background: 'rgba(255,255,255,0.025)',
        padding: '4px 9px',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: C.text,
        whiteSpace: 'nowrap',
      }}
    >
      {b.label}
    </span>
  )
}

// The one canonical glass surface. Thin low-opacity border, inset top
// highlight, soft drop shadow. `accent` is for the selected state only;
// `glow` adds ambient light.
const GLASS_BG = 'linear-gradient(145deg, rgba(16,20,42,0.78), rgba(8,11,26,0.90))'
const GLASS_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.045), 0 22px 56px rgba(0,0,0,0.30)'

function Glass({ children, style, accent, glow, className, onClick, ...rest }) {
  return (
    <div
      className={`pl-glass${onClick ? ' pl-click' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20,
        padding: 24,
        minWidth: 0,
        border: `1px solid ${accent ? `${accent}cc` : 'rgba(255,255,255,0.09)'}`,
        background: GLASS_BG,
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        boxShadow: accent
          ? `${GLASS_SHADOW}, 0 0 46px -14px ${accent}88`
          : GLASS_SHADOW,
        ...style,
      }}
      {...rest}
    >
      {glow && (
        <span
          aria-hidden
          className="pl-drift"
          style={{
            position: 'absolute',
            top: -120,
            right: -90,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: glow,
            opacity: 0.09,
            filter: 'blur(110px)',
            pointerEvents: 'none',
          }}
        />
      )}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

function Label({ children, style }) {
  return <div style={{ fontSize: 18, fontWeight: 700, color: C.white, letterSpacing: '-0.02em', ...style }}>{children}</div>
}

const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, lineHeight: 1.2 }

function BrandButton({ children, onClick, style }) {
  return (
    <button type="button" onClick={onClick} className="pl-brand" style={{
      background: CTA_GRADIENT, border: 'none', borderRadius: 18, padding: '0 22px', minHeight: 46,
      fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', color: C.white, cursor: 'pointer', whiteSpace: 'nowrap',
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
// GLOW CHART — real daily earnings as a lit line
// ============================================

// Smooth path through points (monotone-ish Catmull-Rom -> cubic Bezier).
function smoothPath(pts) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x},${Math.max(0, c1y)} ${c2x},${Math.max(0, c2y)} ${p2[0]},${p2[1]}`
  }
  return d
}


// Line icons (no emoji). Decorative only: every one is paired with text.
const ICONS = {
  dollar: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 6.5v11', 'M14.8 9.3c-.4-.9-1.4-1.5-2.8-1.5-1.5 0-2.7.8-2.7 2 0 2.9 5.6 1.2 5.6 4.2 0 1.2-1.2 2-2.9 2-1.4 0-2.5-.6-2.9-1.6'],
  users: ['M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-3A3.5 3.5 0 0 0 6 17.5V19', 'M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19 19v-1a3 3 0 0 0-2.2-2.9', 'M15.8 5.2a3 3 0 0 1 0 5.6'],
  sparkle: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 16v4', 'M17 18h4'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  trend: ['M4 16l5-5 3 3 7-8', 'M15 6h4v4'],
  repeat: ['M17 3l3 3-3 3', 'M4 11V9a3 3 0 0 1 3-3h13', 'M7 21l-3-3 3-3', 'M20 13v2a3 3 0 0 1-3 3H4'],
  pie: ['M12 3a9 9 0 1 0 9 9h-9z', 'M15 3.5A9 9 0 0 1 20.5 9H15z'],
  bars: ['M5 20v-8', 'M12 20V5', 'M19 20v-5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  lock: ['M5 11h14v9H5z', 'M8 11V8a4 4 0 0 1 8 0v3', 'M12 15v2'],
  folder: ['M3 7h6l2 2h10v10H3z'],
  play: ['M8 5l11 7-11 7z'],
  heart: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
  video: ['M3 7h12v10H3z', 'M15 11l6-3v8l-6-3'],
  check: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M8 12.5l3 3 5-6'],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M9 20h6'],
  crown: ['M4 18h16l1-10-5 4-4-6-4 6-5-4z'],
}
export function Ico({ name, size = 16, color = 'currentColor', style }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
      {(ICONS[name] || []).map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

// Platform initials, the same short codes Live mode uses (CB / BC / MFC).
const PLATFORM_MARK = { chaturbate: 'CB', myfreecams: 'MFC', bongacams: 'BC' }
const markFor = (p) => PLATFORM_MARK[(p || '').toLowerCase().trim()] || String(p || '?').slice(0, 2).toUpperCase()
export function PlatformMark({ platform, size = 30 }) {
  const a = accentFor(platform)
  const m = markFor(platform)
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: `${a}1f`, color: a, fontSize: m.length > 2 ? 10 : 11.5, fontWeight: 700, letterSpacing: '0.02em',
      boxShadow: `inset 0 0 0 1px ${a}33`,
    }}>{m}</span>
  )
}

// `daily.days` keys are already creator-local dates (YYYY-MM-DD); format them
// as UTC-noon so the label can never slip a day.
const dayLabel = (key) => {
  const [y, m, d] = String(key).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
// Round chart top: 1, 2, 4, 8 or 10 x a power of ten, so quarter ticks are clean.
const niceTop = (m) => {
  const e = Math.pow(10, Math.floor(Math.log10(m)))
  const f = m / e
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 8 ? 8 : 10) * e
}
const axisMoney = (v) => (v >= 10000 ? `$${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : fmt$0(v))

let chartUid = 0
function GlowChart({ values, color = C.teal, height = 180, strokeWidth = 2.5, pulse = true, fill = true, dates = null }) {
  const [id] = useState(() => `plg${++chartUid}`)
  const [hover, setHover] = useState(null)
  const axes = Array.isArray(dates) && dates.length === values.length
  const W = 600, H = height, pad = 6
  const n = values.length
  const peak = Math.max(...values, 0.01)
  // With axes, scale to a round top so the $ ticks read cleanly. This only
  // sets the vertical scale; every plotted value is the real daily total.
  const max = axes ? niceTop(peak) : peak
  const xAt = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W)
  const yAt = (v) => H - pad - (v / max) * (H - pad * 2)
  const pts = values.map((v, i) => [xAt(i), yAt(v)])
  const line = smoothPath(pts)
  const last = pts[n - 1]
  const ticks = axes ? [0, 0.25, 0.5, 0.75, 1].map(f => max * f) : []
  const xi = axes ? [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * (n - 1))) : []
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const f = (e.clientX - r.left) / Math.max(1, r.width)
    setHover(Math.max(0, Math.min(n - 1, Math.round(f * (n - 1)))))
  }
  const hx = hover === null ? 0 : (xAt(hover) / W) * 100
  const chart = (
    <div style={{ position: 'relative', width: '100%', height }} onMouseMove={axes ? onMove : undefined} onMouseLeave={axes ? () => setHover(null) : undefined}>
      {axes && ticks.map((t, i) => (
        <span key={i} aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: yAt(t), height: 1, background: 'rgba(255,255,255,0.045)' }} />
      ))}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={height} style={{ display: 'block', overflow: 'visible', position: 'relative' }}>
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {fill && <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${id}f)`} className="pl-fade" />}
        <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" pathLength="1"
          className="pl-draw" style={{ filter: `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 14px ${color}88)` }} />
      </svg>
      {pulse && hover === null && (
        <span className="pl-ping" style={{
          position: 'absolute', left: `calc(${(last[0] / W) * 100}% - 5px)`, top: last[1] - 5,
          width: 10, height: 10, borderRadius: 5, background: color, boxShadow: `0 0 14px ${color}, 0 0 28px ${color}`,
        }} />
      )}
      {axes && hover !== null && (
        <>
          <span aria-hidden="true" style={{ position: 'absolute', left: `${hx}%`, top: 0, bottom: 0, width: 1, background: `${color}55` }} />
          <span aria-hidden="true" style={{ position: 'absolute', left: `calc(${hx}% - 4px)`, top: pts[hover][1] - 4, width: 8, height: 8, borderRadius: 4, background: color, boxShadow: `0 0 12px ${color}` }} />
          <div role="status" style={{
            position: 'absolute', left: `${hx}%`, top: Math.max(0, pts[hover][1] - 58), pointerEvents: 'none', zIndex: 5,
            transform: hover > n * 0.65 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            padding: '7px 11px', borderRadius: 10, whiteSpace: 'nowrap',
            background: 'rgba(10,12,26,0.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07), 0 12px 28px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 12, color: C.muted }}>{dayLabel(dates[hover])}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.white, fontVariantNumeric: 'tabular-nums' }}>{fmt$(values[hover])}</div>
          </div>
        </>
      )}
    </div>
  )
  if (!axes) return chart
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 8 }}>
        <div aria-hidden="true" style={{ position: 'relative', height }}>
          {ticks.map((t, i) => (
            <span key={i} style={{ position: 'absolute', right: 0, top: Math.min(height - 14, Math.max(0, yAt(t) - 7)), fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{axisMoney(t)}</span>
          ))}
        </div>
        {chart}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 8, marginTop: 8 }}>
        <span />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}>
          {xi.map((k, i) => <span key={i}>{dayLabel(dates[k])}</span>)}
        </div>
      </div>
    </div>
  )
}

// One bar, split by platform: where the money comes from at a glance.
function ShareBar3({ comparison }) {
  const mounted = useMounted()
  return (
    <div>
      <div style={{ display: 'flex', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden' }}>
        {comparison.filter(p => p.earningsPercent > 0).map(p => {
          const a = accentFor(p.platform)
          return <div key={p.platform} title={`${p.platform} ${p.earningsPercent}%`} style={{ width: mounted ? `${p.earningsPercent}%` : '0%', background: `linear-gradient(90deg, ${a}aa, ${a})`, boxShadow: `0 0 14px ${a}88`, borderRadius: 4, transition: 'width 1.1s cubic-bezier(.2,.8,.2,1)' }} />
        })}
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: C.muted }}>
        {comparison.map(p => (
          <span key={p.platform} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: accentFor(p.platform), boxShadow: `0 0 8px ${accentFor(p.platform)}` }} />
            <span style={{ color: C.text }}>{p.platform}</span> {p.earningsPercent}%
          </span>
        ))}
      </div>
    </div>
  )
}

// ============================================
// 1 · PLATFORM PULSE
// ============================================

function PlatformPulse({ comparison, snapshot, recap, learning, newFans, daily }) {
  const leader = comparison[0]
  const multi = comparison.length > 1
  const accent = accentFor(leader.platform)
  const pill = (color) => ({
    display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '5px 13px',
    fontSize: 12.5, fontWeight: 700, color, background: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}38`,
  })

  return (
    <div
      className="pl-pulse"
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 28, padding: '38px 42px 34px',
        border: '1px solid rgba(255,255,255,0.065)',
        background: 'linear-gradient(145deg, rgba(13,17,38,0.92), rgba(5,7,19,0.98))',
        backdropFilter: 'blur(34px)', WebkitBackdropFilter: 'blur(34px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.055), 0 34px 84px rgba(0,0,0,0.42)',
      }}
    >
      <span aria-hidden="true" className="pl-drift" style={{ position: 'absolute', left: -150, top: -155, width: 430, height: 430, borderRadius: '50%', background: 'rgba(72,233,255,0.12)', filter: 'blur(120px)', pointerEvents: 'none' }} />
      <span aria-hidden="true" className="pl-drift pl-drift-b" style={{ position: 'absolute', right: -80, top: -80, width: 390, height: 390, borderRadius: '50%', background: 'rgba(124,92,255,0.12)', filter: 'blur(120px)', pointerEvents: 'none' }} />
      <span aria-hidden="true" style={{ position: 'absolute', right: '16%', bottom: -190, width: 320, height: 320, borderRadius: '50%', background: `${accent}12`, filter: 'blur(115px)', pointerEvents: 'none' }} />

      <div className="pl-hero-grid" style={{ position: 'relative', display: 'grid', gridTemplateColumns: daily ? 'minmax(0,0.86fr) minmax(0,1.14fr)' : 'minmax(0,1fr) 300px', gap: 48, alignItems: 'center' }}>
        <div style={{ minWidth: 0, position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="pl-live" style={{ width: 6, height: 6, borderRadius: 3, background: C.teal, boxShadow: `0 0 12px ${C.teal}` }} />
            <span style={eyebrow}>Platform pulse</span>
          </div>

          <div style={{ marginTop: 16, fontSize: 44, fontWeight: 700, color: C.white, letterSpacing: '-0.04em', lineHeight: 1.06 }}>
            {multi ? <>{leader.platform} <span style={{ color: C.text }}>is leading</span></> : <>Everything on <span style={{ color: C.text }}>{leader.platform}</span></>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            {multi && <span style={pill(C.indigo)}>{leader.earningsPercent}% of earnings</span>}
            {newFans?.total > 0 && <span style={pill(C.teal)}>{plural(newFans.total, 'new fan')} this week</span>}
          </div>

          <div style={{ fontSize: 13, color: C.muted, marginTop: 14 }}>
            <span style={{ color: C.text }}>{plural(snapshot.totalTips, 'tip')}</span> across {plural(comparison.length, 'platform')} · {plural(snapshot.sessions, 'meaningful session')}
          </div>

          <div style={{ marginTop: 26 }}>
            <div style={eyebrow}>Total platform earnings</div>
            <div style={{ marginTop: 10, fontSize: 40, fontWeight: 700, color: C.white, letterSpacing: '-0.045em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              <Counter value={snapshot.totalEarnings} />
            </div>
          </div>

          {multi && <div style={{ marginTop: 26, maxWidth: 490 }}><ShareBar3 comparison={comparison} /></div>}

          {learning.isLearning && (
            <div style={{ fontSize: 13.5, color: C.text, marginTop: 18, lineHeight: 1.65, maxWidth: 510 }}>
              <span style={{ color: C.white, fontWeight: 700 }}>CamCash is still learning your platforms.</span>{' '}
              {[
                learning.sessionsNeeded > 0 ? plural(learning.sessionsNeeded, 'more meaningful session') : null,
                learning.hoursNeeded > 0 ? `${learning.hoursNeeded} more streamed hours` : null,
              ].filter(Boolean).join(' and ')}{' '}
              will unlock early patterns.
            </div>
          )}
        </div>

        {daily ? (
          <div style={{ minWidth: 0, position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <div style={eyebrow}>Daily earnings · last 30 days</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{fmtN(daily.activeDays)} earning days</div>
              </div>
              {recap ? (
                <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
                  <div style={eyebrow}>Your latest stream</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: C.teal, letterSpacing: '-0.04em', lineHeight: 1.1, marginTop: 7, fontVariantNumeric: 'tabular-nums' }}>
                    +<Counter value={recap.earned} />
                  </div>
                  <div style={{ fontSize: 12.5, color: C.text, marginTop: 5 }}>
                    on <span style={{ color: C.white, fontWeight: 700 }}>{recap.platform}</span> · {plural(recap.tips, 'tip')} from {plural(recap.fans, 'fan')}
                  </div>
                  {recap.tookLead && <div style={{ fontSize: 12.5, color: C.purple, marginTop: 4 }}>{recap.platform} moved into the lead</div>}
                </div>
              ) : (
                <div style={{ textAlign: 'right', marginLeft: 'auto', maxWidth: 270 }}>
                  <div style={eyebrow}>Since your last stream</div>
                  <div style={{ fontSize: 13.5, color: C.white, marginTop: 8, lineHeight: 1.55 }}>Stream again and CamCash will start showing what changed between sessions.</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>A stream counts once it runs 30+ minutes with 2+ tips.</div>
                </div>
              )}
            </div>
            <GlowChart values={daily.total} dates={daily.days} color={C.teal} height={200} />
          </div>
        ) : (
          <div style={{ borderRadius: 18, padding: 22, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            {recap ? (
              <>
                <div style={eyebrow}>Your latest stream</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: C.teal, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 14, fontVariantNumeric: 'tabular-nums' }}>+<Counter value={recap.earned} /></div>
                <div style={{ fontSize: 14, color: C.white, marginTop: 10 }}>{recap.platform}</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>{plural(recap.tips, 'tip')} from {plural(recap.fans, 'fan')}</div>
                {recap.tookLead && <div style={{ fontSize: 12.5, color: C.purple, marginTop: 10 }}>{recap.platform} moved into the lead</div>}
              </>
            ) : (
              <>
                <div style={eyebrow}>Since your last stream</div>
                <div style={{ fontSize: 14, color: C.white, marginTop: 10, lineHeight: 1.55 }}>Stream again and CamCash will start showing what changed between sessions.</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>A stream counts once it runs 30+ minutes with 2+ tips.</div>
              </>
            )}
          </div>
        )}
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
    { icon: 'dollar', value: fmtSigned$(recap.earned), label: 'earned', sub: `${recap.platform} · ${plural(recap.tips, 'tip')}`, color: C.teal },
    recap.returningFans === null
      ? { icon: 'users', value: 'First stream here', label: '', sub: 'returning fans from your next stream', color: C.text }
      : { icon: 'users', value: plural(recap.returningFans, 'returning fan'), label: '', sub: 'tipped again', color: C.white },
    recap.newSpenders === null
      ? null
      : { icon: 'sparkle', value: recap.newSpenders ? plural(recap.newSpenders, 'new spender') : 'No new spenders', label: '', sub: 'tipped for the first time', color: recap.newSpenders ? C.white : C.text },
    multi && recap.shareShiftPts
      ? { icon: 'pie', value: `${recap.shareShiftPts > 0 ? '+' : ''}${recap.shareShiftPts} pts`, label: 'revenue share', sub: recap.tookLead ? `${recap.platform} took the lead` : recap.platform, color: recap.shareShiftPts > 0 ? C.green : C.text }
      : dur
        ? { icon: 'clock', value: `${dur >= 60 ? `${Math.floor(dur / 60)}h ` : ''}${dur % 60}m`, label: 'streamed', sub: `${plural(recap.fans, 'fan')} tipped`, color: C.white }
        : null,
  ].filter(Boolean)

  return (
    <div className="pl-stream-rail" style={{
      borderRadius: 18, padding: '18px 22px',
      border: '1px solid rgba(255,255,255,0.04)',
      background: 'linear-gradient(90deg, rgba(22,244,255,0.035), rgba(255,255,255,0.015) 48%, rgba(124,92,255,0.025))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <span className="pl-live" style={{ width: 6, height: 6, borderRadius: 3, background: C.teal, boxShadow: `0 0 10px ${C.teal}` }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>Since your last stream</span>
        <span style={{ fontSize: 12, color: C.muted }}>{streamWhen(recap.endTime, tz)}</span>
      </div>
      <div className="pl-rail-items" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 0' }}>
        {items.map((it, i) => (
          <div key={i} className="pl-rail-item" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, padding: '0 26px', ...(i ? { borderLeft: '1px solid rgba(255,255,255,0.06)' } : { paddingLeft: 0 }) }}>
            <span style={{ width: 32, height: 32, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', color: it.color === C.text ? C.muted : it.color }}>
              <Ico name={it.icon} size={16} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: it.color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {it.value}{it.label && <span style={{ fontWeight: 400, color: C.muted }}> {it.label}</span>}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{it.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// 3 · PLATFORM CARDS
// ============================================

function PlatformCard({ row, extras, badges, selected, onSelect, leading, spark }) {
  const accent = accentFor(row.platform)
  const mounted = useMounted()
  const fresh = badges.includes('fresh')
  const shownBadges = badges.filter(b => b !== 'fresh').slice(0, 1)
  const hasSpark = Boolean(spark && spark.some(v => v > 0))

  return (
    <Glass
      accent={selected ? accent : undefined}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      className={`pl-platform-card${leading ? ' pl-platform-leading' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      aria-pressed={selected}
      style={{
        padding: '22px 24px 20px',
        background: leading
          ? `radial-gradient(circle at 4% -8%, ${accent}1f, transparent 52%), linear-gradient(150deg, rgba(13,17,38,0.78), rgba(5,7,19,0.92))`
          : 'linear-gradient(150deg, rgba(13,17,38,0.72), rgba(5,7,19,0.90))',
        ...(selected ? {} : { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035), 0 16px 42px rgba(0,0,0,0.23)' }),
      }}
    >
      <span aria-hidden="true" style={{ position: 'absolute', left: -24, top: -1, bottom: 0, width: 1, background: `linear-gradient(180deg, transparent, ${accent}70, transparent)`, boxShadow: `0 0 18px ${accent}45`, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <PlatformMark platform={row.platform} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.white, letterSpacing: '-0.012em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.platform}</span>
            {fresh && <span title={BADGE_HELP.fresh} className="pl-live" style={{ width: 5, height: 5, borderRadius: 3, background: C.teal, boxShadow: `0 0 8px ${C.teal}`, flexShrink: 0 }} />}
          </div>
          {shownBadges.length > 0 && <div style={{ marginTop: 6 }}>{shownBadges.map(b => <Badge key={b} kind={b} />)}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginTop: 20 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: C.white, letterSpacing: '-0.045em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            <Counter value={row.earnings} />
          </div>
          <div style={{ fontSize: 13, color: accent, fontWeight: 700, marginTop: 9 }}>{row.earningsPercent}% of earnings</div>
        </div>
        {hasSpark && (
          <div style={{ width: '42%', maxWidth: 150, flexShrink: 0, marginBottom: -2 }}>
            <GlowChart values={spark} color={accent} height={52} strokeWidth={2} pulse={leading} />
          </div>
        )}
      </div>

      {!hasSpark && (
        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginTop: 16 }}>
          <div style={{ width: mounted ? `${row.earningsPercent}%` : 0, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${accent}88, ${accent})`, boxShadow: `0 0 11px ${accent}55`, transition: 'width 900ms cubic-bezier(.2,.8,.2,1)' }} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
          <span><span style={{ color: C.text }}>{fmtN(row.tips)}</span> tips</span>
          <span><span style={{ color: C.text }}>{fmtN(extras?.uniqueFans ?? 0)}</span> fans</span>
          <span><span style={{ color: C.text }}>{row.avgTipSize > 0 ? fmt$(row.avgTipSize) : '—'}</span> avg tip</span>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: selected ? accent : C.text, whiteSpace: 'nowrap' }}>
          {selected ? 'Viewing' : 'View details'} <Ico name="arrow" size={12} style={selected ? { transform: 'rotate(90deg)' } : undefined} />
        </span>
      </div>

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 12.5, color: C.muted }}>
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
const ACTIVITY_ICON = { earned24h: 'trend', newFans: 'sparkle', returning: 'repeat', share: 'pie' }
function ActivityFeed({ items }) {
  if (!items.length) return null

  const shown = items.slice(0, 6)
  const scrolls = shown.length >= 3
  const mask = scrolls ? 'linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)' : undefined

  const item = (it, i, dup) => {
    const a = accentFor(it.platform)
    return (
      <span
        key={`${dup}${i}`}
        title={it.sub}
        aria-hidden={dup ? true : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 9, flexShrink: 0, borderRadius: 999,
          padding: '6px 14px 6px 10px', fontSize: 12.5, color: C.text, whiteSpace: 'nowrap',
          background: 'rgba(255,255,255,0.022)', boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.045), 0 0 20px -12px ${a}`,
        }}
      >
        <Ico name={ACTIVITY_ICON[it.kind] || 'sparkle'} size={14} color={a} />
        <span style={{ color: C.white }}>{it.text}</span>
        <span style={{ color: C.muted }}>{it.sub}</span>
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0, padding: '2px 2px 0' }}>
      <span style={{ ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <span className="pl-live" style={{ width: 5, height: 5, borderRadius: 3, background: C.cyan, boxShadow: `0 0 8px ${C.cyan}` }} />
        Just updated
      </span>
      <div className="pl-ticker" style={{ flex: 1, minWidth: 0, overflow: 'hidden', WebkitMaskImage: mask, maskImage: mask }}>
        <div className={scrolls ? 'pl-marquee' : undefined} style={{ display: 'flex', gap: 10, width: scrolls ? 'max-content' : undefined, flexWrap: scrolls ? 'nowrap' : 'wrap' }}>
          {shown.map((it, i) => item(it, i, ''))}
          {scrolls && shown.map((it, i) => item(it, i, 'd'))}
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
              <span style={{ color: C.white, fontWeight: 800, whiteSpace: 'nowrap' }}>{fmt$(a.earnings)}{a.usdPerHour > 0 && a.rateHours > 0 ? <span style={{ color: C.text, fontWeight: 700 }}> · {fmt$(a.usdPerHour)}/hr</span> : null}</span>
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
        <Label>Platform history <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>· revenue split by month</span></Label>
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
      <div style={{ ...eyebrow, marginBottom: 22 }}>Where your money comes from</div>

      <div style={{ display: 'grid', gap: 22 }}>
        {comparison.map(p => {
          const accent = accentFor(p.platform)

          return (
            <div key={p.platform}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) auto auto',
                  gap: 14,
                  alignItems: 'baseline',
                  marginBottom: 10,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: C.white,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.platform}
                </span>
                <span style={{ fontSize: 12.5, color: C.muted }}>
                  {fmt$(p.earnings)}
                </span>
                <span
                  style={{
                    minWidth: 42,
                    fontSize: 14,
                    color: C.white,
                    fontWeight: 700,
                    textAlign: 'right',
                  }}
                >
                  {p.earningsPercent}%
                </span>
              </div>

              <div
                style={{
                  height: 3,
                  background: 'rgba(255,255,255,0.045)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: mounted
                      ? `${Math.max(
                          p.earningsPercent,
                          p.earnings > 0 ? 1 : 0
                        )}%`
                      : 0,
                    height: '100%',
                    borderRadius: 2,
                    background: `linear-gradient(90deg, ${accent}77, ${accent})`,
                    boxShadow: `0 0 12px ${accent}55`,
                    transition: 'width 1s cubic-bezier(.2,.8,.2,1)',
                  }}
                />
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
    <Glass
      className="pl-intelligence"
      style={{
        padding: '30px 30px 28px',
        background:
          'linear-gradient(145deg, rgba(13,17,38,0.78), rgba(5,7,19,0.91))',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: -120,
          top: -160,
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: 'rgba(124,92,255,0.08)',
          filter: 'blur(115px)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="pi-two-col"
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: multi
            ? 'minmax(0,0.78fr) minmax(0,1.22fr)'
            : '1fr',
          gap: 46,
          alignItems: 'start',
        }}
      >
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
  const shown = isPro
    ? [...cross.map(c => c.text), ...noticed.map(n => n.text)]
    : noticed.map(n => n.text)
  const [lead, ...rest] = shown

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minWidth: 0, borderRadius: 18, padding: '2px 0 2px 26px', borderLeft: '1px solid rgba(124,92,255,0.22)' }}>
      <span aria-hidden="true" style={{ position: 'absolute', left: -80, top: -70, width: 220, height: 220, borderRadius: '50%', background: 'rgba(124,92,255,0.10)', filter: 'blur(85px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        <div style={{ ...eyebrow, color: C.text, marginBottom: 17 }}>
          <span style={{ color: C.purple }}>✦</span> CamCash noticed
        </div>

        {shown.length === 0 && freeTeasers.length === 0 ? (
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7 }}>
            {multi
              ? 'Nothing stands out between your platforms yet. Findings appear here when the gap is big enough to be real.'
              : 'Findings appear here once a pattern in your data is strong enough to call out.'}
          </div>
        ) : (
          <>
            {lead && (
              <div className="pl-chip" style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, borderRadius: 16, padding: '16px 18px', maxWidth: 680,
                background: 'linear-gradient(135deg, rgba(124,92,255,0.11), rgba(22,244,255,0.035))',
                boxShadow: 'inset 0 0 0 1px rgba(124,92,255,0.20)',
              }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124,92,255,0.16)', color: C.purple }}>
                  <Ico name="bars" size={16} />
                </span>
                <span style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.6, color: C.white, letterSpacing: '-0.01em' }}>{lead}</span>
              </div>
            )}

            {rest.slice(0, 3).map((t, i) => (
              <div key={i} className="pl-chip" style={{
                animationDelay: `${(i + 1) * 70}ms`, display: 'flex', alignItems: 'flex-start', gap: 12, maxWidth: 680,
                padding: '12px 4px 0 6px', marginTop: i ? 0 : 6, fontSize: 13.5, lineHeight: 1.7, color: C.text,
              }}>
                <span style={{ color: C.purple, fontSize: 12, marginTop: 4 }}>✦</span>
                <span style={{ minWidth: 0 }}>{t}</span>
              </div>
            ))}

            {freeTeasers.slice(0, 2).map((c, i) => (
              <div key={c.id} style={{ marginTop: lead || i ? 20 : 0, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.045)', maxWidth: 680 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: C.pink }}>✦ PRO INSIGHT</span>
                  <span aria-hidden="true" style={{ fontSize: 12, color: C.text, filter: 'blur(4px)', userSelect: 'none' }}>██████████ · ██%</span>
                </div>
                <div style={{ fontSize: 14, color: C.white, marginTop: 7, lineHeight: 1.6 }}>{c.teaser}</div>
                <button type="button" onClick={() => onUpgrade?.(`platforms_insight_${c.id}`)} style={{ marginTop: 7, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.pink }}>
                  {c.cta} →
                </button>
              </div>
            ))}

            {freeTeasers.length > 2 && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>
                + {plural(freeTeasers.length - 2, 'more finding')} already found in your data
              </div>
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
  const cols = [
    { label: 'Earnings', get: p => p.earnings, fmt: fmt$ },
    { label: 'Share', get: p => p.earningsPercent, fmt: v => `${v}%` },
    { label: 'Tips', get: p => p.tips, fmt: fmtN },
    { label: 'Fans', get: p => extras[p.platform]?.uniqueFans ?? 0, fmt: fmtN },
    { label: 'Avg tip', get: p => p.avgTipSize, fmt: fmt$ },
    { label: 'Biggest tip', get: p => extras[p.platform]?.biggestTip ?? 0, fmt: fmt$ },
    { label: 'Sessions', get: p => p.sessions, fmt: fmtN, note: '30+ min, 2+ tips' },
    // $/hr only from sessions with a reliable length (engine rule).
    { label: 'Est. $/hr', get: p => (p.rateHours > 0 && p.usdPerHour > 0 ? p.usdPerHour : null), fmt: fmt$, note: 'timed sessions only' },
    { label: '30-day', get: p => (p.trend?.pct ?? null), render: p => <TrendCell trend={p.trend} /> },
  ]
  const best = cols.map(c => {
    const finite = comparison.map(c.get).filter(v => v !== null && Number.isFinite(v))
    return finite.length > 1 ? Math.max(...finite) : null
  })
  const th = { textAlign: 'right', padding: '0 18px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap', verticalAlign: 'bottom' }

  return (
    <Glass style={{ padding: '22px 6px 8px', background: 'linear-gradient(145deg, rgba(13,17,38,0.7), rgba(5,7,19,0.9))' }}>
      <div style={{ ...eyebrow, padding: '0 24px 18px' }}>Platform comparison</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', paddingLeft: 24 }}>Platform</th>
              {cols.map(c => (
                <th key={c.label} style={th}>
                  {c.label}
                  {c.note && <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: 0, textTransform: 'none', marginTop: 3 }}>{c.note}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.map(p => (
              <tr key={p.platform} style={{ borderTop: '1px solid rgba(255,255,255,0.045)' }}>
                <td style={{ padding: '14px 18px 14px 24px', fontSize: 13.5, color: C.white, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <PlatformCell platform={p.platform} />
                </td>
                {cols.map((c, ci) => {
                  const v = c.get(p)
                  const isBest = best[ci] !== null && v === best[ci] && v > 0
                  return (
                    <td key={c.label} style={{ padding: '14px 18px', fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap', color: isBest ? C.white : C.cell, fontWeight: isBest ? 600 : 400 }}>
                      {c.render ? c.render(p) : v === null ? <span style={{ color: C.muted }}>—</span> : c.fmt(v)}
                      {isBest && !c.render && <span title="Best of your platforms" style={{ display: 'inline-block', width: 4, height: 4, borderRadius: 2, background: C.pink, marginLeft: 7, verticalAlign: 'middle', boxShadow: `0 0 6px ${C.pink}` }} />}
                    </td>
                  )
                })}
              </tr>
            ))}
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
      <Label style={{ marginBottom: 14 }}>Revenue split <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>· last 30 days vs the 30 before</span></Label>
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
    <div style={{ borderRadius: 20, padding: 28, position: 'relative', overflow: 'hidden', border: '1px solid rgba(124,92,255,0.14)', background: GLASS_BG, boxShadow: GLASS_SHADOW }}>
      <div aria-hidden style={{ position: 'absolute', left: -80, bottom: -110, width: 280, height: 280, borderRadius: '50%', background: 'rgba(124,92,255,0.14)', filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 380px', minWidth: 0 }}>
          <div style={{ ...eyebrow, marginBottom: 12 }}>Your full picture</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.white, letterSpacing: '-0.025em' }}>It&apos;s already in your account</div>
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
    <div className="pl-chip" style={{ borderRadius: 16, padding: '14px 20px', border: '1px solid rgba(22,244,255,0.12)', background: 'linear-gradient(90deg, rgba(22,244,255,0.06), rgba(255,255,255,0.02) 55%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span className="pl-live" style={{ width: 6, height: 6, borderRadius: 3, background: C.teal, boxShadow: `0 0 10px ${C.teal}` }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>Since your last visit</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: C.teal, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}>+<Counter value={visit.totalUSD} /></span>
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

function PlatformDetail({ analytics, platformName, isPro, extras, onNavigate, detailRef, onClose }) {
  const accent = accentFor(platformName)
  const links = [
    ['whales', 'Fans'],
    ['sessions', 'Sessions'],
    ['planner', 'Stream planner'],
  ]
  return (
    <div ref={detailRef} style={{ scrollMarginTop: 16 }}>
      <Glass accent={accent} style={{ padding: '20px 22px 22px', marginTop: 4, background: 'linear-gradient(145deg, rgba(13,16,32,0.82), rgba(5,7,19,0.94))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <PlatformMark platform={platformName} size={34} />
            <span style={{ fontSize: 18, fontWeight: 700, color: C.white, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{platformName} in detail</span>
            {extras?.biggestTip > 0 && <span style={{ fontSize: 12.5, color: C.muted, whiteSpace: 'nowrap' }}>· biggest tip {fmt$(extras.biggestTip)} · {plural(extras.uniqueFans, 'fan')}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {onNavigate && links.map(([tab, label]) => (
              <button key={tab} type="button" onClick={() => onNavigate(tab)} style={{ fontSize: 13, fontWeight: 500, color: C.text, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '0 14px', minHeight: 36, cursor: 'pointer' }}>
                {label} →
              </button>
            ))}
            {onClose && (
              <button type="button" onClick={onClose} aria-label={`Close ${platformName} details`} style={{ width: 36, height: 36, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: C.text, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
                <Ico name="close" size={15} />
              </button>
            )}
          </div>
        </div>
        <SplitView analytics={analytics} platformName={platformName} isPro={isPro} />
      </Glass>
    </div>
  )
}

// ============================================
// PAGE
// ============================================


// ============================================
// MOCK LAYOUT · Pulse row, finding cards, trends, timing, records
// Every figure below comes from the existing builders (comparison rows,
// extras, buildDailySeries, canonicalBestTimes); nothing is derived here.
// ============================================

function SectionHead({ icon, title, note, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '4px 2px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 800, color: C.white, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          <span style={{ color: C.teal, display: 'inline-flex' }}><Ico name={icon} size={18} /></span>{title}
        </span>
        {note && <span style={{ fontSize: 12.5, color: C.muted }}>{note}</span>}
      </div>
      {right}
    </div>
  )
}

function PulseCard({ row, extras, badges, selected, onSelect, leading, spark }) {
  const accent = accentFor(row.platform)
  const fresh = badges.includes('fresh')
  const shown = badges.filter(b => b !== 'fresh').slice(0, 1)
  const hasSpark = Boolean(spark && spark.some(v => v > 0))
  const stat = (label, value, title) => (
    <div style={{ minWidth: 0 }} title={title}>
      <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.white, marginTop: 4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
  return (
    <Glass
      accent={selected ? accent : undefined}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      style={{
        padding: '18px 20px 16px',
        background: leading
          ? `radial-gradient(circle at 4% -8%, ${accent}22, transparent 55%), linear-gradient(150deg, rgba(13,17,38,0.78), rgba(5,7,19,0.92))`
          : 'linear-gradient(150deg, rgba(13,17,38,0.72), rgba(5,7,19,0.90))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <PlatformMark platform={row.platform} size={28} />
          <span style={{ fontSize: 16, fontWeight: 700, color: C.white, letterSpacing: '-0.012em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.platform}</span>
          {fresh && <span title={BADGE_HELP.fresh} className="pl-live" style={{ width: 5, height: 5, borderRadius: 3, background: C.teal, boxShadow: `0 0 8px ${C.teal}`, flexShrink: 0 }} />}
        </div>
        <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 999, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>
          <TrendCell trend={row.trend} />
        </span>
      </div>
      {shown.length > 0 && <div style={{ marginTop: 8 }}>{shown.map(b => <Badge key={b} kind={b} />)}</div>}

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,auto))', gap: '12px 26px', minWidth: 0 }}>
          {stat('Earnings', fmt$(row.earnings))}
          {stat('$/hr', row.rateHours > 0 ? fmt$(row.usdPerHour) : '—', 'Timed sessions of 30+ minutes with 2+ tips only')}
          {stat('Hours', fmtH(row.hours))}
          {stat('Fans', fmtN(extras?.uniqueFans ?? 0))}
        </div>
        {hasSpark && (
          <div style={{ width: '40%', maxWidth: 150, flexShrink: 0 }}>
            <GlowChart values={spark} color={accent} height={64} strokeWidth={2} pulse={leading} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 12.5, color: C.muted }}>
        <span style={{ color: accent, fontWeight: 700 }}>{row.earningsPercent}% of earnings</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: selected ? accent : C.text }}>
          {selected ? 'Viewing' : 'View details'} <Ico name="arrow" size={12} style={selected ? { transform: 'rotate(90deg)' } : undefined} />
        </span>
      </div>
    </Glass>
  )
}

const FINDING_ICON = { avg_tip: 'dollar', growth: 'trend', top_spenders: 'users' }

function FindingCards({ noticed, cross, isPro, onUpgrade, multi }) {
  const items = (isPro
    ? [...cross.map(c => ({ id: c.id, text: c.text })), ...noticed.map((n, i) => ({ id: `n${i}`, text: n.text }))]
    : noticed.map((n, i) => ({ id: `n${i}`, text: n.text }))
  ).slice(0, 4)
  const teasers = isPro ? [] : cross.slice(0, 2)
  if (items.length === 0 && teasers.length === 0) {
    return (
      <Glass style={{ padding: '18px 22px' }}>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7 }}>
          {multi
            ? 'Nothing stands out between your platforms yet. Findings appear here when the gap is big enough to be real.'
            : 'Findings appear here once a pattern in your data is strong enough to call out.'}
        </div>
      </Glass>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
      {items.map((it, i) => {
        const lead = i === 0
        const color = lead ? C.pink : i % 2 ? C.cyan : C.purple
        return (
          <Glass key={it.id} accent={lead ? C.pink : undefined} className="pl-chip" style={{ padding: '16px 18px', animationDelay: `${i * 70}ms`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${color}1f`, color }}>
                <Ico name={FINDING_ICON[it.id] || 'sparkle'} size={16} />
              </span>
              {lead && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.pink, padding: '3px 8px', borderRadius: 6, background: `${C.pink}14`, boxShadow: `inset 0 0 0 1px ${C.pink}40` }}>TOP FINDING</span>}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: lead ? C.white : C.cell, fontWeight: lead ? 500 : 400 }}>{it.text}</div>
          </Glass>
        )
      })}
      {teasers.map((c, i) => (
        <Glass key={c.id} className="pl-chip" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: C.pink }}>PRO INSIGHT</span>
            <span aria-hidden="true" style={{ fontSize: 12, color: C.text, filter: 'blur(4px)', userSelect: 'none' }}>██████████ · ██%</span>
          </div>
          <div style={{ fontSize: 14, color: C.white, lineHeight: 1.55 }}>{c.teaser}</div>
          <button type="button" onClick={() => onUpgrade?.(`platforms_insight_${c.id}`)} style={{ marginTop: 'auto', padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.pink, textAlign: 'left' }}>
            {c.cta} →
          </button>
        </Glass>
      ))}
    </div>
  )
}

// Daily earnings per platform: real daily totals, one lit line per platform.
function TrendsSection({ daily, comparison }) {
  const [hover, setHover] = useState(null)
  const series = comparison
    .map(r => ({ platform: r.platform, row: r, color: accentFor(r.platform), values: daily?.byPlatform?.[r.platform] }))
    .filter(x => x.values && x.values.some(v => v > 0))
  if (!daily || series.length === 0) return null
  const n = daily.days.length
  const W = 700, H = 240, pad = 6
  const max = niceTop(Math.max(...series.flatMap(x => x.values), 0.01))
  const xAt = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W)
  const yAt = (v) => H - pad - (v / max) * (H - pad * 2)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => max * f)
  const xi = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * (n - 1)))
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / Math.max(1, r.width)) * (n - 1)))))
  }
  const sums = series.map(x => ({ ...x, sum: x.values.reduce((a, b) => a + b, 0) }))
  const total = sums.reduce((a, b) => a + b.sum, 0)
  const hx = hover === null ? 0 : (xAt(hover) / W) * 100
  return (
    <div className="pl-trends" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 310px', gap: 14 }}>
      <Glass style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 8 }}>
          <div aria-hidden="true" style={{ position: 'relative', height: H }}>
            {ticks.map((t, i) => (
              <span key={i} style={{ position: 'absolute', right: 0, top: Math.min(H - 14, Math.max(0, yAt(t) - 7)), fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{axisMoney(t)}</span>
            ))}
          </div>
          <div style={{ position: 'relative', height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            {ticks.map((t, i) => <span key={i} aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: yAt(t), height: 1, background: 'rgba(255,255,255,0.045)' }} />)}
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: 'block', overflow: 'visible', position: 'relative' }}>
              {sums.map(x => (
                <path key={x.platform} d={smoothPath(x.values.map((v, i) => [xAt(i), yAt(v)]))} fill="none" stroke={x.color} strokeWidth="2.2"
                  vectorEffect="non-scaling-stroke" pathLength="1" className="pl-draw" style={{ filter: `drop-shadow(0 0 6px ${x.color}) drop-shadow(0 0 12px ${x.color}66)` }} />
              ))}
            </svg>
            {hover !== null && (
              <>
                <span aria-hidden="true" style={{ position: 'absolute', left: `${hx}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.18)' }} />
                <div role="status" style={{
                  position: 'absolute', left: `${hx}%`, top: 6, pointerEvents: 'none', zIndex: 5,
                  transform: hover > n * 0.6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
                  padding: '8px 12px', borderRadius: 10, whiteSpace: 'nowrap', background: 'rgba(10,12,26,0.92)',
                  backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07), 0 12px 28px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{dayLabel(daily.days[hover])}</div>
                  {sums.map(x => (
                    <div key={x.platform} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: x.color }}>{x.platform}</span><span style={{ color: C.white, fontWeight: 700 }}>{fmt$(x.values[hover])}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 8, marginTop: 8 }}>
          <span />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}>
            {xi.map((k, i) => <span key={i}>{dayLabel(daily.days[k])}</span>)}
          </div>
        </div>
      </Glass>

      <Glass style={{ padding: '18px 18px 16px' }}>
        <div style={eyebrow}>Last 30 days · {dayLabel(daily.days[0])} – {dayLabel(daily.days[n - 1])}</div>
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          {sums.map(x => (
            <div key={x.platform} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto auto', gap: 10, alignItems: 'baseline', fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: x.color, boxShadow: `0 0 8px ${x.color}`, alignSelf: 'center' }} />
              <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.platform}</span>
              <span style={{ color: C.white, fontWeight: 700 }}>{fmt$(x.sum)}</span>
              <span style={{ fontSize: 12 }}><TrendCell trend={x.row.trend} /></span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 13, color: C.text }}>Total</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: C.white, fontVariantNumeric: 'tabular-nums' }}>{fmt$(total)}</span>
        </div>
      </Glass>
    </div>
  )
}

// When to earn: the engine's hour-of-day strength and its best window.
function TimingSection({ analytics, timeIntel, comparison, isPro }) {
  const grid = analytics?.canonicalBestTimes?.grid || []
  const win = analytics?.canonicalBestTimes?.bestWindow || null
  const early = analytics?.canonicalBestTimes?.earlySignal || null
  if (grid.length === 0 && !win && !early) return null
  const byHour = new Map(grid.map(g => [Number(g.hour), g]))
  const peak = Math.max(...grid.map(g => g.avg), 0.01)
  const bestH = win ? Number(win.localHour) : early ? Number(early.localHour) : null
  const level = timeIntel?.confidence?.level
  const topPlatform = win?.topPlatform || null
  const others = isPro
    ? comparison
        .filter(r => r.platform !== topPlatform)
        .map(r => ({ platform: r.platform, t: analytics?.platformBestTimes?.[r.platform] }))
        .filter(x => x.t && (x.t.hour || x.t.bestDay))
        .slice(0, 3)
    : []
  const row = (label, value) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginTop: 4 }}>{value}</div>
    </div>
  )
  return (
    <div className="pl-timing" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 14 }}>
      <Glass style={{ padding: '18px 20px 14px' }}>
        <div style={eyebrow}>Earning strength by hour · your timezone</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 130, marginTop: 16 }}>
          {Array.from({ length: 24 }, (_, h) => {
            const g = byHour.get(h)
            const isBest = bestH === h
            return (
              <div key={h} title={g ? `${formatHour(h)} · ${plural(g.count, 'session')}` : `${formatHour(h)} · not enough data`}
                style={{ flex: 1, height: g ? `${Math.max(6, (g.avg / peak) * 100)}%` : 3, borderRadius: 3,
                  background: !g ? 'rgba(255,255,255,0.05)' : isBest ? `linear-gradient(180deg, ${C.pink}, ${C.purple})` : `linear-gradient(180deg, ${C.teal}aa, ${C.indigo}66)`,
                  boxShadow: isBest ? `0 0 14px ${C.pink}77` : 'none' }} />
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.muted, marginTop: 8 }}>
          {[0, 6, 12, 18, 23].map(h => <span key={h}>{formatHour(h)}</span>)}
        </div>
      </Glass>

      <Glass accent={bestH !== null ? C.pink : undefined} style={{ padding: '18px 20px' }}>
        <div style={eyebrow}>{win ? 'Best window' : 'Early signal'}</div>
        {bestH !== null ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.white, letterSpacing: '-0.02em', marginTop: 10 }}>
              {(win?.localDay || (early?.localDay !== 'Any day' ? early?.localDay : null)) ? `${win?.localDay || early.localDay} · ` : ''}around {formatHour(bestH)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14, marginTop: 14 }}>
              {topPlatform && row('Top platform', topPlatform)}
              {row('Sample', plural(win?.sessionCount ?? early?.sessionCount ?? 0, 'session'))}
              {row('Confidence', level && level !== 'Very Low' ? timeIntel.confidence.label : 'Still learning')}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13.5, color: C.text, marginTop: 10, lineHeight: 1.6 }}>Timing appears here once a window is supported by enough sessions.</div>
        )}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ ...eyebrow, marginBottom: 10 }}>Also worth considering</div>
          {isPro ? (
            others.length === 0
              ? <div style={{ fontSize: 13, color: C.muted }}>No other platform has a timing pattern yet.</div>
              : others.map(x => (
                <div key={x.platform} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, padding: '5px 0' }}>
                  <span style={{ color: accentFor(x.platform), fontWeight: 700 }}>{x.platform}</span>
                  <span style={{ color: C.text }}>{[x.t.bestDay?.day, x.t.hour ? `around ${formatHour(x.t.hour.hour)}` : null].filter(Boolean).join(' · ')}</span>
                </div>
              ))
          ) : (
            <LockedRow text="Best hour and day for each platform" />
          )}
        </div>
      </Glass>
    </div>
  )
}

// Records: only facts already on the rows, so each reconciles to the table.
function RecordsStrip({ comparison, extras, efficiency }) {
  const recs = []
  const tip = comparison
    .map(r => ({ platform: r.platform, usd: extras?.[r.platform]?.biggestTip || 0 }))
    .sort((a, b) => b.usd - a.usd)[0]
  if (tip && tip.usd > 0) recs.push({ icon: 'trophy', label: 'Biggest tip', value: fmt$(tip.usd), sub: tip.platform, color: C.pink })
  if (efficiency.length > 0) recs.push({ icon: 'clock', label: 'Best $/hr', value: fmt$(efficiency[0].usdPerHour), sub: efficiency[0].platform, color: C.teal })
  const growing = comparison
    .filter(r => r.trend && r.trend.pct !== null && r.trend.pct > 0)
    .sort((a, b) => b.trend.pct - a.trend.pct)[0]
  if (growing) recs.push({ icon: 'trend', label: 'Fastest 30-day growth', value: `+${Math.round(growing.trend.pct)}%`, sub: growing.platform, color: C.cyan })
  if (recs.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      {recs.map(r => (
        <Glass key={r.label} style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${r.color}1f`, color: r.color }}><Ico name={r.icon} size={16} /></span>
            <span style={{ fontSize: 12.5, color: C.text }}>{r.label}</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.white, letterSpacing: '-0.03em', marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>{r.value}</div>
          <div style={{ fontSize: 12.5, color: accentFor(r.sub), marginTop: 4 }}>{r.sub}</div>
        </Glass>
      ))}
    </div>
  )
}

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
  const daily = useMemo(() => buildDailySeries(analytics, tz), [analytics, tz])
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
.pl-root {
  max-width: 100%;
  position: relative;
  isolation: isolate;
}

.pl-root::before {
  content: '';
  position: absolute;
  inset: -40px -40px 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% 8%, rgba(22,244,255,0.10), transparent 34%),
    radial-gradient(circle at 88% 30%, rgba(255,43,174,0.10), transparent 36%);
}

.pl-root section,
.pl-root .pi-two-col > *,
.pl-root .pl-grid > * {
  min-width: 0;
}

.pl-root table {
  font-variant-numeric: tabular-nums;
}

.pl-click {
  cursor: pointer;
  transition:
    transform .2s ease,
    border-color .2s ease,
    box-shadow .2s ease,
    background .2s ease;
}

.pl-click:hover {
  transform: translateY(-2px);
  border-color: rgba(124,92,255,.20) !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.05),
    0 24px 60px rgba(0,0,0,.32) !important;
}

.pl-click:focus-visible {
  outline: 2px solid ${C.pink};
  outline-offset: 3px;
}

.pl-platform-card:hover {
  transform: translateY(-3px);
}

.pl-brand {
  transition: transform .16s ease, box-shadow .16s ease;
}

.pl-brand:hover {
  transform: translateY(-1px);
  box-shadow:
    0 0 30px rgba(22,244,255,.28),
    0 0 34px rgba(255,43,174,.20) !important;
}

@keyframes plGlow {
  0% { text-shadow: 0 0 0 transparent; }
  30% { text-shadow: 0 0 18px rgba(22,244,255,.55); }
  100% { text-shadow: 0 0 0 transparent; }
}

.pl-glow {
  animation: plGlow 1.4s ease-out;
}

@keyframes plIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.pl-chip,
.pl-badge {
  animation: plIn .42s ease-out both;
}

@keyframes plDrift {
  0%, 100% {
    transform: translate(0,0) scale(1);
  }
  50% {
    transform: translate(42px,20px) scale(1.08);
  }
}

.pl-drift {
  animation: plDrift 16s ease-in-out infinite;
}

.pl-drift-b {
  animation-duration: 20s;
  animation-direction: reverse;
}

@keyframes plLive {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: .48;
    transform: scale(.78);
  }
}

.pl-live {
  animation: plLive 2s ease-in-out infinite;
}

@keyframes plMarquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.pl-marquee {
  animation: plMarquee 42s linear infinite;
}

.pl-ticker:hover .pl-marquee {
  animation-play-state: paused;
}

@keyframes plDrawK {
  from {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
  }
  to {
    stroke-dasharray: 1;
    stroke-dashoffset: 0;
  }
}

.pl-draw {
  animation: plDrawK 1.6s cubic-bezier(.3,.7,.2,1) both;
}

@keyframes plFadeK {
  from { opacity: 0; }
  to { opacity: 1; }
}

.pl-fade {
  animation: plFadeK 1.4s .35s ease-out both;
}

@keyframes plPingK {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  60% {
    transform: scale(1.75);
    opacity: .4;
  }
}

.pl-ping {
  animation: plPingK 2.2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .pl-draw,
  .pl-fade,
  .pl-ping,
  .pl-drift,
  .pl-live,
  .pl-marquee,
  .pl-glow,
  .pl-chip,
  .pl-badge {
    animation: none !important;
  }

  .pl-click,
  .pl-click:hover,
  .pl-brand,
  .pl-brand:hover {
    transition: none;
    transform: none;
  }
}

@media (max-width: 900px) {
  .pl-root .pl-hero-grid {
    grid-template-columns: 1fr !important;
    gap: 28px !important;
  }

  .pl-pulse {
    padding: 28px 22px 24px !important;
  }

  .pl-rail-item {
    padding: 0 18px !important;
  }

  .pl-rail-item:first-child {
    padding-left: 0 !important;
  }

  .pl-platform-grid {
    margin-top: 0 !important;
  }
}

@media (max-width: 1000px) {
  .pl-root .pl-pulse-grid {
    grid-template-columns: 1fr 1fr !important;
  }

  .pl-root .pl-pulse-grid > :last-child {
    grid-column: 1 / -1;
    border-left: none !important;
    padding-left: 0 !important;
  }

  .pl-root .pi-two-col {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 900px) {
  .pl-root .pl-trends,
  .pl-root .pl-timing {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 600px) {
  .pl-root .pl-rail-items {
    display: grid !important;
    grid-template-columns: 1fr 1fr;
    gap: 18px 10px !important;
  }

  .pl-root .pl-rail-item {
    border-left: none !important;
    padding: 0 !important;
  }

  .pl-root .pl-pulse-grid {
    grid-template-columns: 1fr !important;
  }

  .pl-root .pl-pulse-grid > * {
    border-left: none !important;
    padding-left: 0 !important;
  }

  .pi-strip {
    grid-template-columns: repeat(2, minmax(0,1fr)) !important;
  }
}
      `}</style>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '2px 2px 0',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 36,
              fontWeight: 800,
              color: C.white,
              letterSpacing: '-0.04em',
              lineHeight: 1.08,
            }}
          >
            Platforms
          </h1>

          <div
            style={{
              fontSize: 13.5,
              lineHeight: '22px',
              color: C.muted,
              marginTop: 6,
            }}
          >
            See where your money is coming from — and what changed since your last stream.
          </div>
        </div>

        {recap && (
          <span
            style={{
              fontSize: 12,
              color: C.muted,
              whiteSpace: 'nowrap',
            }}
          >
            Updated through {streamWhen(recap.endTime, tz)}
          </span>
        )}
      </div>

      {!analytics || comparison.length === 0 ? (
        <LearningPanel learning={learning} onImport={onImport} />
      ) : (
        <>
          <SinceLastVisit visit={visit} tz={tz} />
          <div>
            <SectionHead icon="bars" title="Platform Pulse" note="Earnings across your analysed history · the badge compares the last 30 days with the 30 before"
              right={snapshot && (
                <span style={{ fontSize: 13, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                  Total <strong style={{ color: C.white, fontSize: 16 }}>{fmt$(snapshot.totalEarnings)}</strong> · {plural(snapshot.totalTips, 'tip')} · {plural(comparison.length, 'platform')}
                </span>
              )} />
            {learning.isLearning && (
              <div style={{ fontSize: 13, color: C.text, margin: '-4px 2px 12px', lineHeight: 1.55 }}>
                <span style={{ color: C.white, fontWeight: 700 }}>CamCash is still learning your platforms.</span>{' '}
                {[
                  learning.sessionsNeeded > 0 ? plural(learning.sessionsNeeded, 'more meaningful session') : null,
                  learning.hoursNeeded > 0 ? `${learning.hoursNeeded} more streamed hours` : null,
                ].filter(Boolean).join(' and ')}{[learning.sessionsNeeded > 0, learning.hoursNeeded > 0].some(Boolean) ? ' will unlock early patterns.' : ''}
              </div>
            )}
          {!isPro && multi && (
            <div style={{ fontSize: 13, color: C.text, marginTop: -2, lineHeight: 1.55 }}>
              {fullHistoryPlatform && names.includes(fullHistoryPlatform)
                ? <>Free plan: <strong style={{ color: C.white }}>{fullHistoryPlatform}</strong> (your primary) includes its full history; other platforms show their latest 31 days, so shares compare different spans.</>
                : <>Free plan: each platform shows its latest 31 days of activity.</>}
            </div>
          )}
          <div className="pl-grid pl-platform-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            {comparison.map(row => (
              <PulseCard key={row.platform} row={row} extras={extras[row.platform]} badges={freshPlatforms.has(row.platform) ? ['fresh', ...(statuses[row.platform] || [])] : (statuses[row.platform] || [])}
                selected={active === row.platform} onSelect={() => select(row.platform)} leading={multi && row.platform === comparison[0].platform} spark={daily?.byPlatform?.[row.platform]} />
            ))}
            {!multi && <ExpansionCard onImport={onImport} />}
          </div>
          </div>


          <LatestStream recap={recap} tz={tz} multi={multi} />
          <ActivityFeed items={activity} />

          {active && (
            <div>
              <PlatformDetail analytics={analytics} platformName={active} isPro={isPro} extras={extras[active]} onNavigate={onNavigate} detailRef={detailRef} onClose={() => setSelectedPlatform(null)} />
            </div>
          )}

          <div>
            <SectionHead icon="sparkle" title="CamCash Noticed" note="Personalized discoveries from your cross-platform data" />
            <FindingCards noticed={noticed} cross={cross} isPro={isPro} onUpgrade={onUpgrade} multi={multi} />
          </div>

          {daily && (
            <div>
              <SectionHead icon="trend" title="Historical Trends" note="Daily earnings by platform, last 30 days" />
              <TrendsSection daily={daily} comparison={comparison} />
            </div>
          )}

          <div>
            <SectionHead icon="clock" title="Cross-Platform Timing" note="When you tend to earn most, across all platforms" />
            <TimingSection analytics={analytics} timeIntel={timeIntel} comparison={comparison} isPro={isPro} />
          </div>

          {isPro && (
            <div>
              <SectionHead icon="trophy" title="Records & Breakdowns" note="Key facts and platform health" />
              <RecordsStrip comparison={comparison} extras={extras} efficiency={efficiency} />
            </div>
          )}

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
