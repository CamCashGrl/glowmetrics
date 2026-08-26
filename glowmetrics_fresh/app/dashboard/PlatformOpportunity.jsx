'use client'
// ═══════════════════════════════════════════════════════════════════════════
// CROSS-PLATFORM DISCOVERY → CONTEXTUAL CONVERSION  (Phase 2C-6)
//
// Turns the existing, evidence-gated platform comparison into an opportunity
// the creator can act on. It renders one of three states, decided entirely by
// canonical outputs — this file holds no ranking rule and no threshold:
//
//   2+ rankable platforms   the observed comparison, then the Pro action
//   1 rankable platform     what has been measured, and what is still missing
//   0 / no comparison       nothing, or the evidence-building state
//
// "Rankable" is NOT re-derived here. analytics.rankablePlatforms is the same
// array bestPlatformByRate is chosen from (median $/hr > 0, not the Unknown
// bucket, and calculateConfidence() at Medium or better — the gate added in
// the platform-confidence work). Re-implementing that filter in the UI is
// exactly how two definitions of "best platform" drift apart.
//
// ── FOUR THINGS THAT STAY DISTINCT ────────────────────────────────────────
//   historical earnings · historical $/hr · session count · confidence
// They are rendered as four separate figures. A higher observed rate is never
// collapsed into "you earn more there", and never into a claim about a future
// stream. The copy says "your recorded sessions show a stronger observed
// rate", and nothing stronger than that.
//
// It creates no recommendation engine: it does not tell a creator to move
// time, abandon a platform, or expect a gain. Pro opens the comparison that
// already exists.
// ═══════════════════════════════════════════════════════════════════════════

import ConfidenceBadge from './ConfidenceBadge'

const C = {
  white: '#F1F5F9', text: '#94A3B8', muted: '#64748B',
  cyan: '#22D3EE', indigo: '#7C5CFF',
  border: 'rgba(255,255,255,0.09)', card: 'rgba(255,255,255,0.03)',
}
const GRADIENT = 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)'
const fmtUsd0 = (v) => `$${Math.round(Number(v) || 0).toLocaleString('en-US')}`
const fmtHours = (h) => `${Number(h) >= 10 ? Math.round(h) : (Number(h) || 0).toFixed(1)}h`

/**
 * @param {Object}   props
 * @param {Object}   props.analytics
 * @param {Object}  [props.intelligence]
 * @param {boolean} [props.isPro]
 * @param {Function}[props.onComparePlatforms] - Pro: existing comparison
 * @param {Function}[props.onUpgrade]          - Free: the 2C-4 modal
 * @param {Function}[props.onImport]
 * @param {boolean} [props.compact]
 */
export default function PlatformOpportunity({
  analytics, intelligence = null, isPro = false,
  onComparePlatforms, onUpgrade, onImport, compact = false,
}) {
  const rankable = analytics?.rankablePlatforms || []
  const allPlatforms = (analytics?.platforms || []).filter(p => p.platform !== 'Unknown')
  const insight = intelligence?.insights?.cross_platform || null
  const state = insight?.state || null

  // Nothing measured on any platform: no discovery, and nothing to say.
  if (allPlatforms.length === 0) return null

  const shell = {
    borderRadius: 16, border: `1px solid ${C.border}`, background: C.card,
    padding: compact ? '16px 18px' : '20px 22px', position: 'relative', overflow: 'hidden',
  }

  const PlatformRow = ({ p, lead }) => (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: 10, flexWrap: 'wrap', padding: '10px 0',
      borderTop: `1px solid ${C.border}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: lead ? C.white : C.text }}>{p.platform}</div>
        {/* Four distinct measures, never merged into one impressive number. */}
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
          {p.sessions} session{p.sessions === 1 ? '' : 's'} · {fmtHours(p.hours)} streamed · {fmtUsd0(p.totalUSD)} earned
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: lead ? C.cyan : C.text, letterSpacing: '-0.02em' }}>
          ${p.medianUsdPerHour}/hr
        </div>
        <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
          median rate · {p.confidenceLabel}
        </div>
      </div>
    </div>
  )

  // ── FEWER THAN TWO RANKABLE PLATFORMS ────────────────────────────────────
  // No comparison exists, so none is shown and nothing is sold. What HAS been
  // measured is still displayed — free stays useful — alongside what is
  // missing before a comparison would mean anything.
  if (rankable.length < 2) {
    const measured = rankable.length === 1 ? rankable[0] : null
    return (
      <div style={shell}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted }}>
            Comparing your platforms
          </div>
          <ConfidenceBadge intelligence={intelligence} insight="cross_platform" />
        </div>
        {measured && <PlatformRow p={measured} lead />}
        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.65, marginTop: measured ? 10 : 0 }}>
          {insight?.explanation || 'Only one platform has enough sessions to measure so far.'}
        </div>
        {insight?.nextMilestone?.label && (
          <div style={{ fontSize: 12, color: C.cyan, marginTop: 8, lineHeight: 1.55 }}>
            Next: {insight.nextMilestone.label}.
          </div>
        )}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.55 }}>
          A comparison needs at least two platforms whose own samples are strong enough to stand
          against each other. Until then CamCash will not name one as stronger.
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

  // ── A REAL COMPARISON ────────────────────────────────────────────────────
  const [lead, ...rest] = rankable
  const runnerUp = rest[0]
  const shown = [lead, ...rest.slice(0, compact ? 1 : 3)]

  return (
    <div style={shell}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: GRADIENT }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted }}>
          Your platforms are performing differently
        </div>
        <ConfidenceBadge intelligence={intelligence} insight="cross_platform" />
      </div>

      <div style={{ marginBottom: 12 }}>
        {shown.map(p => <PlatformRow key={p.platform} p={p} lead={p.platform === lead.platform} />)}
      </div>

      {/* The finding, stated as an observation about recorded sessions. */}
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65, marginBottom: 14 }}>
        Your recorded sessions show a stronger observed hourly rate on{' '}
        <strong style={{ color: C.white }}>{lead.platform}</strong> than on{' '}
        <strong style={{ color: C.white }}>{runnerUp.platform}</strong>. That is a difference in what
        has already happened, not a projection of what another stream would earn.
      </div>

      {isPro ? (
        onComparePlatforms && (
          <button onClick={onComparePlatforms} style={primaryBtn}>
            Compare my platforms →
          </button>
        )
      ) : (
        onUpgrade && (
          <>
            <button onClick={() => onUpgrade('platform_comparison')} style={primaryBtn}>
              Compare my platforms →
            </button>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 9, lineHeight: 1.55 }}>
              Pro compares your platform performance in more detail and shows how platform and
              streaming time interact across your recorded history.
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
