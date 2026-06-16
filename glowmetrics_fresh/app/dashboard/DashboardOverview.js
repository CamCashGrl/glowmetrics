"use client"
import React, { useState } from "react"

const C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

const glassCard = {
  background: "rgba(15,20,32,0.75)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  boxShadow: "0 0 30px rgba(59,130,246,0.12), 0 0 60px rgba(236,72,153,0.06)",
}

// ─── DashboardOverview ────────────────────────────────────────────────────────
// Pure display component. All data passed as props from Dashboard.
// Never fetches data itself — edit visuals freely without touching analytics.
// Props:
//   dailyBrief, sessions, whales, insights, platforms, tips
//   totalRevenue, avgPerHour, analytics
//   platformVelocity, earningsVelocity, platformBestTimes
//   missedRevenueByPlat, returningVsNew, topFanDependency
//   setMessageTarget, setMessageIndex, setMessageCopied
//   handleTabChange, setChartDrillDay
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardOverview({
  dailyBrief, sessions, whales, insights, platforms, tips,
  totalRevenue, avgPerHour, analytics,
  platformVelocity, earningsVelocity, platformBestTimes,
  missedRevenueByPlat, returningVsNew, topFanDependency,
  setMessageTarget, setMessageIndex, setMessageCopied,
  handleTabChange, setChartDrillDay,
}) {
  const UTC_DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

  // ── ALERT CONFIG (same as demo) ─────────────────────────────────────────────
  const ALERT_CFG = {
    strike_hot: { bg:"rgba(251,146,60,0.08)",  border:"rgba(251,146,60,0.25)",  dot:"#FB923C" },
    win_back:   { bg:"rgba(236,72,153,0.08)",  border:"rgba(236,72,153,0.25)",  dot:"#EC4899" },
    milestone:  { bg:"rgba(245,158,11,0.08)",  border:"rgba(245,158,11,0.25)",  dot:"#F59E0B" },
    online_now: { bg:"rgba(16,185,129,0.08)",  border:"rgba(16,185,129,0.3)",   dot:"#10B981" },
    online_soon:{ bg:"rgba(245,158,11,0.06)",  border:"rgba(245,158,11,0.2)",   dot:"#F59E0B" },
    dormant:    { bg:"rgba(251,146,60,0.06)",  border:"rgba(251,146,60,0.2)",   dot:"#FB923C" },
    performance:{ bg:"rgba(236,72,153,0.06)",  border:"rgba(236,72,153,0.2)",   dot:"#EC4899" },
    social_mention:{ bg:"rgba(34,211,238,0.06)",border:"rgba(34,211,238,0.18)", dot:"#22D3EE" },
  }


  return (
    <div style={{ animation: "fadeUp 0.3s ease" }}>

            {/* ═══════════════════════════════════════
                LAYER 1 — COMMAND CARD
                Stateful: before stream / at peak / after stream
                Replaces: Daily Brief + Make Money Right Now
            ═══════════════════════════════════════ */}
            {(() => {
              if (!dailyBrief) return null
              const { todayName, bhLabel, bh, atPeak, hoursUntilPeak, displayPlat, displayAvg,
                isBestDay, predictionLow, predictionHigh, likelyOnline, reengageFans } = dailyBrief

              // Compute state: at_peak | before_stream | post_stream
              const lastSession = sessions.length ? [...sessions].sort((a,b) => new Date(b.startTime)-new Date(a.startTime))[0] : null
              const msSinceLastSession = lastSession ? Date.now() - new Date(lastSession.endTime || lastSession.startTime) : Infinity
              const isPostStream = msSinceLastSession < 4 * 3600000 && lastSession

              // Daily changes — what's new since yesterday
              const todayChanges = []
              const now = new Date()
              const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
              const todayTips = tips.filter(t => new Date(t.date_time || t.dateRaw) >= todayStart)
              const returnedToday = todayTips.length > 0
                ? [...new Set(todayTips.map(t => t.username))].filter(u => {
                    const prev = tips.filter(t2 => t2.username === u && new Date(t2.date_time || t2.dateRaw) < todayStart)
                    return prev.length > 0
                  })
                : []
              if (returnedToday.length > 0) todayChanges.push(`${returnedToday.length} fan${returnedToday.length > 1 ? 's' : ''} returned today`)
              if (isBestDay) todayChanges.push(`${todayName} is your best earning day`)
              if (atPeak) todayChanges.push('Peak window open now')
              if (bhLabel && !atPeak && hoursUntilPeak <= 3) todayChanges.push(`Peak in ${hoursUntilPeak}h — ${bhLabel}`)

              // Determine card state
              let cardState = 'before'
              if (atPeak) cardState = 'peak'
              else if (isPostStream) cardState = 'post'

              const cardConfig = {
                peak: {
                  icon: '🟢',
                  title: 'Peak Window Open — Go Live Now',
                  accentColor: '#10B981',
                  borderColor: 'rgba(16,185,129,0.4)',
                  bg: 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(34,211,238,0.06))',
                },
                before: {
                  icon: '⚡',
                  title: 'Best Move Right Now',
                  accentColor: '#22D3EE',
                  borderColor: 'rgba(34,211,238,0.3)',
                  bg: 'linear-gradient(135deg,rgba(34,211,238,0.08),rgba(124,92,255,0.06))',
                },
                post: {
                  icon: '📊',
                  title: 'Session Review Ready',
                  accentColor: '#F59E0B',
                  borderColor: 'rgba(245,158,11,0.3)',
                  bg: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(236,72,153,0.05))',
                },
              }
              const cfg = cardConfig[cardState]

              return (
                <div style={{ marginBottom: 20, borderRadius: 16, border: `1px solid ${cfg.borderColor}`, background: cfg.bg, backdropFilter: 'blur(16px)', animation: 'fadeUp 0.3s ease both', overflow: 'hidden' }}>
                  {/* Top accent line */}
                  <div style={{ height: 2, background: `linear-gradient(90deg, ${cfg.accentColor}, #EC4899)` }} />

                  <div style={{ padding: '16px 20px' }}>
                    {/* Daily change pills */}
                    {todayChanges.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        {todayChanges.slice(0,2).map((c,i) => (
                          <div key={i} style={{ padding: '3px 10px', borderRadius: 20, background: `rgba(34,211,238,0.08)`, border: '1px solid rgba(34,211,238,0.2)', fontSize: 11, color: '#22D3EE', fontWeight: 600 }}>
                            ● {c}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Main command */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${cfg.accentColor}20`, border: `1px solid ${cfg.accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                        {cfg.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: cfg.accentColor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{cfg.title}</div>

                        {cardState === 'peak' && (
                          <>
                            <div style={{ fontSize: 18, fontWeight: 900, color: '#F1F5F9', marginBottom: 6 }}>
                              Go live on {displayPlat} immediately
                            </div>
                            <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
                              This window closes in <span style={{ color: '#10B981', fontWeight: 700 }}>~{60 - new Date().getUTCMinutes()} min</span>
                              {displayAvg > 0 && <> · <span style={{ color: '#F59E0B', fontWeight: 700 }}>${displayAvg.toFixed(0)} avg/session</span></>}
                              {likelyOnline.length > 0 && <> · <span style={{ color: '#10B981', fontWeight: 700 }}>{likelyOnline.length} whale{likelyOnline.length > 1 ? 's' : ''} likely online</span></>}
                            </div>
                          </>
                        )}

                        {cardState === 'before' && bhLabel && (
                          <>
                            <div style={{ fontSize: 18, fontWeight: 900, color: '#F1F5F9', marginBottom: 6 }}>
                              Go live on {displayPlat} at {bhLabel}
                              {hoursUntilPeak !== null && hoursUntilPeak > 0 && <span style={{ fontSize: 14, color: '#64748B', fontWeight: 500 }}> · in {hoursUntilPeak}h</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                              {displayAvg > 0 && <span style={{ fontSize: 12, color: '#64748B' }}>Historically <span style={{ color: '#F59E0B', fontWeight: 700 }}>${displayAvg.toFixed(0)}/session</span></span>}
                              {likelyOnline.length > 0 && <span style={{ fontSize: 12, color: '#64748B' }}><span style={{ color: '#10B981', fontWeight: 700 }}>{likelyOnline.length} whale{likelyOnline.length > 1 ? 's' : ''}</span> likely online</span>}
                              {predictionLow > 0 && <span style={{ fontSize: 12, color: '#64748B' }}>Expected <span style={{ color: '#10B981', fontWeight: 700 }}>${predictionLow}–${predictionHigh}</span></span>}
                            </div>
                          </>
                        )}

                        {cardState === 'before' && !bhLabel && (
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>
                            Upload more sessions to get personalized timing
                          </div>
                        )}

                        {cardState === 'post' && lastSession && (
                          <>
                            <div style={{ fontSize: 18, fontWeight: 900, color: '#F1F5F9', marginBottom: 6 }}>
                              You earned ${lastSession.totalUSD.toFixed(2)} just now
                            </div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                              {(() => {
                                const avgSess = sessions.length > 1 ? sessions.reduce((s,x) => s+x.totalUSD,0)/sessions.length : 0
                                const diff = avgSess > 0 ? Math.round(((lastSession.totalUSD - avgSess)/avgSess)*100) : null
                                return diff !== null ? (
                                  <span style={{ fontSize: 12, color: '#64748B' }}>
                                    <span style={{ color: diff >= 0 ? '#10B981' : '#F87171', fontWeight: 700 }}>{diff >= 0 ? '+' : ''}{diff}%</span> vs your avg session
                                  </span>
                                ) : null
                              })()}
                              {reengageFans.length > 0 && (
                                <span style={{ fontSize: 12, color: '#64748B' }}>
                                  <span style={{ color: '#EC4899', fontWeight: 700 }}>{reengageFans.length} fan{reengageFans.length > 1 ? 's' : ''}</span> to re-engage
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ═══════════════════════════════════════
                LAYER 2 — MONEY SNAPSHOT (KPI strip)
            ═══════════════════════════════════════ */}
            {(() => {
              const now = new Date()
              const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
              const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
              const thisMonthRev = tips.filter(t => new Date(t.date_time || t.dateRaw) >= thisMonthStart).reduce((s,t) => s+(t.usd||0), 0)
              const prevMonthRev = tips.filter(t => { const d=new Date(t.date_time||t.dateRaw); return d>=prevMonthStart && d<thisMonthStart }).reduce((s,t) => s+(t.usd||0), 0)
              const growthPct = (prevMonthRev > 0 && thisMonthRev > 0) ? Math.round(((thisMonthRev-prevMonthRev)/prevMonthRev)*100) : null
              const isPositive = growthPct !== null && growthPct >= 0
              const fansActiveLast30 = new Set(tips.filter(t => (Date.now()-new Date(t.date_time||t.dateRaw))/86400000 <= 30).map(t => t.username)).size
              const returningPct = (() => {
                const fc = {}; tips.forEach(t => { fc[t.username]=(fc[t.username]||0)+1 })
                const total = Object.keys(fc).length
                const ret = Object.values(fc).filter(c=>c>1).length
                return total > 0 ? Math.round((ret/total)*100) : 0
              })()
              const forecast = dailyBrief ? dailyBrief.predictionLow + '–$' + dailyBrief.predictionHigh : null

              const kpis = [
                {
                  label: "This Month",
                  value: `$${thisMonthRev.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`,
                  sub: growthPct !== null ? (isPositive ? `↑ ${growthPct}% vs last month` : `↓ ${Math.abs(growthPct)}% vs last month`) : `$${totalRevenue.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})} all time`,
                  subColor: isPositive ? C.green : growthPct !== null ? C.red : C.muted,
                  icon: "💰",
                },
                {
                  label: "Avg $/Hour",
                  value: `$${avgPerHour.toFixed(2)}`,
                  sub: avgPerHour > 20 ? "Above avg — keep it up" : "Stream at peak hours",
                  subColor: C.muted,
                  icon: "⏱️",
                },
                {
                  label: "Return Rate",
                  value: `${returningPct}%`,
                  sub: `${fansActiveLast30} active fans (30d)`,
                  subColor: C.muted,
                  icon: "🔁",
                },
                {
                  label: "Tonight's Forecast",
                  value: forecast ? `$${forecast}` : '—',
                  sub: dailyBrief?.bhLabel ? `if you stream at ${dailyBrief.bhLabel}` : 'upload more data',
                  subColor: C.muted,
                  icon: "🎯",
                },
              ]

              const velPlatforms = Object.entries(platformVelocity).filter(([,v]) => v !== null).sort((a,b) => (b[1]||0)-(a[1]||0))

              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: velPlatforms.length ? 10 : 24 }}>
                    {kpis.map((k, i) => (
                      <div key={i} className="dash-card" style={{ ...glassCard, borderRadius: 16, padding: "18px 16px", animation: `fadeUp 0.3s ease ${i*0.05}s both` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{k.label}</span>
                          <span style={{ fontSize: 18 }}>{k.icon}</span>
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, background: "linear-gradient(135deg,#60a5fa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 5, lineHeight: 1.1 }}>{k.value}</div>
                        <div style={{ fontSize: 11, color: k.subColor, lineHeight: 1.4 }}>{k.sub}</div>
                      </div>
                    ))}
                  </div>
                  {velPlatforms.length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                      {velPlatforms.map(([plat, vel], i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)" }}>
                          <span style={{ fontSize: 10, color: C.muted }}>{plat.replace('BongaCams','Bonga').replace('MyFreeCams','MFC').replace(/chaturbate/i,'CB')}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.cyan }}>${(vel??0).toFixed(2)}/hr</span>
                        </div>
                      ))}
                      {earningsVelocity !== null && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                          <span style={{ fontSize: 10, color: C.muted }}>Overall</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>${earningsVelocity.toFixed(2)}/hr</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}

            {/* ═══════════════════════════════════════
                LAYER 3 — FANS TO FOCUS ON
                Priority-sorted: Urgent / Valuable / Growing / Cold
                Single list, single action per row
            ═══════════════════════════════════════ */}
            {(() => {
              const now = Date.now()

              // Score every fan — higher = more urgent
              const scoredFans = whales.map(w => {
                const daysSince = w.daysSinceLastTip || Math.floor((now - new Date(w.lastTipDate)) / 86400000)
                const fanTips = (w.tips && w.tips.length > 0) ? w.tips : tips.filter(t => t.username?.toLowerCase() === w.username?.toLowerCase())
                const hourCounts = {}
                fanTips.forEach(t => { const h = new Date(t.date_time||t.dateRaw).getUTCHours(); hourCounts[h]=(hourCounts[h]||0)+1 })
                const peakH = Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0]
                const hoursAway = peakH ? (parseInt(peakH[0]) - new Date().getUTCHours() + 24) % 24 : 99
                const isLikelyOnline = hoursAway <= 2 && fanTips.length >= 3
                const nearMilestone = [50,100,200,500].some(m => { const r=m-w.totalUSD; return r>0 && r<=m*0.1 })
                const isHighValue = w.totalUSD >= 50
                const isGrowing = w.tipCount >= 3 && daysSince <= 14
                const isChurning = w.churnRisk?.level === 'High' || w.churnRisk?.level === 'Critical'

                let priority = 'cold'
                let priorityScore = 0
                let sub = `${daysSince}d since last tip`
                let badgeLabel = null, badgeColor = C.muted

                if (isLikelyOnline && isHighValue) {
                  priority = 'urgent'; priorityScore = 100 + w.totalUSD
                  sub = `likely online now · $${w.totalUSD.toFixed(0)} lifetime`
                  badgeLabel = 'Online now'; badgeColor = C.green
                } else if (isChurning && isHighValue) {
                  priority = 'urgent'; priorityScore = 90 + w.totalUSD
                  sub = `${daysSince}d gone · $${w.totalUSD.toFixed(0)} lifetime`
                  badgeLabel = 'At risk'; badgeColor = C.red
                } else if (nearMilestone) {
                  priority = 'valuable'; priorityScore = 80 + w.totalUSD
                  const m = [50,100,200,500].find(m => { const r=m-w.totalUSD; return r>0 && r<=m*0.1 })
                  sub = `$${(m-w.totalUSD).toFixed(0)} from $${m} milestone`
                  badgeLabel = 'Near milestone'; badgeColor = C.gold
                } else if (isHighValue && daysSince <= 30) {
                  priority = 'valuable'; priorityScore = 70 + w.totalUSD
                  sub = `$${w.totalUSD.toFixed(0)} lifetime · ${daysSince}d ago`
                  badgeLabel = 'VIP'; badgeColor = C.gold
                } else if (isGrowing) {
                  priority = 'growing'; priorityScore = 50 + w.tipCount
                  sub = `${w.tipCount} tips · every ~${Math.round(w.avgDaysBetweenTips||7)}d`
                  badgeLabel = 'Growing'; badgeColor = C.cyan
                } else if (daysSince > 45 && w.totalUSD >= 20) {
                  priority = 'cold'; priorityScore = 30 + w.totalUSD / 10
                  sub = `$${w.totalUSD.toFixed(0)} lifetime · ${daysSince}d gone`
                  badgeLabel = 'Cold'; badgeColor = C.muted
                }

                return { ...w, priority, priorityScore, sub, badgeLabel, badgeColor }
              })

              // Sort by score, show top 6
              const topFans = scoredFans
                .filter(w => w.badgeLabel)
                .sort((a,b) => b.priorityScore - a.priorityScore)
                .slice(0, 6)

              if (!topFans.length) return null

              const PRIORITY_ORDER = ['urgent','valuable','growing','cold']
              const PRIORITY_LABELS = { urgent: 'URGENT', valuable: 'VALUABLE', growing: 'GROWING', cold: 'COLD' }
              const PRIORITY_COLORS = { urgent: C.red, valuable: C.gold, growing: C.cyan, cold: C.muted }

              // Group by priority
              const grouped = {}
              topFans.forEach(f => {
                if (!grouped[f.priority]) grouped[f.priority] = []
                grouped[f.priority].push(f)
              })

              return (
                <div style={{ ...glassCard, borderRadius: 18, padding: 22, marginBottom: 18, animation: "fadeUp 0.3s ease 0.1s both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#EC4899,#7C5CFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>👑</div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>Fans to Focus On</div>
                      <div style={{ fontSize: 11, color: C.muted }}>Sorted by revenue opportunity</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {PRIORITY_ORDER.filter(p => grouped[p]).map(priority => (
                      <div key={priority}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: PRIORITY_COLORS[priority], letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, marginTop: priority !== 'urgent' ? 12 : 0 }}>
                          {PRIORITY_LABELS[priority]}
                        </div>
                        {grouped[priority].map((w, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: `rgba(255,255,255,0.02)`, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 4, transition: "background 0.15s" }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                          >
                            {/* Avatar */}
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${PRIORITY_COLORS[priority]}20`, border: `1px solid ${PRIORITY_COLORS[priority]}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: PRIORITY_COLORS[priority], flexShrink: 0 }}>
                              {w.username.charAt(0).toUpperCase()}
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{w.username}</span>
                                <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 20, background: `${w.badgeColor}15`, color: w.badgeColor, fontWeight: 700 }}>{w.badgeLabel}</span>
                              </div>
                              <div style={{ fontSize: 11, color: C.muted }}>{w.sub}</div>
                            </div>
                            {/* Action */}
                            <button onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }}
                              style={{ padding: "4px", background: "none", border: "none", color: C.pink, fontSize: 22, cursor: "pointer", flexShrink: 0, lineHeight: 1, opacity: 0.8, transition: "opacity 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.opacity = 1}
                              onMouseLeave={e => e.currentTarget.style.opacity = 0.8}
                            >💌</button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* ═══════════════════════════════════════
                LAYER 4 — HEATMAP + PLATFORM ROI
                Hero visual first, then per-platform one-liners
            ═══════════════════════════════════════ */}
            <div style={{ ...glassCard, borderRadius: 18, padding: 22, marginBottom: 18, animation: "fadeUp 0.3s ease 0.15s both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Revenue Timing & Platform ROI</div>
                <div style={{ fontSize: 11, color: C.muted }}>avg $/active day · click to filter fans</div>
              </div>

              {/* HEATMAP — hero */}
              {(() => {
                const UTC_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                const platDayUSD = {}; const platDayDates = {}
                tips.forEach(t => {
                  const p = t.platform; const dt = new Date(t.date_time || t.dateRaw)
                  const shortDay = UTC_DAYS[dt.getUTCDay()]; const dateKey = dt.toISOString().slice(0,10)
                  if (!platDayUSD[p]) platDayUSD[p] = {}
                  if (!platDayDates[p]) platDayDates[p] = {}
                  platDayUSD[p][shortDay] = (platDayUSD[p][shortDay]||0) + (t.usd||0)
                  if (!platDayDates[p][shortDay]) platDayDates[p][shortDay] = new Set()
                  platDayDates[p][shortDay].add(dateKey)
                })
                const platDayAvg = {}
                Object.keys(platDayUSD).forEach(p => {
                  platDayAvg[p] = {}
                  UTC_DAYS.forEach(d => {
                    const total = platDayUSD[p][d]||0; const activeDays = platDayDates[p]?.[d]?.size||1
                    platDayAvg[p][d] = total > 0 ? parseFloat((total/activeDays).toFixed(2)) : 0
                  })
                })
                const platList = Object.keys(platDayAvg)
                if (!platList.length) return null
                const todayShort = UTC_DAYS[new Date().getUTCDay()]
                const todayLong = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getUTCDay()]

                return (
                  <div style={{ marginBottom: 20 }}>
                    <div className="heatmap-wrap" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "72px repeat(7,1fr)", gap: 3, minWidth: 400 }}>
                        <div/>
                        {UTC_DAYS.map(d => (
                          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: d===todayShort ? C.cyan : C.muted, paddingBottom: 3 }}>{d}</div>
                        ))}
                        {platList.map(plat => {
                          const dayVals = UTC_DAYS.map(d => platDayAvg[plat][d]||0)
                          const maxVal = Math.max(...dayVals, 0.01)
                          return [
                            <div key={plat+'_l'} style={{ fontSize: 10, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", paddingRight: 4, lineHeight: "30px" }}>
                              {plat.replace('BongaCams','Bonga').replace(/chaturbate/i,'CB').replace('MyFreeCams','MFC')}
                            </div>,
                            ...UTC_DAYS.map(d => {
                              const val = platDayAvg[plat][d]||0
                              const intensity = maxVal > 0 ? val/maxVal : 0
                              const isToday = d === todayShort
                              const bg = val===0 ? "rgba(255,255,255,0.03)" : intensity<0.25 ? "rgba(34,211,238,0.12)" : intensity<0.5 ? "rgba(34,211,238,0.30)" : intensity<0.75 ? "rgba(34,211,238,0.60)" : "rgba(34,211,238,0.90)"
                              return (
                                <div key={d} title={`${plat} ${d}: avg $${val.toFixed(2)}/day`}
                                  onClick={() => { if (val>0) { setChartDrillDay(d); handleTabChange("whales") } }}
                                  style={{ height: 30, borderRadius: 5, background: bg, border: isToday ? "2px solid rgba(34,211,238,0.6)" : "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: val>0 ? "pointer" : "default", transition: "all 0.15s" }}
                                  onMouseEnter={e => { if (val>0) { e.currentTarget.style.transform="scale(1.08)"; e.currentTarget.style.boxShadow="0 0 8px rgba(34,211,238,0.4)" } }}
                                  onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.boxShadow="" }}>
                                  {val>0 && <span style={{ fontSize: 9, fontWeight: 700, color: intensity>0.45 ? "#fff" : C.muted }}>${val>=100 ? Math.round(val) : val.toFixed(0)}</span>}
                                </div>
                              )
                            })
                          ]
                        })}
                      </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 10, color: C.muted }}>Today ({todayLong}) highlighted · darker = more earnings · click any cell to filter fans</div>
                  </div>
                )
              })()}

              {/* Platform one-liners */}
              {(() => {
                const fmtH = h => h===0?'12 AM':h<12?`${h} AM`:h===12?'12 PM':`${h-12} PM`
                const platColors = { Chaturbate: C.cyan, BongaCams: C.pink, MyFreeCams: C.gold }
                const allPlats = [...(analytics?.platforms||[])].sort((a,b)=>b.totalUSD-a.totalUSD)
                if (!allPlats.length) return null
                const maxUPH = Math.max(...allPlats.map(p => platformVelocity[p.platform]||0), 1)

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {allPlats.map((p, i) => {
                      const roi = platformVelocity[p.platform] ?? (p.hours>0 ? parseFloat((p.totalUSD/p.hours).toFixed(2)) : null)
                      const col = platColors[p.platform] || C.blue
                      const isTop = i === 0
                      const bestTime = platformBestTimes[p.platform]
                      const uptPct = maxUPH>0 && roi ? Math.round((roi/maxUPH)*100) : 0

                      // Missed revenue warning
                      const missed = missedRevenueByPlat[p.platform]
                      const hasWarning = missed && missed.missedRevenue > 10

                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: isTop ? `${col}08` : "rgba(255,255,255,0.02)", border: `1px solid ${isTop ? col+'25' : 'rgba(255,255,255,0.05)'}` }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0, boxShadow: isTop ? `0 0 6px ${col}` : 'none' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{p.platform.replace('BongaCams','Bonga').replace('MyFreeCams','MFC').replace(/chaturbate/i,'CB')}</span>
                              {isTop && <span style={{ fontSize: 9, color: col, fontWeight: 700 }}>TOP ROI</span>}
                              {roi !== null && <span style={{ fontSize: 12, color: col, fontWeight: 700 }}>${roi.toFixed(2)}/hr</span>}
                              {bestTime && <span style={{ fontSize: 11, color: C.muted }}>Best: {fmtH(bestTime.hour)}</span>}
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", maxWidth: 200 }}>
                              <div style={{ height: "100%", width: `${uptPct}%`, background: col, borderRadius: 2 }} />
                            </div>
                          </div>
                          {hasWarning && (
                            <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, whiteSpace: "nowrap" }}>
                              Bonga ↓{Math.round(missed.missedRevenue > 0 ? ((missed.bestHourAvg - missed.overallAvg)/missed.overallAvg*100) : 0)}% off-peak
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* ═══════════════════════════════════════
                BONUS — SMART INSIGHTS (collapsed, 2 max)
                Only show if there's something genuinely new
            ═══════════════════════════════════════ */}
            {(insights.length > 0 || topFanDependency || returningVsNew) && (
              <div style={{ ...glassCard, borderRadius: 16, padding: 22, marginBottom: 18, animation: "fadeUp 0.3s ease 0.2s both" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>💡 Smart Insights</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topFanDependency && topFanDependency.top1Pct > 20 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}>
                      <span style={{ fontSize: 14 }}>⚠️</span>
                      <span style={{ fontSize: 12, color: C.text }}>
                        Top fan is <span style={{ color: C.red, fontWeight: 700 }}>{topFanDependency.top1Pct}%</span> of your revenue — diversify your audience
                      </span>
                    </div>
                  )}
                  {returningVsNew && returningVsNew.multiplier && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}>
                      <span style={{ fontSize: 14 }}>🔁</span>
                      <span style={{ fontSize: 12, color: C.text }}>
                        Returning fans spend <span style={{ color: C.green, fontWeight: 700 }}>{returningVsNew.multiplier}x more</span> than new fans — focus on retention
                      </span>
                    </div>
                  )}
                  {insights.slice(0,2).map((ins, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", borderRadius: 9, background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{ins.icon}</span>
                      <span style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}



  )
}
