'use client'
// ═══════════════════════════════════════════════════════════════════════════
// DISCOVERY → PERSONALIZED STREAMING PLAN  (Phase 2C-5)
//
// Turns an already-supported peak_window discovery into the useful next
// action. It renders one of two states, decided ENTIRELY by the canonical
// ladder — this file has no threshold of its own:
//
//   claimable (SUPPORTED+)  the discovery, its evidence, and a plan CTA
//   below that              the evidence-building state, and NO Pro CTA
//
// THE SECOND STATE IS THE POINT. A creator whose window is still CALIBRATING
// does not have a reliable weekly plan to buy, so she is not asked to buy one.
// She is told exactly what evidence is still missing, in the canonical layer's
// own words (peak_window.nextMilestone).
//
// ── A PEAK WINDOW IS AN OBSERVED HISTORICAL PATTERN ───────────────────────
// Never a forecast. This file may say "your strongest observed window" and
// "the times that have performed best in your recorded history". It may never
// say a creator will earn more, should expect an amount, or is guaranteed
// anything. verify-peak-window-plan.mjs asserts the banned phrasings.
//
// It computes NOTHING: the window, its rate, its volume and its evidence
// counts are read from analytics.canonicalBestTimes and the intelligence
// object. No new scheduling engine — the Pro action opens the existing
// Stream Planner, and the free CTA opens 2C-4's ContextualUpgradeModal with
// the existing `stream_planner` context.
// ═══════════════════════════════════════════════════════════════════════════

import ConfidenceBadge from './ConfidenceBadge'

const C = {
  white: '#F1F5F9', text: '#94A3B8', muted: '#64748B',
  cyan: '#22D3EE', indigo: '#7C5CFF',
  border: 'rgba(255,255,255,0.09)', card: 'rgba(255,255,255,0.03)',
}
const GRADIENT = 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)'

const fmtHour = (h) => {
  const hh = ((Number(h) % 24) + 24) % 24
  return hh === 0 ? '12 AM' : hh < 12 ? `${hh} AM` : hh === 12 ? '12 PM' : `${hh - 12} PM`
}
const fmtUsd0 = (v) => `$${Math.round(Number(v) || 0).toLocaleString('en-US')}`

/** States at or above CLAIMABLE_FLOOR. Mirrors lib/intelligence/states.js. */
const CLAIMABLE = new Set(['SUPPORTED', 'HIGH_CONFIDENCE', 'ESTABLISHED'])

/**
 * @param {Object}   props
 * @param {Object}   props.analytics
 * @param {Object}  [props.intelligence]
 * @param {boolean} [props.isPro]
 * @param {Function}[props.onOpenPlanner]  - Pro: open the existing planner
 * @param {Function}[props.onUpgrade]      - Free: open the 2C-4 modal
 * @param {Function}[props.onImport]       - low-data: add more history
 * @param {boolean} [props.compact]
 */
export default function PeakWindowPlan({
  analytics, intelligence = null, isPro = false,
  onOpenPlanner, onUpgrade, onImport, compact = false,
}) {
  const insight = intelligence?.insights?.peak_window || null
  const state = insight?.state || null
  const bestWindow = analytics?.canonicalBestTimes?.bestWindow || null
  const earlySignal = analytics?.canonicalBestTimes?.earlySignal || null

  // Nothing measured at all, or intelligence still loading: render nothing
  // rather than an empty promise.
  if (!state || state === 'NOT_AVAILABLE') return null

  const claimable = CLAIMABLE.has(state) && !!bestWindow
  const shown = claimable ? bestWindow : earlySignal

  const windowLabel = shown
    ? `${shown.localDay} · ${fmtHour(shown.localHour)}–${fmtHour(shown.localHour + 2)}`
    : null

  const shell = {
    borderRadius: 16, border: `1px solid ${C.border}`, background: C.card,
    padding: compact ? '16px 18px' : '20px 22px', position: 'relative', overflow: 'hidden',
  }

  // ── BELOW THE CLAIMABLE FLOOR ────────────────────────────────────────────
  // The evidence-building state. No plan is offered and no upgrade is asked
  // for, because there is no genuine discovery behind either yet.
  if (!claimable) {
    return (
      <div style={shell}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted }}>
            Finding your strongest window
          </div>
          <ConfidenceBadge intelligence={intelligence} insight="peak_window" />
        </div>
        {windowLabel && (
          <div style={{ fontSize: compact ? 16 : 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            {windowLabel} <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>· too early to call</span>
          </div>
        )}
        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.65 }}>
          {insight?.explanation || 'CamCash is still collecting sessions.'}
        </div>
        {insight?.nextMilestone?.label && (
          <div style={{ fontSize: 12, color: C.cyan, marginTop: 8, lineHeight: 1.55 }}>
            Next: {insight.nextMilestone.label}.
          </div>
        )}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.55 }}>
          A weekly plan is only worth building once one window has clearly out-performed the others in your own history.
        </div>
        {onImport && (
          <button onClick={onImport} style={{
            marginTop: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
            color: C.white, fontSize: 12.5, fontWeight: 700,
          }}>Add more history</button>
        )}
      </div>
    )
  }

  // ── THE DISCOVERY, AND THE ACTION IT EARNS ───────────────────────────────
  const sessions = bestWindow.sessionCount || 0
  const compared = insight?.comparedAlternatives ?? 0
  const windowUSD = bestWindow.totalUsd || 0

  return (
    <div style={shell}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: GRADIENT }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted }}>
          Your strongest streaming window
        </div>
        <ConfidenceBadge intelligence={intelligence} insight="peak_window" />
      </div>

      <div style={{ fontSize: compact ? 19 : 22, fontWeight: 800, color: C.white, letterSpacing: '-0.02em', marginBottom: 8 }}>
        {windowLabel}
      </div>

      {/* Evidence, stated as counts. Rate and volume stay separate figures so
          a high rate is never read as a large share of earnings. */}
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>
        <strong style={{ color: C.text }}>{sessions} comparable session{sessions === 1 ? '' : 's'}</strong>
        {compared > 0 && <> · <strong style={{ color: C.text }}>{compared} window{compared === 1 ? '' : 's'} compared</strong></>}
        {' · '}<strong style={{ color: C.cyan }}>${bestWindow.medianUsdPerHour}/hr</strong> median rate
        {windowUSD > 0 && <> · <strong style={{ color: C.text }}>{fmtUsd0(windowUSD)}</strong> earned in it so far</>}
      </div>

      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65, marginBottom: 14 }}>
        Your data shows this has been your strongest observed streaming window. It is a pattern in
        what you have already recorded, not a promise about what a future stream will earn.
      </div>

      {isPro ? (
        onOpenPlanner && (
          <button onClick={onOpenPlanner} style={primaryBtn}>
            Open my weekly plan →
          </button>
        )
      ) : (
        onUpgrade && (
          <>
            <button onClick={() => onUpgrade('stream_planner')} style={primaryBtn}>
              Turn this pattern into a weekly plan →
            </button>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 9, lineHeight: 1.55 }}>
              Pro builds a schedule around the times that have performed best in your recorded history.
            </div>
          </>
        )
      )}
    </div>
  )
}

const primaryBtn = {
  padding: '11px 20px', borderRadius: 100, border: 'none', cursor: 'pointer',
  background: GRADIENT, color: '#06101A', fontSize: 13, fontWeight: 800,
}
