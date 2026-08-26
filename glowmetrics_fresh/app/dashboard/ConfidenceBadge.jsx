'use client'
// ═══════════════════════════════════════════════════════════════════════════
// CONFIDENCE BADGE — the dashboard's ONE evidence-strength indicator (2C-2)
//
// Replaces four local vocabularies that had drifted apart (CreatorReport's
// STATE_LABEL, CommandCenter's TIER_COPY, Performance's read of it, and
// StreamPlanner's CONF/ConfBadge). Every word rendered here comes from
// STATE_META in lib/intelligence/states.js. This file contains NO thresholds,
// NO states of its own, and performs NO analytics.
//
// THE EMPHASIS RULE (approved 2C-2): the badge is loudest where the claim is
// weakest. On a mature account almost every insight is HIGH_CONFIDENCE or
// ESTABLISHED, so equal-weight badges would be pure decoration; the value of
// this layer lands entirely on the insights that are NOT yet findings.
//   CALIBRATING / EARLY_SIGNAL / DEVELOPING -> filled chip, coloured border
//   SUPPORTED                               -> outline chip, restrained
//   HIGH_CONFIDENCE / ESTABLISHED           -> plain text, near-silent
//
// RENDERS NOTHING when intelligence is null/loading or the insight is unknown.
// An absent measurement and a measurement that found nothing are different
// claims, and only the second one is ever shown.
// ═══════════════════════════════════════════════════════════════════════════

import { badgeFor, badgeForInsight, BADGE_EMPHASIS } from '../../lib/intelligence/states'

// Dashboard token set (app/dashboard/page.js's `C`), not a new palette.
const TONE = {
  muted:  { fg: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.30)' },
  info:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.32)'  },
  good:   { fg: '#22D3EE', bg: 'rgba(34,211,238,0.10)',  border: 'rgba(34,211,238,0.28)'  },
  strong: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.26)'  },
}

/**
 * @param {Object}  props
 * @param {Object} [props.intelligence] - computeIntelligence() result
 * @param {string} [props.insight]      - insight id to read from it
 * @param {string} [props.state]        - or an INSIGHT_STATE directly
 * @param {string} [props.evidence]     - optional one-line evidence sub-label
 * @param {boolean}[props.showEmoji]
 * @param {Object} [props.style]
 */
export default function ConfidenceBadge({
  intelligence = null, insight = null, state = null,
  evidence = null, showEmoji = true, style = {},
}) {
  const badge = state ? badgeFor(state) : badgeForInsight(intelligence, insight)
  if (!badge) return null

  const tone = TONE[badge.tone] || TONE.muted
  const subtle = badge.emphasis === BADGE_EMPHASIS.SUBTLE
  const medium = badge.emphasis === BADGE_EMPHASIS.MEDIUM

  const chip = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    borderRadius: 100, whiteSpace: 'nowrap', lineHeight: 1.3,
    fontWeight: subtle ? 600 : 700,
    fontSize: subtle ? 10.5 : 11,
    letterSpacing: subtle ? '0.02em' : '0.01em',
    padding: subtle ? '1px 0' : '2px 9px',
    color: subtle ? '#8D93AA' : tone.fg,
    background: subtle ? 'transparent' : medium ? 'transparent' : tone.bg,
    border: subtle ? 'none' : `1px solid ${tone.border}`,
    ...style,
  }

  return (
    <span style={chip} title={badge.blurb}>
      {showEmoji && !subtle && <span aria-hidden="true">{badge.emoji}</span>}
      <span>{badge.label}</span>
      {evidence && (
        <span style={{ fontWeight: 500, color: '#8D93AA', fontSize: subtle ? 10.5 : 10.5 }}>
          · {evidence}
        </span>
      )}
    </span>
  )
}

/**
 * The badge plus the canonical explanation underneath it, for cards that have
 * room for a sentence. The explanation is the insight's OWN `explanation`
 * string from computeIntelligence() — never re-written here, never a threshold
 * quoted by hand.
 */
export function ConfidenceNote({ intelligence, insight, align = 'left', style = {} }) {
  const badge = badgeForInsight(intelligence, insight)
  if (!badge) return null
  const explanation = intelligence?.insights?.[insight]?.explanation || null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: align === 'right' ? 'flex-end' : 'flex-start', ...style }}>
      <ConfidenceBadge intelligence={intelligence} insight={insight} />
      {explanation && (
        <div style={{ fontSize: 10.5, color: '#8D93AA', lineHeight: 1.5, textAlign: align }}>{explanation}</div>
      )}
    </div>
  )
}
