"use client"

import { useEffect } from "react"
import { badgeFor } from "../../lib/intelligence/states"
import { buildReportDiscoveries, buildReportFacts, buildReportActions } from "../../lib/reportDiscoveries"
import {
  ReportHeader, ReportDiscovery, ReportActions, ReportPro, ReportEmpty, SectionTitle,
} from "./ReportNarrative"
import { track as gtmTrack } from "../../lib/track"
import { PLATFORM_TOKEN_RATES } from "../../lib/constants"
import { resolveCurrentMonthGrowth } from "../../lib/analytics"

/*
  CREATOR REPORT
  ------------------------------------------------------------
  Progressive report experience:

  EARLY DATA
  -> report is warming up
  -> real earnings/platform information still visible
  -> tells creator exactly what more data unlocks

  DEVELOPING DATA
  -> more insights become available
  -> contextual Pro previews appear after useful discoveries

  RICH DATA
  -> advanced opportunities become visible
  -> Pro becomes the deeper action layer

  IMPORTANT:
  This component intentionally does NOT create a second analytics engine.
  It reads values already calculated by analytics.js / existing dashboard
  analytics and only controls presentation, confidence states and conversion.
*/

// ------------------------------------------------------------
// PLATFORM DISPLAY NAMES
// ------------------------------------------------------------

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
// COLORS
// ------------------------------------------------------------

const C = {
  cyan: "#22D3EE",
  pink: "#EC4899",
  purple: "#A855F7",
  gold: "#F59E0B",
  green: "#10B981",
  red: "#F87171",
  blue: "#60A5FA",
  white: "#F1F5F9",
  muted: "#94A3B8",
  dim: "#64748B",
  card: "rgba(12,16,34,0.78)",
  card2: "rgba(15,20,32,0.72)",
  border: "rgba(255,255,255,0.09)",
}

// ------------------------------------------------------------
// CONFIDENCE VOCABULARY
//
// The only place this component spells a confidence word. Values are the
// canonical INSIGHT_STATE ladder from lib/intelligence/states.js — this map
// is presentation only and introduces no new state, threshold or ordering.
// ------------------------------------------------------------

// 2C-2: the local confidence-word table is gone. Every confidence word now
// comes from STATE_META via badgeFor() (lib/intelligence/states.js), so the
// Creator Report, the Command Center, Performance and the Stream Planner can
// no longer describe the same state with four different words.
const stateWord = (state) => badgeFor(state)?.label || null

// The report's three existing bands (computed unchanged below from tip and
// session counts) expressed in the canonical vocabulary. A PRESENTATION map
// only — it creates no threshold and moves no band boundary. Before 2C-2 the
// calibration pill looked the band up in the seven-state table, and because a
// band is "warming"/"developing"/"rich" rather than an INSIGHT_STATE, the
// lookup always missed and every account saw "Calibrating".
const REPORT_BAND_STATE = {
  warming: "CALIBRATING",
  developing: "DEVELOPING",
  rich: "SUPPORTED",
}

// States at which a finding may be stated as fact rather than hedged. Mirrors
// CLAIMABLE_FLOOR (SUPPORTED) — below this the copy must never say "best",
// "peak" or "your strongest".
const CLAIMABLE = new Set(["SUPPORTED", "HIGH_CONFIDENCE", "ESTABLISHED"])

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

// ------------------------------------------------------------
// STAT CARD
// ------------------------------------------------------------

const STAT_ACCENTS = [
  { accent: "#F472B6", glow: "rgba(244,114,182,0.12)" },
  { accent: "#22D3EE", glow: "rgba(34,211,238,0.12)" },
  { accent: "#A78BFA", glow: "rgba(167,139,250,0.12)" },
  { accent: "#FBBF24", glow: "rgba(251,191,36,0.12)" },
]

function StatCard({
  icon,
  label,
  value,
  sub,
  index = 0,
  status = null,
}) {
  const style = STAT_ACCENTS[index % STAT_ACCENTS.length]

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        minWidth: 0,
        borderRadius: 16,
        padding: "15px 16px",
        background: C.card2,
        border: `1px solid ${C.border}`,
        backdropFilter: "blur(20px)",
        animation: `fadeUp 0.3s ease ${index * 0.05}s both`,
        boxShadow: `0 10px 35px ${style.glow}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg,${style.accent}90,${style.accent}10)`,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 7,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: C.muted,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          {label}
        </span>

        <span style={{ fontSize: 16, opacity: 0.8 }}>
          {icon}
        </span>
      </div>

      <div
        style={{
          fontSize: "clamp(18px, 2vw, 23px)",
          lineHeight: 1.15,
          fontWeight: 900,
          color: status === "warming" ? C.muted : style.accent,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>

      {sub && (
        <div
          style={{
            marginTop: 5,
            fontSize: 11,
            lineHeight: 1.45,
            color: C.dim,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// SECTION HEADER
// ------------------------------------------------------------

function SectionHeader({
  eyebrow,
  title,
  description,
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      {eyebrow && (
        <div
          style={{
            marginBottom: 4,
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: C.cyan,
          }}
        >
          {eyebrow}
        </div>
      )}

      <div
        style={{
          fontSize: 16,
          fontWeight: 850,
          color: C.white,
        }}
      >
        {title}
      </div>

      {description && (
        <div
          style={{
            marginTop: 4,
            maxWidth: 680,
            fontSize: 12,
            lineHeight: 1.55,
            color: C.muted,
          }}
        >
          {description}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// PRO CTA
// ------------------------------------------------------------

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
        border: "1px solid rgba(236,72,153,0.25)",
        borderRadius: compact ? 9 : 11,
        padding: compact ? "8px 13px" : "10px 17px",
        cursor: "pointer",
        fontSize: compact ? 11 : 12,
        fontWeight: 850,
        color: "#fff",
        background:
          "linear-gradient(90deg,#EC4899,#A855F7)",
        boxShadow: "0 8px 25px rgba(236,72,153,0.18)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  )
}

// ------------------------------------------------------------
// WARMING / CALIBRATION HEADER
// ------------------------------------------------------------

function CalibrationCard({
  calibration,
  reportState,
  isPro,
  onImport,
  nextEvidence,
}) {
  /*
    READS ONLY. The local four-boolean percentage that used to live here was a
    checklist, not readiness — it disagreed with getDashboardReadiness(),
    getUnlockProgress() and getModuleLockState(), which is exactly the
    four-competing-systems problem. Everything below now comes from
    computeIntelligence() (lib/intelligence/readiness.js), the one canonical
    source, so the Creator Report, the dashboard and future surfaces cannot
    drift apart.

    `calibration.pct` is evidence-weighted: each insight contributes its weight
    in proportion to how far up the confidence ladder it has actually climbed.
    It is not "percent of a checklist ticked".
  */

  const pct = calibration?.pct ?? 0
  const ev = calibration?.evidence || {}
  const established = calibration?.establishedCount ?? 0
  const building = calibration?.buildingCount ?? 0

  // The label comes from the ladder, never from the percentage.
  const stateLabel = stateWord(REPORT_BAND_STATE[reportState]) || "Calibrating"

  let headline = "Your report is calibrating"
  let subhead =
    "CamCash is collecting evidence from your history. Nothing is being claimed yet."

  if (established >= 8) {
    headline = "🔥 Your report is fully calibrated"
    subhead =
      "CamCash has enough evidence to state your strongest patterns with confidence. Pro turns them into a plan."
  } else if (established >= 5) {
    headline = "📈 Your report just got smarter"
    subhead =
      "Several patterns in your history now have enough evidence behind them to rely on."
  } else if (established >= 2) {
    headline = "🔮 Your report is finding patterns"
    subhead =
      "You have given CamCash enough history to start identifying repeatable behaviour."
  } else if (building > 0) {
    headline = "🌱 CamCash is learning your patterns"
    subhead =
      "Early signals are showing up. More sessions will turn them into reliable patterns."
  }

  // Countable evidence, straight from the engine — never a synthetic score.
  const evidenceChips = [
    { label: "sessions analysed", value: ev.sessionsAnalyzed },
    { label: "windows compared", value: ev.windowsCompared },
    { label: "fans identified", value: ev.fansIdentified },
    { label: "hours tracked", value: ev.streamedHours },
  ].filter((chip) => Number(chip.value) > 0)

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        marginBottom: 18,
        borderRadius: 20,
        padding: "18px 20px",
        background:
          "linear-gradient(135deg,rgba(34,211,238,0.08),rgba(168,85,247,0.07),rgba(236,72,153,0.05))",
        border: "1px solid rgba(34,211,238,0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <div
            style={{
              marginBottom: 5,
              fontSize: 16,
              fontWeight: 900,
              color: C.white,
            }}
          >
            {headline}
          </div>

          <div
            style={{
              maxWidth: 680,
              fontSize: 12,
              lineHeight: 1.55,
              color: C.muted,
            }}
          >
            {subhead}
          </div>
        </div>

        <div
          style={{
            minWidth: 115,
            textAlign: "right",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            Report calibration
          </div>

          <div
            style={{
              marginTop: 2,
              fontSize: 24,
              fontWeight: 950,
              color: pct >= 75 ? C.green : C.cyan,
            }}
          >
            {pct}%
          </div>
        </div>
      </div>

      <div
        style={{
          height: 6,
          marginTop: 15,
          overflow: "hidden",
          borderRadius: 99,
          background: "rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            width: `${Math.max(pct, 7)}%`,
            height: "100%",
            borderRadius: 99,
            background:
              "linear-gradient(90deg,#22D3EE,#A855F7,#EC4899)",
            transition: "width 0.5s ease",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 13,
        }}
      >
        <span
          style={{
            padding: "5px 11px",
            borderRadius: 99,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: C.cyan,
            background: "rgba(34,211,238,0.09)",
            border: "1px solid rgba(34,211,238,0.22)",
          }}
        >
          {stateLabel}
        </span>

        {evidenceChips.map((chip) => (
          <span
            key={chip.label}
            style={{
              padding: "5px 11px",
              borderRadius: 99,
              fontSize: 10.5,
              fontWeight: 600,
              color: C.muted,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <strong style={{ color: C.white, fontWeight: 800 }}>
              {chip.value}
            </strong>{" "}
            {chip.label}
          </span>
        ))}
      </div>

      {!isPro && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 15,
            paddingTop: 13,
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: C.muted,
            }}
          >
            {nextEvidence
              ? `Next: ${nextEvidence.label} to strengthen ${nextEvidence.insightLabel.toLowerCase()}.`
              : "Keep importing history and CamCash keeps sharpening these patterns."}
          </div>

          <button
            onClick={onImport}
            style={{
              border: "1px solid rgba(34,211,238,0.2)",
              borderRadius: 9,
              padding: "8px 13px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 800,
              color: C.cyan,
              background: "rgba(34,211,238,0.07)",
            }}
          >
            Import More History
          </button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// PEAK WINDOW — the report's headline discovery
//
// Three states, all decided by the intelligence layer:
//   claimable      -> a real finding, stated plainly, then the Pro CTA
//   early signal   -> the engine's own canonicalBestTimes.earlySignal,
//                     labelled as provisional and never called a peak
//   neither        -> calibrating, with the exact evidence still required
//
// No threshold, confidence or window is computed here.
// ------------------------------------------------------------

function PeakWindowCard({
  claimable,
  window: win,
  earlySignal,
  state,
  evidence,
  platformLabel,
  isPro,
  onUpgrade,
  onImport,
}) {
  const shown = claimable ? win : earlySignal
  const hourLabel = shown
    ? `${fmtHour(shown.localHour)}–${fmtHour((shown.localHour + 2) % 24)}`
    : null

  const accent = claimable ? C.gold : C.cyan
  const bg = claimable
    ? "linear-gradient(135deg,rgba(245,158,11,0.10),rgba(236,72,153,0.06))"
    : "linear-gradient(135deg,rgba(34,211,238,0.07),rgba(168,85,247,0.05))"

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        marginBottom: 18,
        borderRadius: 20,
        padding: "20px 22px",
        background: bg,
        border: `1px solid ${claimable ? "rgba(245,158,11,0.28)" : "rgba(34,211,238,0.18)"}`,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 900,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 9,
        }}
      >
        {claimable
          ? "🔥 We found your peak streaming window"
          : shown
            ? "🌱 Your strongest window so far"
            : "⏳ Finding your peak window"}
      </div>

      {shown ? (
        <>
          <div
            style={{
              fontSize: 24,
              fontWeight: 950,
              color: C.white,
              lineHeight: 1.2,
              marginBottom: 3,
            }}
          >
            {shown.localDay} · {hourLabel}
          </div>

          {platformLabel && (
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>
              {platformLabel}
            </div>
          )}

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 11px",
              borderRadius: 99,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: accent,
              background: claimable
                ? "rgba(245,158,11,0.10)"
                : "rgba(34,211,238,0.09)",
              border: `1px solid ${claimable ? "rgba(245,158,11,0.26)" : "rgba(34,211,238,0.22)"}`,
              marginBottom: 11,
            }}
          >
            Confidence: {stateWord(state) || "Calibrating"}
          </div>

          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.6,
              color: C.muted,
              maxWidth: 620,
            }}
          >
            {claimable
              ? evidence?.explanation ||
                "Your history shows this window consistently outperforms your other comparable sessions."
              : "Still building confidence — this is your strongest window so far, not yet a confirmed pattern."}
          </div>

          {!claimable && evidence?.nextMilestone?.label && (
            <div
              style={{
                marginTop: 9,
                fontSize: 11.5,
                color: C.cyan,
                fontWeight: 700,
              }}
            >
              {evidence.nextMilestone.label} to confirm it.
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.6,
            color: C.muted,
            maxWidth: 620,
          }}
        >
          {evidence?.explanation ||
            "CamCash needs a few more qualifying sessions before it can identify a reliable earning window."}
          {evidence?.nextMilestone?.label && (
            <span style={{ color: C.cyan, fontWeight: 700 }}>
              {" "}
              {evidence.nextMilestone.label}.
            </span>
          )}
        </div>
      )}

      {claimable && !isPro && (
        <div
          style={{
            marginTop: 15,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: C.white,
              marginBottom: 8,
            }}
          >
            Want CamCash to turn this into your personalized streaming plan?
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "5px 16px",
              marginBottom: 13,
            }}
          >
            {[
              "A weekly schedule built around your own windows",
              "Which platform to prioritise, and when",
              "The windows worth testing next",
            ].map((line) => (
              <div
                key={line}
                style={{
                  fontSize: 11.5,
                  color: C.muted,
                  display: "flex",
                  gap: 6,
                }}
              >
                <span style={{ color: C.green }}>✓</span>
                {line}
              </div>
            ))}
          </div>

          <ProButton onClick={onUpgrade}>
            Unlock My Personalized Plan
          </ProButton>
        </div>
      )}

      {!claimable && (
        <button
          onClick={onImport}
          style={{
            marginTop: 14,
            border: "1px solid rgba(34,211,238,0.2)",
            borderRadius: 9,
            padding: "8px 13px",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 800,
            color: C.cyan,
            background: "rgba(34,211,238,0.07)",
          }}
        >
          Import More History
        </button>
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

// ------------------------------------------------------------
// INSIGHT STATE CARD
// ------------------------------------------------------------

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
        minHeight: 118,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 15,
        borderRadius: 15,
        background: isWarming
          ? "rgba(255,255,255,0.025)"
          : "rgba(16,185,129,0.045)",
        border: `1px solid ${
          isWarming
            ? "rgba(255,255,255,0.07)"
            : "rgba(16,185,129,0.15)"
        }`,
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>{icon}</span>

          <span
            style={{
              fontSize: 10,
              fontWeight: 850,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {title}
          </span>

          <span
            style={{
              marginLeft: "auto",
              padding: "3px 6px",
              borderRadius: 20,
              fontSize: 8,
              fontWeight: 900,
              color: isWarming ? C.gold : C.green,
              background: isWarming
                ? "rgba(245,158,11,0.08)"
                : "rgba(16,185,129,0.08)",
            }}
          >
            {isWarming ? "WARMING UP" : "READY"}
          </span>
        </div>

        <div
          style={{
            marginTop: 11,
            fontSize: 13,
            lineHeight: 1.5,
            color: isWarming ? C.muted : C.white,
          }}
        >
          {children}
        </div>
      </div>

      {footer && (
        <div
          style={{
            marginTop: 10,
            fontSize: 10,
            color: C.dim,
          }}
        >
          {footer}
        </div>
      )}

      {isWarming && onImport && (
        <button
          onClick={onImport}
          style={{
            alignSelf: "flex-start",
            marginTop: 9,
            padding: "6px 9px",
            borderRadius: 7,
            cursor: "pointer",
            border:
              "1px solid rgba(34,211,238,0.14)",
            color: C.cyan,
            background: "rgba(34,211,238,0.05)",
            fontSize: 9,
            fontWeight: 800,
          }}
        >
          Import more history →
        </button>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// PRO PREVIEW
// ------------------------------------------------------------

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
        borderRadius: 16,
        padding: 17,
        background:
          "linear-gradient(135deg,rgba(168,85,247,0.07),rgba(236,72,153,0.055))",
        border:
          "1px solid rgba(168,85,247,0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            borderRadius: 10,
            background: "rgba(168,85,247,0.10)",
            border:
              "1px solid rgba(168,85,247,0.18)",
            fontSize: 16,
          }}
        >
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 900,
              color: C.purple,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>

          <div
            style={{
              marginTop: 3,
              fontSize: 13,
              fontWeight: 850,
              color: C.white,
            }}
          >
            {title}
          </div>

          {description && (
            <div
              style={{
                marginTop: 5,
                fontSize: 11,
                lineHeight: 1.5,
                color: C.muted,
              }}
            >
              {description}
            </div>
          )}

          {preview && (
            <div
              style={{
                marginTop: 10,
                padding: "9px 10px",
                borderRadius: 9,
                background:
                  "rgba(0,0,0,0.15)",
                border:
                  "1px solid rgba(255,255,255,0.05)",
                fontSize: 11,
                lineHeight: 1.5,
                color: C.white,
              }}
            >
              {preview}
            </div>
          )}

          <div style={{ marginTop: 11 }}>
            <ProButton
              compact
              source={source}
              onClick={onUpgrade}
            >
              Unlock with Pro →
            </ProButton>
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// LOCKED ACTION
// ------------------------------------------------------------

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
        gap: 11,
        padding: "11px 12px",
        borderRadius: 11,
        background: "rgba(168,85,247,0.045)",
        border:
          "1px solid rgba(168,85,247,0.12)",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
          borderRadius: 8,
          background: "rgba(168,85,247,0.08)",
          fontSize: 13,
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.white,
          }}
        >
          {title}
        </div>

        {description && (
          <div
            style={{
              marginTop: 2,
              fontSize: 10,
              lineHeight: 1.4,
              color: C.muted,
            }}
          >
            {description}
          </div>
        )}
      </div>

      <ProButton
        compact
        source={source}
        onClick={onUpgrade}
      >
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
  // The canonical readiness object (computeIntelligence()), passed in by
  // page.js from the same analytics this component already reads. This
  // component never computes confidence, progress or thresholds itself.
  intelligence = null,
  timezone = "UTC",
  firstName = null,
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

  // ── CANONICAL INTELLIGENCE ────────────────────────────────
  // Every confidence state below is read, never derived. The local
  // `hourlyRateUnlocked` rule that used to sit here duplicated
  // canShowHourlyRate() / getModuleLockState('avgHourlyRate'); it now comes
  // from the one intelligence layer instead.
  const insightStates = intelligence?.insights || {}
  const stateOf = (id) => insightStates[id]?.state || "NOT_AVAILABLE"
  const evidenceOf = (id) => insightStates[id] || null
  const isClaimable = (id) => CLAIMABLE.has(stateOf(id))

  const hourlyRateUnlocked = isClaimable("hourly_rate")

  // monthlyData only holds months that HAVE data, so its last entry is NOT
  // necessarily the current calendar month. Reading it directly meant a
  // creator with no tips yet this month saw LAST month's growth labelled as
  // this month's. resolveCurrentMonthGrowth() (lib/analytics.js) is the same
  // answer the dashboard uses, so the two surfaces cannot disagree.
  const growth = resolveCurrentMonthGrowth(monthlyData, timezone)
  const monthGrowthPct = growth.growthPct
  const growthStatus = growth.status

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

  // ── PEAK WINDOW: three honest states, decided by the engine ──────────
  // SUPPORTED+  -> a real finding, may be called a peak window
  // below that  -> canonicalBestTimes.earlySignal, the engine's own
  //                "strongest window so far, not yet reliable" answer.
  //                Surfacing it is what makes the low-data report feel like a
  //                system warming up rather than an empty page — and it needs
  //                no new analytic, only rendering.
  // neither     -> calibrating, with the exact remaining requirement
  const peakWindowState = stateOf("peak_window")
  const peakWindowEvidence = evidenceOf("peak_window")
  const peakWindowIsClaimable = isClaimable("peak_window")

  const hasBestWindow = Boolean(canonicalBestWindow) && peakWindowIsClaimable

  const earlySignalWindow =
    !peakWindowIsClaimable
      ? safeAnalytics.canonicalBestTimes?.earlySignal || canonicalBestWindow || null
      : null

  // The overall label for the report header — the peak window is the report's
  // headline insight, so its state is the report's state, with the account's
  // own calibration as the floor.
  const overallReportState =
    (intelligence?.calibration?.establishedCount ?? 0) >= 5 && peakWindowIsClaimable
      ? "HIGH_CONFIDENCE"
      : peakWindowState

  // "What would most improve confidence next", ranked by the engine.
  const nextEvidence = intelligence?.calibration?.nextBestEvidence?.[0] || null

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

  // Presence of a value is not permission to call it a finding. Both cards
  // now require their insight to be at SUPPORTED or above; below that they
  // show the calibrating copy, which is what stops the report claiming a
  // "best day" from a single lucky night.
  const bestDayReady =
    Boolean(canonicalBestWindow?.localDay) && isClaimable("peak_day")

  const bestTimeReady =
    Boolean(canonicalBestWindow?.localHour != null) && peakWindowIsClaimable

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

  // ── THE REPORT'S OWN DATA ─────────────────────────────────
  // Read, ordered and gated by lib/reportDiscoveries.js. No metric, threshold
  // or confidence is computed in this component.
  const reportDiscoveries = buildReportDiscoveries({ analytics: safeAnalytics, intelligence })
  const reportFacts = buildReportFacts({ analytics: safeAnalytics, tips })
  const reportActions = buildReportActions(reportDiscoveries)

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

    onUpgrade?.(source)
  }

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <div>
      {/* ══ THE REPORT ═══════════════════════════════════════════════
          A generated document, not another tab of cards: header naming the
          creator's own data range, then her discoveries strongest-first, each
          told as discovery -> evidence -> what it means -> what to do with it.
          Every value is read from buildReportDiscoveries(), which gates each
          claim on the canonical ladder. The detailed dashboard sections that
          used to open this page now sit BELOW it as supporting reference. */}
      <ReportHeader facts={reportFacts} calibration={intelligence?.calibration} firstName={firstName} />

      <SectionTitle>What we learned</SectionTitle>
      {reportDiscoveries.length > 0 ? (
        reportDiscoveries.map((d, i) => (
          <ReportDiscovery key={d.id} discovery={d} index={i} intelligence={intelligence} />
        ))
      ) : (
        <ReportEmpty facts={reportFacts} nextEvidence={nextEvidence} onImport={handleImport} />
      )}

      <ReportActions
        actions={reportActions}
        isPro={isPro}
        onAction={(a) => handleUpgrade(a.source)}
        onUpgrade={(source) => handleUpgrade(source)}
      />

      {!isPro && <ReportPro actions={reportActions} onUpgrade={(source) => handleUpgrade(source)} />}

      {/* ══ SUPPORTING DETAIL ════════════════════════════════════════
          Everything below is the same reference material as before, kept
          intact and demoted beneath the narrative. */}
      <div style={{ marginTop: 44, paddingTop: 26, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <SectionTitle>The numbers behind it</SectionTitle>
      </div>

      {/* ======================================================
          CORE NUMBERS
      ====================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(175px,1fr))",
          gap: 11,
          marginBottom: 19,
        }}
      >
        <StatCard
          index={0}
          icon="💰"
          label="Total Earnings"
          value={fmtUsd(totalUSD)}
          sub={
            growthStatus === "current" && monthGrowthPct !== null
              ? `${monthGrowthPct >= 0 ? "↑" : "↓"} ${Math.abs(monthGrowthPct)}% this month vs last`
              : growthStatus === "no_current_month"
                ? "No earnings recorded yet this month"
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
          marginBottom: 19,
          borderRadius: 18,
          padding: "17px 18px",
          background: C.card,
          border: `1px solid ${C.border}`,
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
          WHAT YOUR DATA IS SAYING
      ====================================================== */}

      <div
        style={{
          marginBottom: 19,
          borderRadius: 18,
          padding: "17px 18px",
          background: C.card,
          border: `1px solid ${C.border}`,
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
            gridTemplateColumns:
              "repeat(auto-fit,minmax(235px,1fr))",
            gap: 10,
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
              : evidenceOf("peak_day")?.nextMilestone?.label
                ? `${evidenceOf("peak_day").nextMilestone.label} before CamCash can isolate your strongest day.`
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
              : peakWindowEvidence?.nextMilestone?.label
                ? `${peakWindowEvidence.nextMilestone.label} before this window can be confirmed.`
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
          "WE FOUND SOMETHING"
      ====================================================== */}

      {positiveInsight && (
        <div
          style={{
            marginBottom: 19,
            padding: "16px 18px",
            borderRadius: 17,
            background:
              "linear-gradient(135deg,rgba(16,185,129,0.08),rgba(34,211,238,0.04))",
            border:
              "1px solid rgba(16,185,129,0.18)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: C.green,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            🔎 CamCash found something
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 14,
              lineHeight: 1.6,
              color: C.white,
            }}
          >
            {positiveInsight.text}
          </div>

          {!isPro && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 12,
                paddingTop: 11,
                borderTop:
                  "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  lineHeight: 1.5,
                  color: C.muted,
                }}
              >
                Pro can turn this pattern into a
                specific next-stream action.
              </div>

              <ProButton
                compact
                source="creator_report_pattern_found"
                onClick={() =>
                  handleUpgrade(
                    "creator_report_pattern_found"
                  )
                }
              >
                Show Me What To Do →
              </ProButton>
            </div>
          )}
        </div>
      )}

      {/* ======================================================
          REVENUE OPPORTUNITY
      ====================================================== */}

      {largestRevenueLeakAmount > 0 ? (
        <ProPreview
          icon="⚡"
          eyebrow="Revenue opportunity"
          title={`Potential ${fmtUsd(largestRevenueLeakAmount, 2)} opportunity detected`}
          description={`CamCash already has platform-level revenue opportunity data in your report.`}
          preview={`🔒 Pro can break down where that opportunity is coming from and what change is most likely to address it.`}
          source="creator_report_revenue_opportunity"
          onUpgrade={() =>
            handleUpgrade(
              "creator_report_revenue_opportunity"
            )
          }
        />
      ) : (
        !isPro &&
        hasRichData && (
          <ProPreview
            icon="⚡"
            eyebrow="Advanced opportunity analysis"
            title="Your history is rich enough for deeper opportunity analysis"
            description="You have enough historical sessions for CamCash to go beyond basic reporting."
            preview="🔒 Pro adds deeper platform, timing and revenue-opportunity analysis."
            source="creator_report_advanced_opportunity"
            onUpgrade={() =>
              handleUpgrade(
                "creator_report_advanced_opportunity"
              )
            }
          />
        )
      )}

      {/* ======================================================
          FAN / VIP INTELLIGENCE
      ====================================================== */}

      <div
        style={{
          marginTop: 19,
          marginBottom: 19,
          borderRadius: 18,
          padding: "17px 18px",
          background: C.card,
          border: `1px solid ${C.border}`,
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
          RECOMMENDED ACTIONS
      ====================================================== */}

      <div
        style={{
          borderRadius: 18,
          padding: "17px 18px",
          background: C.card,
          border: `1px solid ${C.border}`,
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
          "WHAT SHOULD I DO TONIGHT?"
      ====================================================== */}

      {!isPro && (
        <div
          style={{
            marginTop: 19,
            borderRadius: 18,
            padding: "17px 18px",
            background:
              "linear-gradient(135deg,rgba(34,211,238,0.06),rgba(168,85,247,0.07),rgba(236,72,153,0.06))",
            border:
              "1px solid rgba(34,211,238,0.14)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: C.cyan,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            🎯 Before your next stream
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 15,
              fontWeight: 850,
              color: C.white,
            }}
          >
            Want CamCash to build your next-stream plan?
          </div>

          <div
            style={{
              marginTop: 5,
              maxWidth: 650,
              fontSize: 11,
              lineHeight: 1.55,
              color: C.muted,
            }}
          >
            Pro can combine your historical timing,
            platform performance and supporter signals
            into a personalized action plan instead of
            leaving you to interpret the numbers yourself.
          </div>

          <div style={{ marginTop: 12 }}>
            <ProButton
              source="creator_report_next_stream_plan"
              onClick={() =>
                handleUpgrade(
                  "creator_report_next_stream_plan"
                )
              }
            >
              Build My Next-Stream Plan →
            </ProButton>
          </div>
        </div>
      )}

      {/* ======================================================
          POWER USER CONVERSION
      ====================================================== */}

      {!isPro && hasRichData && (
        <div
          style={{
            marginTop: 19,
            padding: "19px 20px",
            borderRadius: 19,
            textAlign: "center",
            background:
              "linear-gradient(135deg,rgba(236,72,153,0.09),rgba(168,85,247,0.09))",
            border:
              "1px solid rgba(236,72,153,0.19)",
          }}
        >
          <div style={{ fontSize: 21 }}>
            🚀
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 17,
              fontWeight: 900,
              color: C.white,
            }}
          >
            You've given CamCash enough data to go deeper.
          </div>

          <div
            style={{
              maxWidth: 580,
              margin: "6px auto 0",
              fontSize: 11,
              lineHeight: 1.55,
              color: C.muted,
            }}
          >
            {fmtNumber(tipCount)} tips ·{" "}
            {fmtNumber(meaningfulSessionCount)} sessions
            {platformCount
              ? ` · ${platformCount} platform${platformCount === 1 ? "" : "s"}`
              : ""}
            . Your history is now rich enough for
            advanced intelligence beyond the basic report.
          </div>

          <div style={{ marginTop: 13 }}>
            <ProButton
              source="creator_report_power_user"
              onClick={() =>
                handleUpgrade(
                  "creator_report_power_user"
                )
              }
            >
              Unlock Creator Pro →
            </ProButton>
          </div>
        </div>
      )}
    </div>
  )
}
