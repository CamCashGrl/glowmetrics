'use client'
// ═══════════════════════════════════════════════════════════════════════════
// WHAT CHANGED — the reason to come back tomorrow
//
// Reads the diff the intelligence route already computes between the creator's
// stored `last_seen_intelligence` baseline and her state right now. Nothing is
// generated for this block: if her data has not moved, it says so plainly and
// takes up two lines. A dashboard that manufactures activity to look busy is
// the opposite of what earns a daily check.
//
// The baseline advances only after this has been shown (page.js POSTs once the
// diff is in hand), so a change is never silently swallowed by the visit that
// would have reported it.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  white: '#F1F5F9', text: '#94A3B8', muted: '#64748B',
  cyan: '#22D3EE', green: '#10B981',
  border: 'rgba(255,255,255,0.09)', card: 'rgba(255,255,255,0.03)',
}

const EVIDENCE_LABEL = {
  sessionsAnalyzed: 'sessions analysed',
  tipsAnalyzed: 'tips analysed',
  fansIdentified: 'fans identified',
  windowsCompared: 'windows compared',
  platformsQualifying: 'platforms now measurable',
  streamedHours: 'hours of stream time',
}

/**
 * @param {Object}  props
 * @param {Object} [props.diff]   - diffSnapshots() output from /api/intelligence
 * @param {boolean}[props.loading]
 */
export default function WhatChanged({ diff = null, loading = false }) {
  // First ever visit: there is no baseline to compare against, so there is
  // honestly nothing to report. Render nothing rather than a hollow section.
  if (loading || !diff) return null

  const improved = (diff.improved || []).filter(c => c.isDiscovery || c.newlyClaimable)
  const evidence = Object.entries(diff.evidenceDelta || {})
    .filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => ({ key: k, value: v, label: EVIDENCE_LABEL[k] || k }))
  const pctDelta = diff.pctDelta || 0
  const nothing = improved.length === 0 && evidence.length === 0 && pctDelta === 0

  return (
    <div style={{
      borderRadius: 16, border: `1px solid ${C.border}`, background: C.card,
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: nothing ? 0 : 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted }}>
          What changed since you last checked
        </div>
        {pctDelta > 0 && (
          <div style={{ fontSize: 11.5, fontWeight: 800, color: C.green }}>
            +{pctDelta} calibration
          </div>
        )}
      </div>

      {nothing ? (
        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, marginTop: 8 }}>
          Nothing new since your last visit. Your patterns are where you left them.
        </div>
      ) : (
        <>
          {improved.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: evidence.length ? 12 : 0 }}>
              {improved.slice(0, 4).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'baseline', gap: 9, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
                  <span style={{ color: C.cyan, fontWeight: 800, flexShrink: 0 }}>→</span>
                  <span>
                    <strong style={{ color: C.white }}>{c.label}</strong>
                    {c.newlyClaimable ? ' is now supported by enough evidence to state.' : ' has stronger evidence behind it.'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {evidence.length > 0 && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {evidence.map(e => (
                <div key={e.key} style={{ fontSize: 11.5, color: C.muted }}>
                  <span style={{ color: C.green, fontWeight: 800 }}>+{e.value}</span> {e.label}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
