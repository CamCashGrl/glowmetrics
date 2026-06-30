'use client'
// ============================================================
// CAMCASH — POST-ONBOARDING DASHBOARD PREVIEW
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
// ============================================================

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ── BRAND TOKENS (from CLAUDE.md) ────────────────────────────
const C = {
  bg:     '#050713',
  bg1:    '#080B1A',
  bg2:    '#0D1020',
  card:   'rgba(10,14,32,0.82)',
  border: 'rgba(255,255,255,0.09)',
  cyan:   '#16F4FF',
  cyanSoft:'#48E9FF',
  pink:   '#FF2BAE',
  purple: '#7C5CFF',
  gold:   '#FFC857',
  green:  '#34d399',
  red:    '#f87171',
  white:  '#FFFFFF',
  text:   '#D7D9EA',
  muted:  '#8D93AA',
  grad:   'linear-gradient(90deg,#16F4FF 0%,#55B8FF 28%,#7C5CFF 52%,#FF2BAE 100%)',
}

const PAGE_BG = `
  radial-gradient(circle at 18% 35%, rgba(22,244,255,0.18), transparent 34%),
  radial-gradient(circle at 82% 45%, rgba(255,43,174,0.20), transparent 36%),
  linear-gradient(135deg, #050713 0%, #080B1A 48%, #120719 100%)
`

// ── SAFE FORMATTERS ───────────────────────────────────────────
const safeNum = (v, fallback = 0) => { const n = parseFloat(v); return isNaN(n) || !isFinite(n) ? fallback : n }
const fmt$    = (v) => `$${safeNum(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtN    = (v) => safeNum(v).toLocaleString('en-US')
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function fmtDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }

// ── CARD STYLES ───────────────────────────────────────────────
const glassCard = (extra = {}) => ({
  background: 'rgba(12,16,34,0.78)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 22,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 42px rgba(0,0,0,0.28)',
  padding: '22px 24px',
  position: 'relative',
  overflow: 'hidden',
  ...extra,
})

const primaryBtn = (extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 18, border: 'none', cursor: 'pointer',
  background: C.grad,
  color: '#fff', fontWeight: 850, fontSize: 13,
  padding: '12px 24px',
  boxShadow: `0 0 26px rgba(22,244,255,0.28), 0 0 36px rgba(255,43,174,0.26)`,
  transition: 'opacity 0.15s',
  whiteSpace: 'nowrap',
  ...extra,
})

const secondaryBtn = (extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 18, border: '1px solid rgba(255,255,255,0.13)',
  background: 'rgba(255,255,255,0.06)', color: C.text,
  fontWeight: 600, fontSize: 13, padding: '11px 22px',
  cursor: 'pointer', transition: 'background 0.15s',
  whiteSpace: 'nowrap',
  ...extra,
})

// ── ACCENT LINE ───────────────────────────────────────────────
function TopAccent({ color }) {
  return <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color || C.grad, borderRadius: '22px 22px 0 0' }} />
}

// ── SECTION LABEL ─────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, marginBottom: 12 }}>{children}</div>
)

// ── LOCK CHIP ─────────────────────────────────────────────────
function LockChip({ type }) {
  const isData = type === 'needs_data'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700,
      background: isData ? `${C.cyan}15` : `${C.pink}15`,
      border: `1px solid ${isData ? C.cyan : C.pink}40`,
      color: isData ? C.cyan : C.pink,
    }}>
      {isData ? '📊 Needs more data' : '✦ Pro'}
    </span>
  )
}

// ── PILL ──────────────────────────────────────────────────────
const pill = (label, color) => (
  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', background: `${color}20`, color, border: `1px solid ${color}44` }}>
    {label}
  </span>
)

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getDashboardReadiness({ totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0 }) {
  if (!totalTips || totalTips === 0) return 'no_data'
  if (totalTips < 25 || totalSessions < 3 || totalFans < 5 || totalEarnings < 10) return 'very_low_data'
  if (totalTips < 100 || totalSessions < 8 || totalFans < 20 || totalEarnings < 50) return 'partial_data'
  return 'full_data'
}

export function getDashboardStage({ tipCount = 0, sessionCount = 0, totalEarnings = 0 }) {
  if (tipCount === 0) return 'empty'
  const r = getDashboardReadiness({ totalTips: tipCount, totalSessions: sessionCount, totalEarnings })
  if (r === 'full_data') return 'ready'
  return 'preview'
}

export function getPlanAccess(userPlan = 'free', trackedPlatformCount = 0) {
  const isPro = userPlan === 'pro'
  return {
    isPro, isFree: !isPro,
    canTrackMultiplePlatforms: isPro,
    canComparePlatforms: isPro,
    canUseCrossPlatformInsights: isPro,
    freePlatformLimitReached: !isPro && trackedPlatformCount >= 1,
  }
}

export function getFeatureLockState({ feature, userPlan = 'free', totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0, totalStreamMinutes = 0, importedPlatforms = [], liveModeSessions = 0 }) {
  const isPro = userPlan === 'pro'
  const platformCount = importedPlatforms?.length || 0
  const rules = {
    bestStreamingTimes:     { needsData: totalSessions < 3 || totalTips < 25,           requiresPro: false, dataMessage: 'Unlocks after 3+ sessions with timestamps.',                          proMessage: null },
    topFans:                { needsData: totalFans < 5 || totalTips < 10,               requiresPro: false, dataMessage: 'Unlocks after more fan and tip activity.',                           proMessage: null },
    whales:                 { needsData: totalFans < 10 || totalEarnings < 50,          requiresPro: false, dataMessage: 'Unlocks after enough repeat fan activity.',                          proMessage: null },
    platformComparison:     { needsData: isPro && platformCount < 2,                    requiresPro: !isPro, dataMessage: 'Import at least 2 platforms to compare earnings.',                  proMessage: 'Upgrade to Pro to compare earnings across platforms.' },
    multiPlatformTracking:  { needsData: false,                                         requiresPro: !isPro, dataMessage: null,                                                                proMessage: 'Upgrade to Pro to track more than one platform.' },
    crossPlatformBestTimes: { needsData: isPro && (platformCount < 2 || totalSessions < 3), requiresPro: !isPro, dataMessage: 'Import sessions from at least 2 platforms to unlock cross-platform timing insights.', proMessage: 'Upgrade to Pro to unlock cross-platform best times.' },
    sessionPerformance:     { needsData: totalSessions < 3,                             requiresPro: false, dataMessage: 'Unlocks after multiple completed sessions.',                         proMessage: null },
    averageHourly:          { needsData: totalSessions < 3 || totalStreamMinutes < 60, requiresPro: false, dataMessage: 'Unlocks after at least 60 minutes of tracked stream time.',          proMessage: null },
    liveScore:              { needsData: liveModeSessions < 1,                          requiresPro: false, dataMessage: 'Unlocks after your first Live Mode stream.',                         proMessage: null },
    retention:              { needsData: totalSessions < 5 || totalFans < 20,           requiresPro: false, dataMessage: 'Unlocks after more repeat fan activity.',                           proMessage: null },
    forecasting:            { needsData: totalSessions < 8 || totalEarnings < 50,       requiresPro: false, dataMessage: 'Unlocks after more earnings history.',                              proMessage: null },
  }
  const rule = rules[feature]
  if (!rule) return { locked: false, lockType: null, message: null }
  if (rule.requiresPro) return { locked: true, lockType: 'requires_pro', message: rule.proMessage }
  if (rule.needsData)   return { locked: true, lockType: 'needs_data',   message: rule.dataMessage }
  return { locked: false, lockType: null, message: null }
}

export const canShowBestHours    = ({ tipCount, sessionCount })             => tipCount >= 25 && sessionCount >= 3
export const canShowWhales       = ({ uniqueFanCount, totalEarnings })      => uniqueFanCount >= 5 && totalEarnings >= 50
export const canShowPlatformComp = ({ platformCount, sessionCount })        => platformCount >= 2 && sessionCount >= 4
export const canShowSessionPerf  = ({ sessionCount })                       => sessionCount >= 3
export const canShowRetention    = ({ uniqueFanCount, dateRangeDays })      => uniqueFanCount >= 10 && dateRangeDays >= 7
export const canShowHourlyRate   = ({ sessionCount, totalStreamMinutes })   => sessionCount >= 3 && totalStreamMinutes >= 60

// ============================================================
// LOCKED INSIGHT CARD
// ============================================================
export function LockedInsightCard({ title, description, lockType = 'needs_data', requirement, ctaLabel, ctaAction }) {
  const isData = lockType === 'needs_data'
  const accent = isData ? C.cyan : C.pink
  return (
    <div style={{ ...glassCard({ background: `${accent}08`, border: `1px solid ${accent}25` }) }}>
      <TopAccent color={`linear-gradient(90deg, transparent, ${accent}60, transparent)`} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: `${accent}18`, border: `1px solid ${accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
          {isData ? '📊' : '✦'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{title}</div>
            <LockChip type={lockType} />
          </div>
          <div style={{ fontSize: 11, color: C.text, lineHeight: 1.65, marginBottom: requirement ? 8 : 0 }}>{description}</div>
          {requirement && <div style={{ fontSize: 11, color: C.muted, marginBottom: ctaLabel ? 12 : 0 }}>◦ {requirement}</div>}
          {ctaLabel && ctaAction && (
            <button onClick={ctaAction} style={{ padding: '6px 14px', borderRadius: 100, border: `1px solid ${accent}50`, background: `${accent}14`, color: accent, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {ctaLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// EMPTY DASHBOARD — no_data state
// ============================================================
export function EmptyDashboard({ onImport, onLiveMode }) {
  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: "'DM Sans','Inter',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ maxWidth: 500, width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}>

        {/* Icon */}
        <div style={{ width: 80, height: 80, borderRadius: 24, background: C.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, margin: '0 auto 28px', boxShadow: `0 0 50px rgba(22,244,255,0.25), 0 0 80px rgba(255,43,174,0.18)` }}>
          💸
        </div>

        <div style={{ fontSize: 28, fontWeight: 900, color: C.white, letterSpacing: '-0.025em', marginBottom: 12, lineHeight: 1.2 }}>
          Your dashboard is ready ✨
        </div>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.75, marginBottom: 36, maxWidth: 380, margin: '0 auto 36px' }}>
          Import your first tips or start Live Mode to unlock your personal earnings insights.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 300, margin: '0 auto' }}>
          <button onClick={onImport} style={{ ...primaryBtn({ width: '100%', padding: '15px', fontSize: 14 }) }}>
            Import My Tips →
          </button>
          <button onClick={onLiveMode} style={{ ...secondaryBtn({ width: '100%', padding: '14px', fontSize: 13 }) }}>
            Start Live Mode
          </button>
        </div>

        <div style={{ marginTop: 32, fontSize: 12, color: C.muted }}>
          Supports Chaturbate, BongaCams, MyFreeCams, Stripchat & CamSoda
        </div>
      </div>
    </div>
  )
}

// ============================================================
// SNAPSHOT METRIC CARD
// ============================================================
function MetricCard({ label, value, helper, accent = C.cyan, icon }) {
  return (
    <div style={{ ...glassCard({ padding: '18px 20px', borderTop: `2px solid ${accent}` }) }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 70, height: 70, background: `radial-gradient(circle at top right, ${accent}18, transparent 70%)`, pointerEvents: 'none' }} />
      {icon && <div style={{ fontSize: 18, marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: accent, fontFamily: "'DM Mono',monospace", lineHeight: 1.1, marginBottom: helper ? 4 : 0 }}>{value}</div>
      {helper && <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>{helper}</div>}
    </div>
  )
}

// ============================================================
// DASHBOARD PREVIEW — main export
// ============================================================
export function DashboardPreview({ tips = [], analytics, userPlan = 'free', onAddHistory, onContinue, onUpgrade, onLiveMode }) {
  const router = useRouter()

  // ── Derived values ───────────────────────────────────────
  const totalTips          = tips.length
  const totalUSD           = safeNum(tips.reduce((s, t) => s + safeNum(t.usd), 0))
  const totalTokens        = tips.reduce((s, t) => s + (parseInt(t.tokens) || 0), 0)
  const hasUSD             = totalUSD > 0
  const isEstimated        = !hasUSD && totalTokens > 0

  const platforms          = [...new Set(tips.map(t => t.platform).filter(p => p && p !== 'Unknown'))]
  const platformCount      = platforms.length

  const fans               = [...new Set(tips.map(t => (t.username || '').toLowerCase()).filter(Boolean))]
  const totalFans          = fans.length

  const totalSessions      = analytics?.meaningfulSessionCount || 0
  const totalEarnings      = totalUSD
  const totalStreamMinutes = analytics?.totalStreamMinutes || 0
  const liveModeSessions   = 0

  const dates              = tips.map(t => new Date(t.date_time || t.dateRaw)).filter(d => !isNaN(d)).sort((a, b) => a - b)
  const dateFrom           = dates[0] || null
  const dateTo             = dates[dates.length - 1] || null
  const avgTip             = totalTips > 0 && hasUSD ? totalUSD / totalTips : 0
  const maxTip             = tips.length > 0 ? safeNum(Math.max(...tips.map(t => safeNum(t.usd)))) : 0
  const recentTips         = [...tips].sort((a, b) => new Date(b.date_time || b.dateRaw) - new Date(a.date_time || a.dateRaw)).slice(0, 8)
  const mostRecentTip      = recentTips[0] || null

  // Fan aggregates
  const fanTotals = {}; const fanCounts = {}; let biggestSingle = null, biggestSingleAmt = 0
  tips.forEach(t => {
    const u = (t.username || 'anonymous').toLowerCase()
    fanTotals[u] = safeNum(fanTotals[u]) + safeNum(t.usd)
    fanCounts[u] = (fanCounts[u] || 0) + 1
    if (safeNum(t.usd) > biggestSingleAmt) { biggestSingleAmt = safeNum(t.usd); biggestSingle = t.username }
  })
  const topByTotal = Object.entries(fanTotals).sort((a, b) => b[1] - a[1])[0]
  const topByCount = Object.entries(fanCounts).sort((a, b) => b[1] - a[1])[0]

  // Tip type breakdown
  const tipTypes = {}
  tips.forEach(t => { const k = t.tip_type || 'tip'; tipTypes[k] = (tipTypes[k] || 0) + 1 })

  // Platform earnings breakdown
  const platformEarnings = {}
  tips.forEach(t => {
    if (!t.platform || t.platform === 'Unknown') return
    if (!platformEarnings[t.platform]) platformEarnings[t.platform] = { usd: 0, count: 0 }
    platformEarnings[t.platform].usd   += safeNum(t.usd)
    platformEarnings[t.platform].count += 1
  })

  // Readiness + plan
  const readiness = getDashboardReadiness({ totalTips, totalSessions, totalFans, totalEarnings })
  const plan      = getPlanAccess(userPlan, platformCount)
  const isPro     = plan.isPro

  // Data confidence label
  const confidenceLabel = {
    no_data:      null,
    very_low_data: 'Early signal',
    partial_data:  'Likely pattern',
    full_data:     'Strong pattern',
  }[readiness]

  const confidenceColor = {
    very_low_data: C.gold,
    partial_data:  C.cyan,
    full_data:     C.green,
  }[readiness]

  // Hero copy
  const heroConfig = {
    very_low_data: {
      headline: 'Your first insights are ready ✨',
      sub: 'We found your first earnings data. Import a few more sessions to unlock your best times, top fans, and deeper trends.',
      primaryLabel: 'Import More Data',
      secondaryLabel: 'Start Live Mode',
    },
    partial_data: {
      headline: "CamCash is learning your stream patterns ✨",
      sub: "Based on your imported sessions, we're identifying your earning patterns, fan behavior, and platform performance.",
      primaryLabel: 'Add More History',
      secondaryLabel: 'View Live Mode',
    },
    full_data: {
      headline: 'Your personalized dashboard is ready ✨',
      sub: 'You have enough data to see your best times, top fans, platform trends, and session performance.',
      primaryLabel: 'View My Insights',
      secondaryLabel: 'Start Live Mode',
    },
  }
  const hero = heroConfig[readiness] || heroConfig.very_low_data

  // Progress checklist
  const progressItems = [
    { label: 'Account created',                       done: true },
    { label: 'Onboarding completed',                  done: true },
    { label: 'Track your first platform',             done: platformCount >= 1 },
    { label: 'Import at least 3 sessions',            done: totalSessions >= 3 },
    { label: 'Add 25+ tips',                          done: totalTips >= 25 },
    { label: 'Start your first Live Mode session',    done: liveModeSessions >= 1 },
    { label: 'Unlock full insights',                  done: readiness === 'full_data' },
    isPro
      ? { label: 'Pro multi-platform tracking enabled', done: true, isPro: true }
      : { label: 'Upgrade to Pro for multi-platform',   done: false, isPro: true },
  ]
  const progressPct = Math.round((progressItems.filter(i => i.done).length / progressItems.length) * 100)

  // Feature locks
  const lockArgs = { userPlan, totalTips, totalSessions, totalFans, totalEarnings, totalStreamMinutes, importedPlatforms: platforms, liveModeSessions }
  const locks = {
    bestTimes:   getFeatureLockState({ feature: 'bestStreamingTimes', ...lockArgs }),
    topFans:     getFeatureLockState({ feature: 'topFans',            ...lockArgs }),
    whales:      getFeatureLockState({ feature: 'whales',             ...lockArgs }),
    platComp:    getFeatureLockState({ feature: 'platformComparison', ...lockArgs }),
    crossTimes:  getFeatureLockState({ feature: 'crossPlatformBestTimes', ...lockArgs }),
    sessionPerf: getFeatureLockState({ feature: 'sessionPerformance', ...lockArgs }),
    liveScore:   getFeatureLockState({ feature: 'liveScore',          ...lockArgs }),
  }

  // Next action
  function getNextAction() {
    if (platformCount === 0) return { text: 'Choose your first platform and import your first tips to start building your dashboard.', primary: 'Choose Platform', onPrimary: onAddHistory }
    if (readiness === 'very_low_data') return { text: 'Add at least 2 more sessions so CamCash can calculate your best earning windows.', primary: 'Import More Sessions', onPrimary: onAddHistory }
    if (readiness === 'partial_data' && !isPro) return { text: "Keep building your first platform dashboard, or upgrade to Pro when you're ready to compare multiple cam sites.", primary: 'Import More Data', secondary: 'Upgrade to Pro', onPrimary: onAddHistory, onSecondary: onUpgrade }
    if (readiness === 'partial_data' && isPro) return { text: 'Add another platform or start Live Mode so CamCash can compare your performance across sites.', primary: 'Add Platform', onPrimary: onAddHistory }
    if (readiness === 'full_data' && !isPro) return { text: 'Review your current platform insights. Upgrade to Pro to compare more platforms.', primary: 'View My Insights', secondary: 'Upgrade to Pro', onPrimary: onContinue, onSecondary: onUpgrade }
    if (readiness === 'full_data' && isPro) return { text: 'Review your top fans and plan your next stream around your best earning window.', primary: 'View Top Fans', onPrimary: onContinue }
    return { text: 'Import your first tips from your platform.', primary: 'Import Tips', onPrimary: onAddHistory }
  }
  const nextAction = getNextAction()

  const ALL_PLATFORMS = ['Chaturbate', 'BongaCams', 'MyFreeCams', 'Stripchat', 'CamSoda']

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: "'DM Sans','Inter',sans-serif", color: C.white, position: 'relative' }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        * { box-sizing: border-box }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 980, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* ── 1. HERO STATUS CARD ─────────────────────────── */}
        <div style={{ ...glassCard({ marginBottom: 14 }) }}>
          <TopAccent />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.cyan, marginBottom: 10 }}>CamCash Dashboard</div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: 10, margin: '0 0 10px' }}>{hero.headline}</h1>
              <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0 }}>{hero.sub}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 180 }}>
              <button onClick={onAddHistory} style={primaryBtn({ width: '100%' })}>{hero.primaryLabel} →</button>
              <button onClick={readiness === 'full_data' ? onContinue : onLiveMode} style={secondaryBtn({ width: '100%' })}>{hero.secondaryLabel}</button>
            </div>
          </div>

          {/* Status pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
            {[
              { label: `${fmtN(totalTips)} tips`, color: C.cyan },
              { label: `${fmtN(totalFans)} fan${totalFans !== 1 ? 's' : ''}`, color: C.purple },
              { label: hasUSD ? `${fmt$(totalUSD)} detected` : isEstimated ? `${fmtN(totalTokens)} tokens` : 'No earnings yet', color: C.gold },
              { label: `${platformCount} platform${platformCount !== 1 ? 's' : ''}`, color: C.pink },
              ...(confidenceLabel ? [{ label: confidenceLabel, color: confidenceColor }] : []),
            ].map(({ label, color }, i) => (
              <div key={i} style={{ padding: '4px 12px', borderRadius: 100, background: `${color}14`, border: `1px solid ${color}35`, fontSize: 11, color, fontWeight: 600 }}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. SNAPSHOT METRICS ─────────────────────────── */}
        <SectionLabel>Your snapshot</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
          <MetricCard
            label="Earnings"
            value={hasUSD ? fmt$(totalUSD) : isEstimated ? `~${fmt$(totalTokens * 0.05)}` : '—'}
            helper={hasUSD ? 'Real USD from imports' : isEstimated ? 'Est. from tokens at $0.05' : 'Waiting for import'}
            accent={C.gold}
            icon="💵"
          />
          <MetricCard
            label="Tips Found"
            value={totalTips > 0 ? fmtN(totalTips) : '—'}
            helper={totalTips > 0 ? (dateFrom ? `${fmtDate(dateFrom)} → ${fmtDate(dateTo)}` : undefined) : 'No imports yet'}
            accent={C.cyan}
            icon="🎁"
          />
          <MetricCard
            label="Unique Fans"
            value={totalFans > 0 ? fmtN(totalFans) : '—'}
            helper={totalFans > 0 ? `Avg ${avgTip > 0 ? fmt$(avgTip) : '—'} per tip` : 'Found after import'}
            accent={C.pink}
            icon="⭐"
          />
          <MetricCard
            label="Sessions"
            value={totalSessions > 0 ? fmtN(totalSessions) : '—'}
            helper={totalSessions > 0 ? `${totalSessions} valid sessions` : 'Needs 30+ min & 2+ tips'}
            accent={C.purple}
            icon="🎬"
          />
          <MetricCard
            label="Avg $/Hour"
            value={canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes }) ? fmt$(analytics?.avgPerHour || 0) : '—'}
            helper={!canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes }) ? 'Unlocks after 60+ tracked minutes' : `Over ${Math.round(totalStreamMinutes / 60)}h tracked`}
            accent={C.green}
            icon="⏱"
          />
          <MetricCard
            label="Biggest Tip"
            value={maxTip > 0 ? fmt$(maxTip) : '—'}
            helper={biggestSingle ? `from ${biggestSingle}` : undefined}
            accent={C.gold}
            icon="💎"
          />
        </div>

        {/* ── 3. EARNINGS + TOP FANS ──────────────────────── */}
        <SectionLabel>What CamCash found so far</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14, marginBottom: 20 }}>

          {/* Earnings breakdown */}
          <div style={glassCard()}>
            <TopAccent color={`linear-gradient(90deg, transparent, ${C.gold}60, transparent)`} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: `${C.gold}18`, border: `1px solid ${C.gold}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💵</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Earnings Snapshot</div>
            </div>
            {hasUSD ? (
              <>
                <div style={{ fontSize: 34, fontWeight: 900, color: C.gold, fontFamily: "'DM Mono',monospace", marginBottom: 16 }}>{fmt$(totalUSD)}</div>
                {[
                  ['Tips imported',  fmtN(totalTips)],
                  ['Average tip',    avgTip > 0 ? fmt$(avgTip) : '—'],
                  ['Largest tip',    maxTip > 0 ? fmt$(maxTip) : '—'],
                  ['Most recent',    mostRecentTip ? fmt$(safeNum(mostRecentTip.usd)) : '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
                    <span style={{ color: C.muted, fontSize: 11 }}>{label}</span>
                    <span style={{ color: C.white, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{val}</span>
                  </div>
                ))}
                {Object.keys(platformEarnings).length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>By platform</div>
                    {Object.entries(platformEarnings).sort((a, b) => b[1].usd - a[1].usd).map(([p, { usd, count }]) => (
                      <div key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0' }}>
                        <span style={{ color: C.text }}>{p}</span>
                        <span style={{ color: C.gold, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{fmt$(usd)} <span style={{ color: C.muted, fontWeight: 400 }}>({count} tips)</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>
                {totalTokens > 0
                  ? `${fmtN(totalTokens)} tokens detected — USD values not found in import. Estimated value: ${fmt$(totalTokens * 0.05)}`
                  : 'Waiting for your first import.'}
              </div>
            )}
          </div>

          {/* Top Supporters */}
          <div style={glassCard()}>
            <TopAccent color={`linear-gradient(90deg, transparent, ${C.pink}60, transparent)`} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: `${C.pink}18`, border: `1px solid ${C.pink}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⭐</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Top Supporters</div>
            </div>
            {topByTotal ? (
              <>
                {[
                  { label: 'Top supporter',  icon: '👑', value: topByTotal[0],     sub: fmt$(topByTotal[1]) + ' total' },
                  { label: 'Most frequent',  icon: '🔄', value: topByCount?.[0] || '—', sub: `${topByCount?.[1] || 0} tips` },
                  { label: 'Biggest single', icon: '💎', value: biggestSingle || '—',    sub: maxTip > 0 ? fmt$(maxTip) : '—' },
                  { label: 'Most recent',    icon: '⏱',  value: mostRecentTip?.username || '—', sub: mostRecentTip ? fmtDateTime(mostRecentTip.date_time || mostRecentTip.dateRaw) : '—' },
                ].map(({ label, icon, value, sub }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 1 }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{value}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.text, textAlign: 'right' }}>{sub}</div>
                  </div>
                ))}
                <div style={{ marginTop: 12, fontSize: 11, color: C.muted, lineHeight: 1.55 }}>
                  Import more history to see your real whales and repeat supporters.
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: C.muted }}>Your top supporters will appear here after your first import.</div>
            )}
          </div>

          {/* Platform status card */}
          <div style={glassCard({ background: `${C.cyan}06`, border: `1px solid ${C.cyan}20` })}>
            <TopAccent color={`linear-gradient(90deg, transparent, ${C.cyan}55, transparent)`} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: `${C.cyan}18`, border: `1px solid ${C.cyan}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📡</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>
                {platformCount === 0 ? 'No platforms yet' : isPro ? 'Pro tracking active' : `Tracking: ${platforms[0]}`}
              </div>
            </div>
            {platformCount === 0 ? (
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.65, marginBottom: 14 }}>
                Choose a platform to start tracking your earnings.
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.65, marginBottom: 14 }}>
                {isPro
                  ? `Tracking ${platforms.join(', ')} — add more platforms anytime.`
                  : `Tracking ${platforms[0]} on the free plan. Upgrade to Pro to track more platforms and compare where you earn best.`}
              </div>
            )}
            {isPro
              ? <button onClick={onAddHistory} style={primaryBtn({ fontSize: 12 })}>Add Another Platform</button>
              : <button onClick={onUpgrade} style={primaryBtn({ fontSize: 12 })}>Upgrade to Pro ✦</button>}
            {!isPro && platformCount === 0 && (
              <button onClick={onAddHistory} style={{ ...secondaryBtn({ fontSize: 12, marginTop: 8 }) }}>Choose Platform →</button>
            )}
          </div>
        </div>

        {/* ── 4. UNLOCK PROGRESS ──────────────────────────── */}
        <SectionLabel>Dashboard unlock progress</SectionLabel>
        <div style={{ ...glassCard({ marginBottom: 20 }) }}>
          <TopAccent color={`linear-gradient(90deg, transparent, ${C.green}55, transparent)`} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${C.green}18`, border: `1px solid ${C.green}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎯</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Unlock your full dashboard</div>
              <div style={{ fontSize: 11, color: C.muted }}>{progressPct}% complete</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 900, color: C.green, fontFamily: "'DM Mono',monospace" }}>{progressPct}%</div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 100, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: C.grad, borderRadius: 100, transition: 'width 0.7s ease' }} />
          </div>

          {/* Checklist */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
            {progressItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '6px 0' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900,
                  background: item.done ? (item.isPro ? `${C.purple}25` : `${C.green}22`) : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${item.done ? (item.isPro ? C.purple : C.green) : 'rgba(255,255,255,0.1)'}55`,
                  color: item.done ? (item.isPro ? C.purple : C.green) : C.muted,
                }}>
                  {item.done ? '✓' : ''}
                </div>
                <span style={{ color: item.done ? C.white : C.muted, fontWeight: item.done ? 600 : 400, flex: 1 }}>{item.label}</span>
                {item.isPro && !item.done && <span style={{ fontSize: 10, color: C.pink, fontWeight: 700 }}>Pro</span>}
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. PLAN STATUS ──────────────────────────────── */}
        <div style={{ ...glassCard({ marginBottom: 20, background: isPro ? `${C.purple}08` : 'rgba(255,255,255,0.03)', border: `1px solid ${isPro ? C.purple : 'rgba(255,255,255,0.08)'}35` }) }}>
          <TopAccent color={isPro ? `linear-gradient(90deg, transparent, ${C.purple}60, transparent)` : undefined} />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              {isPro ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {pill('✦ Pro plan active', C.purple)}
                  </div>
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.65 }}>Track multiple platforms, compare earnings, and unlock cross-platform insights as your data grows.</div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {pill('Free plan', C.muted)}
                  </div>
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.65 }}>
                    {platformCount > 0
                      ? <>You're tracking <strong style={{ color: C.cyan }}>{platforms[0]}</strong> for free. Upgrade to Pro when you're ready to track more platforms and compare where you earn best.</>
                      : 'Track 1 platform free. Choose your first platform to start building your dashboard.'}
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isPro
                ? <button onClick={onAddHistory} style={primaryBtn()}>Add Another Platform</button>
                : <>
                    <button onClick={onUpgrade} style={primaryBtn()}>Upgrade to Pro ✦</button>
                    {platformCount > 0 && <button onClick={onContinue} style={secondaryBtn({ fontSize: 11 })}>Keep Tracking {platforms[0]}</button>}
                  </>}
            </div>
          </div>
        </div>

        {/* ── 6. PLATFORM TRACKING ────────────────────────── */}
        <SectionLabel>Platform tracking</SectionLabel>
        <div style={{ ...glassCard({ marginBottom: 20 }) }}>
          <TopAccent color={`linear-gradient(90deg, transparent, ${C.purple}55, transparent)`} />
          {platformCount === 0 ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 6 }}>Choose 1 platform to track for free</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Each platform has its own earnings format — CamCash handles parsing automatically.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                {ALL_PLATFORMS.map(p => (
                  <button key={p} onClick={onAddHistory} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${C.cyan}30`, background: `${C.cyan}08`, color: C.white, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                    {p}<br /><span style={{ color: C.cyan, fontSize: 10, fontWeight: 600 }}>Free</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ padding: '6px 14px', borderRadius: 100, background: `${C.cyan}14`, border: `1px solid ${C.cyan}35`, fontSize: 12, fontWeight: 700, color: C.cyan }}>
                  ✓ Tracking: {platforms.join(', ')}
                </div>
                {isPro && <div style={{ fontSize: 11, color: C.muted }}>Pro — add more below</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                {ALL_PLATFORMS.filter(p => !platforms.includes(p)).map(p => (
                  <button key={p} onClick={isPro ? onAddHistory : onUpgrade} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${isPro ? C.purple : C.pink}25`, background: `${isPro ? C.purple : C.pink}06`, color: isPro ? C.text : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>
                    {p}<br /><span style={{ color: isPro ? C.purple : C.pink, fontSize: 10 }}>{isPro ? '+ Add' : 'Requires Pro'}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── 7. LOCKED INSIGHT CARDS ─────────────────────── */}
        <SectionLabel>Coming alive as you add more data</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, marginBottom: 20 }}>
          {locks.bestTimes.locked   && <LockedInsightCard title="Best Streaming Times"       description="Your personal peak hours — the times your room earns the most per hour."         lockType={locks.bestTimes.lockType}   requirement={locks.bestTimes.message}   ctaLabel="Import More Data"                                                     ctaAction={onAddHistory} />}
          {locks.topFans.locked     && <LockedInsightCard title="Top Fans & Whales"           description="Who tips the most, most often, and who's most likely to go private."            lockType={locks.topFans.lockType}     requirement={locks.topFans.message}     ctaLabel="Import More Data"                                                     ctaAction={onAddHistory} />}
          {locks.sessionPerf.locked && <LockedInsightCard title="Session Performance"         description="How your earnings shift based on stream length, time of day, and energy."       lockType={locks.sessionPerf.lockType} requirement={locks.sessionPerf.message} ctaLabel="Import More Data"                                                     ctaAction={onAddHistory} />}
          {locks.liveScore.locked   && <LockedInsightCard title="Live Mode Score"             description="Real-time coaching and earnings tracking while you stream."                    lockType={locks.liveScore.lockType}   requirement={locks.liveScore.message}   ctaLabel="Start Live Mode"                                                      ctaAction={onLiveMode} />}
          {locks.platComp.locked    && <LockedInsightCard title="Platform Comparison"         description="Which cam site pays you best by hour, day, and fan type."                      lockType={locks.platComp.lockType}    requirement={locks.platComp.message}    ctaLabel={locks.platComp.lockType === 'requires_pro' ? 'Upgrade to Pro' : 'Add Platform'} ctaAction={locks.platComp.lockType === 'requires_pro' ? onUpgrade : onAddHistory} />}
          {locks.crossTimes.locked  && <LockedInsightCard title="Cross-Platform Best Times"   description="Your best earning windows across all platforms combined."                      lockType={locks.crossTimes.lockType}  requirement={locks.crossTimes.message}  ctaLabel={locks.crossTimes.lockType === 'requires_pro' ? 'Upgrade to Pro' : 'Import More Data'} ctaAction={locks.crossTimes.lockType === 'requires_pro' ? onUpgrade : onAddHistory} />}
        </div>

        {/* ── 8. NEXT BEST STEP ───────────────────────────── */}
        <div style={{ ...glassCard({ marginBottom: 20, background: `${C.purple}08`, border: `1px solid ${C.purple}30` }) }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.grad, borderRadius: '22px 22px 0 0' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 8 }}>Your next best step</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7 }}>{nextAction.text}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={nextAction.onPrimary} style={primaryBtn()}>{nextAction.primary} →</button>
              {nextAction.secondary && <button onClick={nextAction.onSecondary} style={secondaryBtn({ fontSize: 12 })}>{nextAction.secondary}</button>}
            </div>
          </div>
        </div>

        {/* ── 9. QUICK TOOLS ──────────────────────────────── */}
        <SectionLabel>Use CamCash while your dashboard learns</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { icon: '🎬', title: 'Room Title Generator', desc: 'Create clickable stream titles in one click.', cta: 'Open Tool', action: () => router.push('/guides/chaturbate-room-title-generator') },
            { icon: '🪙', title: 'Token Calculator',     desc: 'Convert tokens to estimated USD instantly.',  cta: 'Open Tool', action: () => router.push('/dashboard?tab=token-calc') },
            { icon: '🔴', title: 'Live Mode',            desc: 'Track tips and get coaching while you stream.', cta: 'Start Live Mode', action: onLiveMode },
            { icon: '🗓️', title: 'Stream Planner',       desc: 'Plan your schedule around your best earning windows.', cta: 'Open Planner', action: () => router.push('/dashboard?tab=stream-planner') },
          ].map(({ icon, title, desc, cta, action }) => (
            <div key={title} style={glassCard({ padding: '18px 20px' })}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 11, color: C.text, lineHeight: 1.6, marginBottom: 14 }}>{desc}</div>
              <button onClick={action} style={secondaryBtn({ fontSize: 11, padding: '7px 14px' })}>{cta}</button>
            </div>
          ))}
        </div>

        {/* ── 10. RECENT ACTIVITY ─────────────────────────── */}
        <SectionLabel>Recent activity</SectionLabel>
        <div style={glassCard()}>
          <TopAccent color={`linear-gradient(90deg, transparent, ${C.cyan}45, transparent)`} />
          {recentTips.length > 0 ? (
            recentTips.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < recentTips.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.cyan, flexShrink: 0, boxShadow: `0 0 6px ${C.cyan}` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{t.username || 'anonymous'}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{fmtDateTime(t.date_time || t.dateRaw)}{t.platform ? ` · ${t.platform}` : ''}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, fontFamily: "'DM Mono',monospace" }}>
                  {safeNum(t.usd) > 0 ? fmt$(t.usd) : t.tokens ? `${t.tokens} tkn` : '—'}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '24px 0' }}>
              No activity yet. Your imports, Live Mode sessions, and tracked tips will appear here.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
