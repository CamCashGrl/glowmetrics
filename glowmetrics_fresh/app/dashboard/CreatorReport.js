"use client"

import { useEffect } from "react"
import { track as gtmTrack } from "../../lib/track"
import { PLATFORM_TOKEN_RATES } from "../../lib/constants"
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  SHADOWS,
  BORDERS,
  RADIUS,
  TRANSITIONS,
  BACKDROP,
} from "../../lib/designTokens"

/*
  CREATOR REPORT — LUXURY PROFESSIONAL REDESIGN
  ============================================================
  Progressive report experience with enhanced visual design.

  EARLY DATA → report warming up, real earnings visible
  DEVELOPING DATA → more insights available, selective Pro previews
  RICH DATA → advanced opportunities visible, deeper action layer

  This component uses centralized design tokens (lib/designTokens.js)
  for consistency across the platform.
*/

// Platform display names
const PLATFORM_DISPLAY_NAMES = Object.fromEntries(
  Object.keys(PLATFORM_TOKEN_RATES).map(name => [
    name.toLowerCase(),
    name,
  ])
)

const displayPlatform = (platform) =>
  (platform &&
    PLATFORM_DISPLAY_NAMES[String(platform).toLowerCase()]) ||
  platform ||
  "Unknown"

// ------------------------------------------------------------
// FORMATTERS
// ------------------------------------------------------------

const fmtUsd = (value, decimals = 0) => {
  const n = Number(value) || 0

  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

const fmtHour = (hour) => {
  if (hour == null) return null

  const n = parseInt(hour, 10)

  if (Number.isNaN(n)) return null

  if (n === 0) return "12 AM"
  if (n < 12) return `${n} AM`
  if (n === 12) return "12 PM"

  return `${n - 12} PM`
}

const fmtNumber = (value) =>
  Number(value || 0).toLocaleString()

const formatDuration = (minutes) => {
  const m = Math.round(Number(minutes) || 0)

  if (m <= 0) return "0m"

  const hours = Math.floor(m / 60)
  const remainder = m % 60

  if (!hours) return `${remainder}m`

  return remainder
    ? `${hours}h ${remainder}m`
    : `${hours}h`
}

// ============================================================
// STAT CARD — Luxury Professional Design
// ============================================================

const STAT_ACCENTS = [
  COLORS.pink,
  COLORS.cyan,
  COLORS.purple,
  COLORS.gold,
]

function StatCard({
  icon,
  label,
  value,
  sub,
  index = 0,
  status = null,
}) {
  const accentColor = STAT_ACCENTS[index % STAT_ACCENTS.length]

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        minWidth: 0,
        borderRadius: RADIUS.lg,
        padding: `${SPACING.lg} ${SPACING.xl}`,
        background: COLORS.bgCard,
        border: BORDERS.card,
        backdropFilter: BACKDROP.blur,
        boxShadow: SHADOWS.sm,
        borderTop: `2px solid ${accentColor}`,
        animation: `fadeUp 0.3s ease ${index * 0.05}s both`,
        transition: `all ${TRANSITIONS.normal}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = SHADOWS.md
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = SHADOWS.sm
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Header: Label + Icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACING.md,
          marginBottom: SPACING.xl,
        }}
      >
        <span style={{ ...TYPOGRAPHY.labelSm, color: COLORS.textTertiary }}>
          {label}
        </span>
        <span style={{ fontSize: 20, opacity: 0.8 }}>{icon}</span>
      </div>

      {/* Main Value */}
      <div
        style={{
          ...TYPOGRAPHY.dataLg,
          color: status === "warming" ? COLORS.textSecondary : accentColor,
          marginBottom: SPACING.sm,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>

      {/* Sub-text */}
      {sub && (
        <div
          style={{
            ...TYPOGRAPHY.bodySm,
            color: COLORS.textSecondary,
            lineHeight: 1.45,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

// ============================================================
// SECTION HEADER
// ============================================================

function SectionHeader({
  eyebrow,
  title,
  description,
}) {
  return (
    <div style={{ marginBottom: SPACING.xl }}>
      {eyebrow && (
        <div style={{ ...TYPOGRAPHY.labelSm, color: COLORS.cyan, marginBottom: SPACING.md }}>
          {eyebrow}
        </div>
      )}

      <div style={{ ...TYPOGRAPHY.h2, color: COLORS.textPrimary, marginBottom: SPACING.sm }}>
        {title}
      </div>

      {description && (
        <div
          style={{
            ...TYPOGRAPHY.bodySm,
            color: COLORS.textSecondary,
            maxWidth: 680,
            marginTop: SPACING.md,
          }}
        >
          {description}
        </div>
      )}
    </div>
  )
}

// ============================================================
// PRO BUTTON — Consistent Gradient CTA
// ============================================================

function ProButton({
  children,
  onClick,
  source = "creator_report",
  compact = false,
}) {
  return (
    <button
      onClick={() => {
        try {
          gtmTrack("creator_report_upgrade_click", { source })
        } catch (_) {}
        onClick?.()
      }}
      style={{
        border: "1px solid rgba(236, 72, 153, 0.3)",
        borderRadius: compact ? RADIUS.sm : RADIUS.md,
        padding: compact ? `${SPACING.sm} ${SPACING.md}` : `${SPACING.md} ${SPACING.xl}`,
        cursor: "pointer",
        fontSize: compact ? 11 : 12,
        fontWeight: 800,
        color: "#FFF",
        background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)",
        boxShadow: SHADOWS.md,
        whiteSpace: "nowrap",
        transition: `all ${TRANSITIONS.normal}`,
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = SHADOWS.lg
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = SHADOWS.md
        e.currentTarget.style.transform = 'translateY(0)'
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${COLORS.cyan}`
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none'
      }}
    >
      {children}
    </button>
  )
}

// ============================================================
// CALIBRATION CARD — Report Warming Up Progress
// ============================================================

function CalibrationCard({
  tipsCount,
  sessionCount,
  platformCount,
  isPro,
  onImport,
  hasBestWindow,
  hourlyRateUnlocked,
}) {
  const tipReady = tipsCount >= 10
  const sessionReady = sessionCount >= 2
  const timingReady = Boolean(hasBestWindow)
  const hourlyReady = Boolean(hourlyRateUnlocked)

  const milestones = [
    { label: "Earnings", ready: tipsCount > 0 },
    { label: "Session patterns", ready: sessionReady },
    { label: "Timing patterns", ready: timingReady },
    { label: "$/hour confidence", ready: hourlyReady },
  ]

  const completed = milestones.filter(m => m.ready).length
  const calibration = Math.round((completed / milestones.length) * 100)

  let headline = "Your Creator Report is warming up"
  let subhead = "CamCash is learning your earning patterns. Keep importing history and the report will become more precise."

  if (completed >= 4) {
    headline = "🔥 Creator Report is fully calibrated"
    subhead = "You have enough history for CamCash to surface your strongest patterns. Pro can take those patterns deeper."
  } else if (completed >= 3) {
    headline = "📈 Your report just got smarter"
    subhead = "CamCash has enough history to identify several meaningful patterns in your streams."
  } else if (completed >= 2) {
    headline = "🔮 Your report is finding patterns"
    subhead = "You've given CamCash enough history to start identifying repeatable behavior."
  }

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        marginBottom: SPACING.xxl,
        borderRadius: RADIUS.xl,
        padding: `${SPACING.lg} ${SPACING.xl}`,
        background: "linear-gradient(135deg,rgba(34,211,238,0.08),rgba(168,85,247,0.07),rgba(236,72,153,0.05))",
        border: BORDERS.cardAccent,
        boxShadow: SHADOWS.sm,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: SPACING.xl, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ ...TYPOGRAPHY.h2, color: COLORS.textPrimary, marginBottom: SPACING.sm }}>
            {headline}
          </div>
          <div style={{ ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary, maxWidth: 680 }}>
            {subhead}
          </div>
        </div>

        <div style={{ minWidth: 115, textAlign: "right" }}>
          <div style={{ ...TYPOGRAPHY.labelSm, color: COLORS.textTertiary }}>
            Report calibration
          </div>
          <div style={{ ...TYPOGRAPHY.dataLg, color: calibration >= 75 ? COLORS.green : COLORS.cyan, marginTop: SPACING.sm }}>
            {calibration}%
          </div>
        </div>
      </div>

      <div style={{ height: 6, marginTop: SPACING.xl, overflow: "hidden", borderRadius: RADIUS.full, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${Math.max(calibration, 7)}%`, height: "100%", borderRadius: RADIUS.full, background: "linear-gradient(90deg,#22D3EE,#A855F7,#EC4899)", transition: `width 0.5s ease` }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: SPACING.md, marginTop: SPACING.lg }}>
        {milestones.map((milestone) => (
          <div key={milestone.label} style={{ display: "flex", alignItems: "center", gap: SPACING.md, padding: `${SPACING.sm} ${SPACING.md}`, borderRadius: RADIUS.md, background: milestone.ready ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.025)", border: `1px solid ${milestone.ready ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.06)"}` }}>
            <span style={{ fontSize: 12 }}>{milestone.ready ? "✓" : "○"}</span>
            <span style={{ ...TYPOGRAPHY.labelSm, color: milestone.ready ? COLORS.green : COLORS.textSecondary }}>
              {milestone.label}
            </span>
          </div>
        ))}
      </div>

      {!isPro && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: SPACING.lg, flexWrap: "wrap", marginTop: SPACING.xl, paddingTop: SPACING.lg, borderTop: BORDERS.divider }}>
          <div style={{ ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary }}>
            {tipReady ? "Your basic report is active. Keep importing to improve pattern confidence." : `Import ${Math.max(1, 10 - tipsCount)} more tip${10 - tipsCount === 1 ? "" : "s"} to unlock more basic report signals.`}
          </div>
          <button onClick={onImport} style={{ border: BORDERS.cardAccent, borderRadius: RADIUS.sm, padding: `${SPACING.sm} ${SPACING.md}`, cursor: "pointer", ...TYPOGRAPHY.labelSm, color: COLORS.cyan, background: "rgba(34,211,238,0.07)", transition: `all ${TRANSITIONS.normal}`, outline: 'none' }} onFocus={(e) => { e.currentTarget.style.outline = `2px solid ${COLORS.cyan}`; e.currentTarget.style.outlineOffset = '2px' }} onBlur={(e) => { e.currentTarget.style.outline = 'none' }}>
            Import More History
          </button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// PLATFORM CARDS
// ------------------------------------------------------------

function PlatformCards({
  platforms,
  tips,
  isPro,
  onUpgrade,
}) {
  const actualPlatforms =
    Array.isArray(platforms) && platforms.length
      ? platforms
      : []

  const tipPlatforms = [
    ...new Set(
      tips
        .map(t => t?.platform)
        .filter(Boolean)
    ),
  ]

  const names = [
    ...new Set([
      ...actualPlatforms.map(p => p?.platform),
      ...tipPlatforms,
    ]),
  ].filter(Boolean)

  if (!names.length) {
    return (
      <div
        style={{
          padding: 18,
          borderRadius: 14,
          border: `1px dashed ${C.border}`,
          background: "rgba(255,255,255,0.02)",
          color: C.muted,
          fontSize: 12,
        }}
      >
        Import your first platform history and CamCash will start
        building your platform report here.
      </div>
    )
  }

  const normalized = names.map(name => {
    const existing = actualPlatforms.find(
      p =>
        String(p?.platform || "").toLowerCase() ===
        String(name).toLowerCase()
    )

    const platformTips = tips.filter(
      t =>
        String(t?.platform || "").toLowerCase() ===
        String(name).toLowerCase()
    )

    const totalUSD =
      existing?.totalUSD ??
      platformTips.reduce(
        (sum, t) => sum + (Number(t?.usd) || 0),
        0
      )

    const tipCount =
      existing?.tipCount ??
      existing?.tips ??
      platformTips.length

    const sessions =
      existing?.sessions ??
      0

    const hours =
      existing?.hours ??
      0

    const usdPerHour =
      existing?.usdPerHour ??
      0

    return {
      platform: name,
      totalUSD,
      tipCount,
      sessions,
      hours,
      usdPerHour,
    }
  })

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(205px,1fr))",
        gap: 10,
      }}
    >
      {normalized.map((platform, index) => (
        <div
          key={platform.platform}
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 15,
            padding: "14px 15px",
            background: C.card2,
            border: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 850,
                color: C.white,
              }}
            >
              {displayPlatform(platform.platform)}
            </div>

            <div
              style={{
                padding: "3px 7px",
                borderRadius: 20,
                fontSize: 9,
                fontWeight: 800,
                color: C.green,
                background: "rgba(16,185,129,0.08)",
                border:
                  "1px solid rgba(16,185,129,0.16)",
              }}
            >
              SYNCED
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              fontSize: 21,
              fontWeight: 900,
              color: index === 0 ? C.cyan : C.white,
            }}
          >
            {fmtUsd(platform.totalUSD, 2)}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 10,
              color: C.dim,
            }}
          >
            {fmtNumber(platform.tipCount)} tips
            {platform.sessions
              ? ` · ${platform.sessions} sessions`
              : ""}
          </div>

          <div
            style={{
              marginTop: 11,
              paddingTop: 9,
              borderTop:
                "1px solid rgba(255,255,255,0.06)",
              fontSize: 10,
              color: C.muted,
            }}
          >
            {platform.usdPerHour > 0
              ? `${fmtUsd(platform.usdPerHour)}/hr`
              : "Building hourly history"}
          </div>

          {normalized.length > 1 && !isPro && index > 0 && (
            <div
              style={{
                marginTop: 9,
                padding: "7px 8px",
                borderRadius: 8,
                background: "rgba(168,85,247,0.06)",
                border:
                  "1px solid rgba(168,85,247,0.16)",
                fontSize: 10,
                lineHeight: 1.45,
                color: C.muted,
              }}
            >
              🔒 Pro compares this platform against
              your other platforms by timing and
              profitability.
            </div>
          )}
        </div>
      ))}

      {!isPro && normalized.length === 1 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            borderRadius: 15,
            padding: 15,
            background:
              "linear-gradient(135deg,rgba(168,85,247,0.06),rgba(236,72,153,0.04))",
            border:
              "1px solid rgba(168,85,247,0.17)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 850,
              color: C.white,
            }}
          >
            🌐 Add another platform
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 10,
              lineHeight: 1.5,
              color: C.muted,
            }}
          >
            Your first platform is mapped. Pro
            unlocks deeper cross-platform intelligence
            when you have multiple sources.
          </div>

          <div style={{ marginTop: 10 }}>
            <ProButton
              compact
              source="creator_report_multi_platform"
              onClick={onUpgrade}
            >
              See Multi-Platform Pro
            </ProButton>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// INSIGHT STATE CARD — Simplified Design
// ============================================================

function InsightState({
  icon,
  title,
  state,
  children,
  footer,
  onImport,
}) {
  const isWarming = state === "warming"

  return (
    <div
      style={{
        minHeight: 120,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: SPACING.lg,
        borderRadius: RADIUS.lg,
        background: COLORS.bgCard,
        border: BORDERS.card,
        backdropFilter: BACKDROP.blur,
        boxShadow: SHADOWS.sm,
        transition: `all ${TRANSITIONS.normal}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = SHADOWS.md
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = SHADOWS.sm
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: SPACING.md }}>
          <span style={{ fontSize: 20, opacity: isWarming ? 0.5 : 1 }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ ...TYPOGRAPHY.labelSm, color: COLORS.textTertiary }}>
              {title}
            </div>
            <span
              style={{
                display: "inline-block",
                marginTop: SPACING.sm,
                padding: `2px ${SPACING.md}`,
                borderRadius: RADIUS.full,
                fontSize: 8,
                fontWeight: 800,
                color: isWarming ? COLORS.gold : COLORS.green,
                background: isWarming ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
              }}
            >
              {isWarming ? "WARMING" : "READY"}
            </span>
          </div>
        </div>

        <div style={{ ...TYPOGRAPHY.body, color: isWarming ? COLORS.textSecondary : COLORS.textPrimary, marginTop: SPACING.lg, lineHeight: 1.55 }}>
          {children}
        </div>
      </div>

      {footer && (
        <div style={{ ...TYPOGRAPHY.bodySm, color: COLORS.textTertiary, marginTop: SPACING.lg }}>
          {footer}
        </div>
      )}

      {isWarming && onImport && (
        <button
          onClick={onImport}
          style={{
            alignSelf: "flex-start",
            marginTop: SPACING.lg,
            padding: `${SPACING.sm} ${SPACING.md}`,
            borderRadius: RADIUS.sm,
            cursor: "pointer",
            border: BORDERS.cardAccent,
            color: COLORS.cyan,
            background: "rgba(34,211,238,0.07)",
            fontSize: 9,
            fontWeight: 800,
            transition: `all ${TRANSITIONS.normal}`,
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(34,211,238,0.12)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(34,211,238,0.07)"
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = `2px solid ${COLORS.cyan}`
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
        >
          Import more history →
        </button>
      )}
    </div>
  )
}

// ============================================================
// PRO PREVIEW — Premium Locked Feature Preview
// ============================================================

function ProPreview({
  icon = "🔒",
  eyebrow = "PRO INSIGHT",
  title,
  description,
  preview,
  onUpgrade,
  source = "creator_report_pro_preview",
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: RADIUS.lg,
        padding: SPACING.xl,
        background: "linear-gradient(135deg,rgba(168,85,247,0.07),rgba(236,72,153,0.055))",
        border: BORDERS.cardPink,
        boxShadow: SHADOWS.sm,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: SPACING.lg }}>
        <div style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", borderRadius: RADIUS.md, background: "rgba(168,85,247,0.10)", border: BORDERS.cardPink, fontSize: 16 }}>
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...TYPOGRAPHY.labelSm, color: COLORS.purple }}>
            {eyebrow}
          </div>

          <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginTop: SPACING.sm }}>
            {title}
          </div>

          {description && (
            <div style={{ ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary, marginTop: SPACING.md }}>
              {description}
            </div>
          )}

          {preview && (
            <div style={{ marginTop: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.md, background: "rgba(0,0,0,0.15)", border: BORDERS.divider, ...TYPOGRAPHY.bodySm, color: COLORS.textPrimary }}>
              {preview}
            </div>
          )}

          <div style={{ marginTop: SPACING.xl }}>
            <ProButton compact source={source} onClick={onUpgrade}>
              Unlock with Pro →
            </ProButton>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// LOCKED ACTION — Inline Pro Feature Lock
// ============================================================

function LockedAction({
  icon = "🔒",
  title,
  description,
  onUpgrade,
  source,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: SPACING.lg,
        padding: `${SPACING.md} ${SPACING.lg}`,
        borderRadius: RADIUS.md,
        background: "rgba(168,85,247,0.045)",
        border: BORDERS.cardPink,
        transition: `all ${TRANSITIONS.normal}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(168,85,247,0.08)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(168,85,247,0.045)"
      }}
    >
      <div style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", borderRadius: RADIUS.sm, background: "rgba(168,85,247,0.08)", fontSize: 13 }}>
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...TYPOGRAPHY.label, color: COLORS.textPrimary }}>
          {title}
        </div>
        {description && (
          <div style={{ ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary, marginTop: SPACING.sm }}>
            {description}
          </div>
        )}
      </div>

      <ProButton compact source={source} onClick={onUpgrade}>
        Reveal
      </ProButton>
    </div>
  )
}

// ------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------

export default function CreatorReport({
  analytics,
  tips = [],
  isPro = false,
  onUpgrade,
  engineInsights = null,
}) {
  const safeAnalytics = analytics || {}

  // ----------------------------------------------------------
  // EXISTING ANALYTICS — READ ONLY
  // ----------------------------------------------------------

  const totalUSD = safeAnalytics.totalUSD || 0

  const meaningfulSessionCount =
    safeAnalytics.meaningfulSessionCount || 0

  const sessions =
    safeAnalytics.sessions || []

  const topTippers =
    safeAnalytics.topTippers || []

  const platforms =
    safeAnalytics.platforms || []

  const insights =
    safeAnalytics.insights || []

  const nextMoves =
    safeAnalytics.nextMoves || []

  const monthlyData =
    safeAnalytics.monthlyData || []

  const topPlatform =
    safeAnalytics.bestPlatformByRate || null

  const canonicalBestWindow =
    safeAnalytics.canonicalBestTimes?.bestWindow || null

  const hourlyRate =
    safeAnalytics.estimatedHourlyRate || 0

  const hourlyRateSessionCount =
    safeAnalytics.hourlyRateSessionCount || 0

  const hourlyRateTotalMinutes =
    safeAnalytics.hourlyRateTotalMinutes || 0

  // Existing dashboard uses these fields to determine whether
  // hourly rate is actually eligible.
  const hourlyRateUnlocked =
    hourlyRateSessionCount >= 3 &&
    hourlyRateTotalMinutes >= 60

  const latestMonth =
    monthlyData.length
      ? monthlyData[monthlyData.length - 1]
      : null

  const monthGrowthPct =
    latestMonth?.growthPct ?? null

  const topSupporter =
    topTippers[0] || null

  // Existing advanced analytics fields.
  const missedRevenueByPlatform =
    safeAnalytics.missedRevenueByPlatform || {}

  const returningVsNew =
    safeAnalytics.returningVsNew || null

  const topFanDependency =
    safeAnalytics.topFanDependency || null

  // ----------------------------------------------------------
  // DATA STATE
  // ----------------------------------------------------------

  const tipCount = tips.length

  const platformCount = [
    ...new Set(
      tips
        .map(t => t?.platform)
        .filter(Boolean)
    ),
  ].length

  const hasEnoughBasicData =
    tipCount > 0

  const hasEnoughSessions =
    meaningfulSessionCount >= 2

  const hasBestWindow =
    Boolean(canonicalBestWindow)

  const hasRichData =
    tipCount >= 100 &&
    meaningfulSessionCount >= 5

  // We intentionally don't use a hard "no data" return.
  // The report should always look complete.
  const reportState =
    hasRichData
      ? "rich"
      : hasEnoughSessions
        ? "developing"
        : "warming"

  // ----------------------------------------------------------
  // INSIGHT STATES
  // ----------------------------------------------------------

  const bestDayReady =
    Boolean(canonicalBestWindow?.localDay)

  const bestTimeReady =
    Boolean(canonicalBestWindow?.localHour != null)

  const bestDayText =
    bestDayReady
      ? canonicalBestWindow.localDay
      : "More history needed"

  const bestTimeText =
    bestTimeReady
      ? fmtHour(canonicalBestWindow.localHour)
      : "Warming up"

  // ----------------------------------------------------------
  // CONTEXTUAL INSIGHTS
  // ----------------------------------------------------------

  const warningInsight =
    insights.find(i => i?.icon === "📉") ||
    null

  const opportunityInsight =
    insights.find(i => i && i !== warningInsight) ||
    null

  const positiveInsight =
    opportunityInsight ||
    insights[0] ||
    null

  // Existing missed-revenue data only.
  const revenueLeakEntries = Object.entries(
    missedRevenueByPlatform || {}
  ).filter(([, value]) => {
    const n =
      typeof value === "object"
        ? Number(
            value?.missedRevenue ??
            value?.usd ??
            value?.amount ??
            0
          )
        : Number(value || 0)

    return n > 0
  })

  const largestRevenueLeak =
    revenueLeakEntries.length
      ? revenueLeakEntries.sort(
          (a, b) => {
            const av =
              typeof a[1] === "object"
                ? Number(
                    a[1]?.missedRevenue ??
                    a[1]?.usd ??
                    a[1]?.amount ??
                    0
                  )
                : Number(a[1] || 0)

            const bv =
              typeof b[1] === "object"
                ? Number(
                    b[1]?.missedRevenue ??
                    b[1]?.usd ??
                    b[1]?.amount ??
                    0
                  )
                : Number(b[1] || 0)

            return bv - av
          }
        )[0]
      : null

  const largestRevenueLeakAmount =
    largestRevenueLeak
      ? typeof largestRevenueLeak[1] === "object"
        ? Number(
            largestRevenueLeak[1]?.missedRevenue ??
            largestRevenueLeak[1]?.usd ??
            largestRevenueLeak[1]?.amount ??
            0
          )
        : Number(largestRevenueLeak[1] || 0)
      : 0

  // ----------------------------------------------------------
  // TRACKING
  // ----------------------------------------------------------

  const track = (name, props) => {
    try {
      gtmTrack(name, props)
    } catch (_) {}
  }

  useEffect(() => {
    track("creator_report_viewed", {
      reportState,
      tipCount,
      meaningfulSessionCount,
      platformCount,
      isPro,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----------------------------------------------------------
  // IMPORT HANDLER
  // ----------------------------------------------------------

  const handleImport = () => {
    track("creator_report_import_more_click", {
      reportState,
      tipCount,
      meaningfulSessionCount,
    })

    /*
      CreatorReport currently doesn't receive a navigation callback.
      Dispatch a lightweight browser event so the dashboard can optionally
      listen later without breaking the current component API.

      If the dashboard doesn't listen, nothing happens.
      The button still remains safe.
    */
    try {
      window.dispatchEvent(
        new CustomEvent("camcash:creator-report-import")
      )
    } catch (_) {}
  }

  // ----------------------------------------------------------
  // UPGRADE HANDLER
  // ----------------------------------------------------------

  const handleUpgrade = (source = "creator_report") => {
    track("creator_report_upgrade_click", {
      source,
      reportState,
      tipCount,
      meaningfulSessionCount,
      platformCount,
    })

    onUpgrade?.()
  }

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <div>
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACING.xl, marginBottom: SPACING.xxxl, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.md }}>
            <div style={{ ...TYPOGRAPHY.h1, color: COLORS.textPrimary }}>
              🧾 Your Creator Report
            </div>

            <div
              style={{
                padding: `4px ${SPACING.md}`,
                borderRadius: RADIUS.full,
                fontSize: 8,
                fontWeight: 900,
                color: reportState === "rich" ? COLORS.green : reportState === "developing" ? COLORS.cyan : COLORS.gold,
                background: reportState === "rich" ? "rgba(16,185,129,0.08)" : reportState === "developing" ? "rgba(34,211,238,0.08)" : "rgba(245,158,11,0.08)",
              }}
            >
              {reportState === "rich" ? "HIGH SIGNAL" : reportState === "developing" ? "DEVELOPING" : "EARLY SIGNAL"}
            </div>
          </div>

          <div style={{ ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary, marginTop: SPACING.md }}>
            Your numbers become more useful as CamCash gets more history to work with.
          </div>
        </div>

        {!isPro && (
          <ProButton source="creator_report_header" onClick={() => handleUpgrade("creator_report_header")}>
            Unlock Creator Pro
          </ProButton>
        )}
      </div>

      {/* ======================================================
          CALIBRATION
      ====================================================== */}

      <CalibrationCard
        tipsCount={tipCount}
        sessionCount={meaningfulSessionCount}
        platformCount={platformCount}
        isPro={isPro}
        onImport={handleImport}
        hasBestWindow={hasBestWindow}
        hourlyRateUnlocked={hourlyRateUnlocked}
      />

      {/* ======================================================
          CORE NUMBERS (KPI CARDS)
      ====================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: SPACING.lg,
          marginBottom: SPACING.xxxl,
        }}
      >
        <StatCard
          index={0}
          icon="💰"
          label="Total Earnings"
          value={fmtUsd(totalUSD)}
          sub={
            monthGrowthPct !== null
              ? `${monthGrowthPct >= 0 ? "↑" : "↓"} ${Math.abs(monthGrowthPct)}% vs last month`
              : `${fmtNumber(tipCount)} tips tracked`
          }
        />

        <StatCard
          index={1}
          icon="⏱️"
          label="Avg $/Hour"
          value={
            hourlyRateUnlocked && hourlyRate > 0
              ? fmtUsd(hourlyRate)
              : "Warming up"
          }
          sub={
            hourlyRateUnlocked
              ? `Based on ${hourlyRateSessionCount} eligible sessions`
              : `Needs 3 eligible sessions + 60m tracked`
          }
          status={
            hourlyRateUnlocked
              ? null
              : "warming"
          }
        />

        <StatCard
          index={2}
          icon="📅"
          label="Best Streaming Day"
          value={bestDayText}
          sub={
            bestDayReady
              ? `${canonicalBestWindow.sessionCount || 0} qualifying sessions`
              : "More variance required to isolate your peak day"
          }
          status={
            bestDayReady
              ? null
              : "warming"
          }
        />

        <StatCard
          index={3}
          icon="⏰"
          label="Best Streaming Time"
          value={bestTimeText}
          sub={
            bestTimeReady
              ? `${fmtUsd(canonicalBestWindow.medianUsdPerHour || 0)}/hr median`
              : "More session history needed"
          }
          status={
            bestTimeReady
              ? null
              : "warming"
          }
        />

        <StatCard
          index={0}
          icon="👑"
          label="Top Supporter"
          value={
            topSupporter?.username ||
            "Building fan history"
          }
          sub={
            topSupporter
              ? `${fmtUsd(topSupporter.usd || topSupporter.totalUSD || 0, 2)} lifetime`
              : `${fmtNumber(tipCount)} tips imported`
          }
        />

        <StatCard
          index={1}
          icon="🎯"
          label="Top Platform"
          value={
            topPlatform
              ? displayPlatform(topPlatform.platform)
              : platformCount
                ? displayPlatform(
                    tips.find(t => t?.platform)?.platform
                  )
                : "Waiting for data"
          }
          sub={
            topPlatform
              ? `${fmtUsd(topPlatform.usdPerHour || 0)}/hr`
              : platformCount
                ? "Building platform performance"
                : "Import platform history"
          }
        />
      </div>

      {/* ======================================================
          PLATFORM INTELLIGENCE
      ====================================================== */}

      <div
        style={{
          marginBottom: SPACING.xxxl,
          borderRadius: RADIUS.xl,
          padding: SPACING.xl,
          background: COLORS.bgCard,
          border: BORDERS.card,
          boxShadow: SHADOWS.sm,
        }}
      >
        <SectionHeader
          eyebrow="Your data by platform"
          title="🌐 Platform Performance"
          description="Each platform builds its own history as you import it. Pro adds deeper cross-platform analysis."
        />

        <PlatformCards
          platforms={platforms}
          tips={tips}
          isPro={isPro}
          onUpgrade={() =>
            handleUpgrade("creator_report_multi_platform")
          }
        />
      </div>

      {/* ======================================================
          WHAT YOUR DATA IS SAYING (INSIGHTS)
      ====================================================== */}

      <div
        style={{
          marginBottom: SPACING.xxxl,
          borderRadius: RADIUS.xl,
          padding: SPACING.xl,
          background: COLORS.bgCard,
          border: BORDERS.card,
          boxShadow: SHADOWS.sm,
        }}
      >
        <SectionHeader
          eyebrow="Free insights"
          title="📊 What Your Data Is Saying"
          description="These insights become more reliable as your history grows."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: SPACING.lg,
          }}
        >
          <InsightState
            icon="📅"
            title="Best Day"
            state={
              bestDayReady
                ? "ready"
                : "warming"
            }
            onImport={handleImport}
          >
            {bestDayReady
              ? `Your strongest day so far is ${canonicalBestWindow.localDay}.`
              : "More variance is needed before CamCash can confidently isolate your strongest day."}
          </InsightState>

          <InsightState
            icon="⏰"
            title="Best Time"
            state={
              bestTimeReady
                ? "ready"
                : "warming"
            }
            onImport={handleImport}
          >
            {bestTimeReady
              ? `Your strongest window currently centers around ${fmtHour(canonicalBestWindow.localHour)}.`
              : "CamCash is still collecting enough session history to identify a reliable timing pattern."}
          </InsightState>

          <InsightState
            icon="💡"
            title="Opportunity"
            state={
              positiveInsight
                ? "ready"
                : "warming"
            }
            onImport={handleImport}
          >
            {positiveInsight?.text ||
              "As more sessions arrive, CamCash will surface patterns worth acting on."}
          </InsightState>

          <InsightState
            icon="⚠️"
            title="Worth Watching"
            state={
              warningInsight
                ? "ready"
                : "warming"
            }
            onImport={handleImport}
          >
            {warningInsight?.text ||
              (tipCount > 0
                ? "No major warning has been detected in the current history."
                : "Import more history and CamCash will begin checking for performance warnings.")}
          </InsightState>
        </div>
      </div>

      {/* ======================================================
          CamCash FOUND SOMETHING (Discovery Alert)
      ====================================================== */}

      {positiveInsight && (
        <div
          style={{
            marginBottom: SPACING.xxxl,
            padding: SPACING.xl,
            borderRadius: RADIUS.lg,
            background: "linear-gradient(135deg,rgba(16,185,129,0.08),rgba(34,211,238,0.04))",
            border: BORDERS.card,
            boxShadow: SHADOWS.sm,
          }}
        >
          <div style={{ ...TYPOGRAPHY.labelSm, color: COLORS.green }}>
            🔎 CamCash found something
          </div>

          <div style={{ ...TYPOGRAPHY.body, color: COLORS.textPrimary, marginTop: SPACING.md, lineHeight: 1.6 }}>
            {positiveInsight.text}
          </div>

          {!isPro && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACING.lg, flexWrap: "wrap", marginTop: SPACING.lg, paddingTop: SPACING.lg, borderTop: BORDERS.divider }}>
              <div style={{ ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary }}>
                Pro can turn this pattern into a specific next-stream action.
              </div>
              <ProButton compact source="creator_report_pattern_found" onClick={() => handleUpgrade("creator_report_pattern_found")}>
                Show Me What To Do →
              </ProButton>
            </div>
          )}
        </div>
      )}

      {/* ======================================================
          REVENUE OPPORTUNITY (Pro-Only Advanced Analysis)
      ====================================================== */}

      {largestRevenueLeakAmount > 0 && !isPro && (
        <ProPreview
          icon="⚡"
          eyebrow="Revenue opportunity"
          title={`Potential ${fmtUsd(largestRevenueLeakAmount, 2)} opportunity`}
          description="CamCash detected revenue patterns in your platform performance."
          preview="Pro breaks down where opportunities are and what changes matter most."
          source="creator_report_revenue_opportunity"
          onUpgrade={() => handleUpgrade("creator_report_revenue_opportunity")}
        />
      )}

      {/* ======================================================
          SUPPORTER INTELLIGENCE
      ====================================================== */}

      <div
        style={{
          marginTop: SPACING.xxxl,
          marginBottom: SPACING.xxxl,
          borderRadius: RADIUS.xl,
          padding: SPACING.xl,
          background: COLORS.bgCard,
          border: BORDERS.card,
          boxShadow: SHADOWS.sm,
        }}
      >
        <SectionHeader
          eyebrow="Supporter intelligence"
          title="👑 Your Highest-Value Supporters"
          description="Your top supporter is available in Free. Pro goes deeper into who needs attention."
        />

        {topSupporter ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(235px,1fr))",
              gap: 10,
            }}
          >
            <div
              style={{
                padding: 14,
                borderRadius: 13,
                background:
                  "rgba(245,158,11,0.06)",
                border:
                  "1px solid rgba(245,158,11,0.16)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  color: C.gold,
                  textTransform: "uppercase",
                }}
              >
                👑 Top supporter
              </div>

              <div
                style={{
                  marginTop: 7,
                  fontSize: 15,
                  fontWeight: 850,
                  color: C.white,
                }}
              >
                {topSupporter.username}
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 12,
                  color: C.muted,
                }}
              >
                {fmtUsd(
                  topSupporter.usd ||
                    topSupporter.totalUSD ||
                    0,
                  2
                )} lifetime
              </div>
            </div>

            {!isPro ? (
              <ProPreview
                icon="👑"
                eyebrow="VIP intelligence"
                title="Find supporters who are cooling off"
                description="Your top spender is only part of the picture."
                preview="🔒 Pro can surface deeper supporter patterns and help identify who deserves attention next."
                source="creator_report_vip"
                onUpgrade={() =>
                  handleUpgrade(
                    "creator_report_vip"
                  )
                }
              />
            ) : (
              <div
                style={{
                  padding: 14,
                  borderRadius: 13,
                  background:
                    "rgba(16,185,129,0.05)",
                  border:
                    "1px solid rgba(16,185,129,0.14)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    color: C.green,
                    textTransform: "uppercase",
                  }}
                >
                  VIP signals
                </div>

                <div
                  style={{
                    marginTop: 7,
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: C.muted,
                  }}
                >
                  {topFanDependency
                    ? "Your supporter-dependency analytics are available from your existing data."
                    : returningVsNew
                      ? "Returning-vs-new supporter data is available."
                      : "Keep importing history to strengthen supporter signals."}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: 15,
              borderRadius: 12,
              background:
                "rgba(255,255,255,0.025)",
              border:
                "1px dashed rgba(255,255,255,0.08)",
              fontSize: 11,
              color: C.muted,
            }}
          >
            Keep importing tips and CamCash will
            start building your supporter intelligence.
          </div>
        )}
      </div>

      {/* ======================================================
          RECOMMENDED ACTIONS (Next Stream Plan)
      ====================================================== */}

      <div
        style={{
          borderRadius: RADIUS.xl,
          padding: SPACING.xl,
          background: COLORS.bgCard,
          border: BORDERS.card,
          boxShadow: SHADOWS.sm,
        }}
      >
        <SectionHeader
          eyebrow="Your next move"
          title="🎯 Recommended For Your Next Stream"
          description={
            isPro
              ? "These recommendations are based on your existing analytics."
              : "Free shows you the first useful action. Pro unlocks the deeper action layer."
          }
        />

        {nextMoves.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}
          >
            {nextMoves
              .slice(0, 3)
              .map((move, index) => {
                const unlocked =
                  isPro || index === 0

                if (unlocked) {
                  return (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 11,
                        padding: "11px 12px",
                        borderRadius: 11,
                        background:
                          "rgba(16,185,129,0.045)",
                        border:
                          "1px solid rgba(16,185,129,0.13)",
                      }}
                    >
                      <span style={{ fontSize: 16 }}>
                        {move.icon || "🎯"}
                      </span>

                      <div
                        style={{
                          flex: 1,
                          fontSize: 12,
                          lineHeight: 1.55,
                          color: C.white,
                        }}
                      >
                        {move.text}
                      </div>
                    </div>
                  )
                }

                return (
                  <LockedAction
                    key={index}
                    icon={move.icon || "🔒"}
                    title={
                      index === 1
                        ? "Reveal your next personalized action"
                        : "Reveal your advanced next-stream action"
                    }
                    description={
                      index === 1
                        ? "Pro turns your history into a specific recommendation."
                        : "Unlock the remaining recommendation from your data."
                    }
                    source={
                      index === 1
                        ? "creator_report_action_2"
                        : "creator_report_action_3"
                    }
                    onUpgrade={() =>
                      handleUpgrade(
                        index === 1
                          ? "creator_report_action_2"
                          : "creator_report_action_3"
                      )
                    }
                  />
                )
              })}
          </div>
        ) : (
          <div
            style={{
              padding: 14,
              borderRadius: 11,
              background:
                "rgba(255,255,255,0.025)",
              border:
                "1px dashed rgba(255,255,255,0.07)",
              fontSize: 11,
              lineHeight: 1.5,
              color: C.muted,
            }}
          >
            Your recommendation engine is warming up.
            Import more session history and CamCash will
            have more patterns to work with.
          </div>
        )}

        {!isPro && nextMoves.length > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 14,
              padding: "12px 13px",
              borderRadius: 12,
              background:
                "linear-gradient(90deg,rgba(236,72,153,0.07),rgba(168,85,247,0.07))",
              border:
                "1px solid rgba(236,72,153,0.14)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 850,
                  color: C.white,
                }}
              >
                Want the full action plan?
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 10,
                  color: C.muted,
                }}
              >
                Unlock the remaining recommendations
                generated from your history.
              </div>
            </div>

            <ProButton
              compact
              source="creator_report_recommended_actions"
              onClick={() =>
                handleUpgrade(
                  "creator_report_recommended_actions"
                )
              }
            >
              Unlock All Actions →
            </ProButton>
          </div>
        )}
      </div>

      {/* ======================================================
          FINAL CTA: Rich Data Upgrade Prompt (Single, Strategic)
      ====================================================== */}

      {!isPro && hasRichData && (
        <div
          style={{
            marginTop: SPACING.xxxl,
            padding: `${SPACING.xxl} ${SPACING.xl}`,
            borderRadius: RADIUS.xl,
            textAlign: "center",
            background: "linear-gradient(135deg,rgba(236,72,153,0.09),rgba(168,85,247,0.09))",
            border: BORDERS.cardPink,
            boxShadow: SHADOWS.sm,
          }}
        >
          <div style={{ fontSize: 24, marginBottom: SPACING.md }}>🚀</div>

          <div style={{ ...TYPOGRAPHY.h2, color: COLORS.textPrimary }}>
            You've given CamCash enough data to go deeper.
          </div>

          <div style={{ ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary, maxWidth: 600, margin: `${SPACING.lg} auto 0` }}>
            {fmtNumber(tipCount)} tips · {fmtNumber(meaningfulSessionCount)} sessions{platformCount ? ` · ${platformCount} platform${platformCount === 1 ? "" : "s"}` : ""}. Your history is now rich enough for advanced intelligence beyond the basic report.
          </div>

          <div style={{ marginTop: SPACING.xl }}>
            <ProButton source="creator_report_power_user" onClick={() => handleUpgrade("creator_report_power_user")}>
              Unlock Creator Pro →
            </ProButton>
          </div>
        </div>
      )}
    </div>
  )
}
