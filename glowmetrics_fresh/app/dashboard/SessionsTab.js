"use client"
import React from "react"
import { C, glassCard } from "./dashboardTheme"

export default function SessionsTab({ sessions, analytics, meaningfulOnly, setMeaningfulOnly }) {
          const displaySessions = meaningfulOnly
            ? (analytics?.meaningfulSessions || sessions)
            : (analytics?.allValidSessions   || sessions)

          // ── SESSION BREAKDOWN ENGINE ────────────────────────────────
          // Pure logic — runs on each session's tips array
          const getSessionBreakdown = (s) => {
            const rawTips = s.tips || []
            if (rawTips.length === 0) return null

            const sorted = [...rawTips].sort((a, b) =>
              new Date(a.dateRaw || a.date_time) - new Date(b.dateRaw || b.date_time)
            )

            const startMs = new Date(s.startTime).getTime()
            const endMs   = new Date(s.endTime).getTime()
            const durationMins = Math.max(s.durationMinutes || 1, 1)

            // ── TIMELINE BUCKETS (5-min intervals) ──────────────────
            const bucketCount = Math.max(Math.ceil(durationMins / 5), 1)
            const buckets = Array.from({ length: bucketCount }, (_, i) => ({
              label: `${i * 5}m`,
              usd: 0,
              count: 0,
            }))
            sorted.forEach(t => {
              const tMs = new Date(t.dateRaw || t.date_time).getTime()
              const minOffset = (tMs - startMs) / 60000
              const idx = Math.min(Math.floor(minOffset / 5), bucketCount - 1)
              if (idx >= 0 && idx < buckets.length) {
                buckets[idx].usd += parseFloat(t.usd) || 0
                buckets[idx].count += 1
              }
            })

            // ── PEAK BUCKET ─────────────────────────────────────────
            const peakBucket = [...buckets].sort((a, b) => b.usd - a.usd)[0]
            const peakBucketIdx = buckets.indexOf(peakBucket)
            const peakMinute = peakBucketIdx * 5
            const peakTime = new Date(startMs + peakMinute * 60000)

            // ── FIRST HALF vs SECOND HALF ────────────────────────────
            const half = Math.floor(buckets.length / 2)
            const firstHalfUSD = buckets.slice(0, half).reduce((s, b) => s + b.usd, 0)
            const secondHalfUSD = buckets.slice(half).reduce((s, b) => s + b.usd, 0)
            const firstHalfPct = s.totalUSD > 0 ? Math.round((firstHalfUSD / s.totalUSD) * 100) : 0

            // ── TOP TIPPERS ─────────────────────────────────────────
            const tipperMap = {}
            sorted.forEach(t => {
              const u = t.username || "unknown"
              tipperMap[u] = (tipperMap[u] || 0) + (parseFloat(t.usd) || 0)
            })
            const topTippers = Object.entries(tipperMap)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([username, usd]) => ({
                username,
                usd: parseFloat(usd.toFixed(2)),
                pct: s.totalUSD > 0 ? Math.round((usd / s.totalUSD) * 100) : 0,
              }))

            // ── SPIKES (bucket > 2x avg) ─────────────────────────────
            const avgBucketUSD = s.totalUSD / buckets.length
            const spikes = buckets
              .map((b, i) => ({ ...b, idx: i }))
              .filter(b => b.usd >= avgBucketUSD * 2 && b.usd > 0)
              .map(b => ({
                minute: b.idx * 5,
                usd: parseFloat(b.usd.toFixed(2)),
                time: new Date(startMs + b.idx * 5 * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              }))

            // ── PERFORMANCE vs historical avg ────────────────────────
            const allAvg = displaySessions.length > 0
              ? displaySessions.reduce((s, x) => s + x.totalUSD, 0) / displaySessions.length
              : 0
            const performance = s.totalUSD >= allAvg * 1.3
              ? "high"
              : s.totalUSD <= allAvg * 0.6
              ? "low"
              : "average"

            // ── REVENUE PER MINUTE ───────────────────────────────────
            const revenuePerMin = parseFloat((s.totalUSD / durationMins).toFixed(3))

            // ── INSIGHTS ────────────────────────────────────────────
            const insights = []
            if (firstHalfPct >= 60)
              insights.push(`You earned ${firstHalfPct}% of your revenue in the first half of the stream`)
            if (firstHalfPct <= 35 && durationMins > 20)
              insights.push(`Your stream warmed up slowly — earnings picked up in the second half`)
            if (topTippers[0] && topTippers[0].pct >= 40)
              insights.push(`${topTippers[0].username} drove ${topTippers[0].pct}% of this session's revenue`)
            if (spikes.length > 0)
              insights.push(`Your biggest spike was at ${spikes[0].time} — $${spikes[0].usd} in 5 minutes`)
            if (s.uniqueFans === 1)
              insights.push(`Only one fan tipped this session — great loyalty, but audience diversity helps`)
            if (s.uniqueFans >= 5)
              insights.push(`${s.uniqueFans} different fans tipped — strong audience engagement`)
            if (durationMins < 20 && s.totalUSD > 0)
              insights.push(`Short session (${Math.round(durationMins)} min) with solid earnings — your hook is working`)
            if (performance === "high")
              insights.push(`This was one of your top sessions — $${s.totalUSD} vs $${allAvg.toFixed(0)} avg`)
            if (performance === "low")
              insights.push(`Below your average session ($${allAvg.toFixed(0)}) — see recommendations below`)

            // ── RECOMMENDATIONS ─────────────────────────────────────
            const recommendations = []
            if (firstHalfPct >= 60)
              recommendations.push("Your best earnings happen early — open with high energy and a strong tip goal right away")
            if (firstHalfPct <= 35)
              recommendations.push("Slow start detected — open with a countdown goal or shoutout to get early tipping momentum")
            if (topTippers[0] && topTippers[0].pct >= 50)
              recommendations.push(`Retain ${topTippers[0].username} — they drove half your session. Give them public recognition next time`)
            if (s.uniqueFans <= 2 && s.tipCount > 10)
              recommendations.push("Diversify your audience — most tips came from 1–2 fans. Engage lurkers with low-barrier goals")
            if (durationMins < 30 && s.totalUSD > 0)
              recommendations.push(`You earned $${s.totalUSD} in ${Math.round(durationMins)} min. Extending to 45–60 min could 2x your earnings`)
            if (spikes.length >= 2)
              recommendations.push("Multiple spike moments detected — identify what triggered them and recreate it intentionally")
            if (revenuePerMin > 0 && revenuePerMin < 0.10)
              recommendations.push("Low revenue per minute — try setting a token goal every 15 min to maintain tipping momentum")
            if (performance === "high")
              recommendations.push("Replicate this stream: same time, same platform, similar energy — your data supports it")
            if (recommendations.length === 0)
              recommendations.push("Keep streaming consistently — more data helps us give you sharper recommendations")

            return {
              buckets, peakTime, peakBucket, firstHalfPct,
              topTippers, spikes, performance, revenuePerMin,
              insights, recommendations,
            }
          }

          // ── PERFORMANCE BADGE CONFIG ────────────────────────────────
          const PERF = {
            high:    { label: "🔥 High Performing", color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)" },
            average: { label: "📊 Average",          color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
            low:     { label: "📉 Underperforming",  color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
          }

          const avgSession = displaySessions.length ? displaySessions.reduce((s,x) => s+x.totalUSD,0)/displaySessions.length : 0

          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 4 }}>🎥 Session Breakdown</h1>
                  <p style={{ fontSize: 13, color: C.muted }}>What happened in each stream and how to earn more next time</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:20, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:C.muted }}>
                    <input type="checkbox" checked={meaningfulOnly} onChange={e => setMeaningfulOnly(e.target.checked)} style={{ accentColor: C.cyan }} />
                    Meaningful sessions only
                  </label>
                  {(analytics?.lowSignalSessionCount > 0) && (
                    <span style={{ fontSize:11, color:C.muted }}>({analytics.lowSignalSessionCount} low-signal hidden)</span>
                  )}
                </div>
              </div>

              {/* OVERVIEW STATS BAR */}
              {displaySessions.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
                  {[
                    { label: "Total Sessions", value: displaySessions.length, color: C.cyan },
                    { label: "Avg Earnings", value: `$${avgSession.toFixed(2)}`, color: C.green },
                    { label: "Best Session", value: `$${Math.max(...displaySessions.map(s => s.totalUSD)).toFixed(2)}`, color: C.gold },
                    { label: "Total Earned", value: `$${displaySessions.reduce((s,x) => s+x.totalUSD,0).toFixed(2)}`, color: C.pink },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ ...glassCard, borderRadius: 12, padding: "16px 18px" }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* SESSION CARDS */}
              {displaySessions.length === 0 && (
                <div style={{ ...glassCard, borderRadius: 14, padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎥</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.white }}>{sessions.length > 0 ? 'No meaningful sessions match this filter' : 'No sessions yet'}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{sessions.length > 0 ? 'Try unchecking "Meaningful sessions only" to see all sessions' : 'Import your CSV data to see session breakdowns'}</div>
                  {sessions.length > 0 && meaningfulOnly && <button onClick={() => setMeaningfulOnly(false)} style={{ marginTop:12, padding:'7px 18px', borderRadius:8, background:'rgba(34,211,238,0.12)', border:'1px solid rgba(34,211,238,0.3)', color:C.cyan, fontSize:12, cursor:'pointer' }}>Show all sessions</button>}
                </div>
              )}

              {displaySessions.map((s, si) => {
                const bd = getSessionBreakdown(s)
                if (!bd) return null
                const perf = PERF[bd.performance]
                const maxBucketUSD = Math.max(...bd.buckets.map(b => b.usd), 0.01)
                const fmt = dt => new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

                return (
                  <div key={si} style={{ ...glassCard, borderRadius: 16, marginBottom: 24, overflow: "hidden" }}>

                    {/* SESSION HEADER */}
                    <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: C.white }}>
                            {new Date(s.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                          <span style={{ fontSize: 13, color: C.muted }}>{fmt(s.startTime)} → {fmt(s.endTime)}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>• {s.platform}</span>
                        </div>
                        <span style={{ padding: "3px 10px", borderRadius: 20, background: perf.bg, border: `1px solid ${perf.border}`, fontSize: 11, fontWeight: 700, color: perf.color }}>{perf.label}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: C.green }}>${s.totalUSD.toFixed(2)}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{Math.round(s.durationMinutes)} min • ${bd.revenuePerMin.toFixed(2)}/min</div>
                      </div>
                    </div>

                    <div style={{ padding: 24 }}>

                      {/* REVENUE GAP — vs last 5 sessions */}
                      {(() => {
                        const recentSessions = displaySessions.filter(x => x.id !== s.id && !x.durationUnknown)
                        const comparable = recentSessions.filter(x => x.platform === s.platform).slice(-5)
                        const base = comparable.length >= 3 ? comparable : recentSessions.slice(-5)
                        if (base.length < 2 || s.durationUnknown) return null
                        const expected = base.reduce((a, x) => a + x.totalUSD, 0) / base.length
                        const gap = expected - s.totalUSD
                        const gapPct = expected > 0 ? Math.round((gap / expected) * 100) : 0
                        if (Math.abs(gapPct) < 10) return null
                        const isUnder = gap > 0
                        const color = isUnder ? C.red : C.green
                        const bg    = isUnder ? "rgba(248,113,113,0.06)" : "rgba(16,185,129,0.06)"
                        const bdr   = isUnder ? "rgba(248,113,113,0.25)" : "rgba(16,185,129,0.25)"
                        return (
                          <div style={{ padding: "10px 14px", borderRadius: 10, background: bg, border: `1px solid ${bdr}`, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 13, color, fontWeight: 600 }}>
                              {isUnder ? `⚠️ $${gap.toFixed(0)} below your avg session ($${expected.toFixed(0)}) — ${gapPct}% shortfall` : `✅ $${Math.abs(gap).toFixed(0)} above your avg session — top ${Math.abs(gapPct)}% performance`}
                            </span>
                          </div>
                        )
                      })()}

                      {/* CORE METRICS */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
                        {[
                          { label: "Tips",        value: s.tipCount,                    color: C.cyan  },
                          { label: "Unique Fans", value: s.uniqueFans,                  color: C.pink  },
                          { label: "Avg Tip",     value: `$${s.avgTipSize}`,            color: C.gold  },
                          { label: "$/Hour",      value: s.usdPerHour !== null ? `$${s.usdPerHour}` : "—",  color: C.green },
                          { label: "$/Min",       value: s.usdPerMinute !== null ? `$${s.usdPerMinute}` : "—", color: C.cyan },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* VELOCITY + CONCENTRATION ROW */}
                      {(s.velocityTrend !== 'unknown' || s.topContributorPct >= 40) && (
                        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                          {s.velocityTrend !== 'unknown' && (() => {
                            const vConfig = {
                              growing: { icon: "📈", label: "Momentum building", color: C.green, bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)" },
                              dying:   { icon: "📉", label: "Earnings slowing", color: C.red,   bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)" },
                              steady:  { icon: "➡️", label: "Steady pace",       color: C.muted, bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" },
                            }
                            const v = vConfig[s.velocityTrend]
                            const pctChange = s.firstHalfUPM && s.secondHalfUPM
                              ? Math.round(Math.abs((s.secondHalfUPM - s.firstHalfUPM) / s.firstHalfUPM) * 100)
                              : null
                            return (
                              <div style={{ flex: 1, minWidth: 180, padding: "10px 14px", borderRadius: 10, background: v.bg, border: `1px solid ${v.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 16 }}>{v.icon}</span>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: v.color }}>{v.label}</div>
                                  {pctChange !== null && (
                                    <div style={{ fontSize: 11, color: C.muted }}>
                                      {s.velocityTrend === 'growing' ? `+${pctChange}%` : s.velocityTrend === 'dying' ? `-${pctChange}%` : '~0%'} vs first half
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })()}
                          {s.topContributorPct >= 40 && (
                            <div style={{ flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 16 }}>⚠️</span>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>{s.topContributorPct}% from one fan</div>
                                <div style={{ fontSize: 11, color: C.muted }}>{s.topContributor} drove most of this session</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TIMELINE CHART */}
                      {bd.buckets.length > 1 && (
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>⏱ Earnings Timeline (5-min buckets)</div>
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 64, padding: "0 0 4px" }}>
                            {bd.buckets.map((b, bi) => {
                              const heightPct = maxBucketUSD > 0 ? (b.usd / maxBucketUSD) : 0
                              const isPeak = bi === bd.buckets.indexOf(bd.peakBucket)
                              const barColor = isPeak ? C.gold : b.usd > 0 ? C.cyan : "rgba(255,255,255,0.06)"
                              return (
                                <div key={bi} title={`${b.label}: $${b.usd.toFixed(2)}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                                  <div style={{ width: "100%", height: `${Math.max(heightPct * 100, b.usd > 0 ? 4 : 2)}%`, background: barColor, borderRadius: "3px 3px 0 0", transition: "height 0.3s", minHeight: b.usd > 0 ? 4 : 2 }} />
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                            <span style={{ fontSize: 9, color: C.muted }}>{fmt(s.startTime)}</span>
                            {bd.spikes.length > 0 && <span style={{ fontSize: 9, color: C.gold }}>🔥 Peak at {bd.spikes[0].time}</span>}
                            <span style={{ fontSize: 9, color: C.muted }}>{fmt(s.endTime)}</span>
                          </div>
                        </div>
                      )}

                      {/* FIRST HALF vs SECOND HALF */}
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>📊 Session Pacing</div>
                        <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ width: `${bd.firstHalfPct}%`, background: "linear-gradient(90deg, #22D3EE, #60A5FA)", display: "flex", alignItems: "center", justifyContent: "center", transition: "width 0.4s" }}>
                            {bd.firstHalfPct >= 20 && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff" }}>First half {bd.firstHalfPct}%</span>}
                          </div>
                          <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {100 - bd.firstHalfPct >= 20 && <span style={{ fontSize: 10, color: C.muted }}>Second half {100 - bd.firstHalfPct}%</span>}
                          </div>
                        </div>
                      </div>

                      {/* TOP TIPPERS */}
                      {bd.topTippers.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>🏆 Top Contributors</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {bd.topTippers.map((t, ti) => (
                              <div key={ti} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 14, flexShrink: 0 }}>{["🥇","🥈","🥉"][ti]}</span>
                                <span style={{ fontSize: 13, color: C.white, fontWeight: 600, minWidth: 100 }}>{t.username}</span>
                                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${t.pct}%`, background: ti === 0 ? `linear-gradient(90deg, ${C.gold}, ${C.orange})` : ti === 1 ? C.cyan : C.muted, borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 12, color: C.green, fontWeight: 700, flexShrink: 0 }}>${t.usd}</span>
                                <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{t.pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* INSIGHTS + RECOMMENDATIONS side by side */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        {/* INSIGHTS */}
                        <div style={{ padding: "14px 16px", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>💡 What Happened</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            {bd.insights.map((ins, ii) => (
                              <div key={ii} style={{ fontSize: 12, color: C.text, lineHeight: 1.5, display: "flex", gap: 6 }}>
                                <span style={{ color: C.cyan, flexShrink: 0 }}>→</span>
                                <span>{ins}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* RECOMMENDATIONS */}
                        <div style={{ padding: "14px 16px", background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.pink, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>🚀 Do This Next Time</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            {bd.recommendations.map((rec, ri) => (
                              <div key={ri} style={{ fontSize: 12, color: C.text, lineHeight: 1.5, display: "flex", gap: 6 }}>
                                <span style={{ color: C.pink, flexShrink: 0 }}>•</span>
                                <span>{rec}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>
          )
}
