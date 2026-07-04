"use client"
import React from "react"
import { C, glassCard } from "./dashboardTheme"

export default function MonthlyTab({ analytics, monthlyGoal, goalInput, setGoalInput, showGoalEditor, setShowGoalEditor, saveMonthlyGoal }) {
          const monthly = analytics?.monthlyData || []
          const tipTypes = analytics?.tipTypeBreakdown || []
          const privFans = analytics?.privateShowFans || []
          const spyFans = analytics?.spyShowFans || []
          const bestMo = analytics?.bestMonth
          const totalUSD = analytics?.totalUSD || 0
          const now = new Date()
          const thisMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`
          const thisMonth = monthly.find(m => m.month === thisMonthKey)
          const thisMonthUSD = thisMonth?.usd || 0
          const goalPct = monthlyGoal > 0 ? Math.min(100, Math.round((thisMonthUSD / monthlyGoal) * 100)) : null
          const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth()+1, 0).getDate()
          const dayOfMonth = now.getUTCDate()
          const daysLeft = daysInMonth - dayOfMonth
          const projectedEnd = thisMonthUSD > 0 ? Math.round(thisMonthUSD / dayOfMonth * daysInMonth) : null
          const maxBarUSD = Math.max(...monthly.map(m => m.usd), 1)
          const fmtMonth = (key) => { const [y,m] = key.split('-'); const mo = new Date(y,parseInt(m)-1,1).toLocaleDateString('en-US',{month:'short'}); return mo + " '" + String(y).slice(-2) }

          return (
            <div style={{ animation: "fadeUp 0.3s ease" }}>

              {/* ── HEADER ── */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
                <div>
                  <div style={{ fontSize:24, fontWeight:900, color:C.white }}>📈 Monthly Overview</div>
                  <div style={{ fontSize:13, color:C.muted }}>Earnings trends, tip types, and private show breakdown</div>
                </div>
              </div>

              {/* ── GOAL TRACKER ── */}
              <div style={{ ...glassCard, borderRadius:18, padding:24, marginBottom:24, border:"1px solid rgba(16,185,129,0.25)" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#10B981,#22D3EE)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🎯</div>
                    <div>
                      <div style={{ fontSize:16, fontWeight:800, color:C.white }}>Monthly Goal</div>
                      <div style={{ fontSize:12, color:C.muted }}>{now.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>
                    </div>
                  </div>
                  <button onClick={() => setShowGoalEditor(v => !v)} style={{ padding:"6px 14px", borderRadius:8, background:"rgba(16,185,129,0.15)", border:"1px solid rgba(16,185,129,0.35)", color:C.green, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    {monthlyGoal ? "✏️ Edit Goal" : "➕ Set Goal"}
                  </button>
                </div>

                {showGoalEditor && (
                  <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center" }}>
                    <span style={{ color:C.green, fontSize:16, fontWeight:700 }}>$</span>
                    <input
                      type="number" placeholder="e.g. 500" value={goalInput}
                      onChange={e => setGoalInput(e.target.value)}
                      onFocus={e => e.target.style.borderColor="rgba(16,185,129,0.6)"}
                      onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.1)"}
                      style={{ flex:1, padding:"8px 12px", borderRadius:8, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:C.white, fontSize:14, outline:"none" }}
                    />
                    <button onClick={() => saveMonthlyGoal(goalInput)} style={{ padding:"8px 16px", borderRadius:8, background:"linear-gradient(135deg,#10B981,#22D3EE)", border:"none", color:C.white, fontSize:13, fontWeight:700, cursor:"pointer" }}>Save</button>
                  </div>
                )}

                {monthlyGoal ? (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <span style={{ fontSize:13, color:C.muted }}>
                        <span style={{ color:C.white, fontWeight:700, fontSize:18 }}>${thisMonthUSD.toFixed(0)}</span>
                        <span style={{ color:C.muted }}> / ${monthlyGoal.toFixed(0)} goal</span>
                      </span>
                      <span style={{ fontSize:13, fontWeight:700, color: goalPct >= 100 ? C.green : goalPct >= 70 ? C.gold : C.cyan }}>{goalPct}%</span>
                    </div>
                    <div style={{ height:12, borderRadius:6, background:"rgba(255,255,255,0.08)", overflow:"hidden", marginBottom:10 }}>
                      <div style={{ height:"100%", width:`${goalPct}%`, borderRadius:6, background: goalPct >= 100 ? "linear-gradient(90deg,#10B981,#22D3EE)" : goalPct >= 70 ? "linear-gradient(90deg,#F59E0B,#10B981)" : "linear-gradient(90deg,#22D3EE,#7C5CFF)", transition:"width 0.8s ease" }} />
                    </div>
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                      <span style={{ fontSize:12, color:C.muted }}>{daysLeft} days left this month</span>
                      {projectedEnd && <span style={{ fontSize:12, color: projectedEnd >= monthlyGoal ? C.green : C.orange }}>At this pace: ${projectedEnd} projected</span>}
                      {goalPct >= 100 && <span style={{ fontSize:12, color:C.green, fontWeight:700 }}>🎉 Goal smashed!</span>}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign:"center", padding:"12px 0", color:C.muted, fontSize:13 }}>Set a monthly earnings goal to track your progress here</div>
                )}
              </div>

              {/* ── BEST MONTH CALLOUT ── */}
              {bestMo && (
                <div style={{ ...glassCard, borderRadius:14, padding:18, marginBottom:24, border:"1px solid rgba(245,158,11,0.3)", background:"rgba(245,158,11,0.06)", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                  <div style={{ fontSize:28 }}>🏆</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:C.gold, fontWeight:700, marginBottom:2 }}>Best Month Ever</div>
                    <div style={{ fontSize:20, fontWeight:900, color:C.white }}>{fmtMonth(bestMo.month)} — ${bestMo.usd.toLocaleString('en-US',{minimumFractionDigits:0})}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{bestMo.fans} fans · {bestMo.tips} tips · ${bestMo.usdPerFan} avg per fan</div>
                  </div>
                  {thisMonthUSD > 0 && (
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:11, color:C.muted }}>vs this month</div>
                      <div style={{ fontSize:14, fontWeight:700, color: thisMonthUSD >= bestMo.usd ? C.green : C.orange }}>
                        {thisMonthUSD >= bestMo.usd ? "🔥 New record!" : `${Math.round((thisMonthUSD/bestMo.usd)*100)}% there`}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── MONTHLY BAR CHART ── */}
              <div style={{ ...glassCard, borderRadius:18, padding:24, marginBottom:24 }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.white, marginBottom:4 }}>Monthly Earnings</div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:20 }}>{monthly.length} months of data</div>
                {monthly.length === 0 ? (
                  <div style={{ textAlign:"center", padding:40, color:C.muted }}>No monthly data yet — upload a CSV to get started</div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:6, minWidth: Math.max(monthly.length * 44, 400), height:180, paddingBottom:24, position:"relative" }}>
                      {/* Grid lines */}
                      {[0.25,0.5,0.75,1].map(pct => (
                        <div key={pct} style={{ position:"absolute", left:0, right:0, bottom: pct*180+24+"px", borderTop:"1px solid rgba(255,255,255,0.05)", pointerEvents:"none" }}>
                          <span style={{ fontSize:9, color:C.muted, position:"absolute", left:0, top:-9 }}>${Math.round(maxBarUSD*pct)}</span>
                        </div>
                      ))}
                      {monthly.map((m, i) => {
                        const h = Math.max(4, Math.round((m.usd / maxBarUSD) * 156))
                        const isBest = m.month === bestMo?.month
                        const isCurrent = m.month === thisMonthKey
                        const col = isBest ? C.gold : isCurrent ? C.green : C.indigo
                        return (
                          <div key={m.month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"default" }}
                            title={`${fmtMonth(m.month)}: $${m.usd.toFixed(2)} · ${m.fans} fans · ${m.tips} tips`}>
                            <div style={{ fontSize:9, color:C.muted, fontWeight:600, opacity: m.usd > maxBarUSD*0.1 ? 1 : 0 }}>${m.usd >= 100 ? Math.round(m.usd) : m.usd.toFixed(0)}</div>
                            <div style={{ width:"100%", height:h, borderRadius:"4px 4px 0 0", background: isBest ? `linear-gradient(180deg,${C.gold},${C.orange})` : isCurrent ? `linear-gradient(180deg,${C.green},${C.cyan})` : `linear-gradient(180deg,${C.indigo},rgba(124,92,255,0.4))`, boxShadow: isBest ? `0 0 12px ${C.gold}40` : isCurrent ? `0 0 12px ${C.green}40` : "none", transition:"height 0.4s ease", animationDelay:`${i*30}ms` }} />
                            <div style={{ fontSize:9, color: isCurrent ? C.green : isBest ? C.gold : C.muted, fontWeight: isCurrent || isBest ? 700 : 400, whiteSpace:"nowrap" }}>{fmtMonth(m.month)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* Legend */}
                <div style={{ display:"flex", gap:16, marginTop:8, flexWrap:"wrap" }}>
                  {[["🟡","Best month",C.gold],["🟢","This month",C.green],["🟣","Past months",C.indigo]].map(([dot,label,col]) => (
                    <span key={label} style={{ fontSize:11, color:C.muted, display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ width:8, height:8, borderRadius:2, background:col, display:"inline-block" }} />{label}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── MONTHLY STATS GRID ── */}
              {monthly.length > 0 && (() => {
                const last3 = monthly.slice(-3)
                const avgMonthly = monthly.reduce((s,m) => s+m.usd, 0) / monthly.length
                const trend = monthly.length >= 2 ? monthly[monthly.length-1].usd - monthly[monthly.length-2].usd : 0
                return (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
                    {[
                      { label:"Avg / Month", value:`$${Math.round(avgMonthly)}`, icon:"📊", color:C.cyan },
                      { label:"Best Month", value:`$${bestMo?.usd?.toFixed(0)||0}`, sub:bestMo ? fmtMonth(bestMo.month) : '', icon:"🏆", color:C.gold },
                      { label:"MoM Trend", value: trend >= 0 ? `+$${Math.round(trend)}` : `-$${Math.round(Math.abs(trend))}`, icon: trend >= 0 ? "📈" : "📉", color: trend >= 0 ? C.green : C.red },
                      { label:"Months Tracked", value: monthly.length, icon:"📅", color:C.indigo },
                    ].map(({ label, value, sub, icon, color }) => (
                      <div key={label} style={{ ...glassCard, borderRadius:14, padding:16, border:`1px solid ${color}20` }}>
                        <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>{icon} {label}</div>
                        <div style={{ fontSize:20, fontWeight:900, color }}>{value}</div>
                        {sub && <div style={{ fontSize:11, color:C.muted }}>{sub}</div>}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* ── TIP TYPE BREAKDOWN ── */}
              <div style={{ ...glassCard, borderRadius:18, padding:24, marginBottom:24 }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.white, marginBottom:4 }}>Revenue by Type</div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:20 }}>How your earnings break down across tips, privates, and spy shows</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {tipTypes.map(t => {
                    const col = t.type.toLowerCase().includes('private') ? C.pink : t.type.toLowerCase().includes('spy') ? C.orange : t.type.toLowerCase().includes('received') ? C.cyan : C.indigo
                    return (
                      <div key={t.type} style={{ padding:"14px 16px", borderRadius:12, background:`${col}0d`, border:`1px solid ${col}25` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:C.white }}>{t.type}</div>
                          <div style={{ fontSize:16, fontWeight:900, color:col }}>${t.usd.toFixed(2)} <span style={{ fontSize:12, color:C.muted }}>({t.pct}%)</span></div>
                        </div>
                        <div style={{ height:6, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden", marginBottom:8 }}>
                          <div style={{ height:"100%", width:`${t.pct}%`, borderRadius:3, background:col, transition:"width 0.8s ease" }} />
                        </div>
                        <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                          {[
                            [`${t.count} tips`],
                            [`${t.fans} fans`],
                            [`$${t.avgUsd} avg tip`],
                          ].map(([v]) => <span key={v} style={{ fontSize:11, color:C.muted }}>{v}</span>)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── PRIVATE SHOW INTEL ── */}
              {privFans.length > 0 && (
                <div style={{ ...glassCard, borderRadius:18, padding:24, marginBottom:24, border:"1px solid rgba(236,72,153,0.2)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#EC4899,#7C5CFF)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🔒</div>
                    <div>
                      <div style={{ fontSize:16, fontWeight:800, color:C.white }}>Private Show Fans</div>
                      <div style={{ fontSize:12, color:C.muted }}>{privFans.length} fans have booked a private show</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {privFans.slice(0,8).map((f,i) => (
                      <div key={f.username} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:10, background:"rgba(236,72,153,0.07)", border:"1px solid rgba(236,72,153,0.15)" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg,#EC4899,#7C5CFF)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:C.white, flexShrink:0 }}>{f.username[0]?.toUpperCase()}</div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{f.username}</div>
                            <div style={{ fontSize:11, color:C.muted }}>{f.count} private{f.count>1?'s':''}</div>
                          </div>
                        </div>
                        <div style={{ fontSize:14, fontWeight:700, color:C.pink }}>${f.usd.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                  {spyFans.length > 0 && (
                    <div style={{ marginTop:16, padding:"12px 14px", borderRadius:10, background:"rgba(251,146,60,0.07)", border:"1px solid rgba(251,146,60,0.2)" }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.orange, marginBottom:4 }}>👁️ Spy Show Viewers ({spyFans.length} fans)</div>
                      <div style={{ fontSize:12, color:C.muted }}>These fans watched your privates but never booked one — warm leads for re-engagement</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                        {spyFans.slice(0,10).map(u => (
                          <span key={u} style={{ padding:"3px 8px", borderRadius:6, background:"rgba(251,146,60,0.12)", border:"1px solid rgba(251,146,60,0.2)", fontSize:11, color:C.orange }}>{u}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── MONTHLY FAN TABLE ── */}
              {monthly.length > 0 && (
                <div style={{ ...glassCard, borderRadius:18, padding:24 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:C.white, marginBottom:16 }}>Month by Month</div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                      <thead>
                        <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                          {["Month","Revenue","Tips","Fans","$/Fan","Sessions"].map(h => (
                            <th key={h} style={{ padding:"8px 12px", textAlign:"left", color:C.muted, fontWeight:600, fontSize:11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...monthly].reverse().map((m,i) => {
                          const isBest = m.month === bestMo?.month
                          const isCurrent = m.month === thisMonthKey
                          return (
                            <tr key={m.month} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)", background: isBest ? "rgba(245,158,11,0.06)" : isCurrent ? "rgba(16,185,129,0.06)" : "transparent" }}>
                              <td style={{ padding:"10px 12px", color: isBest ? C.gold : isCurrent ? C.green : C.white, fontWeight: isBest||isCurrent ? 700 : 400 }}>{fmtMonth(m.month)}{isBest?" 🏆":isCurrent?" ◀":""}</td>
                              <td style={{ padding:"10px 12px", color:C.white, fontWeight:700 }}>${m.usd.toFixed(2)}</td>
                              <td style={{ padding:"10px 12px", color:C.muted }}>{m.tips}</td>
                              <td style={{ padding:"10px 12px", color:C.muted }}>{m.fans}</td>
                              <td style={{ padding:"10px 12px", color:C.cyan }}>${m.usdPerFan}</td>
                              <td style={{ padding:"10px 12px", color:C.muted }}>{m.sessions}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )
}
