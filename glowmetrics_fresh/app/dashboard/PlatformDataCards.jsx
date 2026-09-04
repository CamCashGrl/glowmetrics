'use client'
// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM DATA CARDS — one card per platform the creator actually streams on.
//
// The Creator Report told her what CamCash concluded but never what it had to
// work with, so a thin conclusion and a well-evidenced one looked identical.
// These cards answer, per platform: how much of your history is in, and what
// that is enough to say.
//
// It COMPUTES NOTHING. Every figure is a canonical field from
// lib/analytics.js's `platforms` array — the same entries bestPlatformByRate
// is chosen from. The confidence word is that platform's own
// confidenceLabel (calculateConfidence scoped to the platform), not a second
// opinion invented here. "Rankable" is read from rankablePlatforms rather
// than re-derived, because re-implementing that filter in a component is
// exactly how two definitions of "best platform" drift apart.
//
// The primary platform is a stated preference (profiles.primary_pro_platform),
// so it is marked, never ranked — being her main platform is not a claim
// about her earnings.
// ═══════════════════════════════════════════════════════════════════════════

import { C, panel, panelInset, sectionLabel } from './theme'

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtHour = (h) => { const H = ((h % 24) + 24) % 24; return H === 0 ? '12 AM' : H < 12 ? `${H} AM` : H === 12 ? '12 PM' : `${H - 12} PM` }

// The confidence word already carried by the platform entry, shown as a chip.
// Weak samples get the loud chip; a strong one needs no decoration. Same
// emphasis rule as ConfidenceBadge, applied to the per-platform label.
const CHIP = {
  'Very Low': { bg: 'rgba(248,113,113,0.14)', bd: 'rgba(248,113,113,0.45)', fg: C.red },
  'Low':      { bg: 'rgba(251,146,60,0.14)',  bd: 'rgba(251,146,60,0.45)',  fg: C.orange },
  'Medium':   { bg: 'rgba(34,211,238,0.12)',  bd: 'rgba(34,211,238,0.40)',  fg: C.cyan },
  'High':     { bg: 'transparent',            bd: 'transparent',            fg: C.text },
}

/**
 * @param {Object}  props
 * @param {Object}  props.analytics        - aggregateRows() output
 * @param {string} [props.primaryPlatform] - profiles.primary_pro_platform
 */
export default function PlatformDataCards({ analytics, primaryPlatform = null }) {
  const platforms = analytics?.platforms || []
  // "Unknown" is the parser's undetected bucket, not a site she streams on.
  const real = platforms.filter(p => p.platform && p.platform.toLowerCase() !== 'unknown')
  if (!real.length) return null

  const rankable = new Set((analytics?.rankablePlatforms || []).map(p => p.platform))
  const primaryKey = (primaryPlatform || '').toLowerCase()

  // Her primary first, then by how much evidence each one has behind it.
  const ordered = [...real].sort((a, b) => {
    const ap = a.platform.toLowerCase() === primaryKey ? 1 : 0
    const bp = b.platform.toLowerCase() === primaryKey ? 1 : 0
    if (ap !== bp) return bp - ap
    return (b.sessions || 0) - (a.sessions || 0)
  })

  return (
    <div style={{ ...panel, padding: 22 }}>
      <div style={{ ...sectionLabel, marginBottom: 4 }}>Your platforms</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
        What CamCash has from each platform, and what that is enough to say.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 12 }}>
        {ordered.map(p => {
          const isPrimary = p.platform.toLowerCase() === primaryKey
          const canRank = rankable.has(p.platform)
          const chip = CHIP[p.confidenceLabel] || CHIP.Medium
          return (
            <div key={p.platform} style={{
              ...panelInset,
              padding: '16px 16px 14px',
              borderColor: isPrimary ? 'rgba(34,211,238,0.45)' : C.border,
              boxShadow: isPrimary ? '0 0 22px rgba(34,211,238,0.13)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.white }}>{p.platform}</span>
                {isPrimary && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: 20, color: C.cyan,
                    background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.4)',
                  }}>Primary</span>
                )}
                {p.confidenceLabel && p.confidenceLabel !== 'High' && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: 20,
                    background: chip.bg, border: `1px solid ${chip.bd}`, color: chip.fg,
                  }}>{p.confidenceLabel} data</span>
                )}
              </div>

              {/* HOW MUCH DATA — the point of the card. */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px', marginBottom: 12 }}>
                <Stat label="tips imported" value={(p.tips || 0).toLocaleString()} />
                <Stat label="sessions" value={(p.sessions || 0).toLocaleString()} />
                <Stat label="hours streamed" value={`${Number(p.hours || 0).toFixed(1)}h`} />
                <Stat label="earned" value={fmtUsd(p.totalUSD)} color={C.cyan} />
              </div>

              {/* WHAT IT IS ENOUGH TO SAY — read from the canonical gate. */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 11, fontSize: 12, lineHeight: 1.6 }}>
                {canRank ? (
                  <span style={{ color: C.text }}>
                    Enough to compare — <strong style={{ color: C.white }}>{fmtUsd(p.medianUsdPerHour)}/hr</strong> median
                    {p.bestLocalDay != null && p.bestLocalHour != null && (
                      <>, strongest on <strong style={{ color: C.white }}>{p.bestLocalDay}s {fmtHour(p.bestLocalHour)}</strong></>
                    )}.
                  </span>
                ) : (
                  <span style={{ color: C.muted }}>
                    Not enough streaming time here yet to compare it against your other platforms. Keep
                    importing this platform and it joins the comparison.
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 800, color: color || C.white, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{label}</div>
    </div>
  )
}
