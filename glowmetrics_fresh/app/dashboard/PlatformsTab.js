"use client"
import React from "react"
import { C, formatHour, glassCard } from "./dashboardTheme"

const UTC_DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function PlatformsTab({ tips, sessions, platforms, platformTimes, platformTimeFilter, setPlatformTimeFilter }) {
          // ── Time filter
          const now = Date.now()
          const filterMs = platformTimeFilter === "7D" ? 7 * 86400000
                         : platformTimeFilter === "30D" ? 30 * 86400000
                         : platformTimeFilter === "90D" ? 90 * 86400000
                         : null

          const filteredTips = filterMs
            ? tips.filter(t => now - new Date(t.date_time).getTime() <= filterMs)
            : tips

          // Rebuild platform stats from filtered tips using same logic as engine
          const pfMap = {}
          filteredTips.forEach(t => {
            const k = t.platform || "Unknown"
            if (!pfMap[k]) pfMap[k] = { platform: k, totalUSD: 0, tips: 0, sessions: new Set(), hours: 0 }
            pfMap[k].totalUSD += t.usd || 0
            pfMap[k].tips += 1
          })
          // Overlay session data for hour counts
          const filteredSessions = filterMs
            ? sessions.filter(s => now - new Date(s.startTime).getTime() <= filterMs)
            : sessions
          filteredSessions.forEach(s => {
            if (!pfMap[s.platform]) pfMap[s.platform] = { platform: s.platform, totalUSD: 0, tips: 0, sessions: new Set(), hours: 0 }
            pfMap[s.platform].sessions.add(s.id || s.startTime)
            pfMap[s.platform].hours += s.durationHours || 0
          })
          const filteredPlatforms = Object.values(pfMap).map(p => ({
            platform: p.platform,
            totalUSD: parseFloat((p.totalUSD || 0).toFixed(2)),
            sessions: p.sessions.size,
            hours: parseFloat((p.hours || 0).toFixed(1)),
            usdPerHour: p.hours > 0 ? parseFloat((p.totalUSD / Math.max(p.hours, 0.5)).toFixed(2)) : 0,
            avgTipSize: p.tips > 0 ? parseFloat((p.totalUSD / p.tips).toFixed(2)) : 0,
            tipCount: p.tips
          })).sort((a, b) => b.totalUSD - a.totalUSD)

          const displayPlatforms = filteredPlatforms.length > 0 ? filteredPlatforms : platforms
          const maxUSD = Math.max(...displayPlatforms.map(p => p.totalUSD), 1)
          const maxUPH = Math.max(...displayPlatforms.map(p => p.usdPerHour), 1)

          const getPlatformInsights = (p) => {
            const insights = []
            const avgUPH = displayPlatforms.reduce((s, x) => s + x.usdPerHour, 0) / (displayPlatforms.length || 1)
            const pctAbove = displayPlatforms.length > 1 ? Math.round(((p.usdPerHour - avgUPH) / avgUPH) * 100) : null
            const bHour = Object.entries(platformTimes[p.platform]?.hours || {}).sort((a, b) => b[1] - a[1])[0]

            // For best day: compute avg per active day (not raw total which is misleading)
            const dayData = platformTimes[p.platform]?.days || {}
            const dayAvgs = Object.entries(dayData).map(([day, total]) => {
              // Count distinct calendar dates for this platform+day combo
              const activeDates = new Set(
                tips.filter(t => {
                  if (t.platform !== p.platform) return false
                  const dt = new Date(t.date_time || t.dateRaw)
                  return UTC_DAYS_LONG[dt.getUTCDay()] === day
                }).map(t => new Date(t.date_time || t.dateRaw).toISOString().slice(0,10))
              ).size
              return [day, activeDates > 0 ? total / activeDates : 0]
            })
            const bDay = dayAvgs.sort((a, b) => b[1] - a[1])[0]

            const isTop = displayPlatforms.length > 1 && p.totalUSD === maxUSD
            const isTopUPH = displayPlatforms.length > 1 && p.usdPerHour === maxUPH
            if (isTop)    insights.push({ icon: "🏆", text: "Your highest revenue platform", color: C.gold })
            if (isTopUPH && !isTop) insights.push({ icon: "⚡", text: "Most efficient — highest $/hour", color: C.cyan })
            if (pctAbove !== null && pctAbove >= 20)  insights.push({ icon: "🔥", text: `Earns ${pctAbove}% more per hour than your average`, color: C.green })
            if (pctAbove !== null && pctAbove <= -20) insights.push({ icon: "📉", text: `${Math.abs(pctAbove)}% below your avg $/hour — consider shifting time`, color: C.orange })
            if (bDay)  insights.push({ icon: "📅", text: `Best day: ${bDay[0]} ($${parseFloat(bDay[1]).toFixed(0)} avg/stream day)`, color: C.white })
            if (bHour) insights.push({ icon: "🕐", text: `Peak time: ${formatHour(bHour[0])} ($${parseFloat(bHour[1]).toFixed(0)} total earned)`, color: C.white })
            if (p.sessions >= 5 && p.hours / p.sessions < 1) insights.push({ icon: "⏱️", text: "Short sessions — try streaming longer to boost earnings", color: C.muted })
            return insights
          }

          const PLATFORM_EMOJI = { Chaturbate: "🟣", BongaCams: "🔴", MyFreeCams: "🟠", CamSoda: "🟢", Stripchat: "🔵", Flirt4Free: "💜" }

          return (
            <div>
              {/* HEADER + TIME FILTER */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 6 }}>🎯 Platform Comparison</h1>
                  <p style={{ fontSize: 13, color: C.muted }}>See exactly where your time is most valuable</p>
                </div>
                <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                  {[["ALL","All Time"],["7D","7 Days"],["30D","30 Days"],["90D","90 Days"]].map(([val, label]) => (
                    <button key={val} onClick={() => setPlatformTimeFilter(val)} style={{
                      padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s",
                      background: platformTimeFilter === val ? "linear-gradient(135deg, #3b82f6, #ec4899)" : "transparent",
                      color: platformTimeFilter === val ? C.white : C.muted,
                      boxShadow: platformTimeFilter === val ? "0 0 12px rgba(59,130,246,0.4)" : "none"
                    }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* PLATFORM RECOMMENDATION BANNER */}
              {displayPlatforms.length >= 2 && (() => {
                const sorted = [...displayPlatforms].sort((a, b) => b.usdPerHour - a.usdPerHour)
                const top = sorted[0]
                const bottom = sorted[sorted.length - 1]
                if (top.usdPerHour > 0 && bottom.usdPerHour > 0 && top.usdPerHour >= bottom.usdPerHour * 2) {
                  const mult = (top.usdPerHour / bottom.usdPerHour).toFixed(1)
                  return (
                    <div style={{ padding: "14px 18px", borderRadius: 12, background: "linear-gradient(135deg, rgba(34,211,238,0.1), rgba(124,92,255,0.1))", border: "1px solid rgba(34,211,238,0.3)", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20 }}>⚡</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>You earn {mult}x more per hour on {top.platform} than {bottom.platform}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>${(top.usdPerHour || 0).toFixed(2)}/hr vs ${(bottom.usdPerHour || 0).toFixed(2)}/hr — consider shifting more time to {top.platform}</div>
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* SUMMARY ROW — only when 2+ platforms */}
              {displayPlatforms.length >= 2 && (() => {
                const topRev = [...displayPlatforms].sort((a, b) => b.totalUSD - a.totalUSD)[0]
                const topEff = [...displayPlatforms].sort((a, b) => b.usdPerHour - a.usdPerHour)[0]
                const totalHours = displayPlatforms.reduce((s, p) => s + p.hours, 0)
                const totalEarned = displayPlatforms.reduce((s, p) => s + p.totalUSD, 0)
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
                    {[
                      { icon: "💰", label: "Top Revenue", value: topRev.platform, sub: `$${(topRev.totalUSD || 0).toFixed(2)} total`, color: C.gold },
                      { icon: "⚡", label: "Most Efficient", value: topEff.platform, sub: `$${(topEff.usdPerHour || 0).toFixed(2)}/hour`, color: C.cyan },
                      { icon: "🕒", label: "Total Hours", value: `${totalHours.toFixed(1)}h`, sub: `across ${displayPlatforms.length} platforms`, color: C.pink },
                      { icon: "💵", label: "Combined Earned", value: `$${totalEarned.toFixed(2)}`, sub: platformTimeFilter === "ALL" ? "all time" : `last ${platformTimeFilter}`, color: C.green },
                    ].map(({ icon, label, value, sub, color }) => (
                      <div key={label} className="dash-card" style={{ ...glassCard, borderRadius: 14, padding: 20 }}>
                        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{icon} {label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* PLATFORM CARDS */}
              {displayPlatforms.map((p, i) => {
                const insights = getPlatformInsights(p)
                const revenueBarPct = Math.round((p.totalUSD / maxUSD) * 100)
                const uphBarPct     = Math.round((p.usdPerHour / maxUPH) * 100)
                const isTop = p.totalUSD === maxUSD && displayPlatforms.length > 1
                const avgSessionUSD = p.sessions > 0 ? (p.totalUSD / p.sessions) : 0
                const emoji = PLATFORM_EMOJI[p.platform] || "🎥"

                return (
                  <div key={i} className="dash-card" style={{
                    ...glassCard, borderRadius: 16, padding: 28, marginBottom: 20,
                    border: isTop ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: isTop ? "0 0 30px rgba(245,158,11,0.1), 0 0 60px rgba(236,72,153,0.08)" : glassCard.boxShadow
                  }}>
                    {/* HEADER */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: isTop ? "linear-gradient(135deg, rgba(245,158,11,0.3), rgba(251,146,60,0.2))" : "rgba(255,255,255,0.06)", border: isTop ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                          {emoji}
                        </div>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>{p.platform}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{p.sessions} sessions · {(p.hours || 0).toFixed(1)}h streamed</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {isTop && <div style={{ padding: "4px 12px", borderRadius: 20, background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", fontSize: 11, fontWeight: 700, color: C.gold }}>🏆 Top Platform</div>}
                        <div style={{ fontSize: 11, color: C.muted, padding: "4px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>#{i + 1} of {displayPlatforms.length}</div>
                      </div>
                    </div>

                    {/* STAT GRID */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                      {[
                        { label: "Total Revenue", value: `$${(p.totalUSD || 0).toFixed(2)}`, color: C.green },
                        { label: "$/Hour", value: `$${(p.usdPerHour || 0).toFixed(2)}`, color: C.cyan },
                        { label: "Avg Session", value: `$${(avgSessionUSD || 0).toFixed(2)}`, color: C.pink },
                        { label: "Avg Tip Size", value: `$${(p.avgTipSize || 0).toFixed(2)}`, color: C.gold },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* PERFORMANCE BARS */}
                    <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { label: "Revenue share", pct: revenueBarPct, color: C.green },
                        { label: "$/Hour efficiency", pct: uphBarPct, color: C.cyan },
                      ].map(({ label, pct, color }) => (
                        <div key={label}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color }}>{pct}%</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${color}, ${color}80)`, transition: "width 0.6s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* HOURLY HEATMAP — uses trueHourlyAvg (avg per active day per UTC hour) */}
                    {(() => {
                      // Filter trueHourlyAvg to this platform using platformTimes for totals
                      const hourData = platformTimes[p.platform]?.hours || {}
                      const maxEarning = Math.max(...Object.values(hourData), 1)
                      return (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>⏰ Earnings by hour of day (UTC total)</div>
                          <div style={{ display: "flex", gap: 2, flexWrap: "nowrap", overflowX: "auto" }}>
                            {Array.from({ length: 24 }, (_, h) => {
                              const val = hourData[h] || 0
                              const intensity = val / maxEarning
                              const bg = intensity === 0
                                ? "rgba(255,255,255,0.04)"
                                : intensity < 0.33
                                ? "rgba(34,211,238,0.2)"
                                : intensity < 0.66
                                ? "rgba(34,211,238,0.55)"
                                : "rgba(34,211,238,0.95)"
                              const label = (() => { const _off=new Date().getTimezoneOffset()/-60; const _lh=Math.round(((h+_off)%24+24)%24); return _lh===0?"12a":_lh<12?`${_lh}a`:_lh===12?"12p":`${_lh-12}p` })()
                              return (
                                <div key={h} title={`${label}: $${val.toFixed(0)}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: "0 0 auto" }}>
                                  <div style={{ width: 18, height: 24, borderRadius: 3, background: bg, border: "1px solid rgba(255,255,255,0.06)" }} />
                                  {h % 6 === 0 && <div style={{ fontSize: 8, color: C.muted }}>{label}</div>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    {/* FAN LOYALTY + BEST STREAM LENGTH */}
                    {(() => {
                      const platTips = tips.filter(t => t.platform === p.platform)
                      const fanCounts = {}
                      platTips.forEach(t => { fanCounts[t.username] = (fanCounts[t.username] || 0) + 1 })
                      const loyalFans = Object.values(fanCounts).filter(c => c >= 3).length

                      const platSessions = sessions.filter(s => s.platform === p.platform)
                      const longS = platSessions.filter(s => s.durationMinutes > 60)
                      const shortS = platSessions.filter(s => s.durationMinutes <= 60)
                      const longAvg = longS.length ? longS.reduce((s, x) => s + x.totalUSD, 0) / longS.length : 0
                      const shortAvg = shortS.length ? shortS.reduce((s, x) => s + x.totalUSD, 0) / shortS.length : 0
                      const streamLengthPct = shortAvg > 0 && longAvg > shortAvg ? Math.round(((longAvg - shortAvg) / shortAvg) * 100) : 0

                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                          <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>👥 Fan Loyalty</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: C.pink }}>{loyalFans}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>fans tipped 3+ times</div>
                          </div>
                          {streamLengthPct >= 10 && longS.length >= 2 && shortS.length >= 2 ? (
                            <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>⏱️ Stream Length</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>+{streamLengthPct}%</div>
                              <div style={{ fontSize: 11, color: C.muted }}>more earned over 60 min</div>
                            </div>
                          ) : (
                            <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>📊 Sessions</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: C.cyan }}>{p.sessions}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>total streams</div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* INSIGHTS */}
                    {insights.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {insights.map((ins, j) => (
                          <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                            <span style={{ fontSize: 16, flexShrink: 0 }}>{ins.icon}</span>
                            <span style={{ fontSize: 13, color: ins.color || C.text }}>{ins.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {displayPlatforms.length === 0 && (
                <div style={{ ...glassCard, borderRadius: 14, padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>No platform data yet</div>
                  <div style={{ fontSize: 13, color: C.muted }}>Import your CSV files to see how your platforms compare</div>
                </div>
              )}
            </div>
          )
}
