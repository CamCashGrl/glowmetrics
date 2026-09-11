'use client'
// ============================================================
// CAMCASH — POST-ONBOARDING DASHBOARD
// DashboardPreview.js
//
// Exports:
//   getDashboardReadiness()  — 4-state readiness system
//   getPlanAccess()          — free/pro plan logic
//   getFeatureLockState()    — per-feature lock type (data vs plan)
//   getDashboardStage()      — legacy compat (empty/preview/ready)
//   EmptyDashboard           — no_data state
//   DashboardPreview         — very_low/partial/full_data state
//   LockedInsightCard        — use inside full dashboard for unready cards
//   PlatformIntelligenceHero — first-view post-onboarding platform comparison
//
// Plan source of truth: profiles.plan ('free' | 'pro')
// ============================================================

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FREE_PLATFORM_LIMIT, isProPlan } from '../../lib/planLimits'

// ── BRAND TOKENS ─────────────────────────────────────────────
const C = {
  bg:     '#12131a',
  card:   'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.10)',
  cyan:   '#22D3EE',
  pink:   '#EC4899',
  indigo: '#7C5CFF',
  gold:   '#F59E0B',
  green:  '#10B981',
  white:  '#F1F5F9',
  text:   '#94A3B8',
  muted:  '#475569',
  grad:   'linear-gradient(90deg,#22D3EE,#7C5CFF,#EC4899)',
}

// ── SAFE FORMATTERS ───────────────────────────────────────────
const safeNum = (v, fallback = 0) => { const n = parseFloat(v); return isNaN(n) || !isFinite(n) ? fallback : n }
function formatCurrency(v) { if (!v || isNaN(v) || !isFinite(v)) return 'Not started'; return `$${safeNum(v).toFixed(2)}` }
function formatNumber(v) { if (!v || isNaN(v)) return 'Not started'; return safeNum(v).toLocaleString('en-US') }
const fmt$ = (v) => `$${safeNum(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtN = (v) => safeNum(v).toLocaleString('en-US')
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function fmtDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }

// ── CARD STYLE ────────────────────────────────────────────────
const glassCard = (extra = {}) => ({
  borderRadius: 24,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 0 40px rgba(0,245,255,0.08)',
  padding: '22px 24px',
  position: 'relative',
  overflow: 'hidden',
  ...extra,
})

const primaryBtn = (extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 100, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(90deg,#22D3EE,#a855f7,#EC4899)',
  color: '#000', fontWeight: 700, fontSize: 13,
  padding: '11px 22px',
  boxShadow: '0 0 30px rgba(255,61,196,0.35)',
  transition: 'transform 0.15s, box-shadow 0.15s',
  whiteSpace: 'nowrap',
  ...extra,
})

const secondaryBtn = (extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 100, border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)', color: C.white,
  fontWeight: 600, fontSize: 13, padding: '11px 22px',
  cursor: 'pointer', transition: 'background 0.15s',
  whiteSpace: 'nowrap',
  ...extra,
})

// ── TOP ACCENT LINE ───────────────────────────────────────────
function TopAccent({ color = 'rgba(34,211,238,0.5)' }) {
  return <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
}

// ── LOCK CHIP ─────────────────────────────────────────────────
function LockChip({ type }) {
  const isData = type === 'needs_data'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700,
      background: isData ? 'rgba(34,211,238,0.1)' : 'rgba(236,72,153,0.12)',
      border: `1px solid ${isData ? 'rgba(34,211,238,0.3)' : 'rgba(236,72,153,0.3)'}`,
      color: isData ? C.cyan : C.pink,
    }}>
      {isData ? '📊 Needs more data' : '✦ Pro'}
    </span>
  )
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getDashboardReadiness({ totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0, dateRangeDays = 0, streamDays = 0 }) {
  if (!totalTips || totalTips === 0) return 'setup'
  if (totalTips < 25 || totalSessions < 3 || totalFans < 5 || totalEarnings < 10) return 'building'
  if (totalTips < 50 || totalSessions < 5 || totalFans < 10 || totalEarnings < 25) return 'starter'
  if (totalTips < 100 || totalSessions < 8 || totalFans < 20 || totalEarnings < 50) return 'warming'
  if (dateRangeDays < 7 && streamDays < 3) return 'warming'
  return 'ready'
}

// Legacy compat — page.js now uses getDashboardReadiness directly; real dashboard always renders
export function getDashboardStage({ tipCount = 0, sessionCount = 0, totalEarnings = 0 }) {
  return 'ready'
}

export function getPlanAccess(userPlan = 'free', trackedPlatformCount = 0) {
  const isPro = isProPlan(userPlan)
  return {
    isPro, isFree: !isPro,
    canTrackMultiplePlatforms: true,
    canComparePlatforms: isPro,
    canUseCrossPlatformInsights: isPro,
    freePlatformLimitReached: !isPro && trackedPlatformCount >= FREE_PLATFORM_LIMIT,
  }
}

export function getFeatureLockState({ feature, userPlan = 'free', totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0, totalStreamMinutes = 0, importedPlatforms = [], liveModeSessions = 0, platformLimitReached = false }) {
  const isPro = isProPlan(userPlan)
  const platformCount = importedPlatforms?.length || 0
  const rules = {
    bestStreamingTimes:    { needsData: totalSessions < 3 || totalTips < 25, requiresPro: false, dataMessage: 'Unlocks after 3+ sessions with timestamps.', proMessage: null },
    topFans:               { needsData: totalFans < 5 || totalTips < 10, requiresPro: false, dataMessage: 'Unlocks after more fan and tip activity.', proMessage: null },
    whales:                { needsData: totalFans < 10 || totalEarnings < 50, requiresPro: false, dataMessage: 'Unlocks after enough repeat fan activity.', proMessage: null },
    platformComparison:    { needsData: isPro && platformCount < 2, requiresPro: !isPro, dataMessage: 'Import at least 2 platforms to compare earnings.', proMessage: 'Upgrade to Pro to compare earnings across platforms.' },
    // Free can connect multiple platforms (up to FREE_PLATFORM_LIMIT) — this
    // is now a platform-count gate, never a Pro gate. See lib/planLimits.js.
    multiPlatformTracking: { needsData: false, requiresPro: false, locked: !isPro && platformLimitReached, dataMessage: null, proMessage: null, lockedMessage: 'Free tracks a limited number of platforms — upgrade to Pro for unlimited platforms.' },
    // The real Free/Pro line for historical depth: Free only analyzes the
    // most recent 31 days per platform (see lib/analytics.js applyFreeAnalysisWindow).
    historicalDepth:       { needsData: false, requiresPro: !isPro, dataMessage: null, proMessage: 'Free analyzes the most recent 31 days per platform. Pro unlocks full history.' },
    crossPlatformBestTimes:{ needsData: isPro && (platformCount < 2 || totalSessions < 3), requiresPro: !isPro, dataMessage: 'Import sessions from at least 2 platforms to unlock cross-platform timing insights.', proMessage: 'Upgrade to Pro to unlock cross-platform best times.' },
    sessionPerformance:    { needsData: totalSessions < 3, requiresPro: false, dataMessage: 'Unlocks after multiple completed sessions.', proMessage: null },
    averageHourly:         { needsData: totalSessions < 3 || totalStreamMinutes < 60, requiresPro: false, dataMessage: 'Unlocks after at least 60 minutes of tracked stream time.', proMessage: null },
    liveScore:             { needsData: liveModeSessions < 1, requiresPro: false, dataMessage: 'Unlocks after your first Live Mode stream.', proMessage: null },
    retention:             { needsData: totalSessions < 5 || totalFans < 20, requiresPro: false, dataMessage: 'Unlocks after more repeat fan activity.', proMessage: null },
    forecasting:           { needsData: totalSessions < 8 || totalEarnings < 50, requiresPro: false, dataMessage: 'Unlocks after more earnings history.', proMessage: null },
  }
  const rule = rules[feature]
  if (!rule) return { locked: false, lockType: null, message: null }
  if (rule.requiresPro) return { locked: true, lockType: 'requires_pro', message: rule.proMessage }
  if (rule.locked) return { locked: true, lockType: 'platform_limit', message: rule.lockedMessage }
  if (rule.needsData) return { locked: true, lockType: 'needs_data', message: rule.dataMessage }
  return { locked: false, lockType: null, message: null }
}

// Readiness checks for full dashboard use
export const canShowBestHours    = ({ tipCount, sessionCount }) => tipCount >= 25 && sessionCount >= 3
export const canShowWhales       = ({ uniqueFanCount, totalEarnings }) => uniqueFanCount >= 5 && totalEarnings >= 50
export const canShowPlatformComp = ({ platformCount, sessionCount }) => platformCount >= 2 && sessionCount >= 4
export const canShowSessionPerf  = ({ sessionCount }) => sessionCount >= 3
export const canShowRetention    = ({ uniqueFanCount, dateRangeDays }) => uniqueFanCount >= 10 && dateRangeDays >= 7
export const canShowHourlyRate   = ({ sessionCount, totalStreamMinutes }) => sessionCount >= 3 && totalStreamMinutes >= 60

// ── MODULE LOCK STATE ─────────────────────────────────────────────────────────
// Single source of truth for per-module data thresholds.
// Only platformROI and multiPlatformTracking are ever Pro-gated.
// Money Map and Stream Planner are data-gated only — never paywalled.
export function getModuleLockState({ module, totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0, totalStreamMinutes = 0, importedPlatformCount = 0, isPro = false, liveModeSessions = 0 }) {
  const rules = {
    bestStreamingTimes:   { needsData: totalTips < 25 || totalSessions < 3,          message: 'Peak Earning Windows unlock after 25+ tips and 3+ meaningful sessions.' },
    avgHourlyRate:        { needsData: totalSessions < 3 || totalStreamMinutes < 60,  message: 'Average $/Hour unlocks after 3+ sessions and 60+ tracked minutes.' },
    topFans:              { needsData: totalTips < 10 || totalFans < 5,               message: 'Top Fans unlock after more fan and tip activity.' },
    whales:               { needsData: totalFans < 10 || totalEarnings < 50,          message: 'Whale detection unlocks after enough repeat fan history.' },
    sessionBreakdown:     { needsData: totalSessions < 3,                             message: 'Session Breakdown unlocks after multiple completed sessions.' },
    platformROI:          { needsData: importedPlatformCount < 2, requiresPro: !isPro && importedPlatformCount >= 1, message: !isPro ? 'Platform ROI unlocks after upgrading to Pro and importing at least 2 platforms.' : 'Import at least 2 platforms to compare earnings.' },
    multiPlatformTracking:{ needsData: false, requiresPro: !isPro,                   message: 'Upgrade to Pro to track more than one platform.' },
    fanRecovery:          { needsData: totalFans < 20 || totalEarnings < 50,          message: 'Fan Recovery unlocks after enough repeat fan history.' },
    moneyMap:             { needsData: totalTips < 50 || totalSessions < 5,           message: 'Money Map unlocks after 50+ tips and 5+ meaningful sessions.' },
    streamPlanner:        { needsData: totalTips < 25 || totalSessions < 3,           message: 'Stream Planner unlocks after 25+ tips and 3+ meaningful sessions.' },
    forecasting:          { needsData: totalSessions < 8 || totalEarnings < 50,       message: 'Forecasting unlocks after more earnings history.' },
    liveScore:            { needsData: liveModeSessions < 1,                          message: 'Live Mode Score unlocks after your first Live Mode stream.' },
  }
  const rule = rules[module]
  if (!rule) return { locked: false, lockType: null, message: null }
  if (rule.requiresPro) return { locked: true, lockType: 'requires_pro', message: rule.message }
  if (rule.needsData)   return { locked: true, lockType: 'needs_data',   message: rule.message }
  return { locked: false, lockType: null, message: null }
}

// ── UNLOCK PROGRESS ───────────────────────────────────────────────────────────
export function getUnlockProgress({ totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0, dateRangeDays = 0, streamDays = 0 }) {
  const p = (v, t) => Math.min(100, Math.round(v / Math.max(t, 1) * 100))
  return {
    starter: {
      tips:     { current: totalTips,     target: 25,   pct: p(totalTips, 25) },
      sessions: { current: totalSessions, target: 3,    pct: p(totalSessions, 3) },
      fans:     { current: totalFans,     target: 5,    pct: p(totalFans, 5) },
      earnings: { current: `$${Math.floor(totalEarnings)}`, target: '$10', pct: p(totalEarnings, 10) },
    },
    full: {
      tips:       { current: totalTips,     target: 100,  pct: p(totalTips, 100) },
      sessions:   { current: totalSessions, target: 8,    pct: p(totalSessions, 8) },
      fans:       { current: totalFans,     target: 20,   pct: p(totalFans, 20) },
      earnings:   { current: `$${Math.floor(totalEarnings)}`, target: '$50', pct: p(totalEarnings, 50) },
      dateDays:   { current: dateRangeDays, target: 7,    pct: p(dateRangeDays, 7) },
      streamDays: { current: streamDays,    target: 3,    pct: p(streamDays, 3) },
    },
  }
}

// ── DASHBOARD PROGRESS CARD ───────────────────────────────────────────────────
// Shown inside the real dashboard when data is still warming up.
// Never shown when readiness === 'ready'.
export function DashboardProgressCard({ totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0, readiness = 'building', onImport }) {
  const grad = 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)'
  const progress = getUnlockProgress({ totalTips, totalSessions, totalFans, totalEarnings })
  const isEarly  = readiness === 'setup' || readiness === 'building'
  const target   = isEarly ? progress.starter : progress.full
  const overall  = Math.round((target.tips.pct + target.sessions.pct + target.fans.pct + target.earnings.pct) / 4)
  const stageLabel = { setup: 'Setup', building: 'Building', starter: 'Starter insights unlocked', warming: 'Warming up', ready: 'Full confidence' }[readiness] || readiness
  const nextTarget = isEarly ? 'starter insights (25 tips · 3 sessions · 5 fans · $10)' : 'full confidence (100 tips · 8 sessions · 20 fans · $50)'

  const items = [
    { label: 'Tips',     pct: target.tips.pct,     cur: target.tips.current,     tgt: target.tips.target,     unit: ' tips' },
    { label: 'Sessions', pct: target.sessions.pct, cur: target.sessions.current, tgt: target.sessions.target, unit: ' sessions' },
    { label: 'Fans',     pct: target.fans.pct,     cur: target.fans.current,     tgt: target.fans.target,     unit: ' fans' },
    { label: 'Earnings', pct: target.earnings.pct, cur: target.earnings.current, tgt: target.earnings.target, unit: '' },
  ]

  return (
    <div style={{ borderRadius: 22, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(12,16,34,0.78)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: '18px 22px', marginBottom: 20, position: 'relative', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.28)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: grad }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', marginBottom: 2 }}>
            Dashboard warming up — <span style={{ color: '#16F4FF' }}>{stageLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: '#8D93AA' }}>Progress toward {nextTarget} · {overall}% complete</div>
        </div>
        {onImport && (
          <button onClick={onImport} style={{ padding: '8px 18px', borderRadius: 100, background: grad, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', boxShadow: '0 0 20px rgba(22,244,255,0.2)', whiteSpace: 'nowrap' }}>
            Upload More Data
          </button>
        )}
      </div>
      <div style={{ height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.06)', marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${overall}%`, background: grad, borderRadius: 100, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
        {items.map(item => (
          <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '9px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#8D93AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</span>
              <span style={{ fontSize: 10, color: item.pct >= 100 ? '#10B981' : '#D7D9EA', fontWeight: 700 }}>
                {item.pct >= 100 ? '✓' : `${item.cur}${item.unit} / ${item.tgt}${item.unit}`}
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${item.pct}%`, background: item.pct >= 100 ? '#10B981' : grad, borderRadius: 100, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// REUSABLE COMPONENTS
// ============================================================

// 1. LockedInsightCard — two visual modes: needs_data vs requires_pro
export function LockedInsightCard({ title, description, lockType = 'needs_data', requirement, ctaLabel, ctaAction }) {
  const isData = lockType === 'needs_data'
  const accentColor = isData ? C.cyan : C.pink
  const glowColor = isData ? 'rgba(34,211,238,0.12)' : 'rgba(236,72,153,0.12)'
  const borderColor = isData ? 'rgba(34,211,238,0.2)' : 'rgba(236,72,153,0.2)'
  return (
    <div style={{ ...glassCard({ background: glowColor, border: `1px solid ${borderColor}` }) }}>
      <TopAccent color={`${accentColor}88`} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accentColor}18`, border: `1px solid ${accentColor}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
          {isData ? '📊' : '✦'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{title}</div>
            <LockChip type={lockType} />
          </div>
          <div style={{ fontSize: 11, color: C.text, lineHeight: 1.6, marginBottom: requirement ? 8 : 0 }}>{description}</div>
          {requirement && <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>◦ {requirement}</div>}
          {ctaLabel && ctaAction && (
            <button onClick={ctaAction} style={{
              padding: '6px 14px', borderRadius: 100, border: `1px solid ${accentColor}50`,
              background: `${accentColor}14`, color: accentColor,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>{ctaLabel}</button>
          )}
        </div>
      </div>
    </div>
  )
}

// 2. SnapshotMetricCard
function SnapshotMetricCard({ label, value, helper, status = 'ready', icon }) {
  const statusColors = { ready: C.cyan, early: C.gold, locked: C.muted, needs_data: C.muted, requires_pro: C.pink }
  const color = statusColors[status] || C.cyan
  return (
    <div style={{ ...glassCard({ padding: '18px 20px' }) }}>
      <TopAccent color={`${color}70`} />
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color, marginBottom: helper ? 4 : 0, lineHeight: 1.1 }}>{value}</div>
      {helper && <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>{helper}</div>}
    </div>
  )
}

// 3. QuickToolCard
function QuickToolCard({ icon, title, description, ctaLabel, ctaAction }) {
  return (
    <div style={{ ...glassCard({ padding: '18px 20px' }) }}>
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: C.text, lineHeight: 1.55, marginBottom: 12 }}>{description}</div>
      <button onClick={ctaAction} style={secondaryBtn({ fontSize: 11, padding: '7px 14px' })}>{ctaLabel}</button>
    </div>
  )
}

// ============================================================
// EmptyDashboard — no_data
// ============================================================
export function EmptyDashboard({ onImport, onLiveMode }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Inter',system-ui,sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top left,rgba(0,245,255,0.12),transparent 35%),radial-gradient(circle at top right,rgba(255,61,196,0.12),transparent 35%)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: C.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 24px', boxShadow: '0 0 40px rgba(34,211,238,0.2),0 0 80px rgba(236,72,153,0.1)' }}>$</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: C.white, letterSpacing: '-0.025em', marginBottom: 10 }}>Your CamCash dashboard is ready ✨</div>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7, marginBottom: 32, maxWidth: 360, margin: '0 auto 32px' }}>
          Import your first tips or start Live Mode to unlock your personal earnings insights.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
          <button onClick={onImport} style={{ ...primaryBtn(), width: '100%', padding: '14px', fontSize: 14 }}>Import My Tips →</button>
          <button onClick={onLiveMode} style={{ ...secondaryBtn(), width: '100%', padding: '13px', fontSize: 13 }}>Start Live Mode</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// DashboardPreview — main component
// ============================================================
export function DashboardPreview({ tips = [], analytics, userPlan = 'free', onAddHistory, onContinue, onUpgrade, onLiveMode }) {
  const router = useRouter()

  // ── Safe derived values ───────────────────────────────────
  const totalTips     = tips.length
  const totalUSD      = safeNum(tips.reduce((s, t) => s + safeNum(t.usd), 0))
  const totalTokens   = tips.reduce((s, t) => s + (parseInt(t.tokens) || 0), 0)
  const hasUSD        = totalUSD > 0
  const isEstimated   = !hasUSD && totalTokens > 0

  const platforms     = [...new Set(tips.map(t => t.platform).filter(p => p && p !== 'Unknown'))]
  const platformCount = platforms.length

  const fans          = [...new Set(tips.map(t => (t.username || '').toLowerCase()).filter(Boolean))]
  const totalFans     = fans.length

  const totalSessions = analytics?.meaningfulSessionCount || 0
  const totalEarnings = totalUSD
  const totalStreamMinutes = analytics?.totalStreamMinutes || 0
  const liveModeSessions = 0 // wired when live mode tracking is implemented

  const dates         = tips.map(t => new Date(t.date_time || t.dateRaw)).filter(d => !isNaN(d)).sort((a, b) => a - b)
  const dateFrom      = dates[0] || null
  const dateTo        = dates[dates.length - 1] || null
  const avgTip        = totalTips > 0 && hasUSD ? totalUSD / totalTips : 0
  const maxTip        = tips.length > 0 ? safeNum(Math.max(...tips.map(t => safeNum(t.usd)))) : 0
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
  const topByTotal = Object.entries(fanTotals).sort((a, b) => b[1] - a[1])[0]
  const topByCount = Object.entries(fanCounts).sort((a, b) => b[1] - a[1])[0]

  // Readiness + plan
  const readiness = getDashboardReadiness({ totalTips, totalSessions, totalFans, totalEarnings })
  const plan      = getPlanAccess(userPlan, platformCount)
  const isPro     = plan.isPro

  // Hero copy by readiness
  const heroConfig = {
    very_low_data: {
      headline: 'Your first insights are ready ✨',
      sub: 'We found your first earnings data. Add a little more history to unlock your best times, top fans, and deeper trends.',
      primaryLabel: 'Import More Data',
      secondaryLabel: 'Open Live Mode',
      note: 'Early data · More accuracy unlocks as you add more sessions',
    },
    partial_data: {
      headline: 'Your dashboard is starting to learn your stream patterns ✨',
      sub: 'Based on your imported sessions, CamCash is beginning to identify your earning patterns, fan behavior, and platform performance.',
      primaryLabel: 'Add More History',
      secondaryLabel: 'View Insights',
      note: null,
    },
    full_data: {
      headline: 'Your personalized dashboard is ready ✨',
      sub: 'CamCash has enough data to show your best times, top fans, platform trends, and session performance.',
      primaryLabel: 'View My Insights',
      secondaryLabel: 'Start Live Mode',
      note: null,
    },
  }
  const hero = heroConfig[readiness] || heroConfig.very_low_data

  // Progress checklist
  const progressItems = [
    { label: 'Account created', done: true },
    { label: 'Onboarding completed', done: true },
    { label: 'Track your first platform', done: platformCount >= 1 },
    { label: 'Import at least 3 sessions', done: totalSessions >= 3 },
    { label: 'Add 25+ tips', done: totalTips >= 25 },
    { label: 'Start your first Live Mode session', done: liveModeSessions >= 1 },
    { label: 'Unlock full insights', done: readiness === 'full_data' },
    isPro
      ? { label: 'Pro multi-platform tracking enabled', done: true }
      : { label: 'Upgrade to Pro for multi-platform tracking', done: false, isPro: true },
  ]
  const progressPct = Math.round((progressItems.filter(i => i.done).length / progressItems.length) * 100)

  // Feature locks
  const lockArgs = { userPlan, totalTips, totalSessions, totalFans, totalEarnings, totalStreamMinutes, importedPlatforms: platforms, liveModeSessions }
  const locks = {
    bestTimes:    getFeatureLockState({ feature: 'bestStreamingTimes', ...lockArgs }),
    topFans:      getFeatureLockState({ feature: 'topFans', ...lockArgs }),
    whales:       getFeatureLockState({ feature: 'whales', ...lockArgs }),
    platComp:     getFeatureLockState({ feature: 'platformComparison', ...lockArgs }),
    crossTimes:   getFeatureLockState({ feature: 'crossPlatformBestTimes', ...lockArgs }),
    sessionPerf:  getFeatureLockState({ feature: 'sessionPerformance', ...lockArgs }),
    liveScore:    getFeatureLockState({ feature: 'liveScore', ...lockArgs }),
  }

  // Next action
  function getNextAction() {
    if (platformCount === 0) return { text: 'Next best step: choose your first platform and import your first tips.', primary: 'Choose Platform', onPrimary: onAddHistory }
    if (readiness === 'very_low_data') return { text: 'Next best step: add at least 2 more sessions so CamCash can calculate your best times.', primary: 'Import More Sessions', onPrimary: onAddHistory }
    if (readiness === 'partial_data' && !isPro) return { text: "Next best step: keep building your first platform dashboard, or upgrade to Pro when you're ready to compare multiple cam sites.", primary: 'Import More Data', secondary: 'Upgrade to Pro', onPrimary: onAddHistory, onSecondary: onUpgrade }
    if (readiness === 'partial_data' && isPro) return { text: 'Next best step: add another platform or start Live Mode so CamCash can compare your performance across sites.', primary: 'Add Platform', onPrimary: onAddHistory }
    if (readiness === 'full_data' && !isPro) return { text: 'Next best step: review your current platform insights. Upgrade to Pro to compare more platforms.', primary: 'View My Insights', secondary: 'Upgrade to Pro', onPrimary: onContinue, onSecondary: onUpgrade }
    if (readiness === 'full_data' && isPro) return { text: 'Next best step: review your top fans and plan your next stream around your best earning window.', primary: 'View Top Fans', onPrimary: onContinue }
    return { text: 'Next best step: import your first tips from your platform.', primary: 'Import Tips', onPrimary: onAddHistory }
  }
  const nextAction = getNextAction()

  const ALL_PLATFORMS = ['Chaturbate', 'BongaCams', 'MyFreeCams', 'Stripchat', 'CamSoda']

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Inter',system-ui,sans-serif", color: C.white, boxSizing: 'border-box', position: 'relative' }}>

      {/* BG glow */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle at top left,rgba(0,245,255,0.10),transparent 35%),radial-gradient(circle at top right,rgba(255,61,196,0.10),transparent 35%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* ── 1. HERO STATUS CARD ── */}
        <div style={{ ...glassCard({ marginBottom: 16 }) }}>
          <TopAccent color="rgba(34,211,238,0.5)" />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.cyan, marginBottom: 8 }}>CamCash Dashboard</div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: 10 }}>{hero.headline}</h1>
              <p style={{ fontSize: 13, color: C.text, lineHeight: 1.65, marginBottom: hero.note ? 8 : 0 }}>{hero.sub}</p>
              {hero.note && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginBottom: 0 }}>{hero.note}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 180 }}>
              <button onClick={onAddHistory} style={primaryBtn({ width: '100%' })}>{hero.primaryLabel} →</button>
              <button onClick={readiness === 'full_data' ? onContinue : onLiveMode} style={secondaryBtn({ width: '100%' })}>{hero.secondaryLabel}</button>
            </div>
          </div>

          {/* Status pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {[
              `${fmtN(totalTips)} tips imported`,
              `${fmtN(totalFans)} fan${totalFans !== 1 ? 's' : ''} found`,
              hasUSD ? `${fmt$(totalUSD)} detected` : isEstimated ? `${fmtN(totalTokens)} tokens estimated` : 'No earnings yet',
              `${platformCount} platform${platformCount !== 1 ? 's' : ''} connected`,
            ].map((s, i) => (
              <div key={i} style={{ padding: '4px 12px', borderRadius: 100, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', fontSize: 11, color: C.text, fontWeight: 600 }}>{s}</div>
            ))}
          </div>
        </div>

        {/* ── 2. PLAN STATUS CARD ── */}
        <div style={{ ...glassCard({ marginBottom: 16, background: isPro ? 'rgba(124,92,255,0.06)' : 'rgba(255,255,255,0.03)', border: isPro ? '1px solid rgba(124,92,255,0.2)' : '1px solid rgba(255,255,255,0.08)' }) }}>
          <TopAccent color={isPro ? 'rgba(124,92,255,0.6)' : 'rgba(255,255,255,0.15)'} />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              {isPro ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.indigo }}>✦ Pro plan active</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>You can track multiple platforms, compare earnings, and unlock cross-platform insights as your data grows.</div>
                </>
              ) : platformCount === 0 ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 4 }}>Free plan</div>
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>Track 1 platform for free. Choose your first platform to start building your dashboard.</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 4 }}>Free plan · 1 platform active</div>
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>You're tracking <strong style={{ color: C.cyan }}>{platforms[0]}</strong> for free. Upgrade to Pro when you're ready to track more platforms and compare where you earn best.</div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isPro ? (
                <button onClick={onAddHistory} style={primaryBtn()}>Add Another Platform</button>
              ) : (
                <>
                  <button onClick={onUpgrade} style={primaryBtn()}>Upgrade to Pro</button>
                  {platformCount > 0 && <button onClick={onContinue} style={secondaryBtn({ fontSize: 11 })}>Keep Tracking {platforms[0]}</button>}
                </>
              )}
            </div>
          </div>
          {!isPro && (
            <div style={{ marginTop: 12, fontSize: 11, color: C.muted, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              Your free plan includes 1 active platform. Pro unlocks multi-platform tracking and comparisons. You can keep tracking 1 platform for free forever.
            </div>
          )}
        </div>

        {/* ── 3. UNLOCK PROGRESS CARD ── */}
        <div style={{ ...glassCard({ marginBottom: 16 }) }}>
          <TopAccent color="rgba(16,185,129,0.5)" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎯</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Unlock your full dashboard</div>
              <div style={{ fontSize: 11, color: C.muted }}>{progressPct}% complete</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: C.grad, borderRadius: 100, transition: 'width 0.6s ease' }} />
          </div>
          {/* Checklist */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 6, marginBottom: 14 }}>
            {progressItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900,
                  background: item.done ? (item.isPro ? 'rgba(124,92,255,0.2)' : 'rgba(16,185,129,0.2)') : 'rgba(255,255,255,0.05)',
                  border: item.done ? `1px solid ${item.isPro ? 'rgba(124,92,255,0.4)' : 'rgba(16,185,129,0.4)'}` : '1px solid rgba(255,255,255,0.1)',
                  color: item.done ? (item.isPro ? C.indigo : C.green) : C.muted,
                }}>
                  {item.done ? '✓' : ''}
                </div>
                <span style={{ color: item.done ? C.white : C.muted, fontWeight: item.done ? 600 : 400 }}>{item.label}</span>
                {item.isPro && !item.done && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: C.pink, fontWeight: 700 }}>Pro</span>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
            You're not missing anything — CamCash only shows advanced insights when they're based on enough real activity.
          </div>
        </div>

        {/* ── 4. SNAPSHOT METRIC CARDS ── */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>Your snapshot</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
          <SnapshotMetricCard
            label="Earnings imported"
            value={totalEarnings > 0 ? fmt$(totalEarnings) : 'Not started'}
            helper={isEstimated ? 'Estimated from tokens' : totalEarnings > 0 ? 'Real USD detected' : undefined}
            status={totalEarnings > 0 ? 'ready' : 'locked'}
          />
          <SnapshotMetricCard
            label="Tips found"
            value={totalTips > 0 ? fmtN(totalTips) : 'Not started'}
            status={totalTips > 0 ? 'ready' : 'locked'}
          />
          <SnapshotMetricCard
            label="Fans detected"
            value={totalFans > 0 ? fmtN(totalFans) : 'Not started'}
            status={totalFans > 0 ? 'ready' : 'locked'}
          />
          <SnapshotMetricCard
            label="Sessions"
            value={totalSessions > 0 ? fmtN(totalSessions) : 'Not started'}
            helper={totalSessions > 0 ? `${totalSessions} meaningful` : undefined}
            status={totalSessions > 0 ? 'ready' : 'locked'}
          />
          <SnapshotMetricCard
            label="Avg $/Hour"
            value={canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes }) ? fmt$(analytics?.avgPerHour || 0) : 'Needs more data'}
            helper={!canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes }) ? 'Unlocks after 60+ tracked minutes' : undefined}
            status={canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes }) ? 'ready' : 'needs_data'}
          />
          <SnapshotMetricCard
            label="Platforms"
            value={platformCount > 0 ? platforms.join(', ') : 'None yet'}
            helper={isPro ? 'Pro multi-platform tracking enabled' : 'Free plan tracks 1 platform'}
            status={platformCount > 0 ? 'ready' : 'locked'}
          />
        </div>

        {/* ── 5. EARLY INSIGHTS ── */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>What CamCash found so far</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, marginBottom: 16 }}>

          {/* Earnings card */}
          <div style={glassCard()}>
            <TopAccent color="rgba(245,158,11,0.5)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💵</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Earnings Snapshot</div>
            </div>
            {hasUSD ? (
              <>
                <div style={{ fontSize: 32, fontWeight: 900, color: C.gold, marginBottom: 14 }}>{fmt$(totalUSD)}</div>
                {[
                  ['Tips imported',  fmtN(totalTips)],
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
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                {totalTokens > 0 ? `${fmtN(totalTokens)} tokens detected — USD values not found in import` : 'Waiting for your first import.'}
              </div>
            )}
          </div>

          {/* Top Supporters */}
          <div style={glassCard()}>
            <TopAccent color="rgba(236,72,153,0.5)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⭐</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Top Supporters So Far</div>
            </div>
            {topByTotal ? (
              <>
                {[
                  { label: 'Top supporter',  icon: '👑', value: topByTotal[0], sub: fmt$(topByTotal[1]) + ' total' },
                  { label: 'Most frequent',  icon: '🔄', value: topByCount?.[0] || '—', sub: `${topByCount?.[1] || 0} tips` },
                  { label: 'Biggest single', icon: '💎', value: biggestSingle || '—', sub: maxTip > 0 ? fmt$(maxTip) : '—' },
                  { label: 'Most recent',    icon: '⏱',  value: mostRecentTip?.username || '—', sub: mostRecentTip ? fmtDateTime(mostRecentTip.date_time || mostRecentTip.dateRaw) : '—' },
                ].map(({ label, icon, value, sub }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 1 }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{value}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.text }}>{sub}</div>
                  </div>
                ))}
                <div style={{ marginTop: 10, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>Import more history to see who your real whales and repeat supporters are.</div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: C.muted }}>Still learning — your top supporters will appear here after more tip activity.</div>
            )}
          </div>

          {/* Platform insight (free users only — show upgrade CTA) */}
          {!isPro && platformCount > 0 && (
            <div style={glassCard({ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.15)' })}>
              <TopAccent color="rgba(34,211,238,0.4)" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📡</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Your first platform is active</div>
              </div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginBottom: 14 }}>
                You're tracking <strong style={{ color: C.cyan }}>{platforms[0]}</strong> on the free plan. Upgrade to Pro when you want to add more platforms and compare where you earn best.
              </div>
              <button onClick={onUpgrade} style={primaryBtn({ fontSize: 12 })}>Upgrade to Pro</button>
            </div>
          )}
        </div>

        {/* ── 6. PLATFORM TRACKING SECTION ── */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>Platform tracking</div>
        <div style={{ ...glassCard({ marginBottom: 16 }) }}>
          <TopAccent color="rgba(124,92,255,0.4)" />
          {platformCount === 0 ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 6 }}>Choose 1 platform to track for free</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginTop: 14 }}>
                {ALL_PLATFORMS.map(p => (
                  <button key={p} onClick={onAddHistory} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(34,211,238,0.25)', background: 'rgba(34,211,238,0.05)', color: C.white, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {p} <span style={{ color: C.cyan, fontSize: 10 }}>— Free</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ padding: '6px 14px', borderRadius: 100, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', fontSize: 12, fontWeight: 700, color: C.cyan }}>
                  ✓ Currently tracking: {platforms[0]}
                </div>
                {isPro && <div style={{ fontSize: 11, color: C.muted }}>Pro plan — add more platforms below</div>}
              </div>
              {!isPro && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                  {ALL_PLATFORMS.filter(p => p !== platforms[0]).map(p => (
                    <button key={p} onClick={onUpgrade} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(236,72,153,0.2)', background: 'rgba(236,72,153,0.04)', color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {p} <span style={{ color: C.pink, fontSize: 10, display: 'block' }}>Requires Pro</span>
                    </button>
                  ))}
                </div>
              )}
              {isPro && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                  {ALL_PLATFORMS.filter(p => !platforms.includes(p)).map(p => (
                    <button key={p} onClick={onAddHistory} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(124,92,255,0.25)', background: 'rgba(124,92,255,0.05)', color: C.white, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + Add {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 7. LOCKED ADVANCED INSIGHT CARDS ── */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>Coming alive as you add more data</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, marginBottom: 16 }}>
          {locks.bestTimes.locked && <LockedInsightCard title="Best Streaming Times" description="Your personal peak hours — the times your room earns the most." lockType={locks.bestTimes.lockType} requirement={locks.bestTimes.message} ctaLabel="Import More Data" ctaAction={onAddHistory} />}
          {locks.topFans.locked && <LockedInsightCard title="Top Fans & Whales" description="Who tips the most, most often, and who's most likely to go private." lockType={locks.topFans.lockType} requirement={locks.topFans.message} ctaLabel="Import More Data" ctaAction={onAddHistory} />}
          {locks.sessionPerf.locked && <LockedInsightCard title="Session Performance" description="How your earnings change based on stream length, time, and energy." lockType={locks.sessionPerf.lockType} requirement={locks.sessionPerf.message} ctaLabel="Import More Data" ctaAction={onAddHistory} />}
          {locks.liveScore.locked && <LockedInsightCard title="Live Mode Score" description="Real-time coaching and earnings tracking while you stream." lockType={locks.liveScore.lockType} requirement={locks.liveScore.message} ctaLabel="Start Live Mode" ctaAction={onLiveMode} />}
          {locks.platComp.locked && <LockedInsightCard title="Platform Comparison" description="Which cam site pays you best by hour, day, and fan type." lockType={locks.platComp.lockType} requirement={locks.platComp.message} ctaLabel={locks.platComp.lockType === 'requires_pro' ? 'Upgrade to Pro' : 'Add Platform'} ctaAction={locks.platComp.lockType === 'requires_pro' ? onUpgrade : onAddHistory} />}
          {locks.crossTimes.locked && <LockedInsightCard title="Cross-Platform Best Times" description="Your best earning windows across all platforms combined." lockType={locks.crossTimes.lockType} requirement={locks.crossTimes.message} ctaLabel={locks.crossTimes.lockType === 'requires_pro' ? 'Upgrade to Pro' : 'Import More Data'} ctaAction={locks.crossTimes.lockType === 'requires_pro' ? onUpgrade : onAddHistory} />}
        </div>

        {/* ── 8. NEXT ACTION CARD ── */}
        <div style={{ ...glassCard({ marginBottom: 16, background: 'rgba(124,92,255,0.06)', border: '1px solid rgba(124,92,255,0.2)' }) }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.grad }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 8 }}>Your next best step</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.65 }}>{nextAction.text}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={nextAction.onPrimary} style={primaryBtn()}>{nextAction.primary} →</button>
              {nextAction.secondary && <button onClick={nextAction.onSecondary} style={secondaryBtn({ fontSize: 12 })}>{nextAction.secondary}</button>}
            </div>
          </div>
        </div>

        {/* ── 9. QUICK TOOLS ── */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>Use CamCash while your dashboard learns</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 16 }}>
          <QuickToolCard icon="🎬" title="Room Title Generator" description="Create clickable stream titles in one click." ctaLabel="Open Tool" ctaAction={() => router.push('/guides/chaturbate-room-title-generator')} />
          <QuickToolCard icon="🪙" title="Token Calculator" description="Convert tokens to estimated USD instantly." ctaLabel="Open Tool" ctaAction={() => router.push('/dashboard?tab=token-calc')} />
          <QuickToolCard icon="🔴" title="Live Mode" description="Track tips and get coaching while you stream." ctaLabel="Start Live Mode" ctaAction={onLiveMode} />
          <QuickToolCard icon="🗓️" title="Stream Planner" description="Plan your schedule around your best earning windows." ctaLabel="Open Planner" ctaAction={() => router.push('/dashboard?tab=stream-planner')} />
        </div>

        {/* ── 10. RECENT ACTIVITY ── */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>Recent activity</div>
        <div style={glassCard()}>
          <TopAccent color="rgba(34,211,238,0.4)" />
          {recentTips.length > 0 ? (
            recentTips.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < recentTips.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyan, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{t.username || 'anonymous'}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{fmtDateTime(t.date_time || t.dateRaw)}{t.platform ? ` · ${t.platform}` : ''}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>
                  {safeNum(t.usd) > 0 ? fmt$(t.usd) : t.tokens ? `${t.tokens} tkn` : '—'}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
              No activity yet. Your imports, Live Mode sessions, and tracked tips will appear here.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ============================================================
// PLATFORM INTELLIGENCE HERO — first view after onboarding
//
// Replaces the low-data checklist as the primary thing a user sees on the
// Overview tab. Shows what CamCash actually knows about their multi-platform
// business right now, using only real imported data — never invented,
// never estimated to fill a gap. Everything below is additive; it does not
// touch any other dashboard tab.
// ============================================================

const FREE_TIER_MAX_PLATFORMS = 3
const SNAPSHOT_WINDOW_DAYS = 31

const PI = {
  bg: '#070B18',
  panel: 'rgba(11,18,38,0.74)',
  panelStrong: 'rgba(9,16,35,0.88)',
  border: 'rgba(138,164,220,0.16)',
  borderStrong: 'rgba(22,244,255,0.42)',
  cyan: '#16F4FF',
  blue: '#55B8FF',
  purple: '#7C5CFF',
  pink: '#FF2BAE',
  gold: '#F6B94A',
  green: '#59D98E',
  text: '#F5F7FF',
  body: '#A9B4CC',
  muted: '#6F7C98',
  gradient: 'linear-gradient(90deg,#16F4FF 0%,#55B8FF 36%,#7C5CFF 69%,#FF2BAE 100%)',
}

const PLATFORM_META = {
  Chaturbate: { short: 'CB', color: '#F05A2A' },
  BongaCams:  { short: 'BC', color: '#FF3B6E' },
  MyFreeCams: { short: 'MFC', color: '#F6A33A' },
}
const ALL_PLATFORM_NAMES = Object.keys(PLATFORM_META)
const _normPlatKey = (name) => (name || '').toString().toLowerCase().replace(/[^a-z]/g, '')

function resolvePlatformName(key) {
  if (!key) return null
  const norm = _normPlatKey(key)
  return ALL_PLATFORM_NAMES.find(name => _normPlatKey(name) === norm) || null
}

export function resolvePlatformRoles({ primaryProPlatform, streamingPlatforms, tips = [] }) {
  const fromOnboarding = resolvePlatformName(primaryProPlatform)
  const selected = (streamingPlatforms || []).map(resolvePlatformName).filter(Boolean)

  if (fromOnboarding) {
    const secondary = selected.filter(p => p !== fromOnboarding)
    return { primary: fromOnboarding, secondary, source: 'onboarding' }
  }

  const byUsd = {}
  tips.forEach(t => {
    const p = resolvePlatformName(t.platform)
    if (!p) return
    byUsd[p] = (byUsd[p] || 0) + (parseFloat(t.usd) || 0)
  })
  const ranked = Object.entries(byUsd).sort((a, b) => b[1] - a[1]).map(([p]) => p)
  return { primary: ranked[0] || null, secondary: ranked.slice(1), source: 'inferred' }
}

export function computePlatformCardStats(tips, sessions, platformName, windowDays = SNAPSHOT_WINDOW_DAYS, platformRoi = {}) {
  const platTips = (tips || []).filter(t => resolvePlatformName(t.platform) === platformName)
  if (!platTips.length) {
    return { platform: platformName, hasData: false, usd: 0, tipCount: 0, hours: 0, usdPerHour: null, windowDays: 0, fullHistoryDays: 0, latestDate: null, earliestDate: null }
  }

  const dated = platTips
    .map(t => ({ ...t, _d: new Date(t.date_time || t.dateRaw) }))
    .filter(t => !isNaN(t._d.getTime()))
    .sort((a, b) => a._d - b._d)

  if (!dated.length) return { platform: platformName, hasData: false, usd: 0, tipCount: 0, hours: 0, usdPerHour: null, windowDays: 0, fullHistoryDays: 0, latestDate: null, earliestDate: null }

  const to = dated[dated.length - 1]._d
  const from = dated[0]._d
  const fullHistoryDays = Math.max(1, Math.floor((to - from) / 86400000) + 1)
  const windowStart = new Date(to.getTime() - (windowDays - 1) * 86400000)
  const recentStart = windowStart < from ? from : windowStart
  const recentTips = dated.filter(t => t._d >= recentStart)
  const visibleDays = Math.min(fullHistoryDays, windowDays)

  const usd = parseFloat(recentTips.reduce((s, t) => s + (parseFloat(t.usd) || 0), 0).toFixed(2))
  const tipCount = recentTips.length

  const platSessions = (sessions || []).filter(s => resolvePlatformName(s.platform) === platformName && new Date(s.startTime) >= recentStart)
  const hours = parseFloat(platSessions.reduce((s, x) => s + (Number(x.durationHours) || 0), 0).toFixed(1))
  // $/hr is never derived locally — it must always equal the "Platform ROI"
  // card's number for this platform (single source of truth). No independent
  // session-eligibility or time-window rule for this figure.
  const usdPerHour = Object.prototype.hasOwnProperty.call(platformRoi, platformName) ? platformRoi[platformName] : null

  return {
    platform: platformName,
    hasData: true,
    usd,
    tipCount,
    hours,
    usdPerHour,
    windowDays: visibleDays,
    fullHistoryDays,
    latestDate: to,
    earliestDate: from,
  }
}

export function computeDataVaultStats(tips, windowDays = SNAPSHOT_WINDOW_DAYS) {
  const dated = (tips || [])
    .map(t => new Date(t.date_time || t.dateRaw))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a - b)
  if (!dated.length) return { fullHistoryDays: 0, visibleDays: 0, hasMoreThanWindow: false }
  const fullHistoryDays = Math.max(1, Math.floor((dated[dated.length - 1] - dated[0]) / 86400000) + 1)
  return { fullHistoryDays, visibleDays: Math.min(fullHistoryDays, windowDays), hasMoreThanWindow: fullHistoryDays > windowDays }
}

export function computeMilestones({ primaryStats, secondaryConnectedCount, streamingPlatforms }) {
  return [
    { label: 'Primary platform connected', done: !!primaryStats?.hasData },
    { label: 'First snapshot created', done: !!primaryStats?.hasData },
    { label: 'Second platform connected', done: secondaryConnectedCount >= 1 },
    { label: 'Multi-platform profile created', done: (streamingPlatforms || []).length >= 2 },
  ]
}

function PlatformBadge({ name, size = 40, active = false }) {
  const meta = PLATFORM_META[name] || { short: '?', color: PI.muted }
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: `${meta.color}18`, border: `1px solid ${meta.color}${active ? '95' : '48'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.31, fontWeight: 900, color: meta.color, flexShrink: 0,
      boxShadow: active ? `0 0 18px ${meta.color}20` : 'none'
    }}>{meta.short}</div>
  )
}

function piCard(extra = {}) {
  return {
    borderRadius: 20,
    border: `1px solid ${PI.border}`,
    background: PI.panel,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    boxShadow: '0 14px 45px rgba(0,0,0,0.22)',
    position: 'relative',
    overflow: 'hidden',
    ...extra,
  }
}

function PiLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: PI.muted }}>{children}</div>
}

function PiMetric({ label, value, accent = PI.text }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: PI.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 21, lineHeight: 1.05, fontWeight: 900, color: accent, letterSpacing: '-0.03em' }}>{value}</div>
    </div>
  )
}

function PlatformCard({ platform, stats, primary, onConnect, onUnlock }) {
  const connected = !!stats?.hasData
  const meta = PLATFORM_META[platform] || { color: PI.muted, short: '?' }
  return (
    <div className={primary ? 'pi-platform-card pi-platform-card-primary' : 'pi-platform-card'} style={piCard({ padding: 20, minWidth: 0, height: '100%', background: primary ? `linear-gradient(145deg, ${meta.color}12, rgba(10,16,36,.88))` : PI.panelStrong })}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(circle at 85% 10%, ${meta.color}12, transparent 36%)` }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <PlatformBadge name={platform} size={44} active={connected} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: PI.text }}>{platform}</div>
              <div style={{ display: 'inline-flex', marginTop: 5, padding: '3px 8px', borderRadius: 999, background: primary ? 'linear-gradient(90deg,#16F4FF,#7C5CFF)' : 'rgba(124,92,255,.14)', color: primary ? '#06101A' : '#B9AEFF', fontSize: 9, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                {primary ? 'Primary' : 'Secondary'}
              </div>
            </div>
          </div>
          {connected ? <span style={{ fontSize: 10, fontWeight: 800, color: PI.green }}>● Connected</span> : <span style={{ fontSize: 10, fontWeight: 800, color: PI.muted }}>○ Not connected</span>}
        </div>

        {connected ? (
          <>
            <div style={{ marginTop: 18, marginBottom: 14 }}>
              <PiLabel>{stats.windowDays < SNAPSHOT_WINDOW_DAYS ? `${stats.windowDays} days available` : `Most recent ${SNAPSHOT_WINDOW_DAYS} days`}</PiLabel>
            </div>
            <div className="pi-primary-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 14 }}>
              <PiMetric label="Earnings" value={fmt$(stats.usd)} accent={PI.gold} />
              <PiMetric label="Tips" value={fmtN(stats.tipCount)} />
              <PiMetric label="Hours" value={stats.hours > 0 ? `${stats.hours}h` : '—'} />
              <PiMetric label="$ / hr" value={stats.usdPerHour != null ? fmt$(stats.usdPerHour) : '—'} accent={PI.cyan} />
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11, color: PI.muted }}>
              <span>{stats.earliestDate ? `History starts ${fmtDate(stats.earliestDate)}` : ''}</span>
              {primary && stats.fullHistoryDays > SNAPSHOT_WINDOW_DAYS && <span style={{ color: PI.pink, fontWeight: 800 }}>{stats.fullHistoryDays} days on file</span>}
            </div>
          </>
        ) : (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: PI.body, marginBottom: 14 }}>Selected during onboarding. Connect data to build this platform's snapshot.</div>
            <button onClick={onConnect} style={secondaryBtn({ width: '100%', justifyContent: 'center', fontSize: 12, borderRadius: 12 })}>Connect data →</button>
          </div>
        )}
      </div>
    </div>
  )
}

export function PlatformCoverage({ primary, secondary, connectedSet, maxPlatforms = FREE_TIER_MAX_PLATFORMS, onConnectMore }) {
  const slots = [primary, ...secondary].filter(Boolean)
  const connectedCount = slots.filter(p => connectedSet.has(p)).length
  const pct = maxPlatforms ? Math.min(100, Math.round((connectedCount / maxPlatforms) * 100)) : 0
  return (
    <div className="pi-coverage" style={piCard({ padding: '16px 18px', marginTop: 16 })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: PI.text, textTransform: 'uppercase', letterSpacing: '.08em' }}>Platform coverage</div>
          <div style={{ fontSize: 11, color: PI.muted, marginTop: 3 }}>Your CamCash picture grows as you connect each platform.</div>
        </div>
        <div style={{ fontSize: 12, color: PI.cyan, fontWeight: 900, whiteSpace: 'nowrap' }}>{connectedCount} / {maxPlatforms} connected</div>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,.055)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: PI.gradient, borderRadius: 999, transition: 'width .45s ease' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {slots.map((p, i) => (
          <div key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 9px', borderRadius: 10, border: `1px solid ${connectedSet.has(p) ? 'rgba(89,217,142,.18)' : 'rgba(255,255,255,.07)'}`, background: connectedSet.has(p) ? 'rgba(89,217,142,.05)' : 'rgba(255,255,255,.025)' }}>
            <span style={{ color: connectedSet.has(p) ? PI.green : PI.muted }}>{connectedSet.has(p) ? '✓' : '○'}</span>
            <span style={{ fontSize: 11, color: PI.text, fontWeight: 700 }}>{p}</span>
            <span style={{ fontSize: 9, color: PI.muted, textTransform: 'uppercase' }}>{i === 0 ? 'Primary' : 'Secondary'}</span>
          </div>
        ))}
        {slots.length < maxPlatforms && <button onClick={onConnectMore} style={{ border: '1px dashed rgba(22,244,255,.28)', background: 'rgba(22,244,255,.03)', color: PI.cyan, borderRadius: 10, padding: '6px 9px', fontSize: 11, fontWeight: 800 }}>+ Connect platform</button>}
      </div>
    </div>
  )
}

function MilestoneStrip({ milestones }) {
  const done = milestones.filter(m => m.done).length
  return (
    <div className="pi-milestones" style={piCard({ padding: '14px 16px', marginTop: 14 })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: PI.text, textTransform: 'uppercase', letterSpacing: '.08em' }}>Your CamCash progress</div>
          <div style={{ fontSize: 11, color: PI.muted, marginTop: 3 }}>Real milestones as your platform picture fills in.</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 900, color: PI.cyan }}>{done} / {milestones.length}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
        {milestones.map(m => (
          <div key={m.label} style={{ padding: '9px 10px', borderRadius: 12, background: m.done ? 'rgba(89,217,142,.055)' : 'rgba(255,255,255,.022)', border: `1px solid ${m.done ? 'rgba(89,217,142,.15)' : 'rgba(255,255,255,.06)'}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: m.done ? PI.green : PI.muted }}>{m.done ? '✓ Complete' : '○ Next'}</div>
            <div style={{ fontSize: 10, color: m.done ? PI.body : PI.muted, lineHeight: 1.45, marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DataVaultCard({ vault, onUnlock, isPro = false }) {
  const pct = vault.fullHistoryDays > 0 ? Math.max(2, Math.round((vault.visibleDays / vault.fullHistoryDays) * 100)) : 0
  return (
    <div className="pi-vault" style={piCard({ marginTop: 14, padding: 16, background: 'linear-gradient(145deg,rgba(124,92,255,.09),rgba(10,16,35,.84))', border: '1px solid rgba(124,92,255,.22)' })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <PiLabel>Data vault</PiLabel>
          <div style={{ fontSize: 18, fontWeight: 900, color: PI.text, marginTop: 5 }}>{fmtN(vault.fullHistoryDays)}-day history on file</div>
          <div style={{ fontSize: 11, color: PI.body, marginTop: 3 }}>Free view uses the most recent {SNAPSHOT_WINDOW_DAYS} days.</div>
        </div>
        {isPro ? <span style={{ ...secondaryBtn({ borderColor: 'rgba(89,217,142,.20)', color: '#CFFBE1', background: 'rgba(89,217,142,.05)', fontSize: 11, borderRadius: 11, cursor: 'default' }) }}>✓ Full history unlocked</span> : <button onClick={onUnlock} style={{ ...secondaryBtn({ borderColor: 'rgba(255,43,174,.28)', color: '#FFD6F0', background: 'rgba(255,43,174,.05)', fontSize: 11, borderRadius: 11 }) }}>Unlock deeper history →</button>}
      </div>
      <div style={{ marginTop: 13, height: 8, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: PI.gradient, borderRadius: 999 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 10, color: PI.muted }}>
        <span>{vault.visibleDays} days visible</span>
        <span>{Math.max(0, vault.fullHistoryDays - vault.visibleDays)} days deeper in history</span>
      </div>
    </div>
  )
}

function HowThisWorksInfo() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{ border: 0, background: 'transparent', padding: '4px 0', color: PI.muted, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>ⓘ How this works</button>
      {open && (
        <div style={{ position: 'absolute', top: 30, right: 0, zIndex: 20, width: 320, padding: 14, borderRadius: 14, border: '1px solid rgba(22,244,255,.16)', background: 'rgba(8,13,30,.96)', boxShadow: '0 18px 55px rgba(0,0,0,.45)' }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: PI.text, marginBottom: 7 }}>How this works</div>
          <div style={{ fontSize: 11, color: PI.body, lineHeight: 1.65 }}>CamCash keeps your imported history. Your Free view focuses on the most recent 31 days so you can see what is happening now. More history and broader platform intelligence unlock deeper analysis.</div>
        </div>
      )}
    </div>
  )
}

function NoticeStrip({ children, accent = PI.cyan }) {
  return <div style={{ marginTop: 14, padding: '11px 13px', borderRadius: 12, border: `1px solid ${accent}20`, background: `${accent}07`, color: PI.body, fontSize: 11, lineHeight: 1.55 }}>{children}</div>
}

function CamCashNoticed({ primary, primaryStats, secondary, secondaryStats }) {
  const comparisons = secondaryStats.filter(s => s.hasData && s.usdPerHour != null && primaryStats?.usdPerHour != null)
  const rateLead = comparisons.sort((a,b) => (b.usdPerHour || 0) - (a.usdPerHour || 0))[0]
  const recentPlatforms = [primaryStats, ...secondaryStats].filter(s => s?.hasData).sort((a,b) => b.usd - a.usd)
  const strongest = recentPlatforms[0]
  const insights = []
  if (strongest) insights.push(`${strongest.platform} is your strongest recent earner at ${fmt$(strongest.usd)}.`)
  if (rateLead) insights.push(`${rateLead.platform} currently has the highest tracked $/hour among your connected platforms.`)
  if (!insights.length && primary) insights.push(`${primary} is your current Primary Platform. Add more history or another platform to deepen the comparison.`)
  if (!insights.length) return null
  return (
    <div className="pi-noticed" style={piCard({ marginTop: 16, padding: 16, background: 'linear-gradient(145deg,rgba(22,244,255,.045),rgba(124,92,255,.045))' })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <PiLabel>CamCash noticed</PiLabel>
          <div style={{ fontSize: 16, fontWeight: 900, color: PI.text, marginTop: 4 }}>What your data is telling us so far</div>
        </div>
        <div style={{ fontSize: 10, color: PI.cyan, fontWeight: 800 }}>Based on your data</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(insights.length,2)},minmax(0,1fr))`, gap: 10, marginTop: 12 }}>
        {insights.slice(0,2).map(text => <div key={text} style={{ padding: '11px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.025)', color: PI.body, fontSize: 11, lineHeight: 1.55 }}>{text}</div>)}
      </div>
    </div>
  )
}

function DeeperIntelligence({ primaryStats, totalSessions, isPro = false, onOpenStreamPlanner, onOpenMoneyMap, onUnlock }) {
  const plannerLine = totalSessions > 0 ? `${fmtN(totalSessions)} sessions already contribute to your current planning picture.` : 'Once you have session history, CamCash can start identifying stronger windows.'
  const moneyLine = primaryStats?.hasData ? `${fmtN(primaryStats.tipCount)} recent tips are mapped on your Primary Platform.` : 'Connect your Primary Platform to start building your money picture.'
  return (
    <div className="pi-deeper" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div>
          <PiLabel>Go deeper</PiLabel>
          <div style={{ fontSize: 17, fontWeight: 900, color: PI.text, marginTop: 4 }}>Turn your data into decisions</div>
        </div>
        <div style={{ fontSize: 10, color: PI.muted }}>More intelligence unlocks as your data grows</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
        <div style={piCard({ padding: 15 })}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: PI.text }}>◷ Stream Planner</div>
            <span style={{ fontSize: 9, fontWeight: 800, color: PI.cyan, letterSpacing: '.08em' }}>PLAN</span>
          </div>
          <div style={{ fontSize: 11, color: PI.body, lineHeight: 1.55, margin: '8px 0 10px' }}>{plannerLine}</div>
          <div style={{ padding: 10, borderRadius: 11, background: 'rgba(124,92,255,.06)', border: '1px solid rgba(124,92,255,.16)', fontSize: 11, color: isPro ? PI.green : PI.muted }}>{isPro ? '✓ Historical + cross-platform optimization available' : '🔒 Deeper historical + cross-platform optimization'}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={onOpenStreamPlanner} style={secondaryBtn({ fontSize: 10, padding: '8px 11px', borderRadius: 10 })}>Open Planner →</button>
            {!isPro && <button onClick={onUnlock} style={{ border: 0, background: 'transparent', color: PI.pink, fontSize: 10, fontWeight: 800 }}>Unlock deeper</button>}
          </div>
        </div>
        <div style={piCard({ padding: 15 })}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: PI.text }}>◫ Money Map</div>
            <span style={{ fontSize: 9, fontWeight: 800, color: PI.cyan, letterSpacing: '.08em' }}>MONEY</span>
          </div>
          <div style={{ fontSize: 11, color: PI.body, lineHeight: 1.55, margin: '8px 0 10px' }}>{moneyLine}</div>
          <div style={{ padding: 10, borderRadius: 11, background: 'rgba(255,43,174,.045)', border: '1px solid rgba(255,43,174,.14)', fontSize: 11, color: isPro ? PI.green : PI.muted }}>{isPro ? '✓ Historical + cross-platform money intelligence available' : '🔒 Deeper historical + cross-platform money intelligence'}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={onOpenMoneyMap} style={secondaryBtn({ fontSize: 10, padding: '8px 11px', borderRadius: 10 })}>Open Money Map →</button>
            {!isPro && <button onClick={onUnlock} style={{ border: 0, background: 'transparent', color: PI.pink, fontSize: 10, fontWeight: 800 }}>Unlock deeper</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionCards({ onOpenLiveMode }) {
  return (
    <div className="pi-actions" style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
      <div style={piCard({ padding: 15, background: 'linear-gradient(145deg,rgba(89,217,142,.055),rgba(7,15,26,.84))', border: '1px solid rgba(89,217,142,.14)' })}>
        <div style={{ fontSize: 11, fontWeight: 900, color: PI.green, textTransform: 'uppercase', letterSpacing: '.1em' }}>Live Mode</div>
        <div style={{ fontSize: 15, fontWeight: 900, color: PI.text, marginTop: 4 }}>Turn insights into live coaching.</div>
        <div style={{ fontSize: 11, color: PI.body, lineHeight: 1.55, marginTop: 6 }}>Track what happens while you stream and feed new activity back into your CamCash picture.</div>
        <button onClick={onOpenLiveMode} style={{ marginTop: 10, ...secondaryBtn({ borderColor: 'rgba(89,217,142,.24)', background: 'rgba(89,217,142,.06)', color: '#CFFBE1', fontSize: 10, padding: '8px 12px', borderRadius: 10 }) }}>Open Live Mode →</button>
      </div>
      <div style={piCard({ padding: 15, background: 'linear-gradient(145deg,rgba(22,244,255,.045),rgba(7,15,26,.84))', border: '1px solid rgba(22,244,255,.14)' })}>
        <div style={{ fontSize: 11, fontWeight: 900, color: PI.cyan, textTransform: 'uppercase', letterSpacing: '.1em' }}>Tip Extension</div>
        <div style={{ fontSize: 15, fontWeight: 900, color: PI.text, marginTop: 4 }}>Capture tips automatically.</div>
        <div style={{ fontSize: 11, color: PI.body, lineHeight: 1.55, marginTop: 6 }}>Connect the CamCash browser extension so new tip activity can flow into your analytics without manual entry.</div>
        <a href="/extension" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', marginTop: 10, ...secondaryBtn({ borderColor: 'rgba(22,244,255,.24)', background: 'rgba(22,244,255,.05)', color: '#D7FBFF', fontSize: 10, padding: '8px 12px', borderRadius: 10 }) }}>Get the extension →</a>
      </div>
    </div>
  )
}

export function PlatformIntelligenceHero({
  tips = [], sessions = [], profile, isPro = false,
  totalSessions = 0, platformRoi = {},
  onConnectPlatform, onUnlockPro, onOpenStreamPlanner, onOpenMoneyMap, onOpenLiveMode,
}) {
  const { primary, secondary } = resolvePlatformRoles({
    primaryProPlatform: profile?.primary_pro_platform,
    streamingPlatforms: profile?.streaming_platforms,
    tips,
  })

  const primaryStats = primary ? computePlatformCardStats(tips, sessions, primary, SNAPSHOT_WINDOW_DAYS, platformRoi) : null
  const secondaryStats = secondary.map(p => computePlatformCardStats(tips, sessions, p, SNAPSHOT_WINDOW_DAYS, platformRoi))
  const connectedSet = new Set([primary, ...secondary].filter((p, i) => i === 0 ? primaryStats?.hasData : secondaryStats[i - 1]?.hasData))
  const secondaryConnectedCount = secondaryStats.filter(s => s.hasData).length
  const vault = computeDataVaultStats(tips)
  const milestones = computeMilestones({ primaryStats, secondaryConnectedCount, streamingPlatforms: profile?.streaming_platforms })
  const platformCount = [primary, ...secondary].filter(Boolean).length
  const comparisonCount = connectedSet.size
  const availableCount = Math.max(0, FREE_TIER_MAX_PLATFORMS - platformCount)

  const handleConnectMore = () => onConnectPlatform?.(null)

  return (
    <section className="pi-hero" style={{ marginBottom: 22 }}>
      <div className="pi-hero-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <div>
          <PiLabel>CamCash Platform Intelligence</PiLabel>
          <h1 style={{ marginTop: 5, fontSize: 'clamp(21px,2.1vw,29px)', lineHeight: 1.1, fontWeight: 900, color: PI.text, letterSpacing: '-0.04em' }}>Your cam business, across platforms.</h1>
          <div style={{ marginTop: 6, maxWidth: 760, fontSize: 12, color: PI.body, lineHeight: 1.55 }}>
            See your Primary Platform clearly, compare connected platforms, and build a richer picture as you add data.
          </div>
        </div>
        <HowThisWorksInfo />
      </div>

      <div className={`pi-platform-grid pi-platform-grid-${Math.min(platformCount || 1, 3)}`}>
        {primary && <PlatformCard platform={primary} stats={primaryStats} primary onUnlock={onUnlockPro} onConnect={() => onConnectPlatform?.(primary)} />}
        {secondary.map((p, i) => <PlatformCard key={p} platform={p} stats={secondaryStats[i]} onUnlock={onUnlockPro} onConnect={() => onConnectPlatform?.(p)} />)}
        {!primary && (
          <div style={piCard({ padding: 22, minHeight: 160, display: 'flex', flexDirection: 'column', justifyContent: 'center' })}>
            <PiLabel>Platform setup</PiLabel>
            <div style={{ fontSize: 16, fontWeight: 900, color: PI.text, marginTop: 5 }}>Connect your primary platform</div>
            <div style={{ fontSize: 11, color: PI.body, lineHeight: 1.55, marginTop: 5 }}>Choose a platform in onboarding so CamCash can build your cross-platform view.</div>
            <button onClick={() => onConnectPlatform?.(null)} style={{ ...secondaryBtn({ alignSelf: 'flex-start', marginTop: 12, fontSize: 10, padding: '8px 12px', borderRadius: 10 }) }}>Set up platforms →</button>
          </div>
        )}
      </div>

      <PlatformCoverage primary={primary} secondary={secondary} connectedSet={connectedSet} onConnectMore={handleConnectMore} />

      {comparisonCount > 0 && (
        <NoticeStrip>
          <strong style={{ color: PI.text }}>{comparisonCount} platform{comparisonCount === 1 ? '' : 's'} connected.</strong>{' '}
          {comparisonCount === 1 ? 'Connect another platform to unlock the full side-by-side comparison experience.' : `You have ${availableCount} platform slot${availableCount === 1 ? '' : 's'} available in the current Free setup.`}
        </NoticeStrip>
      )}

      <CamCashNoticed primary={primary} primaryStats={primaryStats} secondary={secondary} secondaryStats={secondaryStats} />

      {vault.hasMoreThanWindow && <DataVaultCard vault={vault} onUnlock={onUnlockPro} isPro={isPro} />}

      <MilestoneStrip milestones={milestones} />

      <DeeperIntelligence
        primaryStats={primaryStats}
        totalSessions={totalSessions}
        isPro={isPro}
        onOpenStreamPlanner={onOpenStreamPlanner}
        onOpenMoneyMap={onOpenMoneyMap}
        onUnlock={onUnlockPro}
      />

      <ActionCards onOpenLiveMode={onOpenLiveMode} />
    </section>
  )
}
