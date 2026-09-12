"use client"
import React, { useState, useMemo } from 'react'
import {
  calculateBusinessSnapshot,
  calculatePlatformComparison,
  calculateEfficiencyComparison,
  calculateTimeIntelligence,
  calculateFanRevenueSummary,
  generateCamCashNoticed,
  calculatePlatformSnapshot,
  formatHour,
  ANALYSIS_WINDOW_DAYS,
} from '../../lib/platformIntelligenceAnalytics'
import {
  calculateSessionTypeBreakdown,
  calculateDayOfWeekBreakdown,
  calculatePeakHours,
  calculateTopFans,
} from '../../lib/platformIntelligence'

const C = {
  card: "#0d1322", card2: "#111829", border: "#1e2d45", border2: "#2a3f5f",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7", red: "#F87171",
}

const PLATFORM_ACCENT = {
  chaturbate: C.purple, bongacams: C.red, myfreecams: C.gold,
  camsoda: C.green, stripchat: C.blue, flirt4free: C.pink,
}
const accentFor = (p) => PLATFORM_ACCENT[(p || '').toLowerCase().trim()] || C.cyan

const fmt$ = (n) => n === null || n === undefined ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt$0 = (n) => n === null || n === undefined ? '—' : `$${Math.round(Number(n)).toLocaleString('en-US')}`
const fmtN = (n) => new Intl.NumberFormat('en-US').format(Math.round(n || 0))
const fmtH = (n) => n === null || n === undefined ? '—' : `${Number(n).toFixed(1)}h`

// ============================================
// COMPACT PRIMITIVES
// Dense by construction: no fixed heights, no oversized type, 14–20px padding.
// ============================================

function Section({ title, note, right, children, style }) {
  return (
    <section style={{ marginBottom: 20, ...style }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.text }}>
          {title}
        </h2>
        {right || (note ? <span style={{ fontSize: 11, color: C.muted }}>{note}</span> : null)}
      </div>
      {children}
    </section>
  )
}

function Panel({ children, style, accent }) {
  return (
    <div style={{
      background: 'rgba(15,20,32,0.75)',
      border: `1px solid ${accent ? `${accent}33` : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 10,
      padding: 14,
      ...style,
    }}>{children}</div>
  )
}

// Horizontal metric strip — the default for grouped numbers (never one card per metric).
function MetricStrip({ items }) {
  return (
    <div className="pi-strip" style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      gap: 1,
      background: C.border,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: 'hidden',
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

// Dense comparison table. Scrolls horizontally on narrow screens rather than growing tall.
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
                textTransform: 'uppercase', whiteSpace: 'nowrap',
                borderBottom: `1px solid ${C.border}`,
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
                  color: C.white, whiteSpace: 'nowrap',
                  borderTop: ri ? `1px solid ${C.border}` : 'none',
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Compact one-line intelligence row: label above, dot-separated facts beneath.
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
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
      border: `1px dashed ${C.gold}44`, borderRadius: 8, background: `${C.gold}0a`,
    }}>
      <span style={{ fontSize: 11 }}>🔒</span>
      <span style={{ fontSize: 11.5, color: C.text }}>{text}</span>
      <ProTag />
    </div>
  )
}

// Inline share bar — communicates proportion inside a table cell without adding height.
function ShareBar({ percent, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <div style={{ width: 46, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ minWidth: 30, textAlign: 'right' }}>{percent}%</span>
    </div>
  )
}

function PlatformCell({ platform }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: accentFor(platform), flexShrink: 0 }} />
      {platform}
    </span>
  )
}

// 24-hour earnings distribution as a compact inline bar row (Pro).
function HourBars({ hourlyData }) {
  const entries = Object.entries(hourlyData).map(([h, d]) => ({ hour: parseInt(h), ...d }))
  const max = Math.max(...entries.map(e => e.earnings), 0)
  if (max <= 0) return null
  return (
    <div style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
        Earnings by hour
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 38 }}>
        {entries.map(e => (
          <div key={e.hour} title={`${formatHour(e.hour)} · ${fmt$(e.earnings)}`} style={{
            flex: 1,
            height: `${Math.max(2, (e.earnings / max) * 100)}%`,
            background: e.earnings === max ? C.cyan : `${C.cyan}55`,
            borderRadius: 1,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.muted, marginTop: 3 }}>
        <span>12 AM</span><span>12 PM</span><span>11 PM</span>
      </div>
    </div>
  )
}

// Recommendations derive strictly from computed values — nothing invented.
function NextBestMove({ comparison, efficiency, timeIntel, hasHours }) {
  const moves = []

  if (hasHours && efficiency.length >= 2) {
    const sorted = [...efficiency].sort((a, b) => b.usdPerHour - a.usdPerHour)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    if (best.usdPerHour > 0 && worst.usdPerHour > 0 && best.usdPerHour >= worst.usdPerHour * 1.25) {
      moves.push(`Shift hours from ${worst.platform} (${fmt$(worst.usdPerHour)}/hr) toward ${best.platform} (${fmt$(best.usdPerHour)}/hr).`)
    }
  }
  if (timeIntel.bestDay && timeIntel.bestHour && timeIntel.dataQuality !== 'insufficient') {
    moves.push(`Protect ${timeIntel.bestDay.day} around ${timeIntel.bestHour.label} — your strongest recorded window.`)
  }
  if (comparison.length === 1) {
    moves.push('You have one platform connected. A second gives CamCash something to compare against.')
  }

  if (moves.length === 0) {
    return <Empty>Once there is enough data to compare platforms and times, suggested moves appear here.</Empty>
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {moves.map((m, i) => (
        <div key={i} style={{
          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 13px',
          background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 8,
        }}>
          <span style={{ color: C.cyan, fontSize: 12 }}>→</span>
          <span style={{ fontSize: 12.5, color: C.white, lineHeight: 1.45 }}>{m}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================
// UNIFIED VIEW
// ============================================

function UnifiedView({ platforms, tips, sessions, paidSessions, isPro }) {
  const snapshot = useMemo(() => calculateBusinessSnapshot(tips, sessions, paidSessions), [tips, sessions, paidSessions])
  const comparison = useMemo(() => calculatePlatformComparison(platforms, tips, sessions, paidSessions), [platforms, tips, sessions, paidSessions])
  const efficiency = useMemo(() => calculateEfficiencyComparison(platforms, tips, sessions, paidSessions), [platforms, tips, sessions, paidSessions])
  const timeIntel = useMemo(() => calculateTimeIntelligence(tips, sessions), [tips, sessions])
  const fans = useMemo(() => calculateFanRevenueSummary(tips, isPro), [tips, isPro])
  const noticed = useMemo(() => generateCamCashNoticed(tips, sessions, paidSessions, platforms, isPro), [tips, sessions, paidSessions, platforms, isPro])

  const hasHours = snapshot.totalHours > 0
  const byRevenue = useMemo(() => [...comparison].sort((a, b) => b.earnings - a.earnings), [comparison])
  const topRevenue = byRevenue[0] || null
  const topEfficiency = hasHours ? [...comparison].sort((a, b) => b.usdPerHour - a.usdPerHour)[0] : null

  return (
    <>
      {/* YOUR CAM BUSINESS */}
      <Section title="Your cam business" note={`Last ${ANALYSIS_WINDOW_DAYS} days`}>
        <MetricStrip items={[
          { label: 'Earnings', value: fmt$0(snapshot.totalEarnings), color: C.green },
          { label: 'Tips', value: fmtN(snapshot.totalTips) },
          { label: 'Hours', value: hasHours ? fmtH(snapshot.totalHours) : '—', sub: hasHours ? null : 'no timed sessions' },
          { label: '$ / hour', value: snapshot.usdPerHour === null ? '—' : fmt$(snapshot.usdPerHour), color: snapshot.usdPerHour === null ? C.muted : C.cyan },
          { label: 'Sessions', value: fmtN(snapshot.sessions) },
          { label: 'Active days', value: fmtN(snapshot.activeDays) },
        ]} />
        <div style={{ marginTop: 8 }}>
          <MetricStrip items={[
            { label: 'Avg / session', value: snapshot.sessions > 0 ? fmt$(snapshot.avgEarningsPerSession) : '—' },
            { label: 'Avg length', value: snapshot.avgSessionLength > 0 ? `${snapshot.avgSessionLength.toFixed(1)}h` : '—' },
            { label: 'Tips / session', value: snapshot.avgTipsPerSession > 0 ? snapshot.avgTipsPerSession.toFixed(1) : '—' },
            { label: 'Tips / hour', value: snapshot.tipsPerHour > 0 ? snapshot.tipsPerHour.toFixed(1) : '—' },
            { label: 'Platforms', value: fmtN(comparison.length) },
            { label: 'Supporters', value: fmtN(fans.uniqueTippers) },
          ]} />
        </div>
      </Section>

      {/* MONEY SOURCE + TIME EFFICIENCY, side by side on desktop */}
      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="Where your money comes from" style={{ marginBottom: 0 }}>
          {comparison.length === 0 ? (
            <Empty>No platform activity in the last {ANALYSIS_WINDOW_DAYS} days.</Empty>
          ) : (
            <DataTable
              columns={[
                { label: 'Platform', align: 'left' },
                { label: 'Earnings' }, { label: 'Share' }, { label: 'Tips' }, { label: 'Days' },
              ]}
              rows={byRevenue.map(p => [
                <PlatformCell key="p" platform={p.platform} />,
                fmt$(p.earnings),
                <ShareBar key="s" percent={p.earningsPercent} color={accentFor(p.platform)} />,
                fmtN(p.tips),
                fmtN(p.activeDays),
              ])}
            />
          )}
        </Section>

        <Section title="Where your time pays best" style={{ marginBottom: 0 }}>
          {!hasHours ? (
            <Empty>Hourly rates need timed sessions. Once your imports include session times, $/hr appears here.</Empty>
          ) : (
            <>
              <DataTable
                columns={[
                  { label: 'Platform', align: 'left' },
                  { label: '$/hr' }, { label: 'Hours' }, { label: 'vs avg' },
                ]}
                rows={[...efficiency].sort((a, b) => b.usdPerHour - a.usdPerHour).map(p => [
                  <PlatformCell key="p" platform={p.platform} />,
                  p.usdPerHour > 0 ? fmt$(p.usdPerHour) : '—',
                  p.hours > 0 ? fmtH(p.hours) : '—',
                  <span key="v" style={{ color: p.vsAverage > 0 ? C.green : p.vsAverage < 0 ? C.red : C.muted }}>
                    {p.vsAverage > 0 ? '+' : ''}{p.vsAverage}%
                  </span>,
                ])}
              />
              {topRevenue && topEfficiency && topRevenue.platform !== topEfficiency.platform && (
                <div style={{ marginTop: 8 }}>
                  <FactRow
                    label="Revenue vs efficiency"
                    accent={C.gold}
                    facts={`${topRevenue.platform} earns most · ${topEfficiency.platform} pays best per hour`}
                  />
                </div>
              )}
            </>
          )}
        </Section>
      </div>

      {/* PLATFORM PERFORMANCE MATRIX */}
      <Section title="Platform performance" note={`Per platform, last ${ANALYSIS_WINDOW_DAYS} days`}>
        {comparison.length === 0 ? (
          <Empty>Import platform data to compare performance.</Empty>
        ) : (
          <DataTable
            columns={[
              { label: 'Platform', align: 'left' },
              { label: 'Earnings' }, { label: 'Hours' }, { label: '$/hr' },
              { label: 'Tips' }, { label: 'Sessions' }, { label: '$/session' }, { label: 'Time share' },
            ]}
            rows={byRevenue.map(p => [
              <PlatformCell key="p" platform={p.platform} />,
              fmt$(p.earnings),
              p.hours > 0 ? fmtH(p.hours) : '—',
              p.usdPerHour > 0 ? fmt$(p.usdPerHour) : '—',
              fmtN(p.tips),
              fmtN(p.sessions),
              p.sessions > 0 ? fmt$(p.earningsPerSession) : '—',
              hasHours ? <ShareBar key="h" percent={p.hoursPercent} color={C.blue} /> : '—',
            ])}
          />
        )}
      </Section>

      {/* TIMING + FANS, side by side */}
      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="When you earn best" note={timeIntel.confidence} style={{ marginBottom: 0 }}>
          {timeIntel.dataQuality === 'insufficient' ? (
            <Empty>Not enough tips yet to read a reliable timing pattern.</Empty>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {timeIntel.bestHour && (
                <FactRow
                  label="Best hour"
                  accent={C.cyan}
                  facts={`${timeIntel.bestHour.label} · ${fmt$(timeIntel.bestHour.earnings)} · ${fmtN(timeIntel.bestHour.tips)} tips`}
                />
              )}
              {timeIntel.bestDay && (
                <FactRow
                  label="Best day"
                  accent={C.purple}
                  facts={`${timeIntel.bestDay.day} · ${fmt$(timeIntel.bestDay.earnings)} · ${fmtN(timeIntel.bestDay.tips)} tips`}
                />
              )}
              {topRevenue && (
                <FactRow
                  label="Strongest platform"
                  accent={accentFor(topRevenue.platform)}
                  facts={`${topRevenue.platform} · ${fmt$(topRevenue.earnings)} · ${topRevenue.earningsPercent}% of earnings`}
                />
              )}
              {isPro
                ? <HourBars hourlyData={timeIntel.hourlyData} />
                : <LockedRow text="Full 24-hour and weekday breakdown per platform" />}
            </div>
          )}
        </Section>

        <Section title="Who is driving your revenue" style={{ marginBottom: 0 }}>
          {fans.uniqueTippers === 0 ? (
            <Empty>No tips recorded in the last {ANALYSIS_WINDOW_DAYS} days.</Empty>
          ) : (
            <>
              <MetricStrip items={[
                { label: 'Supporters', value: fmtN(fans.uniqueTippers) },
                { label: 'Returning', value: fmtN(fans.returningTippers) },
                { label: 'New', value: fmtN(fans.newTippers) },
                { label: 'Top 3 share', value: `${fans.topThreeContribution}%`, color: fans.topThreeContribution >= 50 ? C.gold : C.white },
              ]} />
              <div style={{ marginTop: 8 }}>
                <DataTable
                  columns={[{ label: 'Top supporters', align: 'left' }, { label: 'Tips' }, { label: 'Total' }, { label: 'Share' }]}
                  rows={(isPro ? fans.fullSpenderRanking.slice(0, 8) : fans.topThreeSpenders).map(f => [
                    f.username, fmtN(f.tipCount), fmt$(f.earnings),
                    <ShareBar key="s" percent={f.earningsPercent} color={C.pink} />,
                  ])}
                />
              </div>
              {!isPro && fans.uniqueTippers > 3 && (
                <div style={{ marginTop: 6 }}>
                  <LockedRow text={`Full ranking of all ${fmtN(fans.uniqueTippers)} supporters`} />
                </div>
              )}
            </>
          )}
        </Section>
      </div>

      {/* CAMCASH NOTICED — real findings only */}
      <Section title="CamCash noticed" note="Observations from your own data">
        {noticed.length === 0 ? (
          <Empty>Nothing stands out yet. As more data comes in, findings appear here.</Empty>
        ) : (
          <div style={{
            display: 'grid', gap: 1, background: `${C.cyan}22`,
            border: `1px solid ${C.cyan}33`, borderRadius: 10, overflow: 'hidden',
          }}>
            {noticed.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: 'rgba(13,19,34,0.92)', padding: '10px 13px' }}>
                <span style={{ fontSize: 13, lineHeight: 1.4 }}>{n.icon}</span>
                <span style={{ fontSize: 12.5, color: C.white, lineHeight: 1.45 }}>{n.text}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* PRO PREVIEWS — free only */}
      {!isPro && (
        <Section title="Go deeper with Pro">
          <div className="pi-pro-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { t: 'Historical trends', d: `Month-over-month movement per platform, beyond the ${ANALYSIS_WINDOW_DAYS}-day window.` },
              { t: 'Full timing map', d: 'Every hour and weekday, split per platform.' },
              { t: 'Complete fan ranking', d: 'All supporters, spend history, and who has gone quiet.' },
            ].map((p, i) => (
              <Panel key={i} accent={C.gold} style={{ padding: 13 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.white, display: 'flex', alignItems: 'center' }}>
                  {p.t}<ProTag />
                </div>
                <div style={{ fontSize: 11, color: C.text, marginTop: 4, lineHeight: 1.45 }}>{p.d}</div>
              </Panel>
            ))}
          </div>
        </Section>
      )}

      {/* NEXT BEST MOVE */}
      <Section title="Your next best move">
        <NextBestMove comparison={comparison} efficiency={efficiency} timeIntel={timeIntel} hasHours={hasHours} />
      </Section>
    </>
  )
}

// ============================================
// SPLIT VIEW — single-platform deep dive
// ============================================

function SplitView({ selectedPlatform, tips, sessions, paidSessions, isPro }) {
  const snap = useMemo(() => calculatePlatformSnapshot(selectedPlatform, tips, sessions, paidSessions), [selectedPlatform, tips, sessions, paidSessions])
  const sessionTypes = useMemo(() => calculateSessionTypeBreakdown(tips, paidSessions, selectedPlatform), [tips, paidSessions, selectedPlatform])
  const dayBreakdown = useMemo(() => calculateDayOfWeekBreakdown(tips, paidSessions, selectedPlatform), [tips, paidSessions, selectedPlatform])
  const peakHours = useMemo(() => calculatePeakHours(tips, paidSessions, selectedPlatform), [tips, paidSessions, selectedPlatform])
  const topFans = useMemo(() => calculateTopFans(tips, paidSessions, selectedPlatform), [tips, paidSessions, selectedPlatform])
  const accent = accentFor(selectedPlatform)

  if (!snap.hasData) {
    return <Empty>No activity recorded for {selectedPlatform} in the last {ANALYSIS_WINDOW_DAYS} days.</Empty>
  }

  const activeDays = dayBreakdown.filter(d => d.count > 0)

  return (
    <>
      <Section title={`${selectedPlatform} snapshot`} note={`Last ${ANALYSIS_WINDOW_DAYS} days`}>
        <MetricStrip items={[
          { label: 'Earnings', value: fmt$0(snap.earnings), color: C.green },
          { label: 'Tips', value: fmtN(snap.tips) },
          { label: 'Hours', value: snap.hours > 0 ? fmtH(snap.hours) : '—' },
          { label: '$ / hour', value: snap.usdPerHour === null ? '—' : fmt$(snap.usdPerHour), color: snap.usdPerHour === null ? C.muted : accent },
          { label: 'Sessions', value: fmtN(snap.sessions) },
          { label: 'Active days', value: fmtN(snap.activeDays) },
        ]} />
      </Section>

      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title="Performance" style={{ marginBottom: 0 }}>
          <MetricStrip items={[
            { label: '$ / session', value: snap.sessions > 0 ? fmt$(snap.earningsPerSession) : '—' },
            { label: 'Tips / hour', value: snap.tipsPerHour > 0 ? snap.tipsPerHour.toFixed(1) : '—' },
            { label: 'Avg length', value: snap.avgSessionLength > 0 ? `${snap.avgSessionLength.toFixed(1)}h` : '—' },
            { label: 'History', value: snap.daysAvailable > 0 ? `${fmtN(snap.daysAvailable)}d` : '—' },
          ]} />
        </Section>

        <Section title="Revenue mix" style={{ marginBottom: 0 }}>
          {sessionTypes.length === 0 ? (
            <Empty>No revenue-type detail for this platform.</Empty>
          ) : (
            <DataTable
              columns={[{ label: 'Type', align: 'left' }, { label: 'Count' }, { label: 'Earnings' }, { label: 'Share' }]}
              rows={sessionTypes.slice(0, 6).map(s => [
                s.type, fmtN(s.count), fmt$(s.usd),
                <ShareBar key="s" percent={s.pct} color={accent} />,
              ])}
            />
          )}
        </Section>
      </div>

      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Section title={`When ${selectedPlatform} pays`} style={{ marginBottom: 0 }}>
          {peakHours.length === 0 ? (
            <Empty>Not enough activity on this platform to read a timing pattern.</Empty>
          ) : (
            <>
              <DataTable
                columns={[{ label: 'Hour', align: 'left' }, { label: 'Earnings' }, { label: 'Entries' }]}
                rows={peakHours.slice(0, isPro ? 7 : 3).map(h => [
                  formatHour(h.hour), fmt$(h.usd), fmtN(h.count),
                ])}
              />
              {!isPro && peakHours.length > 3 && (
                <div style={{ marginTop: 6 }}><LockedRow text="Full hourly map for this platform" /></div>
              )}
            </>
          )}
        </Section>

        <Section title="Day of week" style={{ marginBottom: 0 }}>
          {activeDays.length === 0 ? (
            <Empty>Not enough data for a weekday pattern.</Empty>
          ) : (
            <DataTable
              columns={[{ label: 'Day', align: 'left' }, { label: 'Earnings' }, { label: 'Entries' }]}
              rows={activeDays.map(d => [d.day, fmt$(d.usd), fmtN(d.count)])}
            />
          )}
        </Section>
      </div>

      <Section title={`Supporters on ${selectedPlatform}`} note="Identities are never merged across platforms">
        {topFans.length === 0 ? (
          <Empty>No supporters recorded on this platform yet.</Empty>
        ) : (
          <>
            <DataTable
              columns={[{ label: 'Supporter', align: 'left' }, { label: 'Total' }, { label: 'Share' }]}
              rows={topFans.slice(0, isPro ? 5 : 3).map(f => [
                f.name, fmt$(f.usd),
                <ShareBar key="s" percent={f.pct} color={C.pink} />,
              ])}
            />
            {!isPro && topFans.length > 3 && (
              <div style={{ marginTop: 6 }}><LockedRow text="Full supporter list for this platform" /></div>
            )}
          </>
        )}
      </Section>
    </>
  )
}

// ============================================
// PAGE
// ============================================

export default function PlatformsIntelligence({ platforms = [], tips = [], sessions = [], paidSessions = [], isPro = false }) {
  const [view, setView] = useState('unified')
  const [selectedPlatform, setSelectedPlatform] = useState(null)

  // Falls back to the first connected platform whenever the selection is stale
  // (platform removed, or nothing picked yet).
  const activePlatform = platforms.includes(selectedPlatform) ? selectedPlatform : (platforms[0] || null)

  return (
    <div className="pi-root" style={{ maxWidth: 1280 }}>
      <style>{`
        .pi-root { max-width: 100%; }
        .pi-root table { font-variant-numeric: tabular-nums; }
        /* Grid and flex children default to min-width:auto, which lets a wide
           table stretch its column and scroll the whole page sideways instead
           of scrolling inside its own wrapper. */
        .pi-root section, .pi-root .pi-two-col > * { min-width: 0; }
        @media (max-width: 900px) {
          .pi-root .pi-two-col { grid-template-columns: 1fr !important; gap: 14px !important; }
          .pi-root .pi-pro-grid { grid-template-columns: 1fr !important; }
          .pi-root .pi-strip { grid-template-columns: repeat(3, minmax(0,1fr)) !important; }
        }
        @media (max-width: 520px) {
          .pi-root .pi-strip { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
        }
      `}</style>

      {/* Compact header + view toggle on a single row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted }}>Platforms</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 19, fontWeight: 800, color: C.white }}>Platform Intelligence</h1>
        </div>
        <div style={{ display: 'flex', gap: 2, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 2 }}>
          {['unified', 'split'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
              textTransform: 'uppercase', borderRadius: 6, cursor: 'pointer', border: 'none',
              background: view === v ? C.cyan : 'transparent',
              color: view === v ? '#05070f' : C.text,
            }}>{v}</button>
          ))}
        </div>
      </div>

      {platforms.length === 0 ? (
        <Empty>Connect a platform to see your intelligence.</Empty>
      ) : view === 'unified' ? (
        <UnifiedView platforms={platforms} tips={tips} sessions={sessions} paidSessions={paidSessions} isPro={isPro} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {platforms.map(p => (
              <button key={p} onClick={() => setSelectedPlatform(p)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 11px', fontSize: 11.5, fontWeight: 600, borderRadius: 7, cursor: 'pointer',
                background: activePlatform === p ? `${accentFor(p)}1f` : 'transparent',
                border: `1px solid ${activePlatform === p ? `${accentFor(p)}88` : C.border}`,
                color: activePlatform === p ? C.white : C.text,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: accentFor(p) }} />
                {p}
              </button>
            ))}
          </div>
          {activePlatform && (
            <SplitView
              selectedPlatform={activePlatform}
              tips={tips}
              sessions={sessions}
              paidSessions={paidSessions}
              isPro={isPro}
            />
          )}
        </>
      )}
    </div>
  )
}
