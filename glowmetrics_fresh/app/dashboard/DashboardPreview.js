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
//   DashboardPreview         — preview/full_data state
//   LockedInsightCard        — locked insight card component
// ============================================================

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ── BRAND TOKENS ─────────────────────────────────────────────
const C = {
  bg:      '#050713',
  sidebar: '#0d0f1e',
  card:    'rgba(12,16,34,0.78)',
  border:  'rgba(255,255,255,0.09)',
  cyan:    '#16F4FF',
  pink:    '#FF2BAE',
  purple:  '#7C5CFF',
  gold:    '#FFC857',
  green:   '#34d399',
  red:     '#f87171',
  blue:    '#55B8FF',
  white:   '#FFFFFF',
  text:    '#B9BED3',
  muted:   '#8D93AA',
  grad:    'linear-gradient(90deg,#16F4FF 0%,#55B8FF 28%,#7C5CFF 52%,#FF2BAE 100%)',
}

const PAGE_BG = `
  radial-gradient(circle at 12% 18%, rgba(22,244,255,0.18), transparent 30%),
  radial-gradient(circle at 88% 22%, rgba(255,43,174,0.18), transparent 32%),
  linear-gradient(135deg, #050713 0%, #080B1A 48%, #120719 100%)
`

const CARD = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 20,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 42px rgba(0,0,0,0.28)',
  position: 'relative',
  overflow: 'hidden',
}

// ── SAFE FORMATTERS ───────────────────────────────────────────
const safeNum = (v, fb = 0) => { const n = parseFloat(v); return isNaN(n) || !isFinite(n) ? fb : n }
const fmt$    = v => `$${safeNum(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtN    = v => safeNum(v).toLocaleString('en-US')
const fmtDate = d => { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
const fmtTime = d => { if (!d) return '—'; return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }

// ── SHARED UI ATOMS ───────────────────────────────────────────
const Pill = ({ label, color, outline = false }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    background: outline ? 'transparent' : `${color}22`,
    border: `1px solid ${color}${outline ? '99' : '44'}`,
    color,
  }}>{label}</span>
)

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted, marginBottom: 14 }}>{children}</div>
)

const CardHeader = ({ icon, title, badge, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: sub ? 4 : 0 }}>
      {icon && <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{icon}</div>}
      <div style={{ fontSize: 14, fontWeight: 800, color: C.white, flex: 1 }}>{title}</div>
      {badge}
    </div>
    {sub && <div style={{ fontSize: 11, color: C.muted, marginLeft: icon ? 42 : 0, lineHeight: 1.55 }}>{sub}</div>}
  </div>
)

const IconTile = ({ color, children, size = 48 }) => (
  <div style={{ width: size, height: size, borderRadius: 14, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, flexShrink: 0, boxShadow: `0 0 18px ${color}55` }}>
    {children}
  </div>
)

const primaryBtn = (extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 18, border: 'none', cursor: 'pointer',
  background: C.grad, color: '#fff', fontWeight: 800, fontSize: 13,
  padding: '12px 24px',
  boxShadow: '0 0 26px rgba(22,244,255,0.22), 0 0 36px rgba(255,43,174,0.20)',
  whiteSpace: 'nowrap',
  ...extra,
})

const secondaryBtn = (extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 18, border: `1px solid ${C.border}`,
  background: 'rgba(255,255,255,0.05)', color: C.text,
  fontWeight: 600, fontSize: 13, padding: '10px 20px',
  cursor: 'pointer', whiteSpace: 'nowrap',
  ...extra,
})

// ============================================================
// HELPER FUNCTIONS (exported — used by page.js)
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
    bestStreamingTimes:     { needsData: totalSessions < 3 || totalTips < 25,               requiresPro: false, dataMessage: 'Unlocks after 3+ sessions with timestamps.',                          proMessage: null },
    topFans:                { needsData: totalFans < 5 || totalTips < 10,                   requiresPro: false, dataMessage: 'Unlocks after more fan and tip activity.',                           proMessage: null },
    whales:                 { needsData: totalFans < 10 || totalEarnings < 50,              requiresPro: false, dataMessage: 'Unlocks after enough repeat fan activity.',                          proMessage: null },
    platformComparison:     { needsData: isPro && platformCount < 2,                        requiresPro: !isPro, dataMessage: 'Import at least 2 platforms to compare earnings.',                  proMessage: 'Upgrade to Pro to compare earnings across platforms.' },
    multiPlatformTracking:  { needsData: false,                                             requiresPro: !isPro, dataMessage: null,                                                                proMessage: 'Upgrade to Pro to track more than one platform.' },
    crossPlatformBestTimes: { needsData: isPro && (platformCount < 2 || totalSessions < 3), requiresPro: !isPro, dataMessage: 'Import sessions from at least 2 platforms.',                       proMessage: 'Upgrade to Pro to unlock cross-platform best times.' },
    sessionPerformance:     { needsData: totalSessions < 3,                                 requiresPro: false, dataMessage: 'Unlocks after multiple completed sessions.',                         proMessage: null },
    averageHourly:          { needsData: totalSessions < 3 || totalStreamMinutes < 60,      requiresPro: false, dataMessage: 'Unlocks after at least 60 minutes of tracked stream time.',          proMessage: null },
    liveScore:              { needsData: liveModeSessions < 1,                              requiresPro: false, dataMessage: 'Unlocks after your first Live Mode stream.',                         proMessage: null },
    retention:              { needsData: totalSessions < 5 || totalFans < 20,               requiresPro: false, dataMessage: 'Unlocks after more repeat fan activity.',                           proMessage: null },
    forecasting:            { needsData: totalSessions < 8 || totalEarnings < 50,           requiresPro: false, dataMessage: 'Unlocks after more earnings history.',                              proMessage: null },
  }
  const rule = rules[feature]
  if (!rule) return { locked: false, lockType: null, message: null }
  if (rule.requiresPro) return { locked: true, lockType: 'requires_pro', message: rule.proMessage }
  if (rule.needsData)   return { locked: true, lockType: 'needs_data',   message: rule.dataMessage }
  return { locked: false, lockType: null, message: null }
}

export const canShowBestHours    = ({ tipCount, sessionCount })           => tipCount >= 25 && sessionCount >= 3
export const canShowWhales       = ({ uniqueFanCount, totalEarnings })    => uniqueFanCount >= 5 && totalEarnings >= 50
export const canShowPlatformComp = ({ platformCount, sessionCount })      => platformCount >= 2 && sessionCount >= 4
export const canShowSessionPerf  = ({ sessionCount })                     => sessionCount >= 3
export const canShowRetention    = ({ uniqueFanCount, dateRangeDays })    => uniqueFanCount >= 10 && dateRangeDays >= 7
export const canShowHourlyRate   = ({ sessionCount, totalStreamMinutes }) => sessionCount >= 3 && totalStreamMinutes >= 60

// ============================================================
// LOCKED INSIGHT CARD
// ============================================================
export function LockedInsightCard({ title, description, lockType = 'needs_data', requirement, ctaLabel, ctaAction }) {
  const isData  = lockType === 'needs_data'
  const accent  = isData ? C.cyan : C.pink
  return (
    <div style={{ ...CARD, padding: '18px 20px', background: `${accent}08`, border: `1px solid ${accent}25` }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${accent}60,transparent)` }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
          {isData ? '📊' : '✦'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{title}</div>
            <Pill label={isData ? '📊 Needs more data' : '✦ Pro'} color={accent} />
          </div>
          <div style={{ fontSize: 11, color: C.text, lineHeight: 1.6, marginBottom: requirement ? 6 : 0 }}>{description}</div>
          {requirement && <div style={{ fontSize: 11, color: C.muted, marginBottom: ctaLabel ? 10 : 0 }}>◦ {requirement}</div>}
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
// PREVIEW SIDEBAR
// ============================================================
const SIDEBAR_NAV = [
  { id: 'overview',  icon: '⚡', label: 'Overview',         action: 'continue' },
  { id: 'platforms', icon: '🎯', label: 'Platforms',        action: 'continue' },
  { id: 'fans',      icon: '⭐', label: 'Top Fans',         action: 'continue' },
  { id: 'sessions',  icon: '🎬', label: 'Sessions',         action: 'continue' },
  { id: 'live',      icon: '🔴', label: 'Live Mode',        action: 'live'     },
  { id: 'tools',     icon: '🔧', label: 'Tools',            action: 'continue' },
  { id: 'upload',    icon: '📥', label: 'Upload More Data', action: 'import'   },
  { id: 'settings',  icon: '⚙️', label: 'Settings',         action: 'continue' },
]

function PreviewSidebar({ userPlan, onContinue, onAddHistory, onLiveMode }) {
  const [active, setActive] = useState('overview')
  const [hover,  setHover]  = useState(null)

  const handleNav = (item) => {
    setActive(item.id)
    if (item.action === 'live')   return onLiveMode?.()
    if (item.action === 'import') return onAddHistory?.()
    onContinue?.()
  }

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: 212,
      background: C.sidebar,
      borderRight: `1px solid rgba(255,255,255,0.07)`,
      display: 'flex', flexDirection: 'column',
      zIndex: 50, fontFamily: "'DM Sans','Inter',sans-serif",
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 18px 20px', borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: C.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#fff', boxShadow: `0 0 16px rgba(22,244,255,0.3)`, flexShrink: 0 }}>$</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>
              Cam<span style={{ background: C.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cash</span>
            </div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>Creator Intelligence</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
        {SIDEBAR_NAV.map(item => {
          const isActive  = active === item.id
          const isHovered = hover === item.id
          return (
            <button key={item.id}
              onClick={() => handleNav(item)}
              onMouseEnter={() => setHover(item.id)}
              onMouseLeave={() => setHover(null)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 11, border: 'none', cursor: 'pointer',
                marginBottom: 2,
                background: isActive
                  ? 'linear-gradient(135deg, rgba(22,244,255,0.14) 0%, rgba(124,92,255,0.10) 100%)'
                  : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderLeft: isActive ? `2px solid ${C.cyan}` : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0, opacity: isActive ? 1 : 0.65 }}>{item.icon}</span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? C.white : C.text, flex: 1, textAlign: 'left' }}>{item.label}</span>
              {isActive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.cyan, boxShadow: `0 0 6px ${C.cyan}`, flexShrink: 0 }} />}
            </button>
          )
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 10px 18px', borderTop: `1px solid rgba(255,255,255,0.06)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 800, flexShrink: 0 }}>✦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>My Dashboard</div>
            <div style={{ fontSize: 10, marginTop: 2 }}>
              <Pill label={userPlan === 'pro' ? '✦ Pro Plan' : 'Free Plan'} color={userPlan === 'pro' ? C.purple : C.muted} />
            </div>
          </div>
          <span style={{ color: C.muted, fontSize: 12 }}>›</span>
        </div>
      </div>
    </aside>
  )
}

// ============================================================
// EMPTY DASHBOARD — no_data state
// ============================================================
export function EmptyDashboard({ onImport, onLiveMode }) {
  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: "'DM Sans','Inter',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: C.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, margin: '0 auto 28px', boxShadow: '0 0 50px rgba(22,244,255,0.25),0 0 80px rgba(255,43,174,0.18)' }}>💸</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.white, letterSpacing: '-0.025em', marginBottom: 12, lineHeight: 1.2 }}>Your dashboard is ready ✨</div>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.75, marginBottom: 36, maxWidth: 380, margin: '0 auto 36px' }}>Import your first tips or start Live Mode to unlock your personal earnings insights.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 300, margin: '0 auto' }}>
          <button onClick={onImport}   style={{ ...primaryBtn({ width: '100%', padding: '15px', fontSize: 14 }) }}>Import My Tips →</button>
          <button onClick={onLiveMode} style={{ ...secondaryBtn({ width: '100%', padding: '14px', fontSize: 13 }) }}>Start Live Mode</button>
        </div>
        <div style={{ marginTop: 32, fontSize: 12, color: C.muted }}>Supports Chaturbate, BongaCams, MyFreeCams, Stripchat & CamSoda</div>
      </div>
    </div>
  )
}

// ============================================================
// DASHBOARD PREVIEW — main export
// ============================================================
export function DashboardPreview({ tips = [], analytics, userPlan = 'free', onAddHistory, onContinue, onUpgrade, onLiveMode }) {
  const router = useRouter()

  // ── Derived values ──────────────────────────────────────
  const totalTips     = tips.length
  const totalUSD      = safeNum(tips.reduce((s, t) => s + safeNum(t.usd), 0))
  const totalTokens   = tips.reduce((s, t) => s + (parseInt(t.tokens) || 0), 0)
  const hasUSD        = totalUSD > 0
  const isEstimated   = !hasUSD && totalTokens > 0

  const platforms     = [...new Set(tips.map(t => t.platform).filter(p => p && p !== 'Unknown'))]
  const platformCount = platforms.length

  const fanTotals = {}; const fanCounts = {}
  let biggestSingleAmt = 0, biggestSingleUser = null
  tips.forEach(t => {
    const u = (t.username || 'anonymous').toLowerCase()
    fanTotals[u] = safeNum(fanTotals[u]) + safeNum(t.usd)
    fanCounts[u] = (fanCounts[u] || 0) + 1
    if (safeNum(t.usd) > biggestSingleAmt) { biggestSingleAmt = safeNum(t.usd); biggestSingleUser = t.username }
  })
  const uniqueFans = Object.keys(fanTotals)
  const totalFans  = uniqueFans.length

  // Fan tiers per CLAUDE.md
  const getFanTier = (username) => {
    const usd   = safeNum(fanTotals[username])
    const count = fanCounts[username] || 0
    if (usd >= 100 && count >= 10) return 'Whale'
    if (usd >= 30  && count >= 5)  return 'Shark'
    if (usd >= 5   && count >= 2)  return 'Regular'
    return 'New'
  }
  const TIER_STYLE = {
    Whale:   { color: C.pink,   label: '🐋 Whale'   },
    Shark:   { color: C.blue,   label: '🦈 Shark'   },
    Regular: { color: C.cyan,   label: '⭐ Regular'  },
    New:     { color: C.purple, label: '✦ New'      },
  }

  const topFansByUSD = Object.entries(fanTotals).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const totalSessions      = analytics?.meaningfulSessionCount || 0
  const totalStreamMinutes = analytics?.totalStreamMinutes || 0
  const avgPerHour         = analytics?.avgPerHour
  const totalEarnings      = totalUSD

  const dates   = tips.map(t => new Date(t.date_time || t.dateRaw)).filter(d => !isNaN(d)).sort((a, b) => a - b)
  const dateFrom = dates[0] || null
  const dateTo   = dates[dates.length - 1] || null

  const avgTip  = totalTips > 0 && hasUSD ? totalUSD / totalTips : 0
  const maxTip  = tips.length > 0 ? safeNum(Math.max(...tips.map(t => safeNum(t.usd)))) : 0
  const recentTips = [...tips].sort((a, b) => new Date(b.date_time || b.dateRaw) - new Date(a.date_time || a.dateRaw)).slice(0, 6)

  // Best stream day
  const dayTotals = {}
  tips.forEach(t => {
    const d = t.date_time || t.dateRaw
    if (!d) return
    const day = new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    dayTotals[day] = safeNum(dayTotals[day]) + safeNum(t.usd)
  })
  const bestDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0]

  // Platform earnings
  const platEarnings = {}
  tips.forEach(t => {
    const p = t.platform && t.platform !== 'Unknown' ? t.platform : null
    if (!p) return
    platEarnings[p] = safeNum(platEarnings[p]) + safeNum(t.usd)
  })
  const platTotal  = Object.values(platEarnings).reduce((s, v) => s + v, 0)
  const topPlatform = Object.entries(platEarnings).sort((a, b) => b[1] - a[1])[0]

  const PLAT_GRAD = {
    Chaturbate: `linear-gradient(90deg, ${C.cyan}, ${C.blue})`,
    BongaCams:  `linear-gradient(90deg, ${C.pink}, #ff6bc1)`,
    MyFreeCams: `linear-gradient(90deg, ${C.purple}, #a78bfa)`,
    Stripchat:  `linear-gradient(90deg, ${C.gold}, #fb923c)`,
    CamSoda:    `linear-gradient(90deg, ${C.green}, #6ee7b7)`,
  }

  // Data confidence score (real calculation — not fabricated)
  const confScore = Math.min(
    Math.round(
      Math.min(totalTips / 100, 1) * 35 +
      Math.min(totalSessions / 8, 1) * 30 +
      Math.min(totalFans / 20, 1) * 20 +
      Math.min(totalEarnings / 50, 1) * 15
    ),
    100
  )
  const confLabel = confScore < 30 ? 'Starter insight' : confScore < 60 ? 'Early signal' : confScore < 80 ? 'Growing data' : 'Strong signal'

  // Readiness
  const readiness = getDashboardReadiness({ totalTips, totalSessions, totalFans, totalEarnings })
  const isPro     = userPlan === 'pro'

  const stageLabel = {
    very_low_data: '✦ Starter view',
    partial_data:  '✦ Growing view',
    full_data:     '✦ Full view',
  }[readiness] || '✦ Starter view'

  const stageSub = {
    very_low_data: 'CamCash is already finding early patterns in your data. Upload more to improve accuracy and unlock deeper insights.',
    partial_data:  "You're building real signal. Your best times, top fans, and session patterns are coming into focus.",
    full_data:     'Your full personalized dashboard is ready. All insights are based on your real stream data.',
  }[readiness] || 'CamCash is already finding early patterns in your data. Upload more to improve accuracy and unlock deeper insights.'

  const [lastUpdated] = useState('just now')

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'DM Sans','Inter',sans-serif", color: C.white, display: 'flex' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box }
        ::-webkit-scrollbar { width: 5px; height: 5px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px }
      `}</style>

      {/* ── SIDEBAR ─────────────────────────────────── */}
      <PreviewSidebar userPlan={userPlan} onContinue={onContinue} onAddHistory={onAddHistory} onLiveMode={onLiveMode} />

      {/* ── MAIN CONTENT ────────────────────────────── */}
      <div style={{ marginLeft: 212, flex: 1, minHeight: '100vh', background: PAGE_BG }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 28px 80px' }}>

          {/* ── HERO ──────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: '-0.02em', margin: 0 }}>Dashboard Preview</h1>
                <Pill label={stageLabel} color={C.cyan} outline />
              </div>
              <p style={{ fontSize: 13, color: C.text, margin: 0, maxWidth: 580, lineHeight: 1.65 }}>{stageSub}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Last updated: {lastUpdated}</span>
              <button onClick={onContinue} style={{ ...secondaryBtn({ fontSize: 11, padding: '7px 14px', borderRadius: 10 }) }}>↻ Refresh</button>
            </div>
          </div>

          {/* ── TOP METRICS ROW ───────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>

            {/* Total Imported */}
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <IconTile color="linear-gradient(135deg,#55B8FF,#16F4FF)" size={44}>💵</IconTile>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: 4 }}>Total Imported</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.white, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>
                {hasUSD ? fmt$(totalUSD) : isEstimated ? `~${fmt$(totalTokens * 0.05)}` : <span style={{ fontSize: 13, color: C.muted }}>No data yet</span>}
              </div>
              {hasUSD && <div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>{fmtN(totalTips)} tips detected</div>}
            </div>

            {/* Platforms Connected */}
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <IconTile color="linear-gradient(135deg,#7C5CFF,#55B8FF)" size={44}>📡</IconTile>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: 4 }}>Platforms</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.white, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>
                {platformCount > 0 ? platformCount : <span style={{ fontSize: 13, color: C.muted }}>None yet</span>}
              </div>
              {platformCount > 0 && <div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>{platforms.join(', ')}</div>}
            </div>

            {/* Active Fans */}
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <IconTile color="linear-gradient(135deg,#16F4FF,#34d399)" size={44}>⭐</IconTile>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: 4 }}>Active Fans Found</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.white, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>
                {totalFans > 0 ? fmtN(totalFans) : <span style={{ fontSize: 13, color: C.muted }}>None yet</span>}
              </div>
              {totalFans > 0 && <div style={{ fontSize: 10, color: C.cyan, marginTop: 5 }}>{totalFans} unique tippers</div>}
            </div>

            {/* Data Confidence */}
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <IconTile color="linear-gradient(135deg,#FFC857,#fb923c)" size={44}>🛡️</IconTile>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Data Confidence</div>
                  <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{confLabel} ⓘ</div>
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.gold, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{confScore}%</div>
              <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${confScore}%`, background: `linear-gradient(90deg,${C.gold},${C.pink})`, borderRadius: 99, transition: 'width 0.6s ease' }} />
              </div>
            </div>

            {/* Best Early $/Hr */}
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <IconTile color="linear-gradient(135deg,#FF2BAE,#f87171)" size={44}>⏱</IconTile>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Best Early $/Hr</div>
                  <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>Preliminary signal ⓘ</div>
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "'DM Mono',monospace", lineHeight: 1, color: canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes }) ? C.pink : C.muted }}>
                {canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes }) && avgPerHour
                  ? fmt$(avgPerHour)
                  : <span style={{ fontSize: 12, color: C.muted }}>Not enough data</span>}
              </div>
              {canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes }) && <div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>across {totalSessions} sessions</div>}
            </div>
          </div>

          {/* ── MIDDLE ROW ────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>

            {/* Preview Scorecard */}
            <div style={{ ...CARD, padding: '20px 22px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.cyan}70,transparent)` }} />
              <CardHeader icon="🏆" title="Preview Scorecard" sub="Early highlights from your data so far." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  {
                    icon: '⭐', label: 'Best stream day',
                    value: bestDay ? `${bestDay[0]} · ${fmt$(bestDay[1])}` : null,
                  },
                  {
                    icon: '🕐', label: 'Best hour so far',
                    value: analytics?.bestHour?.hour != null
                      ? (() => { const h = parseInt(analytics.bestHour.hour); if (isNaN(h)) return null; const lh = ((h + (new Date().getTimezoneOffset() / -60)) % 24 + 24) % 24; const rh = Math.round(lh); return `${rh === 0 ? '12 AM' : rh < 12 ? `${rh} AM` : rh === 12 ? '12 PM' : `${rh - 12} PM`}` })()
                      : null,
                  },
                  {
                    icon: '🔷', label: 'Top platform so far',
                    value: topPlatform && platTotal > 0 ? `${topPlatform[0]} · ${Math.round((topPlatform[1] / platTotal) * 100)}% of earnings` : null,
                  },
                  {
                    icon: '❤️', label: 'Strongest fan (so far)',
                    value: topFansByUSD[0] ? `${topFansByUSD[0][0]} · ${fmt$(topFansByUSD[0][1])}` : null,
                  },
                  {
                    icon: '💰', label: 'Avg session value',
                    value: totalSessions >= 3 && totalUSD > 0 ? `${fmt$(totalUSD / totalSessions)} across ${totalSessions} sessions` : null,
                  },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                    <span style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}><span>{icon}</span>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: value ? C.white : C.muted, fontFamily: value ? "'DM Mono',monospace" : undefined, textAlign: 'right', maxWidth: 160 }}>
                      {value || 'Not enough data yet'}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 10, color: C.muted, lineHeight: 1.55 }}>
                ⓘ Starter insight — accuracy improves with more data.
              </div>
            </div>

            {/* Platform Preview */}
            <div style={{ ...CARD, padding: '20px 22px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.pink}70,transparent)` }} />
              <CardHeader
                icon="📊"
                title="Platform Preview"
                badge={<Pill label="Preliminary signal" color={C.pink} outline />}
                sub="Early earnings comparison across your connected platforms."
              />
              {Object.keys(platEarnings).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📡</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>No platform data yet</div>
                  <button onClick={onAddHistory} style={primaryBtn({ fontSize: 12, padding: '9px 18px' })}>Import Tips →</button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Object.entries(platEarnings).sort((a, b) => b[1] - a[1]).map(([platform, earned]) => {
                      const pct  = platTotal > 0 ? Math.round((earned / platTotal) * 100) : 0
                      const grad = PLAT_GRAD[platform] || `linear-gradient(90deg,${C.purple},${C.pink})`
                      return (
                        <div key={platform}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 26, height: 26, borderRadius: 7, background: grad, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{platform}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.white, fontFamily: "'DM Mono',monospace" }}>{fmt$(earned)}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>{pct}% of total</div>
                            </div>
                          </div>
                          <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: grad, borderRadius: 99, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 14, fontSize: 10, color: C.muted }}>ⓘ Percentages may shift as more data is imported.</div>
                </>
              )}
            </div>

            {/* Top Early Fans */}
            <div style={{ ...CARD, padding: '20px 22px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.purple}70,transparent)` }} />
              <CardHeader icon="👥" title="Top Early Fans" sub="Your highest value fans so far." />
              {topFansByUSD.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>👥</div>
                  <div style={{ fontSize: 13, color: C.muted }}>Fan data appears after import</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {topFansByUSD.slice(0, 5).map(([username, usd], i) => {
                      const tier = getFanTier(username)
                      const ts   = TIER_STYLE[tier]
                      const initials = username.slice(0, 2).toUpperCase()
                      return (
                        <div key={username} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 4 ? `1px solid rgba(255,255,255,0.05)` : 'none' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${C.purple},${C.pink})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{username}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>×{fanCounts[username]} tips</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: C.gold, fontFamily: "'DM Mono',monospace" }}>{fmt$(usd)}</div>
                            <Pill label={ts.label} color={ts.color} outline={tier !== 'Whale'} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button onClick={onContinue} style={{ ...secondaryBtn({ width: '100%', marginTop: 12, fontSize: 11, padding: '8px', justifyContent: 'center', borderRadius: 10 }) }}>
                    View all fans →
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── BOTTOM ROW ────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>

            {/* Recent Upload Activity */}
            <div style={{ ...CARD, padding: '20px 22px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.blue}70,transparent)` }} />
              <CardHeader icon="📥" title="Recent Upload Activity" sub="Your most recent data imports." />
              {recentTips.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>No imports yet</div>
                  <button onClick={onAddHistory} style={primaryBtn({ fontSize: 12, padding: '9px 18px' })}>Upload Tips →</button>
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Tip / Fan', 'Platform', 'When', 'Amount'].map(h => (
                            <th key={h} style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 0 8px', textAlign: 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentTips.map((t, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 12, color: C.white, fontWeight: 600, padding: '8px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{t.username || 'anonymous'}</td>
                            <td style={{ fontSize: 11, color: C.muted, padding: '8px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{t.platform || '—'}</td>
                            <td style={{ fontSize: 11, color: C.muted, padding: '8px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`, whiteSpace: 'nowrap' }}>{fmtTime(t.date_time || t.dateRaw)}</td>
                            <td style={{ fontSize: 12, fontWeight: 700, color: C.gold, fontFamily: "'DM Mono',monospace", padding: '8px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`, textAlign: 'right' }}>
                              {safeNum(t.usd) > 0 ? fmt$(t.usd) : t.tokens ? `${t.tokens} tkn` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 2 }}>
                    <button onClick={onContinue} style={{ ...secondaryBtn({ fontSize: 11, padding: '7px 14px', borderRadius: 10 }) }}>View upload history →</button>
                  </div>
                </>
              )}
            </div>

            {/* Recommended Next Steps */}
            <div style={{ ...CARD, padding: '20px 22px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.grad }} />
              <CardHeader icon="✨" title="Recommended Next Steps" sub="Keep building your insights." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  {
                    icon: '📥', title: 'Upload More Data',
                    sub: 'Add more sessions, tips, and screenshots',
                    grad: `linear-gradient(135deg, rgba(22,244,255,0.12), rgba(85,184,255,0.08))`,
                    border: `rgba(22,244,255,0.25)`,
                    glow: C.cyan,
                    action: onAddHistory,
                  },
                  {
                    icon: '💎', title: 'Add Private Tips',
                    sub: 'Include private tips for deeper insights',
                    grad: `linear-gradient(135deg, rgba(124,92,255,0.14), rgba(85,184,255,0.06))`,
                    border: `rgba(124,92,255,0.25)`,
                    glow: C.purple,
                    action: onAddHistory,
                  },
                  {
                    icon: '🔴', title: 'Open Live Mode',
                    sub: 'Start tracking live earnings in real time',
                    grad: `linear-gradient(135deg, rgba(255,43,174,0.12), rgba(124,92,255,0.08))`,
                    border: `rgba(255,43,174,0.25)`,
                    glow: C.pink,
                    action: onLiveMode,
                  },
                ].map(({ icon, title, sub, grad, border, glow, action }) => (
                  <button key={title} onClick={action} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 14, border: `1px solid ${border}`,
                    background: grad, cursor: 'pointer', textAlign: 'left',
                    boxShadow: `0 0 20px ${glow}15`,
                    transition: 'transform 0.12s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${glow}22`, border: `1px solid ${glow}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 2 }}>{title}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>
                    </div>
                    <span style={{ color: C.muted, fontSize: 16, flexShrink: 0 }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── UNLOCK NEXT STRIP ─────────────────────── */}
          <div style={{ ...CARD, padding: '20px 24px' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.grad }} />
            <CardHeader icon="🔒" title="Unlock next" sub="More powerful insights become available as your data grows." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { icon: '⏰', title: 'Peak Windows',        desc: 'Discover your highest earning windows.' },
                { icon: '📈', title: 'Session Trends',      desc: 'See how your sessions trend over time.' },
                { icon: '🔄', title: 'Re-engagement List',  desc: 'Find fans most likely to come back.' },
                { icon: '🗓️', title: 'Weekly Stream Plan',   desc: 'Get a personalized plan to maximize earnings.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ ...CARD, padding: '16px', background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,43,174,0.15)` }}>
                  <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 12, opacity: 0.4 }}>🔒</div>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg,${C.purple}40,${C.pink}30)`, border: `1px solid rgba(255,43,174,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.55, marginBottom: 10 }}>{desc}</div>
                  <div style={{ fontSize: 10, color: C.pink, fontWeight: 600 }}>Need more data</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── FOOTER STRIP ──────────────────────────── */}
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: C.muted }}>
            ⓘ This is a preview. Add more data for deeper trends.
            <button onClick={onAddHistory} style={{ marginLeft: 10, color: C.cyan, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Upload now →</button>
          </div>

        </div>
      </div>
    </div>
  )
}
