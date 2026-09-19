"use client"
import React from "react"

// FanCardGrid — mechanical extraction of the "ALL TIPPERS — CRM Card Grid"
// block previously inlined in app/dashboard/page.js (Top Fans / Whales tab).
// No calculation, threshold, or conditional-rendering changes — identical
// logic, just moved behind explicit props. Renders `filteredWhales` (NOT the
// full `whales` array) exactly as the original inline block did.
//
// Props:
//   filteredWhales      — whales filtered by tier/platform/day-drill (see page.js filteredWhales memo)
//   glassCard           — shared glass-card style object
//   C                   — design token object
//   TIER_COLORS         — tier -> color map
//   formatLastActive    — days-since-last-tip -> friendly phrase formatter
//   EnvelopeHeartIcon    — icon component used on the message button
//   whaleModalTriggerRef — ref set to the clicked element before opening the View Fan modal (focus restore)
//   setSelectedWhale     — opens the View Fan profile modal (stays inline in page.js, untouched)
//   setMessageTarget     — opens the message modal for a given fan
//   setMessageIndex      — resets the message-template index
//   setMessageCopied     — resets the "copied" state on the message modal
//   setNoteTarget        — opens the note modal for a given fan (by username)
export default function FanCardGrid({
  filteredWhales, glassCard, C, TIER_COLORS, formatLastActive, EnvelopeHeartIcon,
  whaleModalTriggerRef, setSelectedWhale, setMessageTarget, setMessageIndex, setMessageCopied, setNoteTarget,
}) {
  return filteredWhales.length === 0 ? (
    <div style={{ ...glassCard, borderRadius: 14, padding: 32, textAlign: 'center', marginBottom: 20 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 15, color: C.text, fontWeight: 600, marginBottom: 4 }}>No fans match this filter</div>
      <div style={{ fontSize: 12, color: C.text }}>Try a different tier or clear the platform filter</div>
    </div>
  ) : (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginBottom: 20 }}>
      {filteredWhales.map((w, i) => {
        const tc = TIER_COLORS[w.tier] || C.cyan
        const days = w.daysSinceLastTip ?? (w.lastTipDate ? Math.floor((Date.now() - new Date(w.lastTipDate)) / 86400000) : null)
        const relScore = Math.min(100, Math.round((w.tipCount * 3) + (w.totalUSD / 10) + (days < 7 ? 20 : days < 30 ? 10 : 0)))
        const scoreColor = relScore >= 70 ? C.green : relScore >= 40 ? C.gold : C.red
        // Reuse the shared behavioral-state formula from analytics.js
        // (w.behavioralState / w.behavioralStateReason) — evidence-gated
        // per Fan Intelligence rules, never a raw days-since guess.
        const bs = w.behavioralState
        const riskLevel = bs === "Active" ? { label: "Active", color: C.green, pct: 15 }
          : bs === "Watch" ? { label: "Watch", color: C.gold, pct: 55 }
          : bs === "At Risk" ? { label: "At Risk", color: C.red, pct: 85 }
          : bs === "Dormant" ? { label: "Dormant", color: C.muted, pct: 40 }
          : null // New/Developing, Insufficient Data → no risk meter at all
        const riskReason = w.behavioralStateReason || null
        return (
          <div key={i}
            className="hoverable"
            style={{ ...glassCard, borderRadius: 16, padding: 16, border: '1px solid rgba(255,255,255,0.08)', cursor: 'default', transition: 'transform 0.18s ease, box-shadow 0.18s ease' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 28px rgba(0,0,0,0.4)` }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>

            {/* TOP ROW — avatar, name, badges, score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {/* Avatar */}
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${tc}, ${tc}80)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {(w.username || '?').charAt(0).toUpperCase()}
              </div>
              {/* Name + badges */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div title={w.username} style={{ fontSize: 14, fontWeight: 700, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>{w.username}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <span style={{ padding: '1px 6px', borderRadius: 100, background: `${tc}18`, color: tc, fontSize: 9, fontWeight: 700 }}>{w.tier}</span>
                  <span style={{ padding: '1px 6px', borderRadius: 100, background: 'rgba(255,255,255,0.05)', color: C.text, fontSize: 9, fontWeight: 600 }}>{w.platform || 'Unknown'}</span>
                </div>
              </div>
              {/* Relationship score */}
              <div title="Relationship score" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', border: `2px solid ${scoreColor}45`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{relScore}</div>
              </div>
            </div>

            {/* PRIMARY METRICS — typography-led, no heavy tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', rowGap: 8, columnGap: 10, marginBottom: 12, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>${(w.totalUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style={{ fontSize: 10, color: C.text }}>Lifetime spend</div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>{(w.tipCount || 0).toLocaleString()}</div>
                <div style={{ fontSize: 10, color: C.text }}>Total tips</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.white }} title={w.lastTipDate ? new Date(w.lastTipDate).toLocaleString() : undefined}>{formatLastActive(days).replace('Last active ', '')}</div>
                <div style={{ fontSize: 10, color: C.text }}>Last active</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>${(w.avgTipSize || 0).toFixed(2)}</div>
                <div style={{ fontSize: 10, color: C.text }}>Avg. tip</div>
              </div>
            </div>

            {/* RETENTION RISK */}
            {riskLevel && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: C.text, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Retention risk</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: riskLevel.color }}>{riskLevel.label}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${riskLevel.pct}%`, borderRadius: 2, background: riskLevel.color, transition: 'width 0.4s ease' }} />
                </div>
                {riskReason && <div style={{ fontSize: 10, color: C.text, marginTop: 4 }}>{riskReason}</div>}
              </div>
            )}

            {/* ACTIONS — one primary, two secondary */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={(e) => { whaleModalTriggerRef.current = e.currentTarget; setSelectedWhale(w) }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'linear-gradient(135deg, #22D3EE, #EC4899)', border: 'none', color: '#06101A', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                title="View fan profile">View Fan</button>
              <button onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }}
                className="heart-envelope-btn"
                aria-label={`Message ${w.username}`}
                title="Message fan"
                style={{ width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(255,43,174,0.1)', border: '1px solid rgba(255,43,174,0.25)', color: C.pink, cursor: 'pointer' }}><EnvelopeHeartIcon size={15} /></button>
              <button onClick={() => setNoteTarget(w.username)}
                aria-label={`Add note for ${w.username}`}
                title="Add note"
                style={{ width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontSize: 13, cursor: 'pointer' }}>📝</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
