'use client'
// ============================================================
// CAMCASH — POST-ONBOARDING DASHBOARD
// DashboardPreview.js
//
// Exports:
//   getDashboardReadiness()  — compat wrapper over the canonical intelligence ladder
//   getPlanAccess()          — free/pro plan logic
//   getFeatureLockState()    — compat wrapper: plan gate + canonical insight floor
//   getDashboardStage()      — legacy compat (empty/preview/ready)
//   EmptyDashboard           — no_data state
//   DashboardPreview         — very_low/partial/full_data state
//   LockedInsightCard        — use inside full dashboard for unready cards
//
// Plan source of truth: profiles.plan ('free' | 'pro')
// ============================================================

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isProPlan } from '../../lib/plan'
import { FREE_MAX_PLATFORMS } from '../../lib/planLimits'
import { GATE_MAP, gateOpen, lockMessage, resolveIntelligence, resolveReadiness } from '../../lib/intelligence/locks'

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

export function getDashboardReadiness({ totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0, dateRangeDays = 0, streamDays = 0, intelligence = null, analytics = null }) {
  // COMPAT WRAPPER (2C-1). The old 5-branch counter ladder is retired; the word
  // now comes from where the canonical insights sit on the intelligence ladder.
  // dateRangeDays / streamDays are accepted for signature compatibility and are
  // no longer used — span and coverage are already inside the canonical states.
  return resolveReadiness(resolveIntelligence({ intelligence, analytics, totalTips, totalSessions, totalFans }))
}

// Legacy compat — page.js now uses getDashboardReadiness directly; real dashboard always renders
export function getDashboardStage({ tipCount = 0, sessionCount = 0, totalEarnings = 0 }) {
  return 'ready'
}

export function getPlanAccess(userPlan = 'free', trackedPlatformCount = 0, planExpiresAt = null) {
  const isPro = isProPlan({ plan: userPlan, plan_expires_at: planExpiresAt })
  return {
    isPro, isFree: !isPro,
    canTrackMultiplePlatforms: isPro,
    canComparePlatforms: isPro,
    canUseCrossPlatformInsights: isPro,
    // Matches what the database enforces (enforce_free_tier_platform_limit):
    // free tracks up to FREE_MAX_PLATFORMS, not one.
    freePlatformLimitReached: !isPro && trackedPlatformCount >= FREE_MAX_PLATFORMS,
  }
}

// ── PLAN-ONLY GATES ───────────────────────────────────────────────────────────
// The only rules below that are NOT canonical-intelligence gates. They are
// commercial (plan) or a one-off fact (has this creator ever run Live Mode),
// never analytics thresholds.
function planLock(key, { isPro, platformCount }) {
  if (key === 'multiPlatformTracking' && !isPro && platformCount >= FREE_MAX_PLATFORMS) {
    return { locked: true, lockType: 'requires_pro', message: `Free tracks up to ${FREE_MAX_PLATFORMS} platforms. Upgrade to Pro to add more.` }
  }
  if ((key === 'platformComparison' || key === 'platformROI' || key === 'crossPlatformBestTimes') && !isPro) {
    return { locked: true, lockType: 'requires_pro', message: 'Upgrade to Pro to compare earnings across platforms.' }
  }
  return null
}

function liveScoreLock(liveModeSessions) {
  return liveModeSessions < 1
    ? { locked: true, lockType: 'needs_data', message: 'Unlocks after your first Live Mode stream.' }
    : { locked: false, lockType: null, message: null }
}

/**
 * COMPAT WRAPPER (2C-1). Signature unchanged. The 11 counter rules that used to
 * live here are gone; the data half of every answer is now a floor on the
 * canonical ladder (see GATE_MAP in lib/intelligence/locks.js).
 */
export function getFeatureLockState({ feature, userPlan = 'free', planExpiresAt = null, totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0, totalStreamMinutes = 0, importedPlatforms = [], liveModeSessions = 0, intelligence = null, analytics = null }) {
  const isPro = isProPlan({ plan: userPlan, plan_expires_at: planExpiresAt })
  const platformCount = importedPlatforms?.length || 0
  if (feature === 'liveScore') return liveScoreLock(liveModeSessions)
  const pro = planLock(feature, { isPro, platformCount })
  if (pro) return pro
  if (feature === 'multiPlatformTracking') return { locked: false, lockType: null, message: null }
  if (!GATE_MAP[feature]) return { locked: false, lockType: null, message: null }
  const intel = resolveIntelligence({ intelligence, analytics, totalTips, totalSessions, totalFans, totalStreamMinutes })
  if (gateOpen(intel, feature)) return { locked: false, lockType: null, message: null }
  return { locked: true, lockType: 'needs_data', message: lockMessage(intel, feature) }
}

// Readiness checks for full dashboard use.
// COMPAT WRAPPERS (2C-1) — each is now one floor on the canonical ladder.
// Callers may pass `intelligence` (preferred) or `analytics`; the counter
// arguments are still accepted so no call site had to change.
const canShow = (key) => ({ intelligence = null, analytics = null, tipCount = 0, sessionCount = 0, uniqueFanCount = 0, totalStreamMinutes = 0, platformCount = 0, dateRangeDays = 0, totalEarnings = 0 } = {}) =>
  gateOpen(resolveIntelligence({
    intelligence, analytics,
    totalTips: tipCount, totalSessions: sessionCount,
    totalFans: uniqueFanCount, totalStreamMinutes,
  }), key)

export const canShowBestHours    = canShow('bestStreamingTimes')
export const canShowWhales       = canShow('whales')
export const canShowPlatformComp = canShow('platformComparison')
export const canShowSessionPerf  = canShow('sessionPerformance')
export const canShowRetention    = canShow('retention')
export const canShowHourlyRate   = canShow('avgHourlyRate')

// ── MODULE LOCK STATE ─────────────────────────────────────────────────────────
/**
 * COMPAT WRAPPER (2C-1). Signature unchanged. The 12 counter rules are gone.
 * Money Map and Stream Planner remain data-gated only — never paywalled.
 */
export function getModuleLockState({ module, totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0, totalStreamMinutes = 0, importedPlatformCount = 0, isPro = false, liveModeSessions = 0, intelligence = null, analytics = null }) {
  if (module === 'liveScore') return liveScoreLock(liveModeSessions)
  const pro = planLock(module, { isPro, platformCount: importedPlatformCount })
  if (pro) return pro
  if (module === 'multiPlatformTracking') return { locked: false, lockType: null, message: null }
  if (!GATE_MAP[module]) return { locked: false, lockType: null, message: null }
  const intel = resolveIntelligence({ intelligence, analytics, totalTips, totalSessions, totalFans, totalStreamMinutes })
  if (gateOpen(intel, module)) return { locked: false, lockType: null, message: null }
  return { locked: true, lockType: 'needs_data', message: lockMessage(intel, module) }
}

// ── UNLOCK PROGRESS ───────────────────────────────────────────────────────────
/**
 * COMPAT WRAPPER (2C-1). The two invented target tiers (25/3/5/$10 and
 * 100/8/20/$50) are retired. Progress is now the canonical calibration figure
 * plus the canonical "what would help most next" list — the same numbers the
 * Creator Report's CalibrationCard shows, so the two can no longer disagree.
 *
 * The legacy `starter`/`full` keys are kept so any caller outside this file
 * keeps working, but each slot now reports a canonical insight's own
 * observations against that insight's own requirement.
 */
const PROGRESS_SLOTS = {
  tips:     { insight: 'money_map',       label: 'Tips' },
  sessions: { insight: 'session_history', label: 'Sessions' },
  fans:     { insight: 'top_supporters',  label: 'Fans' },
  windows:  { insight: 'peak_window',     label: 'Windows' },
}

export function getUnlockProgress({ totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0, dateRangeDays = 0, streamDays = 0, intelligence = null, analytics = null }) {
  const intel = resolveIntelligence({ intelligence, analytics, totalTips, totalSessions, totalFans })
  const slot = (key) => {
    const def = PROGRESS_SLOTS[key]
    const e = intel?.insights?.[def.insight] || {}
    const current = e.observations || 0
    const target = e.required || null
    const pct = target ? Math.min(100, Math.round((current / target) * 100)) : (e.claimable ? 100 : 0)
    return { current, target, pct, label: def.label, state: e.state }
  }
  const slots = Object.fromEntries(Object.keys(PROGRESS_SLOTS).map(k => [k, slot(k)]))
  const cal = intel?.calibration || {}
  return {
    // canonical, preferred
    pct: cal.pct ?? 0,
    establishedCount: cal.establishedCount ?? 0,
    buildingCount: cal.buildingCount ?? 0,
    totalCount: cal.totalCount ?? 0,
    nextBestEvidence: cal.nextBestEvidence || [],
    evidence: cal.evidence || {},
    slots,
    // legacy shape
    starter: slots,
    full: slots,
  }
}

// ── DASHBOARD PROGRESS CARD ───────────────────────────────────────────────────
// Shown inside the real dashboard when data is still warming up.
// Never shown when readiness === 'ready'.
export function DashboardProgressCard({ totalTips = 0, totalSessions = 0, totalFans = 0, totalEarnings = 0, readiness = 'building', intelligence = null, analytics = null, onImport }) {
  const grad = 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)'
  // 2C-1: the card no longer runs its own percentage. `overall` is the canonical
  // calibration figure the Creator Report shows, and the per-slot bars are the
  // canonical insights' own observations against their own requirements.
  const progress = getUnlockProgress({ totalTips, totalSessions, totalFans, totalEarnings, intelligence, analytics })
  const overall  = progress.pct
  const stageLabel = { setup: 'Setup', building: 'Building', starter: 'Starter insights unlocked', warming: 'Warming up', ready: 'Full confidence' }[readiness] || readiness
  const nextEvidence = progress.nextBestEvidence?.[0]
  const nextTarget = nextEvidence
    ? `${nextEvidence.insightLabel} — ${nextEvidence.label}`
    : 'stronger evidence behind every insight'

  const items = Object.entries(progress.slots).map(([, slot]) => ({
    label: slot.label,
    pct: slot.pct,
    cur: slot.current,
    tgt: slot.target ?? '—',
    unit: '',
  }))

  return (
    <div className="dpc-ambient-glow" style={{ borderRadius: 22, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(12,16,34,0.78)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: '18px 22px', marginBottom: 20, position: 'relative', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.28)' }}>
      <style jsx>{`
        @keyframes dpcAmbientGlow {
          0%, 100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.28), 0 0 0 rgba(124,92,255,0); }
          50% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.28), 0 0 24px rgba(124,92,255,0.18), 0 0 14px rgba(22,244,255,0.12); }
        }
        .dpc-ambient-glow { animation: dpcAmbientGlow 3.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .dpc-ambient-glow { animation: none; }
        }
      `}</style>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: grad }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', marginBottom: 2 }}>
            Dashboard warming up — <span style={{ color: '#16F4FF' }}>{stageLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: '#8D93AA' }}>{overall}% calibrated · Next: {nextTarget}</div>
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
export function DashboardPreview({ tips = [], analytics, userPlan = 'free', planExpiresAt = null, onAddHistory, onContinue, onUpgrade, onLiveMode }) {
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
  const readiness = getDashboardReadiness({ totalTips, totalSessions, totalFans, totalEarnings, analytics })
  const plan      = getPlanAccess(userPlan, platformCount, planExpiresAt)
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
  // getDashboardReadiness() returns setup/building/starter/warming/ready; this
  // component's copy is written in three bands. Mapped here rather than keeping
  // a second readiness vocabulary alive.
  const stage = (readiness === 'setup' || readiness === 'building') ? 'very_low_data'
    : readiness === 'ready' ? 'full_data'
    : 'partial_data'
  const hero = heroConfig[stage] || heroConfig.very_low_data

  // Progress checklist
  const checklistArgs = { userPlan, planExpiresAt, totalTips, totalSessions, totalFans, totalEarnings, totalStreamMinutes, importedPlatforms: platforms, liveModeSessions, analytics }
  const progressItems = [
    { label: 'Account created', done: true },
    { label: 'Onboarding completed', done: true },
    { label: 'Track your first platform', done: platformCount >= 1 },
    // Canonical: these are the intelligence layer's own session/tip facts, not a
    // second set of counters (2C-1).
    { label: 'Build a readable session history', done: !getFeatureLockState({ feature: 'sessionPerformance', ...checklistArgs }).locked },
    { label: 'Identify your top supporters', done: !getFeatureLockState({ feature: 'topFans', ...checklistArgs }).locked },
    { label: 'Start your first Live Mode session', done: liveModeSessions >= 1 },
    { label: 'Unlock full insights', done: stage === 'full_data' },
    isPro
      ? { label: 'Pro multi-platform tracking enabled', done: true }
      : { label: 'Upgrade to Pro for multi-platform tracking', done: false, isPro: true },
  ]
  const progressPct = Math.round((progressItems.filter(i => i.done).length / progressItems.length) * 100)

  // Feature locks
  const lockArgs = { userPlan, planExpiresAt, totalTips, totalSessions, totalFans, totalEarnings, totalStreamMinutes, importedPlatforms: platforms, liveModeSessions, analytics }
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
    if (stage === 'very_low_data') return { text: 'Next best step: add at least 2 more sessions so CamCash can calculate your best times.', primary: 'Import More Sessions', onPrimary: onAddHistory }
    if (stage === 'partial_data' && !isPro) return { text: "Next best step: keep building your first platform dashboard, or upgrade to Pro when you're ready to compare multiple cam sites.", primary: 'Import More Data', secondary: 'Upgrade to Pro', onPrimary: onAddHistory, onSecondary: onUpgrade }
    if (stage === 'partial_data' && isPro) return { text: 'Next best step: add another platform or start Live Mode so CamCash can compare your performance across sites.', primary: 'Add Platform', onPrimary: onAddHistory }
    if (stage === 'full_data' && !isPro) return { text: 'Next best step: review your current platform insights. Upgrade to Pro to compare more platforms.', primary: 'View My Insights', secondary: 'Upgrade to Pro', onPrimary: onContinue, onSecondary: onUpgrade }
    if (stage === 'full_data' && isPro) return { text: 'Next best step: review your top fans and plan your next stream around your best earning window.', primary: 'View Top Fans', onPrimary: onContinue }
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
              <button onClick={stage === 'full_data' ? onContinue : onLiveMode} style={secondaryBtn({ width: '100%' })}>{hero.secondaryLabel}</button>
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
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>Track up to {FREE_MAX_PLATFORMS} platforms for free. Choose your first platform to start building your dashboard.</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 4 }}>Free plan · {platformCount} of {FREE_MAX_PLATFORMS} platforms active</div>
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
              Your free plan includes up to {FREE_MAX_PLATFORMS} active platforms. Pro unlocks unlimited platforms and the full cross-platform comparison. Your free platforms stay free forever.
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
            value={canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes, analytics }) ? fmt$(analytics?.avgPerHour || 0) : 'Needs more data'}
            helper={!canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes, analytics }) ? 'Unlocks after 60+ tracked minutes' : undefined}
            status={canShowHourlyRate({ sessionCount: totalSessions, totalStreamMinutes, analytics }) ? 'ready' : 'needs_data'}
          />
          <SnapshotMetricCard
            label="Platforms"
            value={platformCount > 0 ? platforms.join(', ') : 'None yet'}
            helper={isPro ? 'Pro multi-platform tracking enabled' : `Free plan tracks up to ${FREE_MAX_PLATFORMS} platforms`}
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
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 6 }}>Choose up to {FREE_MAX_PLATFORMS} platforms to track for free</div>
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
