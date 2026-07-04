"use client"
import React from "react"
import { C, TIER_COLORS, glassCard } from "./dashboardTheme"

export default function WhalesTab({ whales, filteredWhales, allPlatforms, whaleFilter, setWhaleFilter, platformFilter, setPlatformFilter, chartDrillDay, setChartDrillDay, setFanSearchOpen, setSelectedWhale, setMessageTarget, setMessageIndex, setMessageCopied, tipperNotes, setNoteTarget, setNoteText, isPro, openUpgradeModal }) {
  return (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, margin: 0 }}>🐳 Top Fans</h1>
              <div style={{ display: "flex", gap: 8 }}>
                {chartDrillDay && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.35)", fontSize: 13, color: C.cyan, fontWeight: 600 }}>
                    📅 {chartDrillDay}s only
                    <button onClick={() => setChartDrillDay(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                  </div>
                )}
                <button onClick={() => setFanSearchOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(236,72,153,0.15))", border: "1px solid rgba(59,130,246,0.35)", color: C.white, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  🔍 Search Fan
                </button>
              </div>
            </div>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Your highest-value supporters ranked by total spend</p>

            {/* FILTERS */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                {["ALL","Whale","Shark","Regular","Dormant"].map(t => (
                  <button key={t} onClick={() => setWhaleFilter(t)} style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s", background: whaleFilter === t ? "linear-gradient(135deg, #3b82f6, #ec4899)" : "transparent", color: whaleFilter === t ? C.white : C.muted }}>{t}</button>
                ))}
              </div>
              {allPlatforms.length > 1 && (
                <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                  {["ALL", ...allPlatforms].map(p => (
                    <button key={p} onClick={() => setPlatformFilter(p)} style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s", background: platformFilter === p ? "rgba(34,211,238,0.2)" : "transparent", color: platformFilter === p ? C.cyan : C.muted }}>{p}</button>
                  ))}
                </div>
              )}
            </div>

            {/* ALL TIPPERS — CRM Card Grid */}
            {filteredWhales.length === 0 ? (
              <div style={{ ...glassCard, borderRadius: 14, padding: 32, textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 15, color: C.muted }}>No fans match this filter</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginBottom: 20 }}>
                {filteredWhales.map((w, i) => {
                  const tc = TIER_COLORS[w.tier] || C.cyan
                  const days = w.daysSinceLastTip ?? Math.floor((Date.now() - new Date(w.lastTipDate)) / 86400000)
                  const relScore = Math.min(100, Math.round((w.tipCount * 3) + (w.totalUSD / 10) + (days < 7 ? 20 : days < 30 ? 10 : 0)))
                  const scoreColor = relScore >= 70 ? C.green : relScore >= 40 ? C.gold : C.red
                  const riskLevel = days < 14 ? { label: 'Low', color: C.green, pct: 20 } : days < 45 ? { label: 'Medium', color: C.gold, pct: 55 } : { label: 'High', color: C.red, pct: 90 }
                  const tierIcon = w.tier === 'Whale' ? '💎' : w.tier === 'Shark' ? '🦈' : w.tier === 'Regular' ? '⭐' : '💤'
                  return (
                    <div key={i}
                      className="hoverable"
                      style={{ ...glassCard, borderRadius: 16, padding: 18, border: `1px solid ${tc}33`, cursor: 'default', transition: 'transform 0.18s ease, box-shadow 0.18s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 0 28px ${tc}22, 0 8px 32px rgba(0,0,0,0.45)` }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>

                      {/* TOP ROW — avatar, name, badges, score */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        {/* Avatar */}
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${tc}, ${tc}80)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                          {(w.username || '?').charAt(0).toUpperCase()}
                        </div>
                        {/* Name + badges */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{w.username}</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <span style={{ padding: '2px 7px', borderRadius: 100, background: `${tc}20`, color: tc, fontSize: 10, fontWeight: 700 }}>{w.tier}</span>
                            <span style={{ padding: '2px 7px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', color: C.muted, fontSize: 10, fontWeight: 600 }}>{w.platform}</span>
                          </div>
                        </div>
                        {/* Relationship score */}
                        <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', background: `${scoreColor}18`, border: `2px solid ${scoreColor}55`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{relScore}</div>
                          <div style={{ fontSize: 7, color: scoreColor, opacity: 0.7, lineHeight: 1 }}>REL</div>
                        </div>
                      </div>

                      {/* METRIC ROW — 4 pills */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 12 }}>
                        {[
                          { icon: '💰', val: `$${(w.totalUSD || 0).toFixed(2)}`, label: 'lifetime' },
                          { icon: '🔁', val: String(w.tipCount || 0), label: 'tips' },
                          { icon: '⏱', val: `${days}d`, label: 'ago' },
                          { icon: '📊', val: `$${(w.avgTipSize || 0).toFixed(2)}`, label: 'avg tip' },
                        ].map(({ icon, val, label }) => (
                          <div key={label} style={{ padding: '7px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12 }}>{icon}</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.white, lineHeight: 1.1 }}>{val}</div>
                              <div style={{ fontSize: 9, color: C.muted, lineHeight: 1 }}>{label}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* RETENTION RISK BAR */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Retention Risk</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: riskLevel.color }}>{riskLevel.label}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${riskLevel.pct}%`, borderRadius: 2, background: riskLevel.color, transition: 'width 0.4s ease' }} />
                        </div>
                      </div>

                      {/* QUICK ACTIONS */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }}
                          style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.25)', color: C.pink, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          title="Message">💌 Message</button>
                        <button onClick={() => setSelectedWhale(w)}
                          style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', color: C.cyan, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          title="View profile">🔍 View</button>
                        <button onClick={() => setNoteTarget(w.username)}
                          style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          title="Add note">📝 Note</button>
                        <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, opacity: 0.6 }} title={`${w.tier} tier`}>{tierIcon}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 💎 WHALE INTELLIGENCE PANEL */}
            {filteredWhales.length > 0 && (
              <div style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #F59E0B, #EC4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧠</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>Fan Intelligence</div>
                    <div style={{ fontSize: 12, color: C.muted }}>Deep behavior patterns, projections & how to engage each fan</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {filteredWhales.slice(0, isPro ? 5 : 3).map((w, i) => {
                    const tags = []
                    if (w.hasPrivates && w.privateCount >= 2) tags.push({ label: "📷 Cam2Cam spender", color: C.pink })
                    if (w.avgTipSize >= 20) tags.push({ label: "💸 Big tipper", color: C.gold })
                    if (w.tipCount >= 20 && w.avgTipSize < 5) tags.push({ label: "🎯 Micro-tipper", color: C.cyan })
                    if (w.tipProbability?.level === "High") tags.push({ label: "🟢 Likely to tip soon", color: C.green })
                    if (w.churnRisk?.level === "High" || w.churnRisk?.level === "Critical") tags.push({ label: "🚨 At churn risk", color: C.red })
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

                    // Coaching bullets
                    const getCoachingBullets = () => {
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
                    const coachingBullets = getCoachingBullets()
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
                            <button onClick={() => setSelectedWhale(w)} style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.25)", color: C.cyan, fontSize: 11, cursor: "pointer" }}>🔍 Profile</button>
                            <button onClick={() => { setNoteTarget(w.username); setNoteText(tipperNotes[w.username?.toLowerCase()]?.note || '') }}
                              style={{ padding: "4px 8px", borderRadius: 6, background: tipperNotes[w.username?.toLowerCase()]?.note ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", border: tipperNotes[w.username?.toLowerCase()]?.note ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.1)", color: tipperNotes[w.username?.toLowerCase()]?.note ? C.gold : C.muted, fontSize: 11, cursor: "pointer" }}>
                              {tipperNotes[w.username?.toLowerCase()]?.note ? "📝 Note" : "📝"}
                            </button>
                            <button onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }} style={{ padding: "4px", borderRadius: 8, background: "none", border: "none", color: C.pink, fontSize: 26, cursor: "pointer", animation: "pulse-msg 2s infinite", lineHeight: 1 }}>💌</button>
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
            )}

            {filteredWhales.length <= 3 && (
              <div style={{ ...glassCard, borderRadius: 14, padding: 20, textAlign: "center", border: "1px solid rgba(59,130,246,0.2)" }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Upload more data to discover more fans • Pro unlocks full profiles & behavior patterns</div>
                <button onClick={() => openUpgradeModal("whales_empty")} style={{ padding: "8px 20px", borderRadius: 8, background: "linear-gradient(135deg,rgba(59,130,246,0.3),rgba(236,72,153,0.3))", border: "1px solid rgba(59,130,246,0.4)", color: C.white, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  🔓 See What Pro Unlocks
                </button>
              </div>
            )}
          </div>
  )
}
