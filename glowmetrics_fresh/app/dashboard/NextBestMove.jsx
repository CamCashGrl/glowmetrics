'use client'
// ═══════════════════════════════════════════════════════════════════════════
// NEXT BEST MOVE — the dashboard's one dominant answer to "what now?"
//
// The Command Center used to be a vertical stack of equally-weighted cards,
// each with its own CTA, so nothing was primary and the creator had to read
// the whole page to find the one thing worth doing. This block is deliberately
// the loudest thing on the screen, and everything else steps down from it.
//
// WHAT IT SHOWS is chosen, not templated: buildReportDiscoveries() already
// orders the creator's canonical discoveries by evidence strength, so the
// winner is whichever one her own data supports best today. It changes as her
// data changes, which is the point.
//
// It invents nothing. Every figure is read from the discovery, and when
// nothing is claimable yet the move is the canonical nextMilestone — a real
// step ("stream a different slot twice"), never an upsell dressed as advice.
// ═══════════════════════════════════════════════════════════════════════════

import ConfidenceBadge from './ConfidenceBadge'
import { C, GRADIENT, panel, panelInset, panelHero, primaryBtn as sharedPrimaryBtn, sectionLabel } from './theme'


/**
 * @param {Object}   props
 * @param {Object}  [props.discovery] - the winning buildReportDiscoveries() entry
 * @param {Object}  [props.intelligence]
 * @param {boolean} [props.isPro]
 * @param {Function}[props.onAction]   - Pro: perform the action
 * @param {Function}[props.onUpgrade]  - Free: contextual upgrade
 * @param {Function}[props.onImport]
 */
export default function NextBestMove({
  discovery = null, intelligence = null, isPro = false,
  onAction, onUpgrade, onImport,
}) {
  const hasDiscovery = !!discovery
  const claimable = !!discovery?.claimable
  const action = discovery?.action || null

  return (
    <div style={{
      ...panelHero,
      position: 'relative', overflow: 'hidden',
      padding: '26px 26px 24px',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: GRADIENT }} />
      <div style={{ position: 'absolute', right: -90, top: -90, width: 300, height: 300, borderRadius: '50%',
                    background: 'rgba(124,92,255,0.16)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.cyan }}>
            Your next best move
          </div>
          {hasDiscovery && <ConfidenceBadge intelligence={intelligence} insight={discovery.insightId} />}
        </div>

        {hasDiscovery ? (
          <>
            <div style={{ fontSize: 12.5, color: C.text, marginBottom: 4 }}>{discovery.eyebrow}</div>
            <div style={{ fontSize: 30, fontWeight: 850, color: C.white, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 12 }}>
              {discovery.title}
            </div>

            {/* Evidence inline, small — it supports the headline, it is not the headline. */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
              {(discovery.evidence || []).slice(0, 3).map(e => (
                <div key={e.label} style={{ fontSize: 11.5, color: C.muted }}>
                  <span style={{ color: C.text, fontWeight: 700 }}>{e.value}</span> {e.label.toLowerCase()}
                </div>
              ))}
            </div>

            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.65, maxWidth: 620, marginBottom: 18 }}>
              {discovery.meaning}
            </div>

            {/* ONE action. Pro does the thing; free is asked in the discovery's
                own words via the shared contextual modal. */}
            {claimable && action ? (
              isPro ? (
                <button onClick={() => onAction?.(action)} style={primaryBtn}>{action.label} →</button>
              ) : (
                <button onClick={() => onUpgrade?.(action.source)} style={primaryBtn}>{action.label} →</button>
              )
            ) : (
              <>
                <div style={{ fontSize: 13, color: C.cyan, marginBottom: 12 }}>
                  {discovery.nextMilestone
                    ? `Next: ${discovery.nextMilestone}.`
                    : 'Keep streaming — CamCash is still comparing your windows.'}
                </div>
                {onImport && <button onClick={onImport} style={primaryBtn}>Add more history →</button>}
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 24, fontWeight: 850, color: C.white, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 10 }}>
              CamCash is still learning your business
            </div>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.65, maxWidth: 600, marginBottom: 18 }}>
              Nothing in your history has enough evidence behind it to act on yet. Import more of
              your tip history, or stream a slot you have not tried, and the first pattern will
              appear here.
            </div>
            {onImport && <button onClick={onImport} style={primaryBtn}>Import more history →</button>}
          </>
        )}
      </div>
    </div>
  )
}

const primaryBtn = {
  padding: '13px 24px', borderRadius: 100, border: 'none', cursor: 'pointer',
  background: GRADIENT, color: '#06101A', fontSize: 14, fontWeight: 850,
  boxShadow: '0 10px 30px rgba(124,92,255,0.28)',
}
