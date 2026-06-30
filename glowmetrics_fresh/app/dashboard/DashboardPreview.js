'use client'
// ============================================================
// CAMCASH — POST-ONBOARDING DASHBOARD PREVIEW
// DashboardPreview.js — DROP-IN VERSION FOR THE REPO
//
// Styled to match Dashboard.js exactly (same C palette, same
// glassCard treatment, same sidebar conventions) and the approved
// DemoDashboard.jsx visual direction — not a separate design system.
//
// Exports (unchanged contract — Dashboard.js depends on these exact
// names and exact return values):
//   getDashboardReadiness()  — 4-state readiness system
//   getPlanAccess()          — free/pro plan logic
//   getFeatureLockState()    — per-feature lock type (data vs plan)
//   getDashboardStage()      — "empty" | "preview" | "ready"
//   EmptyDashboard           — stage "empty"
//   DashboardPreview         — stage "preview"
//   LockedInsightCard        — reusable locked-insight card
//   canShowBestHours / canShowWhales / canShowPlatformComp /
//   canShowSessionPerf / canShowRetention / canShowHourlyRate
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── BRAND TOKENS — identical to Dashboard.js's C / glassCard ───
const C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

const glassCard = {
  background: "rgba(15,20,32,0.75)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  boxShadow: "0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(236,72,153,0.08)",
}

const pageBg = `radial-gradient(circle at 20% 30%, rgba(59,130,246,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(236,72,153,0.25), transparent 40%), radial-gradient(circle at 50% 50%, rgba(168,85,247,0.15), transparent 60%), #05070f`

// ── SAFE FORMATTERS ───────────────────────────────────────────
const safeNum = (v, fb = 0) => { const n = parseFloat(v); return isNaN(n) || !isFinite(n) ? fb : n }
const fmt$ = v => `$${safeNum(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtTime = d => { if (!d) return '—'; return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }

// ── SHARED UI ATOMS — same language as Dashboard.js's cards ────
const Pill = ({ label, color, outline }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 100,
    fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
    background: outline ? "transparent" : `${color}20`,
    border: `1px solid ${color}${outline ? "70" : "40"}`,
    color,
  }}>{label}</span>
)

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>{children}</div>
)

const CardHeader = ({ icon, title, sub, badge }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: sub ? 4 : 0 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.white, flex: 1 }}>{title}</div>
      {badge}
    </div>
    {sub && <div style={{ fontSize: 11, color: C.muted, marginLeft: 42, lineHeight: 1.5 }}>{sub}</div>}
  </div>
)

const StatCard = ({ icon, label, value, sub, accent, badge, badgeColor }) => (
  <div style={{ ...glassCard, borderRadius: 16, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${accent}80,${accent}20)` }} />
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
      <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 18 }}>{icon}</span>
    </div>
    <div style={{ fontSize: 22, fontWeight: 900, color: accent, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    {badge && <div style={{ marginTop: 7, display: "inline-block", padding: "2px 8px", borderRadius: 6, background: `${badgeColor}20`, border: `1px solid ${badgeColor}40`, fontSize: 9, fontWeight: 700, color: badgeColor }}>{badge}</div>}
  </div>
)

const primaryBtn = (extra = {}) => ({
  padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer",
  background: "linear-gradient(135deg, #22D3EE, #EC4899)", color: "#fff", fontWeight: 700, fontSize: 13,
  boxShadow: "0 0 20px rgba(34,211,238,0.3), 0 0 30px rgba(236,72,153,0.2)",
  ...extra,
})

const secondaryBtn = (extra = {}) => ({
  padding: "9px 18px", borderRadius: 10, border: `1px solid ${C.border2}`,
  background: "rgba(255,255,255,0.04)", color: C.text, fontWeight: 600, fontSize: 13, cursor: "pointer",
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

// ── DASHBOARD STAGE ───────────────────────────────────────────
// WHY THIS EXISTS: brand-new users with 0 imported tips have nothing for
// the real analytics engine to compute, so the full dashboard would render
// broken zeros and empty charts. Users with *some* data but not enough for
// reliable patterns (per-platform hourly averages, fan tiering, session
// trends) would see misleading "best time to stream" claims built on 1-2
// data points. getDashboardStage() collapses the richer 4-state
// getDashboardReadiness() signal into the 3 buckets page.js branches on:
//   "empty"   -> render <EmptyDashboard/>      (zero usable data)
//   "preview" -> render <DashboardPreview/>     (some data, not enough yet)
//   "ready"   -> render the real full dashboard (reliable analytics)
// Keep this 3-value contract stable — page.js's forceFull override
// (sessionStorage 'camcash_force_full_dash') and the tab system assume
// exactly these three return values.
export function getDashboardStage({ tipCount = 0, sessionCount = 0, totalEarnings = 0 }) {
  if (tipCount === 0) return 'empty'
  const r = getDashboardReadiness({ totalTips: tipCount, totalSessions: sessionCount, totalEarnings })
  if (r === 'full_data') return 'ready'
  return 'preview'
}

// ── SUB-STAGE (internal to DashboardPreview only) ─────────────
// Not exported / not part of the page.js contract. Only changes copy and
// which optional cards render inside DashboardPreview between "tiny"
// (barely any signal yet) and "starter" (enough for early directional
// insights, still labeled preliminary everywhere).
function getPreviewSubStage({ totalTips = 0, totalSessions = 0, totalEarnings = 0 }) {
  const isTiny = totalSessions < 3 || totalTips < 25 || totalEarnings < 25
  return isTiny ? 'tiny' : 'starter'
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
  const isData = lockType === 'needs_data'
  const accent = isData ? C.cyan : C.pink
  return (
    <div style={{ ...glassCard, borderRadius: 14, padding: '16px 18px', background: `${accent}08`, border: `1px solid ${accent}25` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
          {isData ? '📊' : '✦'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{title}</div>
            <Pill label={isData ? 'Needs more data' : 'Pro'} color={accent} />
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
// PREVIEW SIDEBAR — same conventions as Dashboard.js's Sidebar
// ============================================================
// WHY EmptyDashboard/DashboardPreview render their own sidebar: page.js
// returns these two components BEFORE it reaches the real <Sidebar/> +
// main-content JSX (see the early `if (dashboardStage === 'empty') return
// <EmptyDashboard .../>` in page.js). Without an internal sidebar here,
// low-data users would lose the app shell entirely. Nav items route
// through the same onAddHistory / onLiveMode / onContinue handlers
// page.js already passes in.
const NAV_ITEMS = [
  { id: 'overview', icon: '⚡', label: 'Overview', action: 'continue' },
  { id: 'platforms', icon: '🎯', label: 'Platforms', action: 'continue' },
  { id: 'whales', icon: '👑', label: 'Top Fans', action: 'continue' },
  { id: 'sessions', icon: '🎬', label: 'Sessions', action: 'continue' },
  { id: 'live', icon: '🔴', label: 'Live Mode', action: 'live' },
  { id: 'upload', icon: '📥', label: 'Upload Data', action: 'import' },
]

function PreviewSidebar({ onAddHistory, onLiveMode, onContinue }) {
  const [active, setActive] = useState('overview')
  const handle = (item) => {
    setActive(item.id)
    if (item.action === 'live') return onLiveMode?.()
    if (item.action === 'import') return onAddHistory?.()
    onContinue?.()
  }
  return (
    <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#0a0d1a', borderRight: '1px solid rgba(255,255,255,0.06)', minHeight: '100vh' }}>
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#22D3EE,#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff' }}>$</div>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.white }}>Cam<span style={{ background: 'linear-gradient(90deg,#22D3EE,#EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cash</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, background: 'linear-gradient(135deg,rgba(124,92,255,0.13),rgba(34,211,238,0.07))', border: '1px solid rgba(124,92,255,0.25)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.indigo, flexShrink: 0 }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: '#A78BFA' }}>BUILDING YOUR DASHBOARD</div>
        </div>
      </div>
      <div style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id
          return (
            <button key={item.id} onClick={() => handle(item)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9,
              border: isActive ? '1px solid rgba(34,211,238,0.3)' : '1px solid transparent', cursor: 'pointer', textAlign: 'left',
              background: isActive ? 'linear-gradient(135deg,rgba(34,211,238,0.14),rgba(236,72,153,0.08))' : 'transparent',
              color: isActive ? C.white : C.text, fontSize: 13, fontWeight: isActive ? 700 : 500,
            }}>
              <span style={{ fontSize: 15, opacity: isActive ? 1 : 0.65 }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </div>
      <div style={{ padding: '10px 10px 18px' }}>
        <button onClick={onContinue} style={{ ...secondaryBtn({ width: '100%', justifyContent: 'center', fontSize: 11 }) }}>Continue to Dashboard →</button>
      </div>
    </div>
  )
}

// ============================================================
// STAGE 0 — EMPTY DASHBOARD
// ============================================================
// WHY THIS EXISTS: a user with 0 imported tips has nothing for analytics
// to compute. Rendering the real dashboard here would mean broken zeros
// and empty charts. This shows 3 concrete setup paths plus a locked
// teaser row so the product still feels alive, not blank.
export function EmptyDashboard({ onImport, onLiveMode }) {
  const unlocks = [
    { icon: '⏰', label: 'Best earning windows' },
    { icon: '👑', label: 'Top fan leaderboard' },
    { icon: '🎯', label: 'Platform breakdown' },
    { icon: '🎬', label: 'Session trends' },
    { icon: '💌', label: 'Re-engagement messages' },
  ]
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: "'Inter', sans-serif" }}>
      <PreviewSidebar onAddHistory={onImport} onLiveMode={onLiveMode} onContinue={onImport} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: pageBg }}>
        <div style={{ maxWidth: 620, width: '100%' }}>
          <div style={{ ...glassCard, borderRadius: 18, padding: '40px 36px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#22D3EE,#EC4899)' }} />
            <div style={{ width: 76, height: 76, borderRadius: 22, background: 'linear-gradient(135deg,#22D3EE,#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 22px', boxShadow: '0 0 40px rgba(34,211,238,0.3)' }}>💸</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.white, marginBottom: 8 }}>Start Your CamCash Dashboard</div>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.65, maxWidth: 440, margin: '0 auto 4px' }}>Your dashboard is ready — it just needs your first tip history to start finding patterns.</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 26 }}>Upload a CSV, paste your tip history, or open Live Mode to begin tracking your earnings.</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 22, textAlign: 'left' }}>
              {[
                { icon: '📥', title: 'Upload Tip History', desc: 'Import past tips so CamCash can find your best hours, fans, and platforms.', cta: 'Upload Data', action: onImport, accent: C.cyan },
                { icon: '📋', title: 'Paste / Import Manually', desc: 'Copy your tip history from your platform and bring it into CamCash.', cta: 'Start Import', action: onImport, accent: C.indigo },
                { icon: '🔴', title: 'Use Live Mode Now', desc: 'Start tracking tips live while your historical dashboard builds.', cta: 'Open Live Mode', action: onLiveMode, accent: C.pink },
              ].map(({ icon, title, desc, cta, action, accent }) => (
                <div key={title} style={{ padding: '15px 13px', borderRadius: 14, background: `${accent}0c`, border: `1px solid ${accent}30`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}22`, border: `1px solid ${accent}45`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.white }}>{title}</div>
                  <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.5, flex: 1 }}>{desc}</div>
                  <button onClick={action} style={{ ...secondaryBtn({ fontSize: 11, padding: '7px 10px', width: '100%', textAlign: 'center', justifyContent: 'center', borderColor: `${accent}45`, color: accent, background: `${accent}14` }) }}>{cta} →</button>
                </div>
              ))}
            </div>

            <div style={{ padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: C.muted, marginBottom: 20 }}>
              ✓ Nothing is wrong — your dashboard is waiting for data.
            </div>

            <div style={{ textAlign: 'left' }}>
              <SectionLabel>What unlocks after upload</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                {unlocks.map(({ icon, label }) => (
                  <div key={label} style={{ padding: '11px 7px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(236,72,153,0.14)', textAlign: 'center' }}>
                    <div style={{ fontSize: 15, marginBottom: 5 }}>{icon}</div>
                    <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.35 }}>{label}</div>
                    <div style={{ fontSize: 8.5, color: C.pink, marginTop: 4 }}>🔒</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, marginTop: 14 }}>Supports Chaturbate, BongaCams, MyFreeCams, Stripchat & CamSoda</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// DASHBOARD PREVIEW — main export, stage "preview" (Stage 1 + 2)
// ============================================================
export function DashboardPreview({ tips = [], analytics, userPlan = 'free', onAddHistory, onContinue, onUpgrade, onLiveMode }) {
  const router = useRouter()

  // ── Derived values — all computed from real props, nothing fabricated ──
  const totalTips = tips.length
  const totalUSD = safeNum(tips.reduce((s, t) => s + safeNum(t.usd), 0))
  const totalTokens = tips.reduce((s, t) => s + (parseInt(t.tokens) || 0), 0)
  const hasUSD = totalUSD > 0
  const isEstimated = !hasUSD && totalTokens > 0

  const platforms = [...new Set(tips.map(t => t.platform).filter(p => p && p !== 'Unknown'))]

  const fanTotals = {}, fanCounts = {}
  let maxTip = 0
  tips.forEach(t => {
    const u = (t.username || 'anonymous').toLowerCase()
    fanTotals[u] = safeNum(fanTotals[u]) + safeNum(t.usd)
    fanCounts[u] = (fanCounts[u] || 0) + 1
    if (safeNum(t.usd) > maxTip) maxTip = safeNum(t.usd)
  })
  const totalFans = Object.keys(fanTotals).length

  const totalSessions = analytics?.meaningfulSessionCount || 0
  const totalStreamMinutes = analytics?.totalStreamMinutes || 0
  const totalEarnings = totalUSD

  const subStage = getPreviewSubStage({ totalTips, totalSessions, totalEarnings })
  const isTiny = subStage === 'tiny'

  const recentTips = [...tips].sort((a, b) => new Date(b.date_time || b.dateRaw) - new Date(a.date_time || a.dateRaw)).slice(0, 6)
  const topFans = Object.entries(fanTotals).sort((a, b) => b[1] - a[1]).slice(0, isTiny ? 3 : 5)

  // Best stream day (real, from tips)
  const dayTotals = {}
  tips.forEach(t => {
    const d = t.date_time || t.dateRaw
    if (!d) return
    const day = new Date(d).toLocaleDateString('en-US', { weekday: 'long' })
    dayTotals[day] = safeNum(dayTotals[day]) + safeNum(t.usd)
  })
  const bestDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0]

  // Platform earnings (real)
  const platEarnings = {}
  tips.forEach(t => {
    const p = t.platform && t.platform !== 'Unknown' ? t.platform : null
    if (!p) return
    platEarnings[p] = safeNum(platEarnings[p]) + safeNum(t.usd)
  })
  const platTotal = Object.values(platEarnings).reduce((s, v) => s + v, 0)
  const topPlatform = Object.entries(platEarnings).sort((a, b) => b[1] - a[1])[0]
  const PLAT_COLOR = { Chaturbate: C.cyan, BongaCams: C.pink, MyFreeCams: C.indigo, Stripchat: C.gold, CamSoda: C.green }

  // Best hour so far (real, from analytics.bestHour if present)
  const bestHourLabel = (() => {
    const h = analytics?.bestHour?.hour != null ? parseInt(analytics.bestHour.hour) : null
    if (h == null || isNaN(h)) return null
    const offset = new Date().getTimezoneOffset() / -60
    const lh = Math.round(((h + offset) % 24 + 24) % 24)
    return lh === 0 ? '12 AM' : lh < 12 ? `${lh} AM` : lh === 12 ? '12 PM' : `${lh - 12} PM`
  })()

  // Data confidence — real calculation, never fabricated
  const confScore = Math.min(Math.round(
    Math.min(totalTips / 100, 1) * 35 + Math.min(totalSessions / 8, 1) * 30 +
    Math.min(totalFans / 20, 1) * 20 + Math.min(totalEarnings / 50, 1) * 15
  ), 100)
  const insightStrength = Math.max(25, Math.min(60, confScore))

  // Starter trend — last up-to-8 real sessions, directional only
  const trendSessions = [...(analytics?.meaningfulSessions || analytics?.sessions || [])]
    .filter(s => s?.startTime)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .slice(-8)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: "'Inter', sans-serif" }}>
      <PreviewSidebar onAddHistory={onAddHistory} onLiveMode={onLiveMode} onContinue={onContinue} />

      <div style={{ flex: 1, minHeight: '100vh', background: pageBg, padding: 28 }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>

          {/* HERO */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: C.white, margin: 0 }}>{isTiny ? 'CamCash found your first signals' : 'Your CamCash insights are building'}</h1>
                <Pill label={isTiny ? 'Starter view' : 'Early analytics'} color={C.cyan} outline />
              </div>
              <p style={{ fontSize: 13, color: C.text, margin: 0, maxWidth: 560, lineHeight: 1.6 }}>
                {isTiny
                  ? 'Your dashboard is starting to build. Add more sessions to unlock stronger patterns and more accurate insights.'
                  : "We've found early patterns already. Add more history to sharpen your timing, fan insights, and earning strategy."}
              </p>
            </div>
            <button onClick={onContinue} style={{ ...secondaryBtn({ fontSize: 11 }) }}>↻ Refresh</button>
          </div>

          {/* TOP METRICS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
            <StatCard
              icon="💵"
              label={isTiny ? 'Tips Imported' : 'Earnings Imported'}
              value={isTiny ? totalTips : (hasUSD ? fmt$(totalUSD) : (isEstimated ? `~${fmt$(totalTokens * 0.05)}` : '—'))}
              sub={isTiny ? `${fmt$(totalUSD)} earned so far` : `${totalTips} tips imported`}
              accent={C.cyan}
            />
            <StatCard icon="🎬" label="Sessions Detected" value={totalSessions || '—'} accent={C.indigo} />
            <StatCard icon="⭐" label="Fans Found" value={totalFans || '—'} sub={totalFans ? `${totalFans} unique tippers` : null} accent={C.gold} />
            <StatCard icon="🛡️" label="Data Confidence" value={`${confScore}%`} sub={isTiny ? 'Low — needs more sessions' : confScore < 60 ? 'Medium-low' : 'Building'} accent={C.pink} />
            <StatCard
              icon="⏱"
              label={isTiny ? 'Best Early $/Hr' : 'Best Early Window'}
              value={canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes }) && analytics?.avgPerHour ? fmt$(analytics.avgPerHour) : 'Needs more'}
              sub="Preliminary signal"
              accent={C.green}
            />
          </div>

          {/* INSIGHT STRENGTH — starter only */}
          {!isTiny && (
            <div style={{ ...glassCard, borderRadius: 16, padding: '18px 20px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#22D3EE,#7C5CFF,#EC4899)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>Insight strength</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Improves as you upload more sessions.</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.cyan }}>{insightStrength}%</div>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${insightStrength}%`, background: 'linear-gradient(90deg,#22D3EE,#7C5CFF,#EC4899)', borderRadius: 99 }} />
              </div>
            </div>
          )}

          {/* MIDDLE ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>

            {/* Snapshot */}
            <div style={{ ...glassCard, borderRadius: 16, padding: '18px 20px' }}>
              <CardHeader icon="🏆" title={isTiny ? 'Early Snapshot' : "What's Ready Now"} sub={isTiny ? "Safe starter metrics from what you've imported." : 'Early highlights from your data so far.'} />
              {[
                { label: 'Best stream day', value: bestDay ? `${bestDay[0]} · ${fmt$(bestDay[1])}` : null },
                { label: isTiny ? 'Most active hour so far' : 'Best hour so far', value: bestHourLabel },
                { label: 'Top platform so far', value: topPlatform && platTotal > 0 ? `${topPlatform[0]} · ${Math.round((topPlatform[1] / platTotal) * 100)}%` : null },
                { label: 'Top fan so far', value: topFans[0] ? `${topFans[0][0]} · ${fmt$(topFans[0][1])}` : null },
                isTiny
                  ? { label: 'Highest tip so far', value: maxTip > 0 ? fmt$(maxTip) : null }
                  : { label: 'Avg session value', value: totalSessions >= 3 && totalUSD > 0 ? `${fmt$(totalUSD / totalSessions)} avg` : null },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: value ? C.white : C.muted, textAlign: 'right', maxWidth: 160 }}>{value || 'Needs more data'}</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: C.muted, marginTop: 10 }}>ⓘ {isTiny ? 'Starter insight' : 'Early signal'} — accuracy improves with more data.</div>
            </div>

            {/* Platform preview */}
            <div style={{ ...glassCard, borderRadius: 16, padding: '18px 20px' }}>
              <CardHeader icon="📊" title="Platform Preview" badge={<Pill label="Preliminary" color={C.pink} outline />} sub="Early earnings comparison across your connected platforms." />
              {platforms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>No platform data yet</div>
                  <button onClick={onAddHistory} style={primaryBtn({ fontSize: 12, padding: '8px 16px' })}>Import Tips →</button>
                </div>
              ) : Object.entries(platEarnings).sort((a, b) => b[1] - a[1]).map(([p, earned]) => {
                const pct = platTotal ? Math.round((earned / platTotal) * 100) : 0
                const col = PLAT_COLOR[p] || C.blue
                return (
                  <div key={p} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{p}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{fmt$(earned)} · {pct}%</span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 99 }} />
                    </div>
                  </div>
                )
              })}
              {platforms.length > 0 && <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>ⓘ Percentages may shift as more data is imported.</div>}
            </div>

            {/* Top fans */}
            <div style={{ ...glassCard, borderRadius: 16, padding: '18px 20px' }}>
              <CardHeader icon="👥" title={isTiny ? 'Fans Found' : 'Top Early Fans'} sub="Based on current imports." />
              {topFans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: C.muted }}>Fan data appears after import</div>
              ) : (
                <>
                  {topFans.map(([username, usd], i) => (
                    <div key={username} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < topFans.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#7C5CFF,#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{username.slice(0, 2).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{username}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>×{fanCounts[username]} tips</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.gold, flexShrink: 0 }}>{fmt$(usd)}</div>
                    </div>
                  ))}
                  <button onClick={onContinue} style={{ ...secondaryBtn({ width: '100%', marginTop: 10, fontSize: 11, padding: '7px', justifyContent: 'center' }) }}>View all fans →</button>
                </>
              )}
            </div>
          </div>

          {/* STARTER TREND — starter only, real session totals, directional only */}
          {!isTiny && trendSessions.length >= 3 && (
            <div style={{ ...glassCard, borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
              <CardHeader icon="📈" title="Starter Trend" badge={<Pill label="Early directional trend only" color={C.indigo} outline />} />
              {(() => {
                const maxVal = Math.max(...trendSessions.map(s => safeNum(s.totalUSD)), 1)
                return (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
                    {trendSessions.map((s, i) => {
                      const h = Math.max(6, Math.round((safeNum(s.totalUSD) / maxVal) * 70))
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: '100%', height: h, borderRadius: '4px 4px 0 0', background: 'linear-gradient(180deg,#22D3EE,#7C5CFF,#EC4899)', opacity: 0.85 }} />
                          <div style={{ fontSize: 8, color: C.muted }}>{new Date(s.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
              <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>More data improves accuracy.</div>
            </div>
          )}

          {/* BUILD FASTER CHECKLIST — tiny only */}
          {isTiny && (
            <div style={{ ...glassCard, borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
              <CardHeader icon="🚀" title="Build Your Dashboard Faster" sub="A few quick steps sharpen every insight above." />
              {[
                { label: 'Upload at least 3 sessions', done: totalSessions >= 3, action: onAddHistory },
                { label: 'Add another platform', done: platforms.length >= 2, action: onAddHistory },
                { label: 'Include private tips later', done: false, action: onAddHistory },
                { label: 'Open Live Mode', done: false, action: onLiveMode },
                { label: 'Continue to full dashboard anyway', done: false, action: onContinue },
              ].map(({ label, done, action }) => (
                <button key={label} onClick={action} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, width: '100%', marginBottom: 6,
                  background: done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : C.border}`, cursor: 'pointer', textAlign: 'left',
                }}>
                  <span style={{ color: done ? C.green : C.muted }}>{done ? '✓' : '○'}</span>
                  <span style={{ fontSize: 12, color: done ? C.green : C.text, flex: 1 }}>{label}</span>
                  {!done && <span style={{ color: C.cyan, fontSize: 11 }}>→</span>}
                </button>
              ))}
            </div>
          )}

          {/* RECENT UPLOAD ACTIVITY */}
          <div style={{ ...glassCard, borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
            <CardHeader icon="📥" title="Recent Upload Activity" sub="Your most recent data imports." />
            {recentTips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '18px 0' }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>No imports yet</div>
                <button onClick={onAddHistory} style={primaryBtn({ fontSize: 12, padding: '8px 16px' })}>Upload Tips →</button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Fan', 'Platform', 'When', 'Amount'].map(h => (
                        <th key={h} style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', padding: '0 0 8px', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentTips.map((t, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12, color: C.white, fontWeight: 600, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{t.username || 'anonymous'}</td>
                        <td style={{ fontSize: 11, color: C.muted, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{t.platform || '—'}</td>
                        <td style={{ fontSize: 11, color: C.muted, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}>{fmtTime(t.date_time || t.dateRaw)}</td>
                        <td style={{ fontSize: 12, fontWeight: 700, color: C.gold, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right' }}>
                          {safeNum(t.usd) > 0 ? fmt$(t.usd) : t.tokens ? `${t.tokens} tkn` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RECOMMENDED NEXT STEPS */}
          <div style={{ ...glassCard, borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
            <CardHeader icon="✨" title="Recommended Next Steps" />
            <div style={{ display: 'grid', gridTemplateColumns: isTiny ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
              {[
                { icon: '📥', title: isTiny ? 'Upload More Data' : 'Upload More Sessions', accent: C.cyan, action: onAddHistory },
                ...(!isTiny ? [{ icon: '🌐', title: 'Import Another Platform', accent: C.gold, action: onAddHistory }] : []),
                { icon: '💎', title: 'Add Private Tips', accent: C.indigo, action: onAddHistory },
                { icon: '🔴', title: 'Open Live Mode', accent: C.pink, action: onLiveMode },
              ].map(({ icon, title, accent, action }) => (
                <button key={title} onClick={action} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12,
                  background: `${accent}10`, border: `1px solid ${accent}30`, cursor: 'pointer', textAlign: 'left',
                }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* UNLOCK NEXT */}
          <div style={{ ...glassCard, borderRadius: 16, padding: '18px 20px', marginBottom: 16 }}>
            <CardHeader icon="🔒" title={isTiny ? 'Unlock next' : 'Coming alive with more data'} sub="More powerful insights become available as your data grows." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {(isTiny
                ? [{ icon: '⏰', title: 'Peak Earning Windows' }, { icon: '📈', title: 'Session Trends' }, { icon: '🔄', title: 'Re-engagement List' }, { icon: '🗓️', title: 'Weekly Streaming Plan' }]
                : [{ icon: '⏰', title: 'Peak Windows' }, { icon: '💎', title: 'Top Spender Recovery' }, { icon: '🗓️', title: 'Weekly Plan' }, { icon: '🎬', title: 'Full Session Breakdown' }]
              ).map(({ icon, title }) => (
                <div key={title} style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(236,72,153,0.15)' }}>
                  <div style={{ fontSize: 18, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 10, color: C.pink, fontWeight: 600 }}>Needs more sessions</div>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <div style={{ textAlign: 'center', fontSize: 11, color: C.muted }}>
            ⓘ This is a preview. Add more data for deeper trends.
            <button onClick={onAddHistory} style={{ marginLeft: 10, color: C.cyan, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Upload now →</button>
            <span style={{ margin: '0 8px' }}>·</span>
            <button onClick={onContinue} style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>Continue to Dashboard Anyway</button>
          </div>

        </div>
      </div>
    </div>
  )
}
