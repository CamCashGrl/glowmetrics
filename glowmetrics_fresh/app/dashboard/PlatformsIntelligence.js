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
import { card, HERO_GRADIENT } from './CommandCenter'

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
  const color = b.color === C.muted ? C.text : b.color
  return (
    <span className="pl-badge" title={BADGE_HELP[kind]} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
      color, background: `${b.color}12`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
    }}>{b.label}</span>
  )
}

// Suspended glass, in the Command Center "next best move" language: deep
// navy translucency, a hairline border, an inset top highlight and a soft
// drop shadow. `glow` adds an ambient corner light without tinting the card.
const GLASS_BG = 'linear-gradient(160deg, rgba(22,27,58,0.58) 0%, rgba(10,12,28,0.70) 100%)'
const GLASS_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.06), 0 30px 60px -34px rgba(0,0,0,0.85)'
function Glass({ children, style, accent, glow, className, onClick, ...rest }) {
  return (
    <div className={`pl-glass${onClick ? ' pl-click' : ''}${className ? ` ${className}` : ''}`} onClick={onClick}
      style={{
        position: 'relative', padding: 22, minWidth: 0, borderRadius: 22, overflow: 'hidden',
        background: GLASS_BG, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${accent ? `${accent}30` : 'rgba(255,255,255,0.06)'}`,
        boxShadow: accent ? `${GLASS_SHADOW}, 0 0 44px -18px ${accent}55` : GLASS_SHADOW,
        ...style,
      }} {...rest}>
      {glow && <span aria-hidden style={{ position: 'absolute', top: -90, right: -70, width: 240, height: 240, borderRadius: '50%', background: glow, opacity: 0.16, filter: 'blur(70px)', pointerEvents: 'none' }} />}
      <div style={{ position: 'relative' }}>{children}</div>
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

function PlatformPulse({ comparison, snapshot, recap, learning, newFans }) {
  const leader = comparison[0]
  const multi = comparison.length > 1
  const accent = accentFor(leader.platform)
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 30, padding: '40px 42px',
      background: `radial-gradient(120% 140% at 0% 0%, rgba(34,211,238,0.10) 0%, transparent 45%),
        radial-gradient(90% 120% at 100% 100%, rgba(236,72,153,0.12) 0%, transparent 50%),
        linear-gradient(150deg, rgba(24,28,66,0.72) 0%, rgba(10,12,30,0.82) 60%, rgba(18,10,34,0.80) 100%)`,
      backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 40px 90px -40px rgba(0,0,0,0.9), 0 0 80px -30px rgba(124,92,255,0.35)',
    }}>
      {/* Atmosphere behind the leading platform */}
      <span aria-hidden style={{ position: 'absolute', left: -60, top: -120, width: 520, height: 380, borderRadius: '50%', background: accent, opacity: 0.20, filter: 'blur(110px)', pointerEvents: 'none' }} />
      <span aria-hidden style={{ position: 'absolute', right: '18%', bottom: -160, width: 360, height: 300, borderRadius: '50%', background: '#7C5CFF', opacity: 0.14, filter: 'blur(100px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: 36, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 440px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: accent, boxShadow: `0 0 14px ${accent}` }} />
            <span style={{ ...eyebrow, color: C.cyan }}>Platform pulse</span>
          </div>
          <div style={{ fontSize: 50, fontWeight: 800, color: C.white, letterSpacing: '-0.045em', lineHeight: 1.04, marginTop: 18, textShadow: `0 0 40px ${accent}44` }}>
            {multi ? <>{leader.platform}<br /><span style={{ color: 'rgba(241,245,249,0.72)' }}>is leading</span></> : <>Everything on<br />{leader.platform}</>}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 34, flexWrap: 'wrap', marginTop: 30 }}>
            <div>
              <div style={{ fontSize: 44, fontWeight: 800, color: C.white, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                <Counter value={snapshot.totalEarnings} />
              </div>
              <div style={{ fontSize: 13, color: C.text, marginTop: 9 }}>total platform earnings</div>
            </div>
            {multi && (
              <div>
                <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: accent, textShadow: `0 0 26px ${accent}66` }}>
                  {leader.earningsPercent}%
                </div>
                <div style={{ fontSize: 13, color: C.text, marginTop: 9 }}>from {leader.platform}</div>
              </div>
            )}
          </div>

          <div style={{ fontSize: 13, color: C.muted, marginTop: 22, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span><span style={{ color: C.text }}>{plural(snapshot.totalTips, 'tip')}</span> across {plural(comparison.length, 'platform')}</span>
            <span><span style={{ color: C.text }}>{fmtN(snapshot.sessions)}</span> meaningful sessions</span>
            {newFans?.total > 0 && <span style={{ color: C.cyan }}>+{plural(newFans.total, 'new fan')} this week</span>}
          </div>

          {learning.isLearning && (
            <div style={{ fontSize: 13.5, color: C.text, marginTop: 16, lineHeight: 1.6, maxWidth: 520 }}>
              <strong style={{ color: C.white }}>CamCash is still learning your platforms.</strong>{' '}
              {[
                learning.sessionsNeeded > 0 ? plural(learning.sessionsNeeded, 'more meaningful session') : null,
                learning.hoursNeeded > 0 ? `${learning.hoursNeeded} more streamed hours` : null,
              ].filter(Boolean).join(' and ')} will unlock early patterns.
            </div>
          )}
        </div>

        {/* Latest stream: a secondary glass element inside the hero */}
        <div style={{
          flex: '0 1 300px', minWidth: 250, alignSelf: 'center', borderRadius: 22, padding: '22px 24px',
          background: 'linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.07)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 20px 40px -24px rgba(0,0,0,0.7)',
        }}>
          {recap ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pl-dot" style={{ width: 7, height: 7, borderRadius: 4, background: C.green }} />
                <span style={eyebrow}>Your latest stream</span>
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, color: C.green, letterSpacing: '-0.035em', marginTop: 12, fontVariantNumeric: 'tabular-nums', textShadow: '0 0 24px rgba(16,185,129,0.35)' }}>
                +<Counter value={recap.earned} />
              </div>
              <div style={{ fontSize: 13, color: C.text, marginTop: 6, lineHeight: 1.5 }}>
                on <span style={{ color: C.white, fontWeight: 700 }}>{recap.platform}</span><br />
                {plural(recap.tips, 'tip')} from {plural(recap.fans, 'fan')}
              </div>
              {recap.tookLead && (
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.pink, marginTop: 10 }}>{recap.platform} moved into the lead</div>
              )}
            </>
          ) : (
            <>
              <div style={eyebrow}>Since your last stream</div>
              <div style={{ fontSize: 14.5, color: C.white, marginTop: 10, lineHeight: 1.5 }}>
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
  const items = [
    { icon: '💸', value: fmtSigned$(recap.earned), label: `earned · ${recap.platform}`, color: C.green },
    recap.returningFans === null
      ? { icon: '🔁', value: 'First stream here', label: 'returning fans from your next stream', color: C.text }
      : { icon: '🔁', value: plural(recap.returningFans, 'fan'), label: 'tipped again', color: recap.returningFans ? C.cyan : C.text },
    recap.newSpenders === null
      ? null
      : { icon: '✨', value: recap.newSpenders ? plural(recap.newSpenders, 'new spender') : 'No new spenders', label: 'first-time tippers', color: recap.newSpenders ? C.pink : C.text },
    multi && recap.shareShiftPts
      ? { icon: '📊', value: `${recap.shareShiftPts > 0 ? '+' : ''}${recap.shareShiftPts} pts`, label: recap.tookLead ? `${recap.platform} took the lead` : 'revenue share', color: recap.shareShiftPts > 0 ? C.green : C.blue }
      : dur ? { icon: '⏱️', value: `${dur >= 60 ? `${Math.floor(dur / 60)}h ` : ''}${dur % 60}m`, label: 'streamed', color: C.gold } : null,
  ].filter(Boolean)
  return (
    <div style={{
      borderRadius: 20, padding: '16px 22px',
      background: 'linear-gradient(90deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))',
      border: '1px solid rgba(255,255,255,0.045)',
      display: 'flex', alignItems: 'center', gap: '14px 34px', flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span className="pl-dot" style={{ width: 7, height: 7, borderRadius: 4, background: C.green }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Since your last stream</span>
        <span style={{ fontSize: 12, color: C.muted }}>{streamWhen(recap.endTime, tz)}</span>
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13, alignSelf: 'center' }}>{it.icon}</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: it.color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{it.value}</span>
          <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>{it.label}</span>
        </div>
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
  // At most two status labels; "new since last visit" shows as a live dot.
  const shownBadges = badges.filter(b => b !== 'fresh').slice(0, 2)
  return (
    <Glass accent={selected ? accent : undefined} glow={accent} onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      aria-pressed={selected} style={{
        padding: '24px 24px 20px',
        ...(leading ? { background: `radial-gradient(120% 90% at 0% 0%, ${accent}1f 0%, transparent 55%), ${GLASS_BG}`, boxShadow: `${GLASS_SHADOW}, 0 0 60px -26px ${accent}88` } : {}),
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: accent, boxShadow: `0 0 14px ${accent}`, flexShrink: 0 }} />
          <span style={{ fontSize: 17, fontWeight: 800, color: C.white, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.platform}</span>
          {fresh && <span title={BADGE_HELP.fresh} className="pl-dot" style={{ width: 6, height: 6, borderRadius: 3, background: C.green, flexShrink: 0 }} />}
        </div>
        <span style={{ fontSize: 11.5, color: selected ? accent : C.muted, whiteSpace: 'nowrap' }}>{selected ? 'Viewing ↓' : 'Details →'}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 21, marginTop: 12 }}>
        {shownBadges.map(b => <Badge key={b} kind={b} />)}
      </div>

      <div style={{ fontSize: 36, fontWeight: 800, color: C.white, marginTop: 22, letterSpacing: '-0.035em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        <Counter value={row.earnings} />
      </div>
      <div style={{ fontSize: 13, color: accent, fontWeight: 700, marginTop: 8 }}>{row.earningsPercent}% of your earnings</div>
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden', marginTop: 14 }}>
        <div style={{ width: mounted ? `${row.earningsPercent}%` : 0, height: '100%', background: accent, boxShadow: `0 0 10px ${accent}`, borderRadius: 1, transition: 'width 900ms cubic-bezier(.2,.8,.2,1)' }} />
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 20, fontSize: 12.5, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
        <span><span style={{ color: C.text, fontWeight: 700 }}>{fmtN(row.tips)}</span> tips</span>
        <span><span style={{ color: C.text, fontWeight: 700 }}>{fmtN(extras?.uniqueFans ?? 0)}</span> fans</span>
        <span><span style={{ color: C.text, fontWeight: 700 }}>{row.avgTipSize > 0 ? fmt$(row.avgTipSize) : '—'}</span> avg tip</span>
      </div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: C.muted, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
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

// Lightweight, platform-only activity feed. Every item is a dated event from
// buildPlatformActivity; nothing is shown when nothing happened.
const ACTIVITY_ICON = { earned24h: '💸', newFans: '✨', returning: '🔁', share: '📊' }
function ActivityFeed({ items }) {
  if (!items.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '0 4px' }}>
      <span style={{ ...eyebrow, fontSize: 10, color: C.cyan, marginRight: 6, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <span className="pl-dot" style={{ width: 6, height: 6, borderRadius: 3, background: C.cyan }} />Just updated
      </span>
      {items.slice(0, 6).map((it, i) => {
        const a = accentFor(it.platform)
        return (
          <span key={i} className="pl-chip" title={it.sub} style={{
            animationDelay: `${i * 60}ms`, display: 'inline-flex', alignItems: 'center', gap: 7,
            fontSize: 12, color: C.white, padding: '5px 11px', borderRadius: 999, maxWidth: '100%',
            background: 'rgba(255,255,255,0.035)', boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 18px -10px ${a}`,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: a, boxShadow: `0 0 8px ${a}`, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{it.text}</span>
            <span style={{ color: C.muted, fontSize: 11, whiteSpace: 'nowrap' }}>{it.sub}</span>
          </span>
        )
      })}
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
                <span style={{ color: C.gold, fontWeight: 700, whiteSpace: 'nowrap' }}>🔒 Pro</span>
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
      <div style={{ ...eyebrow, marginBottom: 18 }}>Where your money comes from</div>
      <div style={{ display: 'grid', gap: 18 }}>
        {comparison.map(p => {
          const accent = accentFor(p.platform)
          return (
            <div key={p.platform}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 9 }}>
                <span style={{ fontSize: 14.5, color: C.white, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.platform}</span>
                <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ fontSize: 13, color: C.muted }}>{fmt$(p.earnings)}</span>
                  <span style={{ fontSize: 17, color: C.white, fontWeight: 800, marginLeft: 10 }}>{p.earningsPercent}%</span>
                </span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: mounted ? `${Math.max(p.earningsPercent, p.earnings > 0 ? 1 : 0)}%` : 0, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${accent}66, ${accent})`, boxShadow: `0 0 14px ${accent}66`, transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// "Where your money comes from" and "CamCash noticed" as two halves of one
// intelligence surface — no divider, separated by space and light.
function IntelligenceArea({ comparison, multi, noticedProps }) {
  return (
    <Glass glow="#7C5CFF" style={{ padding: '28px 30px' }}>
      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: multi ? 'minmax(0,0.9fr) minmax(0,1.1fr)' : '1fr', gap: 40, alignItems: 'start' }}>
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
    <div style={{ minWidth: 0 }}>
      <div style={{ ...eyebrow, marginBottom: 18 }}><span style={{ color: C.pink }}>✦</span> CamCash noticed</div>
      {shown.length === 0 && freeTeasers.length === 0 ? (
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55 }}>
          {multi
            ? 'Nothing stands out between your platforms yet. Findings appear here when the gap is big enough to be real.'
            : 'Findings appear here once a pattern in your data is strong enough to call out.'}
        </div>
      ) : (
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '22px 24px',
          background: 'linear-gradient(150deg, rgba(124,92,255,0.12) 0%, rgba(34,211,238,0.04) 45%, rgba(236,72,153,0.08) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 0 1px rgba(255,255,255,0.045)',
        }}>
          <span aria-hidden style={{ position: 'absolute', right: -50, top: -60, width: 200, height: 200, borderRadius: '50%', background: '#EC4899', opacity: 0.14, filter: 'blur(60px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            {lead && (
              <div className="pl-chip" style={{ fontSize: 17, fontWeight: 600, color: C.white, lineHeight: 1.5, letterSpacing: '-0.01em' }}>{lead}</div>
            )}
            {rest.slice(0, 3).map((t, i) => (
              <div key={i} className="pl-chip" style={{ animationDelay: `${(i + 1) * 70}ms`, display: 'flex', gap: 10, marginTop: 14, fontSize: 13.5, color: C.text, lineHeight: 1.55 }}>
                <span style={{ color: C.indigo, flexShrink: 0 }}>✦</span><span style={{ minWidth: 0 }}>{t}</span>
              </div>
            ))}
            {freeTeasers.slice(0, 2).map((c, i) => (
              <div key={c.id} style={{ marginTop: lead || i ? 18 : 0, paddingTop: lead || i ? 16 : 0, borderTop: lead || i ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: C.pink }}>✦ PRO INSIGHT</span>
                  <span aria-hidden style={{ fontSize: 12, color: C.text, filter: 'blur(4px)', userSelect: 'none' }}>██████████ · ██%</span>
                </div>
                <div style={{ fontSize: 14, color: C.white, marginTop: 6, lineHeight: 1.5 }}>{c.teaser}</div>
                <button type="button" onClick={() => onUpgrade?.(`platforms_insight_${c.id}`)} style={{
                  marginTop: 8, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 800, backgroundImage: CTA_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                }}>{c.cta} →</button>
              </div>
            ))}
            {freeTeasers.length > 2 && (
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 12 }}>
                + {plural(freeTeasers.length - 2, 'more finding')} already found in your data
              </div>
            )}
          </div>
        </div>
      )}
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

// Free: one consolidated, personal "what's already waiting" panel. Each line
// is a real count from this account; lines without data are left out, and
// the panel is hidden when nothing is waiting. No timers, no fake scarcity.
function UnlockPanel({ findings, platforms, hiddenTipCount, supporters, hasPlatformTiming, onUpgrade }) {
  const items = [
    findings > 0 && { icon: '✦', text: `${plural(findings, 'cross-platform finding')} already found in your data` },
    platforms > 1 && { icon: '⚖️', text: `Side-by-side comparison of your ${platforms} platforms: $/hr, fan value and momentum` },
    hiddenTipCount > 0 && { icon: '🗂️', text: `${fmtN(hiddenTipCount)} older tips saved, with month-by-month platform history` },
    supporters > 3 && { icon: '👥', text: `All ${fmtN(supporters)} supporters ranked on every platform` },
    hasPlatformTiming && { icon: '🕐', text: 'Best hour and day for each platform' },
  ].filter(Boolean)
  if (items.length === 0) return null
  return (
    <div style={{ background: HERO_GRADIENT, border: '1px solid rgba(236,72,153,0.30)', borderRadius: 18, padding: 26, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -60, bottom: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(124,92,255,0.14)', filter: 'blur(70px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 380px', minWidth: 0 }}>
          <div style={{ ...eyebrow, color: C.pink, marginBottom: 10 }}>Your full picture</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>It&apos;s already in your account</div>
          <div style={{ fontSize: 13.5, color: C.text, marginTop: 6, lineHeight: 1.55 }}>
            Everything below comes from data you&apos;ve already imported. It&apos;s all there when you upgrade, with no re-upload needed.
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            {items.map((it, i) => (
              <div key={i} className="pl-chip" style={{ animationDelay: `${i * 60}ms`, display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: C.white, lineHeight: 1.45 }}>
                <span style={{ width: 22, flexShrink: 0, textAlign: 'center' }}>{it.icon}</span>
                <span style={{ minWidth: 0 }}>{it.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: '0 1 auto' }}>
          <BrandButton onClick={() => onUpgrade?.('platforms_full_picture')} style={{ padding: '15px 28px', fontSize: 16, borderRadius: 12 }}>
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
    <div className="pl-chip" style={{ borderRadius: 20, padding: '14px 22px', background: 'linear-gradient(90deg, rgba(16,185,129,0.10), rgba(16,185,129,0.02) 60%, transparent)', boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.16), 0 0 40px -24px rgba(16,185,129,0.6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span className="pl-dot" style={{ width: 9, height: 9, borderRadius: 5, background: C.green }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Since your last visit</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: C.green, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>+<Counter value={visit.totalUSD} /></span>
        <span style={{ fontSize: 13.5, color: C.text }}>
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
          .pl-click, .pl-click:hover, .pl-brand, .pl-brand:hover { transition: none; transform: none; }
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
