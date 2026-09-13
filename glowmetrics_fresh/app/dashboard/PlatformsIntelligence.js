"use client"

import React, { useMemo, useState } from 'react'
import {
  buildBusinessSnapshot,
  buildPlatformComparison,
  buildEfficiencyComparison,
  buildTimeIntelligence,
  buildFanRevenue,
  buildCamCashNoticed,
  buildPlatformSnapshot,
  buildDataCoverage,
  formatHour,
} from '../../lib/platformIntelligenceAnalytics'
import { computeDataVaultStats } from './DashboardPreview'

const C = {
  bg: '#080B18',
  panel: 'rgba(12,16,34,0.78)',
  panelSoft: 'rgba(255,255,255,0.035)',
  border: 'rgba(255,255,255,0.09)',
  borderSoft: 'rgba(255,255,255,0.06)',
  white: '#FFFFFF',
  text: '#A5ABC0',
  muted: '#6F7890',
  cyan: '#16F4FF',
  blue: '#55B8FF',
  purple: '#7C5CFF',
  pink: '#FF2BAE',
  green: '#10B981',
  amber: '#F59E0B',
  coral: '#F87171',
}

const GRAD = 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)'
const PLATFORM_ACCENT = {
  chaturbate: C.cyan,
  bongacams: C.purple,
  myfreecams: C.blue,
  camsoda: C.green,
  stripchat: C.pink,
  flirt4free: C.amber,
}

const accentFor = (platform) => PLATFORM_ACCENT[(platform || '').toLowerCase().trim()] || C.cyan
const fmt$ = (n) => n === null || n === undefined ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt$0 = (n) => n === null || n === undefined ? '—' : `$${Math.round(Number(n)).toLocaleString('en-US')}`
const fmtN = (n) => n === null || n === undefined ? '—' : new Intl.NumberFormat('en-US').format(Math.round(n))
const fmtH = (n) => n === null || n === undefined ? '—' : `${Number(n).toFixed(1)}h`

function TopAccent({ color = GRAD }) {
  return <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }} />
}

function Card({ children, style, accent = null }) {
  return (
    <div style={{
      position: 'relative',
      minWidth: 0,
      overflow: 'hidden',
      borderRadius: 16,
      border: `1px solid ${accent ? `${accent}35` : C.border}`,
      background: C.panel,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.045), 0 12px 32px rgba(0,0,0,0.18)',
      ...style,
    }}>
      {accent && <TopAccent color={accent} />}
      {children}
    </div>
  )
}

function SectionHeader({ title, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 9, flexWrap: 'wrap' }}>
      <h2 style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.text }}>{title}</h2>
      {note && <span style={{ fontSize: 10.5, color: C.muted }}>{note}</span>}
    </div>
  )
}

function ProgressBar({ value, color = GRAD, height = 4 }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div style={{ height, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 100, transition: 'width .45s ease' }} />
    </div>
  )
}

function Metric({ label, value, sub, color = C.white }) {
  return (
    <div style={{ minWidth: 0, padding: '10px 12px', background: C.panelSoft, border: `1px solid ${C.borderSoft}`, borderRadius: 11 }}>
      <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 17, lineHeight: 1.15, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ marginTop: 2, fontSize: 9.5, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ padding: '12px 14px', borderRadius: 11, border: `1px dashed ${C.border}`, color: C.muted, fontSize: 11.5, lineHeight: 1.5 }}>{children}</div>
}

function PlatformDot({ platform }) {
  const color = accentFor(platform)
  return <span aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: color, boxShadow: `0 0 9px ${color}55`, flexShrink: 0 }} />
}

function PlatformPill({ platform, active, onClick }) {
  const accent = accentFor(platform)
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '6px 11px', borderRadius: 100, cursor: 'pointer',
      border: `1px solid ${active ? `${accent}70` : C.border}`,
      background: active ? `${accent}14` : 'rgba(255,255,255,0.025)',
      color: active ? C.white : C.text,
      fontSize: 11.5, fontWeight: active ? 750 : 600,
      whiteSpace: 'nowrap',
    }}>
      <PlatformDot platform={platform} />{platform}
    </button>
  )
}

function ConnectedPlatforms({ comparison, coverage, selectedPlatform, onSelect, isPro }) {
  return (
    <Card style={{ padding: 14 }}>
      <SectionHeader title="Connected platforms" note={isPro ? 'Your imported platform data' : 'Your current platform data'} />
      <div style={{ display: 'grid', gap: 7 }}>
        {comparison.map((p) => {
          const accent = accentFor(p.platform)
          const selected = selectedPlatform === p.platform
          return (
            <button key={p.platform} onClick={() => onSelect(p.platform)} style={{
              width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) auto', gap: 12,
              padding: '9px 10px', borderRadius: 11, cursor: 'pointer',
              border: `1px solid ${selected ? `${accent}55` : C.borderSoft}`,
              background: selected ? `${accent}0b` : 'rgba(255,255,255,0.02)', color: C.white,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <PlatformDot platform={p.platform} />
                  <span style={{ fontSize: 12, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.platform}</span>
                  <span style={{ fontSize: 9.5, color: C.green, marginLeft: 'auto' }}>Connected</span>
                </div>
                <ProgressBar value={p.earningsPercent} color={`linear-gradient(90deg,${accent},${accent}99)`} height={3} />
              </div>
              <div style={{ textAlign: 'right', minWidth: 82 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{fmt$0(p.earnings)}</div>
                <div style={{ fontSize: 9.5, color: C.muted }}>{p.earningsPercent}% of earnings</div>
              </div>
            </button>
          )
        })}
      </div>
      {coverage && coverage.historyDays > 0 && (
        <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${C.borderSoft}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: C.muted }}>Data coverage</span>
            <span style={{ fontSize: 10, color: C.text, fontWeight: 700 }}>{coverage.windowCoveragePct}% of 31-day window</span>
          </div>
          <ProgressBar value={coverage.windowCoveragePct} />
        </div>
      )}
    </Card>
  )
}

function InsightTeaser({ title, description, preview, onUpgrade }) {
  return (
    <Card style={{ padding: 13, background: 'linear-gradient(135deg,rgba(22,244,255,0.055),rgba(124,92,255,0.05),rgba(255,43,174,0.035))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: C.white, fontWeight: 750 }}>{title}</div>
        <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.07em', color: C.pink, border: `1px solid ${C.pink}45`, borderRadius: 5, padding: '2px 5px' }}>PRO</span>
      </div>
      <div style={{ fontSize: 10.5, color: C.text, lineHeight: 1.45, marginBottom: 9 }}>{description}</div>
      <div aria-hidden style={{ filter: 'blur(4px)', userSelect: 'none', opacity: .55, marginBottom: 9 }}>
        <div style={{ height: 6, width: '72%', borderRadius: 99, background: GRAD, marginBottom: 6 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
          {['10 PM','Wed','+$42/hr'].map(x => <div key={x} style={{ padding: '5px 6px', borderRadius: 7, background: 'rgba(255,255,255,.05)', fontSize: 9, color: C.white }}>{x}</div>)}
        </div>
      </div>
      {preview && <div style={{ fontSize: 10, color: C.muted, marginBottom: 9 }}>{preview}</div>}
      <button onClick={onUpgrade} style={{ border: `1px solid ${C.pink}45`, background: `${C.pink}10`, color: C.pink, borderRadius: 100, padding: '6px 11px', fontSize: 10.5, fontWeight: 750, cursor: 'pointer' }}>
        Unlock with Pro →
      </button>
    </Card>
  )
}

function DataProgress({ coverage }) {
  if (!coverage || coverage.historyDays === 0) return null
  const milestones = coverage.milestones || []
  return (
    <Card style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12.5, color: C.white, fontWeight: 800 }}>Your data is building</div>
          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{coverage.historyDays} days on file · {coverage.windowCoveragePct}% of the analysis window</div>
        </div>
        <span style={{ fontSize: 10, color: coverage.windowCoveragePct >= 100 ? C.green : C.cyan, fontWeight: 800 }}>{coverage.windowCoveragePct}%</span>
      </div>
      <ProgressBar value={coverage.windowCoveragePct} height={5} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 6, marginTop: 9 }}>
        {milestones.map(m => (
          <div key={m.days} style={{ padding: '6px 7px', borderRadius: 8, background: m.done ? `${C.green}10` : 'rgba(255,255,255,.025)', border: `1px solid ${m.done ? `${C.green}32` : C.borderSoft}` }}>
            <div style={{ fontSize: 9, color: m.done ? C.green : C.muted, fontWeight: 800 }}>{m.done ? '✓' : `${m.days}d`}</div>
            <div style={{ fontSize: 9.5, color: m.done ? C.text : C.muted, marginTop: 2, lineHeight: 1.25 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function UnifiedView({ analytics, coverage, isPro, onUpgrade, onOpenPlanner }) {
  const snapshot = useMemo(() => buildBusinessSnapshot(analytics), [analytics])
  const comparison = useMemo(() => buildPlatformComparison(analytics), [analytics])
  const efficiency = useMemo(() => buildEfficiencyComparison(analytics), [analytics])
  const timeIntel = useMemo(() => buildTimeIntelligence(analytics), [analytics])
  const fans = useMemo(() => buildFanRevenue(analytics, isPro), [analytics, isPro])
  const noticed = useMemo(() => buildCamCashNoticed(analytics), [analytics])

  const topRevenue = comparison[0]
  const topEfficiency = efficiency[0]

  return (
    <>
      <DataProgress coverage={coverage} />

      <div className="pi-platform-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(280px,.75fr)', gap: 14, marginBottom: 14 }}>
        <Card style={{ padding: 14 }}>
          <SectionHeader title="Unified breakdown" note={snapshot.momentum?.label || 'All connected platforms'} />
          <div className="pi-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 6 }}>
            <Metric label="Earnings" value={fmt$0(snapshot.totalEarnings)} color={C.green} />
            <Metric label="Tips" value={fmtN(snapshot.totalTips)} />
            <Metric label="Sessions" value={fmtN(snapshot.sessions)} />
            <Metric label="Hours" value={snapshot.totalHours > 0 ? fmtH(snapshot.totalHours) : '—'} />
            <Metric label="$ / hour" value={snapshot.usdPerHour === null ? '—' : fmt$(snapshot.usdPerHour)} color={C.cyan} />
            <Metric label="Platforms" value={fmtN(snapshot.platformCount)} />
          </div>
          <div className="pi-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 6, marginTop: 6 }}>
            <Metric label="Avg / session" value={snapshot.sessions ? fmt$(snapshot.avgEarningsPerSession) : '—'} />
            <Metric label="Avg tip" value={snapshot.avgTipSize ? fmt$(snapshot.avgTipSize) : '—'} />
            <Metric label="Tips / hour" value={snapshot.tipsPerHour ? snapshot.tipsPerHour.toFixed(1) : '—'} />
            <Metric label="Supporters" value={fmtN(fans.uniqueTippers)} />
            <Metric label="Top 3 share" value={fans.topThreeContribution === null ? '—' : `${fans.topThreeContribution}%`} color={fans.topThreeContribution >= 50 ? C.amber : C.white} />
            <Metric label="Top supporter" value={fans.topSpender ? fmt$(fans.topSpender.earnings) : '—'} />
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 8 }}>
          {!isPro && (
            <InsightTeaser
              title="Compare your platforms"
              description="See which platform is actually paying you best, not just which one brings in the most total revenue."
              preview="Platform-by-platform earning efficiency"
              onUpgrade={onUpgrade}
            />
          )}
          <Card style={{ padding: 13 }} accent={C.cyan}>
            <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>Next best move</div>
            {topRevenue && topEfficiency ? (
              <div style={{ fontSize: 11.5, color: C.white, lineHeight: 1.45 }}>
                <strong>{topRevenue.platform}</strong> leads total earnings at <strong>{fmt$0(topRevenue.earnings)}</strong>{topEfficiency.platform !== topRevenue.platform ? `, while ${topEfficiency.platform} leads on hourly efficiency.` : '.'}
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: C.muted }}>Keep building your connected-platform data and CamCash will surface the strongest comparison here.</div>
            )}
            {onOpenPlanner && <button onClick={onOpenPlanner} style={{ marginTop: 9, padding: '6px 11px', borderRadius: 100, border: 'none', background: GRAD, color: '#05070f', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>Build my stream plan →</button>}
          </Card>
        </div>
      </div>

      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,.8fr)', gap: 14, marginBottom: 14 }}>
        <Card style={{ padding: 14 }}>
          <SectionHeader title="Where your money comes from" note="Share of unified earnings" />
          {comparison.length === 0 ? <Empty>No platform data to compare yet.</Empty> : (
            <div style={{ display: 'grid', gap: 7 }}>
              {comparison.map(p => {
                const accent = accentFor(p.platform)
                return (
                  <div key={p.platform} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,1fr) minmax(100px,1.5fr) auto', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}><PlatformDot platform={p.platform} /><span style={{ fontSize: 11.5, color: C.white, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.platform}</span></div>
                    <div><ProgressBar value={p.earningsPercent} color={`linear-gradient(90deg,${accent},${accent}99)`} height={4} /></div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontSize: 12, color: C.white, fontWeight: 800 }}>{fmt$0(p.earnings)}</div><div style={{ fontSize: 9, color: C.muted }}>{p.earningsPercent}%</div></div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card style={{ padding: 14 }}>
          <SectionHeader title="Where your time pays best" note="Existing hourly-rate data" />
          {efficiency.length === 0 ? <Empty>Hourly rates need sessions with a known duration. None qualify yet.</Empty> : (
            <div style={{ display: 'grid', gap: 7 }}>
              {efficiency.map((p, i) => (
                <div key={p.platform} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,1fr) auto auto', gap: 9, alignItems: 'center', padding: '7px 0', borderBottom: i < efficiency.length - 1 ? `1px solid ${C.borderSoft}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><PlatformDot platform={p.platform} /><span style={{ fontSize: 11.5, color: C.white, fontWeight: 700 }}>{p.platform}</span></div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontSize: 12, color: accentFor(p.platform), fontWeight: 800 }}>{fmt$(p.usdPerHour)}/h</div><div style={{ fontSize: 9, color: C.muted }}>{fmtH(p.rateHours)}</div></div>
                  <div style={{ minWidth: 38, textAlign: 'right', fontSize: 10, color: p.vsAverage > 0 ? C.green : p.vsAverage < 0 ? C.coral : C.muted }}>{p.vsAverage > 0 ? '+' : ''}{p.vsAverage}%</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, marginBottom: 14 }}>
        <Card style={{ padding: 14 }}>
          <SectionHeader title="When your business pays best" note={timeIntel?.confidence?.label || null} />
          {!timeIntel?.hasPattern ? <Empty>Not enough repeat activity yet to name a reliable time.</Empty> : (
            <div style={{ display: 'grid', gap: 7 }}>
              {timeIntel.bestHour && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 9, background: `${C.cyan}08`, border: `1px solid ${C.cyan}20` }}><span style={{ fontSize: 10, color: C.muted }}>Best hour</span><strong style={{ fontSize: 12, color: C.cyan }}>{timeIntel.bestHour.label}</strong></div>}
              {timeIntel.bestDay && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 9, background: `${C.purple}08`, border: `1px solid ${C.purple}20` }}><span style={{ fontSize: 10, color: C.muted }}>Best day</span><strong style={{ fontSize: 12, color: C.white }}>{timeIntel.bestDay.day}</strong></div>}
              {!isPro && <InsightTeaser title="Best times by platform" description="See the strongest earning windows separately for each connected platform." onUpgrade={onUpgrade} />}
              {isPro && comparison.length > 0 && (
                <div style={{ display: 'grid', gap: 5 }}>
                  {comparison.map(p => {
                    const t = timeIntel.platformBestTimes?.[p.platform]
                    if (!t?.hour && !t?.bestDay) return null
                    return <div key={p.platform} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,.025)' }}><span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: C.white }}><PlatformDot platform={p.platform} />{p.platform}</span><span style={{ fontSize: 10, color: C.text }}>{t.hour ? formatHour(t.hour.hour) : '—'}{t.bestDay ? ` · ${t.bestDay.day}` : ''}</span></div>
                  })}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card style={{ padding: 14 }}>
          <SectionHeader title="Who is driving revenue" note="Platform identity stays separate" />
          {fans.uniqueTippers === 0 ? <Empty>No supporters recorded yet.</Empty> : (
            <>
              <div className="pi-fan-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 7 }}>
                <Metric label="Supporters" value={fmtN(fans.uniqueTippers)} />
                <Metric label="Top supporter" value={fans.topSpender ? fmt$(fans.topSpender.earnings) : '—'} />
                <Metric label="Top 3 share" value={fans.topThreeContribution === null ? '—' : `${fans.topThreeContribution}%`} color={fans.topThreeContribution >= 50 ? C.amber : C.white} />
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {fans.visibleSpenders.slice(0, 5).map((f, i) => (
                  <div key={`${f.platform}-${f.username}-${i}`} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) auto', alignItems: 'center', gap: 7, padding: '6px 7px', borderRadius: 8, background: 'rgba(255,255,255,.02)' }}>
                    <span style={{ fontSize: 9, color: C.muted, textAlign: 'center' }}>#{i + 1}</span>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 10.5, color: C.white, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{isPro ? f.username : '••••••••'}</div><div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1, fontSize: 8.5, color: C.muted }}><PlatformDot platform={f.platform} />{f.platform}</div></div>
                    <div style={{ fontSize: 11, color: C.white, fontWeight: 800 }}>{fmt$(f.earnings)}</div>
                  </div>
                ))}
              </div>
              {!isPro && fans.uniqueTippers > 3 && <div style={{ marginTop: 7, fontSize: 10, color: C.pink }}>Full supporter breakdown is a Pro insight.</div>}
            </>
          )}
        </Card>
      </div>

      {noticed.length > 0 && (
        <Card style={{ padding: 11, marginBottom: 14, borderColor: `${C.cyan}20`, background: 'rgba(22,244,255,.025)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><span style={{ fontSize: 10, fontWeight: 800, color: C.cyan, letterSpacing: '.08em', textTransform: 'uppercase' }}>CamCash noticed</span><span style={{ height: 1, flex: 1, background: C.borderSoft }} /></div>
          <div style={{ display: 'grid', gap: 4 }}>{noticed.slice(0, 3).map((n, i) => <div key={i} style={{ fontSize: 10.5, color: C.text, lineHeight: 1.4 }}>{n.icon} {n.text}</div>)}</div>
        </Card>
      )}

      {!isPro && (
        <div className="pi-pro-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <InsightTeaser title="Platform-specific intelligence" description="Break down each connected site by earnings, time, revenue mix, supporters, and best recorded windows." onUpgrade={onUpgrade} />
          <InsightTeaser title="Deeper supporter intelligence" description="See the complete supporter picture instead of only the starter view." onUpgrade={onUpgrade} />
        </div>
      )}
    </>
  )
}

function PlatformBreakdown({ analytics, platformName, isPro, onUpgrade }) {
  const snap = useMemo(() => buildPlatformSnapshot(analytics, platformName), [analytics, platformName])
  const accent = accentFor(platformName)

  if (!snap) return <Empty>{platformName} has no meaningful session data yet, so there is nothing reliable to break down.</Empty>

  return (
    <>
      <Card style={{ padding: 14, marginBottom: 14 }} accent={accent}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PlatformDot platform={platformName} /><div><div style={{ fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800 }}>Single platform breakdown</div><div style={{ fontSize: 15, color: C.white, fontWeight: 850, marginTop: 2 }}>{platformName}</div></div></div>
          <div style={{ fontSize: 10, color: C.muted }}>{snap.earningsPercent}% of unified earnings</div>
        </div>
        <div className="pi-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 6 }}>
          <Metric label="Earnings" value={fmt$0(snap.earnings)} color={C.green} />
          <Metric label="Tips" value={fmtN(snap.tips)} />
          <Metric label="Sessions" value={fmtN(snap.sessions)} />
          <Metric label="Hours" value={snap.hours > 0 ? fmtH(snap.hours) : '—'} />
          <Metric label="$ / hour" value={snap.usdPerHour > 0 ? fmt$(snap.usdPerHour) : '—'} color={accent} />
          <Metric label="$ / session" value={snap.sessions > 0 ? fmt$(snap.earningsPerSession) : '—'} />
        </div>
      </Card>

      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,.95fr)', gap: 14, marginBottom: 14 }}>
        <Card style={{ padding: 14 }}>
          <SectionHeader title="Platform performance" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 9 }}>
            <Metric label="Avg tip" value={snap.avgTipSize > 0 ? fmt$(snap.avgTipSize) : '—'} />
            <Metric label="Time share" value={`${snap.hoursPercent}%`} />
            <Metric label="Rate hours" value={snap.rateHours > 0 ? fmtH(snap.rateHours) : '—'} />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {snap.missedRevenue && <div style={{ padding: '9px 10px', borderRadius: 9, border: `1px solid ${C.amber}25`, background: `${C.amber}08`, fontSize: 10.5, color: C.text, lineHeight: 1.45 }}><span style={{ color: C.amber, fontWeight: 800 }}>Timing signal:</span> sessions at {formatHour(snap.missedRevenue.bestHour)} typically earn {snap.missedRevenue.multiplier}× your average here.</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 9, background: 'rgba(255,255,255,.025)' }}><span style={{ fontSize: 10, color: C.muted }}>Share of streaming hours</span><strong style={{ fontSize: 11, color: C.white }}>{snap.hoursPercent}%</strong></div>
            <ProgressBar value={snap.hoursPercent} color={`linear-gradient(90deg,${accent},${accent}88)`} />
          </div>
        </Card>

        <Card style={{ padding: 14 }}>
          <SectionHeader title="Revenue mix" />
          {snap.revenueMix.length === 0 ? <Empty>No revenue-type detail recorded for this platform.</Empty> : (
            <div style={{ display: 'grid', gap: 5 }}>
              {snap.revenueMix.slice(0, 6).map(t => (
                <div key={t.type} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,1fr) 1.5fr auto', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 10.5, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.type}</span>
                  <ProgressBar value={t.pct} color={`linear-gradient(90deg,${accent},${accent}88)`} height={4} />
                  <span style={{ fontSize: 10.5, color: C.text, fontWeight: 700 }}>{fmt$0(t.usd)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="pi-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card style={{ padding: 14 }}>
          <SectionHeader title={`When ${platformName} pays`} note={isPro ? 'Platform-specific' : 'Pro insight'} />
          {!snap.bestHour && !snap.bestDay ? <Empty>Not enough repeat activity on this platform to name a reliable time.</Empty> : !isPro ? (
            <InsightTeaser title="Best time on this platform" description={`See the strongest recorded earning windows for ${platformName}.`} onUpgrade={onUpgrade} />
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {snap.bestHour && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 9, background: `${accent}08`, border: `1px solid ${accent}20` }}><span style={{ fontSize: 10, color: C.muted }}>Best hour</span><strong style={{ fontSize: 12, color: accent }}>{snap.bestHour.label}</strong></div>}
              {snap.bestDay && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 9, background: `${C.purple}08`, border: `1px solid ${C.purple}20` }}><span style={{ fontSize: 10, color: C.muted }}>Best day</span><strong style={{ fontSize: 12, color: C.white }}>{snap.bestDay.day}</strong></div>}
              {snap.hourly.length > 1 && <div style={{ display: 'grid', gap: 4, marginTop: 2 }}>{snap.hourly.slice(0, 6).map(h => <div key={h.hour} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 7px', background: 'rgba(255,255,255,.02)', borderRadius: 7, fontSize: 9.5 }}><span style={{ color: C.text }}>{formatHour(h.hour)}</span><span style={{ color: C.white, fontWeight: 700 }}>{fmt$(h.avg)} · {fmtN(h.sessionCount)} sessions</span></div>)}</div>}
            </div>
          )}
        </Card>

        <Card style={{ padding: 14 }}>
          <SectionHeader title="Day of week" />
          {snap.weekdays.length === 0 ? <Empty>No weekday has enough repeated activity to show a dependable pattern.</Empty> : (
            <div style={{ display: 'grid', gap: 4 }}>{snap.weekdays.map(d => <div key={d.day} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 7px', background: 'rgba(255,255,255,.02)', borderRadius: 7 }}><span style={{ fontSize: 10.5, color: C.white }}>{d.day}</span><span style={{ fontSize: 9.5, color: C.text }}>{fmt$(d.avg)} typical · {fmtN(d.activeDays)} days</span></div>)}</div>
          )}
        </Card>
      </div>

      <Card style={{ padding: 14 }}>
        <SectionHeader title={`Supporters on ${platformName}`} note="Platform identity stays separate" />
        {snap.topFans.length === 0 ? <Empty>No supporters recorded on this platform yet.</Empty> : (
          <div style={{ display: 'grid', gap: 4 }}>
            {snap.topFans.slice(0, isPro ? 10 : 3).map((f, i) => (
              <div key={`${f.username}-${i}`} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) auto auto', alignItems: 'center', gap: 8, padding: '7px 8px', background: 'rgba(255,255,255,.02)', borderRadius: 8 }}>
                <span style={{ fontSize: 9, color: C.muted }}>#{i + 1}</span>
                <span style={{ fontSize: 10.5, color: C.white, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{isPro ? f.username : '••••••••'}</span>
                <span style={{ fontSize: 9.5, color: C.muted }}>{fmtN(f.tipCount)} tips</span>
                <span style={{ fontSize: 11, color: C.white, fontWeight: 800 }}>{fmt$(f.earnings)}</span>
              </div>
            ))}
            {!isPro && snap.topFans.length > 3 && <div style={{ marginTop: 5 }}><InsightTeaser title="Full supporter breakdown" description={`See the complete supporter picture for ${platformName}.`} onUpgrade={onUpgrade} /></div>}
          </div>
        )}
      </Card>
    </>
  )
}

export default function PlatformsIntelligence({ analytics = null, tips = [], isPro = false, onOpenPlanner = null, onUpgrade = null }) {
  const [view, setView] = useState('unified')
  const [selectedPlatform, setSelectedPlatform] = useState(null)

  const coverage = useMemo(() => buildDataCoverage(computeDataVaultStats(tips)), [tips])
  const platformNames = useMemo(() => buildPlatformComparison(analytics).map(p => p.platform), [analytics])
  const activePlatform = platformNames.includes(selectedPlatform) ? selectedPlatform : (platformNames[0] || null)
  const upgrade = onUpgrade || (() => { window.location.href = '/pricing' })

  if (!analytics || platformNames.length === 0) {
    return <div className="pi-root" style={{ maxWidth: 1280 }}><style>{CSS}</style><Empty>No connected platform has enough session data to analyse yet. Import platform data and CamCash will build this view from your existing analytics.</Empty></div>
  }

  return (
    <div className="pi-root" style={{ maxWidth: 1280 }}>
      <style>{CSS}</style>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: C.cyan, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>Platforms</div>
          <h1 style={{ margin: '2px 0 2px', fontSize: 20, lineHeight: 1.15, fontWeight: 850, color: C.white }}>Your connected cam business</h1>
          <div style={{ fontSize: 11, color: C.muted }}>See the whole picture, then zoom into one platform.</div>
        </div>
        <div className="pi-view-toggle" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 100, background: 'rgba(255,255,255,.035)', border: `1px solid ${C.border}` }}>
          {[['unified','Unified'],['single','Single platform']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{ padding: '6px 13px', borderRadius: 100, border: 'none', background: view === id ? GRAD : 'transparent', color: view === id ? '#05070f' : C.text, fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
      </div>

      {view === 'unified' ? (
        <UnifiedView analytics={analytics} coverage={coverage} isPro={isPro} onUpgrade={upgrade} onOpenPlanner={onOpenPlanner} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {platformNames.map(p => <PlatformPill key={p} platform={p} active={activePlatform === p} onClick={() => setSelectedPlatform(p)} />)}
          </div>
          {activePlatform && <PlatformBreakdown analytics={analytics} platformName={activePlatform} isPro={isPro} onUpgrade={upgrade} />}
        </>
      )}
    </div>
  )
}

const CSS = `
.pi-root { width:100%; color:${C.white}; }
.pi-root * { box-sizing:border-box; }
.pi-root button { font-family:inherit; }
@media (max-width: 1050px) {
  .pi-root .pi-platform-layout { grid-template-columns:1fr !important; }
  .pi-root .pi-metrics { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
}
@media (max-width: 760px) {
  .pi-root .pi-two-col { grid-template-columns:1fr !important; }
  .pi-root .pi-pro-grid { grid-template-columns:1fr !important; }
  .pi-root .pi-fan-summary { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
  .pi-root .pi-view-toggle { width:100%; }
  .pi-root .pi-view-toggle button { flex:1; }
}
@media (max-width: 520px) {
  .pi-root .pi-metrics { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
  .pi-root .pi-fan-summary { grid-template-columns:1fr !important; }
}
`
