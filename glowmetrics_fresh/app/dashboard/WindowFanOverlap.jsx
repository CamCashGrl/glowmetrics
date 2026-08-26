'use client'
// ═══════════════════════════════════════════════════════════════════════════
// DISCOVERY → FAN INTELLIGENCE  (Phase 2C-3)
//
// Connects the peak-window discovery to the fans actually observed in it.
// Every figure is READ from analytics.bestWindowFanOverlap and
// canonicalBestTimes.bestWindow. This file computes nothing.
//
// ── THE WORDING RULE ───────────────────────────────────────────────────────
// Everything stated here is an OBSERVATION about the past:
//   "5 repeat fans have tipped during this window — 3 are Top Supporters."
// Never an inference about the future. The engine produces no calibrated
// model of fan availability or intent, so this component must never say a fan
// is "likely to tip", "usually online", "prefers this time", or will earn the
// creator anything. Those sentences do not appear in this file, and
// verify-window-fan-overlap.mjs asserts they never will.
//
// ── RATE vs VOLUME ─────────────────────────────────────────────────────────
// The best window is the highest MEDIAN $/hr bucket. On a real account that
// can be four sessions and a small share of total earnings. The card states
// the window's actual earnings and session count beside the rate so a strong
// rate is never read as a strong revenue stream.
//
// ── FREE vs PRO ────────────────────────────────────────────────────────────
// Free sees the whole discovery: the window, its confidence, how many repeat
// fans were observed in it, and how many of those are Top Supporters. Pro
// opens the fan-level detail that the fan analytics layer already produces.
// Nothing is invented for Pro and the discovery itself is never hidden.
// ═══════════════════════════════════════════════════════════════════════════

import ConfidenceBadge from './ConfidenceBadge'

const C = {
  white: '#F1F5F9', text: '#94A3B8', muted: '#64748B',
  cyan: '#22D3EE', indigo: '#7C5CFF', gold: '#F59E0B',
  border: 'rgba(255,255,255,0.09)', card: 'rgba(255,255,255,0.03)',
}
const GRADIENT = 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)'

const fmtHour = (h) => {
  const hh = ((h % 24) + 24) % 24
  return hh === 0 ? '12 AM' : hh < 12 ? `${hh} AM` : hh === 12 ? '12 PM' : `${hh - 12} PM`
}
const fmtUsd0 = (v) => `$${Math.round(Number(v) || 0).toLocaleString('en-US')}`

/**
 * @param {Object}  props
 * @param {Object}  props.analytics    - aggregateRows() output
 * @param {Object} [props.intelligence]- computeIntelligence() output
 * @param {boolean}[props.isPro]
 * @param {Function}[props.onViewFans] - Pro: open the Fans tab
 * @param {Function}[props.onUpgrade]  - Free: the earned CTA
 * @param {boolean}[props.compact]     - inline variant for the Command Center
 */
export default function WindowFanOverlap({
  analytics, intelligence = null, isPro = false,
  onViewFans, onUpgrade, compact = false,
}) {
  const bestWindow = analytics?.canonicalBestTimes?.bestWindow || null
  const overlap = analytics?.bestWindowFanOverlap || null

  // No discovery yet — the card says nothing rather than inventing an empty
  // state about fans. The peak-window surfaces already explain what is
  // missing (see ConfidenceBadge's nextMilestone line).
  if (!bestWindow) return null

  const count = overlap?.count || 0
  const topSupporters = overlap?.topSupporterCount || 0
  const fans = overlap?.fans || []
  const windowUSD = overlap?.windowUSD ?? bestWindow.totalUsd ?? 0
  const sessions = overlap?.windowSessionCount ?? bestWindow.sessionCount ?? 0

  const windowLabel = `${bestWindow.localDay}s · ${fmtHour(bestWindow.localHour)}–${fmtHour(bestWindow.localHour + 2)}`

  // OBSERVED, past tense, no inference. Singular/plural handled so the
  // sentence is never grammatically odd on a one-fan account.
  const headline = count === 0
    ? 'No repeat fan has tipped during this window yet.'
    : `${count} repeat fan${count === 1 ? ' has' : 's have'} tipped during this window`
  const supporterClause = count > 0 && topSupporters > 0
    ? `${topSupporters} ${topSupporters === 1 ? 'is' : 'are'} among your Top Supporters.`
    : count > 0
      ? 'None of them rank among your Top Supporters yet.'
      : null

  return (
    <div style={{
      borderRadius: 16, border: `1px solid ${C.border}`, background: C.card,
      padding: compact ? '16px 18px' : '20px 22px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: GRADIENT }} />

      {/* ── THE DISCOVERY ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted }}>
          Your strongest streaming window
        </div>
        <ConfidenceBadge intelligence={intelligence} insight="peak_window" />
      </div>
      <div style={{ fontSize: compact ? 18 : 21, fontWeight: 800, color: C.white, letterSpacing: '-0.02em', marginBottom: 6 }}>
        {windowLabel}
      </div>

      {/* Rate, volume and evidence stated separately and explicitly. The
          window earns the most PER HOUR; that is not a claim about how much
          of the creator's money came from it. */}
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
        Highest median rate at <strong style={{ color: C.cyan }}>${bestWindow.medianUsdPerHour}/hr</strong>
        {' · '}measured over <strong style={{ color: C.text }}>{sessions} session{sessions === 1 ? '' : 's'}</strong>
        {windowUSD > 0 && <> · <strong style={{ color: C.text }}>{fmtUsd0(windowUSD)}</strong> earned in it so far</>}
      </div>

      {/* ── WHO SHOWS UP DURING IT ──────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.white, marginBottom: 7 }}>
          Who shows up during it?
        </div>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }}>
          <strong style={{ color: C.white }}>{headline}</strong>
          {supporterClause && <> — {supporterClause}</>}
        </div>

        {count > 0 && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.55 }}>
            Counted from tips actually recorded in this window. It does not mean these fans are
            online at this time or that they will tip again.
          </div>
        )}

        {/* ── PRO: the fan-level detail the analytics layer already holds ── */}
        {count > 0 && isPro && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 13 }}>
              {fans.map(f => (
                <span key={f.username} style={{
                  fontSize: 12, padding: '6px 12px', borderRadius: 20, overflowWrap: 'anywhere',
                  background: f.isTopSupporter ? 'rgba(124,92,255,0.12)' : 'rgba(34,211,238,0.10)',
                  border: `1px solid ${f.isTopSupporter ? 'rgba(124,92,255,0.30)' : 'rgba(34,211,238,0.25)'}`,
                  color: f.isTopSupporter ? C.indigo : C.cyan,
                }}>
                  {f.isTopSupporter && '👑 '}{f.username} · {f.tipCount} tip{f.tipCount === 1 ? '' : 's'}
                </span>
              ))}
              {count > fans.length && (
                <span style={{ fontSize: 12, padding: '6px 12px', color: C.muted }}>
                  +{count - fans.length} more
                </span>
              )}
            </div>
            {onViewFans && (
              <button onClick={onViewFans} style={{
                marginTop: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                color: C.white, fontSize: 12.5, fontWeight: 700,
              }}>
                Open these fans in Fans →
              </button>
            )}
          </>
        )}

        {/* ── FREE: the CTA is earned by the discovery above it ────
            It names what CamCash just found before it names Pro, and it
            promises only what the fan analytics layer already produces. */}
        {count > 0 && !isPro && onUpgrade && (
          <div style={{
            marginTop: 13, padding: '13px 15px', borderRadius: 12,
            background: 'rgba(124,92,255,0.07)', border: '1px solid rgba(124,92,255,0.22)',
          }}>
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, marginBottom: 10 }}>
              See which fans are behind the pattern and explore their recorded activity —
              tip cadence, last seen, and re-engagement timing — with Pro.
            </div>
            <button onClick={() => onUpgrade('window_fan_overlap')} style={{
              padding: '9px 18px', borderRadius: 100, border: 'none', cursor: 'pointer',
              background: GRADIENT, color: '#06101A', fontSize: 12.5, fontWeight: 800,
            }}>
              Unlock fan detail with Pro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
