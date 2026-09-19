"use client"
import React from "react"

// getCoachingBullets — hoisted out of the per-fan .map() callback it used to
// live inside (was redefined on every render/iteration in page.js). It only
// ever closed over its `w` argument, never any outer JSX state, and was
// used at exactly one call site — confirmed by grepping the full
// app/dashboard/page.js before this extraction. Pure function, no behavior
// change.
function getCoachingBullets(w, C) {
  const bullets = []
  if (w.churnRisk?.level === "Critical") {
    bullets.push({ text: "Send a personal message today — they may not return without one", color: C.red })
    bullets.push({ text: "Reference something specific — their username, a past tip, or a show they loved", color: C.red })
    bullets.push({ text: "Offer something exclusive to bring them back (early access, private goal)", color: C.orange })
  } else if (w.churnRisk?.level === "High") {
    bullets.push({ text: "Re-engage this week — their pattern shows they go cold fast without contact", color: C.orange })
    bullets.push({ text: "Offer something special: a goal just for them or a shoutout next stream", color: C.gold })
    bullets.push({ text: "Keep the message short and warm — don't make it feel like a sales pitch", color: C.muted })
  } else if (w.tipProbability?.level === "High") {
    bullets.push({ text: "Go live during their active window — they're very likely to tip", color: C.green })
    bullets.push({ text: "Set a tip goal that matches their avg ($" + w.avgTipSize.toFixed(0) + ") — it feels achievable to them", color: C.cyan })
    bullets.push({ text: "Acknowledge them by name in stream — they respond to direct recognition", color: C.muted })
  } else if (w.hasPrivates) {
    bullets.push({ text: "Offer a private show — they've already bought one before", color: C.pink })
    bullets.push({ text: "Mention privates casually in stream — a soft reminder works well with this fan type", color: C.muted })
    bullets.push({ text: "They respond to exclusivity — make them feel like a VIP", color: C.gold })
  } else if (w.avgTipSize >= 20) {
    bullets.push({ text: "Give them VIP attention in stream — big tippers notice when they're seen", color: C.gold })
    bullets.push({ text: "Set a goal around their avg tip size ($" + w.avgTipSize.toFixed(0) + ") — they enjoy being the hero", color: C.cyan })
    bullets.push({ text: "Thank them publicly and specifically — it reinforces the behavior", color: C.muted })
  } else if (w.tipCount >= 20) {
    bullets.push({ text: "Thank them publicly — frequent tippers love recognition in front of the room", color: C.cyan })
    bullets.push({ text: "Small goals and countdowns keep micro-tippers engaged and clicking", color: C.muted })
    bullets.push({ text: "Consistency is their love language — show up regularly and they will too", color: C.muted })
  } else {
    bullets.push({ text: "Keep them warm — consistent presence builds loyalty over time", color: C.muted })
    bullets.push({ text: "Greet them by name next time they appear in chat", color: C.muted })
    bullets.push({ text: "They have potential — early engagement now converts them to regulars", color: C.cyan })
  }
  return bullets
}

// WhaleIntelligencePanel — mechanical extraction of the "💎 WHALE
// INTELLIGENCE PANEL" block previously inlined in app/dashboard/page.js
// (Top Fans / Whales tab). No calculation, threshold, or
// conditional-rendering changes — identical logic, just moved behind
// explicit props.
//
// IMPORTANT: this panel deliberately receives BOTH `filteredWhales` (which
// it slices and renders) AND the full, unfiltered `whales` (which it uses
// only for the spending-velocity/percentile-of-max math) — exactly as the
// original inline block did. Do not substitute one for the other.
//
// Props:
//   filteredWhales — whales filtered by tier/platform/day-drill
//   whales         — full (unfiltered) fan array from analytics.whales
//   isPro          — Pro plan flag, gates how many fans are shown (5 vs 3)
//   tipperNotes    — object keyed by lowercased username -> { note }
//   glassCard      — shared glass-card style object
//   C              — design token object
//   TIER_COLORS    — tier -> color map
//   EnvelopeHeartIcon — icon component used on the message button
//   whaleModalTriggerRef — ref set to the clicked element before opening the View Fan modal (focus restore)
//   setSelectedWhale — opens the View Fan profile modal (stays inline in page.js, untouched)
//   setNoteTarget    — opens the note modal for a given fan (by username)
//   setNoteText      — pre-fills the note modal's textarea with this fan's existing note (this panel's
//                      note button does this; the Fan Card Grid's note button deliberately does not)
//   setMessageTarget — opens the message modal for a given fan
//   setMessageIndex  — resets the message-template index
//   setMessageCopied — resets the "copied" state on the message modal
export default function WhaleIntelligencePanel({
  filteredWhales, whales, isPro, tipperNotes, glassCard, C, TIER_COLORS, EnvelopeHeartIcon,
  whaleModalTriggerRef, setSelectedWhale, setNoteTarget, setNoteText,
  setMessageTarget, setMessageIndex, setMessageCopied,
}) {
  if (filteredWhales.length === 0) return null

  // ── COMPACT COMMAND LAYER ──────────────────────────────────────────────
  // Signal row + one featured card, built entirely from fields identifyWhales
  // already computes (lib/analytics.js) — no new thresholds, no new scoring.
  // topFan: filteredWhales is already sorted by totalUSD desc (inherited
  // from identifyWhales' own sort), so [0] is simply "the fan currently at
  // the top of the in-view list" — not a new ranking.
  const shown = filteredWhales.slice(0, isPro ? 5 : 3)
  const topFan = shown[0] || null
  const atRiskCount = filteredWhales.filter(w => w.behavioralState === "At Risk").length
  const trendingUpCount = filteredWhales.filter(w => w.trend?.direction === "up").length
  const topFanTags = topFan ? [
    topFan.tipProbability?.level === "High" ? "🟢 Likely to tip soon" : null,
    topFan.behavioralState === "At Risk" ? "🚨 At churn risk" : null,
    topFan.trend?.direction === "up" ? "📈 Trending up" : null,
    topFan.hasPrivates ? "📷 Cam2Cam spender" : null,
  ].filter(Boolean) : []
  const restShown = shown.slice(1)

  return (
    <div style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 16 }}>
      <div className="fans-intelligence__header" style={{ marginBottom: 18 }}>
        <div className="fans-intelligence__eyebrow" style={{ color: C.gold }}>🧠 Fan Intelligence</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Understand who's driving your earnings, what's changing, and who needs attention.</div>
      </div>

      {/* SIGNAL ROW — compact, real-data-only glance cards */}
      <div className="fans-intelligence__signals">
        {topFan && (
          <div className="fans-intelligence__signal" style={{ ...glassCard }}>
            <div className="fans-intelligence__signal-label" style={{ color: C.muted }}>Top Fan</div>
            <div className="fans-intelligence__signal-value" style={{ color: C.white }}>{topFan.username}</div>
            <div style={{ fontSize: 11, color: TIER_COLORS[topFan.tier] || C.cyan, fontWeight: 700 }}>${topFan.totalUSD.toFixed(0)} · {topFan.tier}</div>
          </div>
        )}
        <div className="fans-intelligence__signal" style={{ ...glassCard }}>
          <div className="fans-intelligence__signal-label" style={{ color: C.muted }}>At Risk</div>
          <div className="fans-intelligence__signal-value" style={{ color: atRiskCount > 0 ? C.red : C.white }}>{atRiskCount}</div>
          <div style={{ fontSize: 11, color: C.muted }}>fan{atRiskCount === 1 ? "" : "s"} need attention</div>
        </div>
        <div className="fans-intelligence__signal" style={{ ...glassCard }}>
          <div className="fans-intelligence__signal-label" style={{ color: C.muted }}>Trending Up</div>
          <div className="fans-intelligence__signal-value" style={{ color: trendingUpCount > 0 ? C.green : C.white }}>{trendingUpCount}</div>
          <div style={{ fontSize: 11, color: C.muted }}>spending more than usual</div>
        </div>
      </div>

      {/* FEATURED CARD — the existing getCoachingBullets output for the top
          fan, presented as one elevated card instead of buried in a list. */}
      {topFan && (
        <div className="fans-intelligence__featured card-glow-gold" style={{ ...glassCard, transition: "transform 0.2s ease, box-shadow 0.2s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${TIER_COLORS[topFan.tier] || C.cyan}20`, border: `1px solid ${TIER_COLORS[topFan.tier] || C.cyan}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: TIER_COLORS[topFan.tier] || C.cyan }}>
                {topFan.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>{topFan.username}</div>
                <div style={{ fontSize: 11, color: C.muted }}>${topFan.totalUSD.toFixed(0)} lifetime · {topFan.tipCount} tips · {topFan.platform}</div>
              </div>
            </div>
            <button onClick={(e) => { whaleModalTriggerRef.current = e.currentTarget; setSelectedWhale(topFan) }}
              style={{ padding: "6px 12px", borderRadius: 7, background: "linear-gradient(135deg, #22D3EE, #EC4899)", border: "none", color: "#06101A", fontSize: 11, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
              View Fan →
            </button>
          </div>
          {topFanTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {topFanTags.map((label, j) => (
                <span key={j} style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)", fontSize: 11, fontWeight: 600, color: C.gold }}>{label}</span>
              ))}
            </div>
          )}
          <div className="fans-intelligence__signal-label" style={{ color: C.gold, marginBottom: 8 }}>✦ CAMCASH NOTICED</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {getCoachingBullets(topFan, C).map((b, j) => (
              <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: b.color, fontSize: 12, flexShrink: 0, marginTop: 1 }}>•</span>
                <span style={{ fontSize: 12, color: b.color, lineHeight: 1.4 }}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {restShown.map((w, i) => {
          const tags = []
          if (w.hasPrivates && w.privateCount >= 2) tags.push({ label: "📷 Cam2Cam spender", color: C.pink })
          if (w.avgTipSize >= 20) tags.push({ label: "💸 Big tipper", color: C.gold })
          if (w.tipCount >= 20 && w.avgTipSize < 5) tags.push({ label: "🎯 Micro-tipper", color: C.cyan })
          if (w.tipProbability?.level === "High") tags.push({ label: "🟢 Likely to tip soon", color: C.green })
          if (w.behavioralState === "At Risk") tags.push({ label: "🚨 At churn risk", color: C.red })
          if (w.daysSinceLastTip <= 3) tags.push({ label: "🔥 Recently active", color: C.orange })
          if (w.tipNotes && w.tipNotes.length > 0) tags.push({ label: "💬 Leaves tip notes", color: C.indigo })
          if (w.spendPercentile >= 90) tags.push({ label: `👑 Top ${100 - w.spendPercentile}% spender`, color: C.gold })

          // Relationship status
          const relStatus = w.daysSinceLastTip <= 7
            ? { label: "🔥 Hot", color: C.orange }
            : w.daysSinceLastTip <= 30
            ? { label: "👀 Watching", color: C.cyan }
            : w.daysSinceLastTip <= 60
            ? { label: "❄️ Cooling", color: C.blue }
            : { label: "💀 At Risk", color: C.red }

          // Spending velocity vs avg fan
          const avgFanUSD = whales.length > 0 ? whales.reduce((s, ww) => s + ww.totalUSD, 0) / whales.length : 1
          const velocity = avgFanUSD > 0 ? (w.totalUSD / avgFanUSD).toFixed(1) : "1.0"
          const velocityPct = Math.min(100, Math.round((w.totalUSD / Math.max(...whales.map(ww => ww.totalUSD))) * 100))

          const coachingBullets = getCoachingBullets(w, C)
          const tierColor = TIER_COLORS[w.tier] || C.cyan

          return (
            <div key={i} style={{ padding: 18, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {/* HEADER ROW */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `${tierColor}20`, border: `1px solid ${tierColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: tierColor }}>
                    {w.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{w.username}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 20, background: `${relStatus.color}15`, border: `1px solid ${relStatus.color}30`, fontSize: 10, fontWeight: 700, color: relStatus.color }}>{relStatus.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: C.muted }}>${w.totalUSD.toFixed(0)} lifetime · {w.tipCount} tips · {w.platform}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems:"center" }}>
                  <button onClick={(e) => { whaleModalTriggerRef.current = e.currentTarget; setSelectedWhale(w) }} style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.25)", color: C.cyan, fontSize: 11, cursor: "pointer" }}>🔍 Profile</button>
                  <button onClick={() => { setNoteTarget(w.username); setNoteText(tipperNotes[w.username?.toLowerCase()]?.note || '') }}
                    style={{ padding: "4px 8px", borderRadius: 6, background: tipperNotes[w.username?.toLowerCase()]?.note ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", border: tipperNotes[w.username?.toLowerCase()]?.note ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.1)", color: tipperNotes[w.username?.toLowerCase()]?.note ? C.gold : C.muted, fontSize: 11, cursor: "pointer" }}>
                    {tipperNotes[w.username?.toLowerCase()]?.note ? "📝 Note" : "📝"}
                  </button>
                  <button onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }}
                    className="heart-envelope-btn"
                    aria-label={`Message ${w.username}`}
                    title="Message fan"
                    style={{ padding: 6, borderRadius: 8, background: "rgba(255,43,174,0.1)", border: "1px solid rgba(255,43,174,0.25)", color: C.pink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><EnvelopeHeartIcon size={17} /></button>
                </div>
              </div>

              {/* PERSONALITY TAGS */}
              {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {tags.map((tag, j) => (
                    <span key={j} style={{ padding: "3px 10px", borderRadius: 20, background: `${tag.color}15`, border: `1px solid ${tag.color}30`, fontSize: 11, fontWeight: 600, color: tag.color }}>{tag.label}</span>
                  ))}
                </div>
              )}

              {/* METRICS ROW */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                {/* Spending velocity */}
                <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>SPENDING VELOCITY</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 6 }}>{velocity}x avg fan</div>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                    <div style={{ height: "100%", width: `${velocityPct}%`, borderRadius: 2, background: `linear-gradient(90deg, ${C.gold}, ${C.orange})` }} />
                  </div>
                </div>
                {/* Visit pattern */}
                <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>ACTIVE WINDOW</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.cyan }}>{w.typicalOnlineHours !== 'Unknown' ? w.typicalOnlineHours : '—'}</div>
                </div>
                {/* Monthly projection */}
                <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>MONTHLY VALUE</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>${w.lifetimeValue?.monthly > 0 ? w.lifetimeValue.monthly.toFixed(0) : '—'}</div>
                </div>
              </div>

              {/* TIP NOTES */}
              {w.tipNotes && w.tipNotes.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Recent Tip Notes</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 64, overflowY: "auto" }}>
                    {w.tipNotes.slice(-2).reverse().map((note, j) => (
                      <div key={j} style={{ padding: "6px 10px", background: `${C.indigo}10`, border: `1px solid ${C.indigo}20`, borderRadius: 6, fontSize: 11, color: C.text, fontStyle: "italic" }}>
                        "{note}"
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* COACHING BULLETS */}
              <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>💡 Action Plan</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {coachingBullets.map((b, j) => (
                    <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: b.color, fontSize: 12, flexShrink: 0, marginTop: 1 }}>•</span>
                      <span style={{ fontSize: 12, color: b.color, lineHeight: 1.4 }}>{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
