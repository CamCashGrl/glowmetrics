"use client"

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT SUCCESS — "here's what CamCash learned from that"
//
// Rendered after /api/upload confirms a successful import and
// POST /api/intelligence returns the measured before/after.
//
// THIS COMPONENT COMPUTES NOTHING. Every figure, state and requirement comes
// from the canonical intelligence layer (lib/intelligence/*), the same one the
// Creator Report reads — so the two can never show different progress. There
// is no percentage, threshold or confidence rule in this file.
//
// It also never manufactures a discovery. If the import moved nothing
// measurable, it says exactly that.
// ═══════════════════════════════════════════════════════════════════════════

// Brand tokens — CamCash cyan → purple → pink on cosmic navy.
const C = {
  cyan: "#16F4FF",
  purple: "#7C5CFF",
  pink: "#FF2BAE",
  gold: "#FFC857",
  green: "#10B981",
  white: "#FFFFFF",
  soft: "#D7D9EA",
  muted: "#8D93AA",
  faint: "#5E647C",
}
const GRAD = "linear-gradient(90deg,#16F4FF 0%,#7C5CFF 48%,#FF2BAE 100%)"

// Same vocabulary as CreatorReport — the canonical INSIGHT_STATE ladder.
const STATE_LABEL = {
  NOT_AVAILABLE: "Not available yet",
  CALIBRATING: "Calibrating",
  EARLY_SIGNAL: "Early Signal",
  DEVELOPING: "Building Pattern",
  SUPPORTED: "Supported Pattern",
  HIGH_CONFIDENCE: "High Confidence",
  ESTABLISHED: "Established",
}
const CLAIMABLE = new Set(["SUPPORTED", "HIGH_CONFIDENCE", "ESTABLISHED"])

// Human labels for the evidence counters carried in the snapshot.
const EVIDENCE_LABEL = {
  sessionsAnalyzed: "sessions analyzed",
  tipsAnalyzed: "tips analyzed",
  fansIdentified: "fans identified",
  windowsCompared: "streaming windows compared",
  platformsQualifying: "platforms measurable",
  streamedHours: "hours tracked",
}
// Order matters: sessions and windows are the evidence that actually moves
// confidence, so they lead.
const EVIDENCE_ORDER = [
  "sessionsAnalyzed",
  "windowsCompared",
  "tipsAnalyzed",
  "fansIdentified",
  "streamedHours",
  "platformsQualifying",
]

const fmtHour = (h) => {
  const H = ((h % 24) + 24) % 24
  return H === 0 ? "12 AM" : H < 12 ? `${H} AM` : H === 12 ? "12 PM" : `${H - 12} PM`
}

const card = (extra = {}) => ({
  background: "rgba(13,17,38,0.72)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 20,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  ...extra,
})

function GradientButton({ children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      className="ccis-cta"
      style={{
        background: GRAD,
        border: "none",
        borderRadius: 18,
        padding: "13px 26px",
        color: "#fff",
        fontWeight: 800,
        fontSize: 15,
        cursor: "pointer",
        boxShadow:
          "0 0 24px rgba(22,244,255,0.28), 0 0 34px rgba(255,43,174,0.26), 0 14px 34px rgba(0,0,0,0.45)",
        transition: "transform 0.15s, box-shadow 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({ children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "rgba(5,9,24,0.72)",
        border: "1px solid rgba(22,244,255,0.24)",
        borderRadius: 16,
        padding: "12px 22px",
        color: C.soft,
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── CALIBRATION MOVEMENT ───────────────────────────────────────────────────
// The before → after bar. Both numbers come from the stored snapshot and the
// freshly computed one; nothing here is interpolated or invented.
function CalibrationMove({ before, after }) {
  const moved = after > before
  return (
    <div style={card({ padding: "18px 20px", marginBottom: 14 })}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: C.muted,
          marginBottom: 12,
        }}
      >
        Report calibration
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: C.faint, fontVariantNumeric: "tabular-nums" }}>
          {before}%
        </span>
        <span style={{ fontSize: 16, color: C.muted }}>→</span>
        <span
          style={{
            fontSize: 34,
            fontWeight: 900,
            color: moved ? C.cyan : C.soft,
            fontVariantNumeric: "tabular-nums",
            textShadow: moved ? "0 0 22px rgba(22,244,255,0.45)" : "none",
          }}
        >
          {after}%
        </span>
        {moved && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: C.green,
              padding: "3px 9px",
              borderRadius: 99,
              background: "rgba(16,185,129,0.10)",
              border: "1px solid rgba(16,185,129,0.26)",
            }}
          >
            +{after - before}
          </span>
        )}
      </div>

      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: 99,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        {/* the portion that already existed */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${Math.max(before, 2)}%`,
            background: "rgba(124,92,255,0.35)",
            borderRadius: 99,
          }}
        />
        {/* the portion this import added, revealed with a slow sweep */}
        <div
          className="ccis-bar"
          style={{
            position: "absolute",
            inset: 0,
            width: `${Math.max(after, 2)}%`,
            background: GRAD,
            borderRadius: 99,
          }}
        />
      </div>
    </div>
  )
}

// ── THE DISCOVERY ──────────────────────────────────────────────────────────
// Only rendered when the intelligence layer actually says a window exists.
// The heading, the confidence label and the "what would help" line are all
// read from the insight entry.
function DiscoveryCard({ insight, window: win, isPro, onUpgrade }) {
  if (!win) return null
  const state = insight?.state || "CALIBRATING"
  const claimable = CLAIMABLE.has(state)
  const hourLabel = `${fmtHour(win.localHour)}–${fmtHour((win.localHour + 2) % 24)}`

  return (
    <div
      className="ccis-discovery"
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: "22px 24px",
        marginBottom: 14,
        background: claimable
          ? "linear-gradient(135deg,rgba(255,200,87,0.10),rgba(255,43,174,0.07))"
          : "linear-gradient(135deg,rgba(22,244,255,0.08),rgba(124,92,255,0.06))",
        border: `1px solid ${claimable ? "rgba(255,200,87,0.30)" : "rgba(22,244,255,0.22)"}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: claimable ? C.gold : C.cyan,
          marginBottom: 10,
        }}
      >
        {claimable ? "🔥 New insight unlocked" : "🌱 A pattern is forming"}
      </div>

      <div style={{ fontSize: 26, fontWeight: 900, color: C.white, lineHeight: 1.15, marginBottom: 4 }}>
        {win.localDay} · {hourLabel}
      </div>

      {win.topPlatform && (
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 11 }}>{win.topPlatform}</div>
      )}

      <div
        style={{
          display: "inline-block",
          padding: "4px 12px",
          borderRadius: 99,
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: claimable ? C.gold : C.cyan,
          background: claimable ? "rgba(255,200,87,0.10)" : "rgba(22,244,255,0.09)",
          border: `1px solid ${claimable ? "rgba(255,200,87,0.26)" : "rgba(22,244,255,0.22)"}`,
          marginBottom: 12,
        }}
      >
        Confidence: {STATE_LABEL[state]}
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.6, color: C.soft, maxWidth: 620 }}>
        {claimable
          ? insight?.explanation ||
            "Your history shows this window consistently outperforms your other comparable sessions."
          : "Your recent data gives an early signal that this may be one of your strongest windows."}
      </div>

      {!claimable && insight?.nextMilestone?.label && (
        <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: C.cyan }}>
          {insight.nextMilestone.label} to confirm the pattern.
        </div>
      )}

      {claimable && !isPro && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: C.white, marginBottom: 10 }}>
            Want CamCash to turn this discovery into a personalized streaming plan?
          </div>
          <div style={{ display: "grid", gap: 5, marginBottom: 14 }}>
            {[
              "A weekly schedule built from your own strongest windows",
              "Which platform to prioritise, and when",
              "The untested windows worth trying next",
              "Cross-platform earning comparison",
            ].map((line) => (
              <div key={line} style={{ fontSize: 12.5, color: C.soft, display: "flex", gap: 8 }}>
                <span style={{ color: C.green }}>✓</span>
                {line}
              </div>
            ))}
          </div>
          <GradientButton onClick={onUpgrade}>Unlock My Streaming Plan</GradientButton>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {object}  result       - /api/upload's success payload (rows imported)
 * @param {object}  changed      - intelligence.changed: the measured diff, or
 *                                 null when there is no baseline to compare to
 * @param {object}  calibration  - intelligence.calibration (current)
 * @param {object}  insights     - intelligence.insights (current)
 * @param {object}  bestWindow   - analytics.canonicalBestTimes.bestWindow
 * @param {object}  earlySignal  - analytics.canonicalBestTimes.earlySignal
 * @param {object}  nextMilestone- intelligence.nextMilestone
 * @param {boolean} isPro
 * @param {boolean} pending      - intelligence still being fetched
 */
export default function ImportSuccess({
  result,
  changed = null,
  calibration = null,
  insights = null,
  bestWindow = null,
  earlySignal = null,
  nextMilestone = null,
  isPro = false,
  pending = false,
  onViewReport,
  onViewDashboard,
  onImportMore,
  onUpgrade,
}) {
  const rowsImported = result?.inserted ?? result?.rows ?? 0
  const peak = insights?.peak_window || null
  const peakState = peak?.state || "NOT_AVAILABLE"
  const peakClaimable = CLAIMABLE.has(peakState)

  // The window to show, decided by the engine: a claimable one is a finding,
  // otherwise the engine's own early signal. Never both, never invented.
  const shownWindow = peakClaimable ? bestWindow : earlySignal
  const showDiscovery =
    Boolean(shownWindow) && peakState !== "NOT_AVAILABLE" && peakState !== "CALIBRATING"

  // What this import actually DISCOVERED. isDiscovery (set canonically in
  // diffSnapshots) means a pattern or prediction crossed the claimable floor —
  // a fact reaching the same floor is bookkeeping, not a finding, and must not
  // trigger the unlock moment. Falls back to newlyClaimable for a diff written
  // before isDiscovery existed.
  const discoveries = (changed?.improved || []).filter((c) =>
    c.isDiscovery ?? c.newlyClaimable
  )

  const evidenceRows = EVIDENCE_ORDER
    .filter((key) => changed?.evidenceDelta?.[key])
    .map((key) => ({ key, label: EVIDENCE_LABEL[key], ...changed.evidenceDelta[key] }))

  const hasMeasuredChange =
    evidenceRows.length > 0 || (changed?.improved?.length ?? 0) > 0

  // Honest headline. The only branch that celebrates is the one where the
  // engine says a threshold was actually crossed.
  const headline = discoveries.length
    ? "New insight unlocked"
    : hasMeasuredChange
      ? "Your report just got smarter"
      : "Your data is in"

  const subhead = discoveries.length
    ? "That import gave CamCash enough evidence to confirm something new about your streaming."
    : hasMeasuredChange
      ? "CamCash analyzed your new data and sharpened what it knows about your patterns."
      : changed
        ? "Your data was added successfully. CamCash is still building confidence in your existing patterns."
        : "Your data was added successfully and is now part of your analysis."

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 0 4px" }}>
      <style jsx>{`
        @keyframes ccisRise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ccisSweep {
          from { width: 0%; }
        }
        @keyframes ccisPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,244,255,0); }
          50%      { box-shadow: 0 0 28px 0 rgba(22,244,255,0.18); }
        }
        @keyframes ccisShimmer {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
        .ccis-root { animation: ccisRise 0.45s ease both; }
        .ccis-cta:hover { transform: translateY(-1px); }
        @media (prefers-reduced-motion: reduce) {
          .ccis-root, .ccis-discovery, .ccis-shimmer { animation: none !important; }
        }
      `}</style>

      <div className="ccis-root">
        {/* ── HEADER ───────────────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 24,
            padding: "26px 26px 24px",
            marginBottom: 14,
            background:
              "radial-gradient(circle at 18% 20%, rgba(22,244,255,0.14), transparent 46%), radial-gradient(circle at 84% 40%, rgba(255,43,174,0.13), transparent 44%), rgba(8,11,26,0.86)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow:
              "0 0 0 1px rgba(22,244,255,0.14), -22px 0 70px rgba(22,244,255,0.14), 22px 0 70px rgba(255,43,174,0.14), 0 24px 70px rgba(0,0,0,0.5)",
          }}
        >
          {/* single soft glow sweep — the brand's alternative to confetti */}
          <div
            className="ccis-shimmer"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "40%",
              height: "100%",
              background:
                "linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)",
              animation: "ccisShimmer 1.5s ease-out 0.25s both",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: C.cyan,
              marginBottom: 10,
            }}
          >
            {discoveries.length ? "✨ Creator Report updated" : "Import complete"}
          </div>

          <h2
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              color: C.white,
              margin: "0 0 8px",
            }}
          >
            {headline}
          </h2>

          <p style={{ fontSize: 14.5, lineHeight: 1.55, color: C.soft, margin: 0, maxWidth: 560 }}>
            {subhead}
          </p>

          {rowsImported > 0 && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: C.muted }}>
              {rowsImported.toLocaleString("en-US")} new row
              {rowsImported === 1 ? "" : "s"} added to your history
            </div>
          )}
        </div>

        {/* ── WHAT THIS IMPORT ADDED ───────────────────────────────── */}
        {evidenceRows.length > 0 && (
          <div style={card({ padding: "18px 20px", marginBottom: 14 })}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: C.muted,
                marginBottom: 13,
              }}
            >
              What this import added
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                gap: 10,
              }}
            >
              {evidenceRows.map((row) => (
                <div
                  key={row.key}
                  style={{
                    padding: "11px 13px",
                    borderRadius: 14,
                    background: "rgba(22,244,255,0.05)",
                    border: "1px solid rgba(22,244,255,0.14)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 900,
                      color: C.cyan,
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1.2,
                    }}
                  >
                    +{row.delta}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{row.label}</div>
                  <div style={{ fontSize: 10.5, color: C.faint, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                    {row.before} → {row.after}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CALIBRATION MOVEMENT ─────────────────────────────────── */}
        {changed && changed.pctAfter !== changed.pctBefore && (
          <CalibrationMove before={changed.pctBefore} after={changed.pctAfter} />
        )}

        {/* First import, or no stored baseline: show where they stand now
            rather than a fabricated "before". */}
        {!changed && calibration && (
          <div style={card({ padding: "18px 20px", marginBottom: 14 })}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: C.muted,
                marginBottom: 8,
              }}
            >
              Report calibration
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.cyan, fontVariantNumeric: "tabular-nums" }}>
              {calibration.pct}%
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
              {calibration.establishedCount} insight
              {calibration.establishedCount === 1 ? "" : "s"} established ·{" "}
              {calibration.buildingCount} still building
            </div>
          </div>
        )}

        {/* ── THE DISCOVERY ────────────────────────────────────────── */}
        {showDiscovery && (
          <DiscoveryCard
            insight={peak}
            window={shownWindow}
            isPro={isPro}
            onUpgrade={onUpgrade}
          />
        )}

        {/* ── WHAT TO DO NEXT — from the engine, not a template ────── */}
        {(nextMilestone?.progress?.label || peak?.nextMilestone?.label) && (
          <div
            style={card({
              padding: "16px 20px",
              marginBottom: 16,
              borderLeft: `3px solid ${C.purple}`,
            })}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: C.muted,
                marginBottom: 7,
              }}
            >
              What would help most next
            </div>
            <div style={{ fontSize: 14, color: C.white, fontWeight: 700, marginBottom: 4 }}>
              {peak?.nextMilestone?.label || nextMilestone?.progress?.label}
            </div>
            {nextMilestone?.name && (
              <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                Next milestone: {nextMilestone.emoji} {nextMilestone.name} — {nextMilestone.description}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIONS ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <GradientButton onClick={onViewReport}>View Updated Creator Report</GradientButton>
          {onViewDashboard && (
            <SecondaryButton onClick={onViewDashboard}>View Dashboard</SecondaryButton>
          )}
          <SecondaryButton onClick={onImportMore}>Import More History</SecondaryButton>
        </div>

        {pending && (
          <div style={{ marginTop: 12, fontSize: 12, color: C.faint }}>
            Updating your intelligence…
          </div>
        )}
      </div>
    </div>
  )
}
