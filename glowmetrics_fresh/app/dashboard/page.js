"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { aggregateRows } from "../../lib/analytics"
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart,
} from "recharts"

const G = {
  bg:"#05050f", bg1:"#090918", bg2:"#0e0e22", bg3:"#13132d", bg4:"#181838",
  border:"#1a1a3e", border2:"#252550",
  glow:"#c084fc", glow2:"#e879f9", teal:"#2dd4bf",
  gold:"#fbbf24", green:"#34d399", pink:"#f472b6",
  blue:"#60a5fa", orange:"#fb923c", red:"#f87171",
  white:"#faf5ff", med:"#a78bca", dim:"#5b4d7a",
}

const PLATFORM_COLORS = { Chaturbate:"#f97316", BongaCams:"#a855f7", MyFreeCams:"#3b82f6" }
const PIE_COLORS = [G.glow, G.teal, G.pink, G.gold, G.blue, G.orange]
const STATUS_COLORS = { "🐳 WHALE":G.gold, "🦈 SHARK":G.blue, "💤 DORMANT":G.orange, "🐟 REGULAR":G.dim }

// ─── SHARED ──────────────────────────────────────────────────────────────────
const Card = ({ children, style={} }) => (
  <div style={{ background:G.bg2, border:`1px solid ${G.border}`, borderRadius:14, padding:24, ...style }}>{children}</div>
)

const Sec = ({ icon, title, sub }) => (
  <div style={{ marginBottom:18 }}>
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span>{icon}</span>
      <span style={{ fontSize:12, fontWeight:700, color:G.white, fontFamily:"'DM Mono',monospace", letterSpacing:"0.1em", textTransform:"uppercase" }}>{title}</span>
    </div>
    {sub && <p style={{ margin:"3px 0 0 24px", fontSize:11, color:G.dim, fontFamily:"'DM Mono',monospace" }}>{sub}</p>}
  </div>
)

const Tip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null
  return (
    <div style={{ background:G.bg3, border:`1px solid ${G.border2}`, borderRadius:8, padding:"10px 14px", fontFamily:"'DM Mono',monospace", fontSize:11 }}>
      <div style={{ color:G.med, marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => <div key={i} style={{ color:p.color||G.glow, fontWeight:700 }}>{typeof p.value==="number"&&p.name!=="tokens"?`$${p.value.toFixed(2)}`:p.value?.toLocaleString()} {p.name}</div>)}
    </div>
  )
}

const KPI = ({ icon, label, value, sub, accent, xs }) => (
  <div style={{
    background:G.bg2, border:`1px solid ${G.border}`, borderRadius:14,
    padding:"18px 20px 14px", borderTop:`3px solid ${accent}`,
    position:"relative", overflow:"hidden",
  }}>
    <div style={{ position:"absolute", top:0, right:0, width:80, height:80, background:`radial-gradient(circle at top right, ${accent}15, transparent 70%)`, pointerEvents:"none" }} />
    <div style={{ fontSize:10, color:G.dim, fontFamily:"'DM Mono',monospace", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:7 }}>{icon} {label}</div>
    <div style={{ fontSize: xs ? 20 : 26, fontWeight:800, color:accent, fontFamily:"'DM Mono',monospace", lineHeight:1.1 }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:G.dim, marginTop:5, fontFamily:"'DM Mono',monospace" }}>{sub}</div>}
  </div>
)

const Empty = ({ msg }) => (
  <div style={{ padding:"36px 0", textAlign:"center", color:G.dim, fontFamily:"'DM Mono',monospace", fontSize:12 }}>{msg}</div>
)

// ─── VIEWS ────────────────────────────────────────────────────────────────────

function DashboardView({ data }) {
  const { totals, daily, cumulative, platforms, tipTypes, bestDay, bestMonth, biggestTip } = data
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* KPI grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14 }}>
        <KPI icon="💰" label="Lifetime Earnings"   value={`$${totals.usd.toLocaleString("en-US",{minimumFractionDigits:2})}`} accent={G.green}  sub={`${totals.tips.toLocaleString()} transactions`} />
        <KPI icon="🪙" label="Total Tokens"         value={totals.tokens.toLocaleString()}                                    accent={G.glow}   sub="All platforms" />
        <KPI icon="📊" label="Avg Tip"               value={`$${totals.avgTip.toFixed(2)}`}                                   accent={G.blue}   sub="Per transaction" />
        <KPI icon="📅" label="Avg / Active Day"      value={`$${totals.avgPerDay.toFixed(2)}`}                                accent={G.teal}   sub={`${totals.activeDays} active days`} />
        <KPI icon="👥" label="Unique Tippers"         value={totals.uniqueTippers.toLocaleString()}                            accent={G.pink}   sub="Lifetime fans" />
        <KPI icon="🐳" label="Top Whale"              value={`$${totals.topWhaleUsd.toFixed(2)}`}                              accent={G.gold}   sub={totals.topWhale} xs />
      </div>

      {/* Secondary KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14 }}>
        <KPI icon="🏆" label="Best Day"       value={`$${bestDay.usd.toFixed(2)}`}    accent={G.orange} sub={bestDay.date} />
        <KPI icon="📆" label="Best Month"     value={`$${bestMonth.usd.toFixed(2)}`}  accent={G.glow2}  sub={bestMonth.month} />
        <KPI icon="💎" label="Biggest Tip"    value={`$${biggestTip.usd.toFixed(2)}`} accent={G.gold}   sub={biggestTip.username} xs />
        <KPI icon="🐳" label="Whales"         value={totals.whales.toString()}         accent={G.gold}   sub="$50+ lifetime" />
        <KPI icon="🦈" label="Sharks"         value={totals.sharks.toString()}         accent={G.blue}   sub="$20–$49 lifetime" />
        <KPI icon="💤" label="Dormant"        value={totals.dormant.toString()}        accent={G.orange} sub="60+ days inactive" />
      </div>

      {/* Cumulative earnings */}
      <Card>
        <Sec icon="📈" title="Cumulative Earnings" sub="All-time running total" />
        {cumulative.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cumulative} margin={{top:5,right:10,left:0,bottom:5}}>
              <defs>
                <linearGradient id="gCum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={G.glow} stopOpacity={0.35}/>
                  <stop offset="95%" stopColor={G.glow} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={G.border}/>
              <XAxis dataKey="date" tick={{fill:G.dim,fontSize:9,fontFamily:"'DM Mono',monospace"}} tickFormatter={d=>d.slice(5)} interval="preserveStartEnd"/>
              <YAxis tick={{fill:G.dim,fontSize:10,fontFamily:"'DM Mono',monospace"}} tickFormatter={v=>`$${v>=1000?`${(v/1000).toFixed(0)}k`:v}`}/>
              <Tooltip content={<Tip/>}/>
              <Area type="monotone" dataKey="cumulative" name="cumulative $" stroke={G.glow} fill="url(#gCum)" strokeWidth={2} dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        ) : <Empty msg="Import a CSV to see your earnings chart"/>}
      </Card>

      {/* Platform + Tip Type */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card>
          <Sec icon="🌐" title="Platform Split"/>
          {platforms.filter(p=>p.usd>0).length > 0 ? platforms.filter(p=>p.usd>0).map((p,i) => {
            const tot = platforms.reduce((s,x)=>s+x.usd,0)
            const pct = tot > 0 ? (p.usd/tot*100).toFixed(1) : 0
            const col = PLATFORM_COLORS[p.platform] || PIE_COLORS[i]
            return (
              <div key={p.platform} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ color:G.white, fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{p.platform}</span>
                  <span style={{ color:col, fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>${p.usd.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                </div>
                <div style={{ background:G.bg3, borderRadius:4, height:5, overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:col, borderRadius:4, transition:"width 1s ease" }}/>
                </div>
                <div style={{ fontSize:10, color:G.dim, marginTop:3, fontFamily:"'DM Mono',monospace" }}>{pct}% · {p.count.toLocaleString()} tips · {p.tokens.toLocaleString()} tokens</div>
              </div>
            )
          }) : <Empty msg="No platform data yet"/>}
        </Card>
        <Card>
          <Sec icon="🎯" title="By Tip Type"/>
          {tipTypes.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={tipTypes} dataKey="usd" nameKey="type" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3}>
                  {tipTypes.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={v=>`$${v.toFixed(2)}`} contentStyle={{background:G.bg3,border:`1px solid ${G.border2}`,borderRadius:8,fontFamily:"'DM Mono',monospace",fontSize:11}}/>
                <Legend iconType="circle" iconSize={7} formatter={v=><span style={{color:G.med,fontFamily:"'DM Mono',monospace",fontSize:10}}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty msg="No data yet"/>}
        </Card>
      </div>
    </div>
  )
}

function AnalyticsView({ data }) {
  const { daily, monthly, hourly, peakHour, cumulative } = data
  const [view, setView] = useState("daily")

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Daily earnings bar */}
      <Card>
        <Sec icon="📅" title="Earnings by Day" sub={`${daily.length} active days`}/>
        {daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={daily.slice(-60)} margin={{top:5,right:10,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke={G.border}/>
              <XAxis dataKey="date" tick={{fill:G.dim,fontSize:9,fontFamily:"'DM Mono',monospace"}} tickFormatter={d=>d.slice(5)} interval={Math.max(1,Math.floor(daily.slice(-60).length/12))}/>
              <YAxis tick={{fill:G.dim,fontSize:10,fontFamily:"'DM Mono',monospace"}} tickFormatter={v=>`$${v}`}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="usd" name="usd" fill={G.glow} radius={[3,3,0,0]}>
                {daily.slice(-60).map((_,i) => <Cell key={i} fill={i===daily.slice(-60).length-1?G.glow2:G.glow}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty msg="Import a CSV to see daily earnings"/>}
      </Card>

      {/* Monthly breakdown */}
      <Card>
        <Sec icon="📆" title="Monthly Earnings" sub="USD per calendar month"/>
        {monthly.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={monthly} margin={{top:5,right:10,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke={G.border}/>
              <XAxis dataKey="month" tick={{fill:G.dim,fontSize:9,fontFamily:"'DM Mono',monospace"}}/>
              <YAxis tick={{fill:G.dim,fontSize:10,fontFamily:"'DM Mono',monospace"}} tickFormatter={v=>`$${v}`}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="usd" name="usd" fill={G.teal} radius={[3,3,0,0]}/>
              <Line type="monotone" dataKey="usd" stroke={G.glow} strokeWidth={2} dot={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        ) : <Empty msg="No monthly data yet"/>}
      </Card>

      {/* Peak hours */}
      <Card>
        <Sec icon="⏰" title="Peak Streaming Hours" sub={`Most active: ${peakHour?.label||"—"} · ${peakHour?.tokens?.toLocaleString()||0} tokens`}/>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={hourly} margin={{top:5,right:10,left:0,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke={G.border}/>
            <XAxis dataKey="label" tick={{fill:G.dim,fontSize:9,fontFamily:"'DM Mono',monospace"}} interval={1}/>
            <YAxis tick={{fill:G.dim,fontSize:10,fontFamily:"'DM Mono',monospace"}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
            <Tooltip content={<Tip/>}/>
            <Bar dataKey="tokens" name="tokens" radius={[3,3,0,0]}>
              {hourly.map((e,i) => <Cell key={i} fill={e.tokens===peakHour?.tokens?G.gold:e.tokens>1500?G.glow:e.tokens>700?G.blue:G.dim}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Daily table */}
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"16px 20px 0" }}><Sec icon="📋" title="Daily Breakdown" sub="Last 30 active days"/></div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'DM Mono',monospace", fontSize:12 }}>
            <thead>
              <tr style={{ background:G.bg3 }}>
                {["Date","USD","Tokens","Tips","Avg USD/tip"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"10px 16px", color:G.dim, borderBottom:`1px solid ${G.border}`, fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daily.length===0
                ? <tr><td colSpan={5} style={{ padding:"28px", textAlign:"center", color:G.dim }}>No data yet</td></tr>
                : daily.slice(-30).reverse().map((d,i) => (
                  <tr key={d.date} style={{ background:i%2===0?G.bg2:G.bg3 }}>
                    <td style={{ padding:"9px 16px", color:G.med }}>{d.date}</td>
                    <td style={{ padding:"9px 16px", color:G.green, fontWeight:700 }}>${d.usd.toFixed(2)}</td>
                    <td style={{ padding:"9px 16px", color:G.glow }}>{d.tokens.toLocaleString()}</td>
                    <td style={{ padding:"9px 16px", color:G.dim }}>{d.count}</td>
                    <td style={{ padding:"9px 16px", color:G.blue }}>${(d.usd/d.count).toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function CRMView({ data, notes, followUp, onNote, onFollow }) {
  const { topTippers } = data
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [sort, setSort] = useState("usd")

  const filtered = topTippers
    .filter(t => t.username.toLowerCase().includes(search.toLowerCase()) && (filter==="all"||t.status.includes(filter)))
    .sort((a,b) => sort==="usd"?b.usd-a.usd : sort==="tokens"?b.tokens-a.tokens : sort==="count"?b.count-a.count : b.daysSince-a.daysSince)

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
        {[
          ["🐳 Whales",  topTippers.filter(t=>t.status.includes("WHALE")).length,   G.gold],
          ["🦈 Sharks",  topTippers.filter(t=>t.status.includes("SHARK")).length,   G.blue],
          ["🐟 Regular", topTippers.filter(t=>t.status.includes("REGULAR")).length, G.dim],
          ["💤 Dormant", topTippers.filter(t=>t.status.includes("DORMANT")).length, G.orange],
          ["⭐ Flagged", Object.values(followUp).filter(Boolean).length,            G.pink],
        ].map(([label,val,col]) => (
          <div key={label} style={{ background:G.bg2, border:`1px solid ${G.border}`, borderRadius:12, padding:"14px 16px", borderLeft:`3px solid ${col}` }}>
            <div style={{ fontSize:10, color:G.dim, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.1em" }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:col, fontFamily:"'DM Mono',monospace", marginTop:4 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search username..."
          style={{ flex:1, minWidth:180, background:G.bg2, border:`1px solid ${G.border}`, borderRadius:8, padding:"9px 14px", color:G.white, fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none" }}
          onFocus={e=>e.target.style.borderColor=G.glow} onBlur={e=>e.target.style.borderColor=G.border}/>

        <div style={{ display:"flex", gap:6 }}>
          {["all","WHALE","SHARK","REGULAR","DORMANT"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{
              background:filter===f?G.glow:"transparent", color:filter===f?G.bg:G.dim,
              border:`1px solid ${filter===f?G.glow:G.border}`, borderRadius:7,
              padding:"8px 14px", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:700, transition:"all 0.15s"
            }}>{f==="all"?"All":f==="WHALE"?"🐳":f==="SHARK"?"🦈":f==="REGULAR"?"🐟":"💤"}</button>
          ))}
        </div>

        <select value={sort} onChange={e=>setSort(e.target.value)}
          style={{ background:G.bg2, border:`1px solid ${G.border}`, borderRadius:8, padding:"9px 12px", color:G.med, fontSize:12, fontFamily:"'DM Mono',monospace", outline:"none" }}>
          <option value="usd">Sort: USD</option>
          <option value="tokens">Sort: Tokens</option>
          <option value="count">Sort: Tips</option>
          <option value="daysSince">Sort: Inactive</option>
        </select>
      </div>

      {/* Table */}
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'DM Mono',monospace", fontSize:11 }}>
            <thead>
              <tr style={{ background:G.bg3 }}>
                {["","Username","Total $","Tokens","Tips","Avg Token","Best Tip","First","Last","Days Ago","Follow Up","Notes"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"10px 12px", color:G.dim, borderBottom:`1px solid ${G.border}`, fontSize:9, letterSpacing:"0.08em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0
                ? <tr><td colSpan={12} style={{ padding:"28px", textAlign:"center", color:G.dim }}>No tippers found</td></tr>
                : filtered.map((t,i) => {
                  const col = STATUS_COLORS[t.status]||G.dim
                  const avgToken = t.count > 0 ? (t.tokens/t.count).toFixed(1) : 0
                  return (
                    <tr key={t.username} style={{ background:i%2===0?G.bg2:G.bg3, borderLeft:`3px solid ${col}` }}>
                      <td style={{ padding:"9px 12px" }}><span style={{ fontSize:14 }}>{t.status.split(" ")[0]}</span></td>
                      <td style={{ padding:"9px 12px", color:G.white, fontWeight:700, maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.username}</td>
                      <td style={{ padding:"9px 12px", color:G.green, fontWeight:700 }}>${t.usd.toFixed(2)}</td>
                      <td style={{ padding:"9px 12px", color:G.glow }}>{t.tokens.toLocaleString()}</td>
                      <td style={{ padding:"9px 12px", color:G.dim }}>{t.count}</td>
                      <td style={{ padding:"9px 12px", color:G.med }}>{avgToken}</td>
                      <td style={{ padding:"9px 12px", color:G.gold }}>{t.tokens}</td>
                      <td style={{ padding:"9px 12px", color:G.dim, whiteSpace:"nowrap" }}>{t.first}</td>
                      <td style={{ padding:"9px 12px", color:G.dim, whiteSpace:"nowrap" }}>{t.last}</td>
                      <td style={{ padding:"9px 12px", color: t.daysSince>60?G.orange:G.dim }}>{t.daysSince}d</td>
                      <td style={{ padding:"9px 12px" }}>
                        <button onClick={()=>onFollow(t.username)} style={{
                          background:followUp[t.username]?G.pink:"transparent",
                          border:`1px solid ${followUp[t.username]?G.pink:G.border}`,
                          color:followUp[t.username]?G.bg:G.dim,
                          borderRadius:5, padding:"3px 9px", fontSize:10, transition:"all 0.15s"
                        }}>{followUp[t.username]?"★":"☆"}</button>
                      </td>
                      <td style={{ padding:"5px 12px", minWidth:150 }}>
                        <input value={notes[t.username]||""} placeholder="Add note..."
                          onChange={e=>onNote(t.username,e.target.value)}
                          style={{ width:"100%", background:"transparent", border:`1px solid transparent`, borderRadius:5, padding:"4px 7px", color:G.med, fontSize:10, outline:"none" }}
                          onFocus={e=>e.target.style.borderColor=G.glow}
                          onBlur={e=>e.target.style.borderColor=notes[t.username]?G.border2:"transparent"}/>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function UploadView({ session, onDone }) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState(null)
  const [replace, setReplace] = useState(false)
  const ref = useRef()

  const upload = useCallback(async (file) => {
    if (!file) return
    setStatus({ type:"loading", msg:`Uploading ${file.name}...` })
    const fd = new FormData()
    fd.append("file", file)
    fd.append("replace", replace.toString())
    try {
      const res = await fetch("/api/upload", { method:"POST", headers:{ Authorization:`Bearer ${session.access_token}` }, body:fd })
      const d = await res.json()
      if (!res.ok) { setStatus({ type:"error", msg:d.error }); return }
      setStatus({ type:"success", msg:`✅ Imported ${d.inserted.toLocaleString()} rows!` })
      setTimeout(onDone, 1000)
    } catch { setStatus({ type:"error", msg:"Upload failed." }) }
  }, [replace, session, onDone])

  return (
    <div style={{ maxWidth:580, margin:"0 auto", paddingTop:40 }}>
      <div style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{ fontSize:44, marginBottom:12 }}>📥</div>
        <h2 style={{ color:G.white, fontSize:22, fontWeight:800, margin:"0 0 8px", letterSpacing:"-0.02em" }}>Import Your Data</h2>
        <p style={{ color:G.med, fontSize:14, fontFamily:"'Space Grotesk',sans-serif" }}>Your CSV is encrypted and completely private to your account</p>
      </div>

      <div onClick={()=>ref.current?.click()}
        onDragOver={e=>{e.preventDefault();setDragging(true)}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);upload(e.dataTransfer.files[0])}}
        style={{
          border:`2px dashed ${dragging?G.glow:G.border2}`, borderRadius:18,
          padding:"56px 40px", textAlign:"center", cursor:"pointer",
          background:dragging?`${G.glow}06`:G.bg2, transition:"all 0.2s",
          boxShadow:dragging?`0 0 40px ${G.glow}20`:"none",
        }}>
        <div style={{ fontSize:32, marginBottom:10 }}>⬆️</div>
        <div style={{ color:G.white, fontWeight:700, fontSize:15, marginBottom:6 }}>Drop CSV here or click to browse</div>
        <div style={{ color:G.dim, fontSize:12, fontFamily:"'DM Mono',monospace" }}>Chaturbate · BongaCams · MyFreeCams</div>
      </div>
      <input ref={ref} type="file" accept=".csv" style={{ display:"none" }} onChange={e=>upload(e.target.files[0])}/>

      <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:10 }}>
        <input type="checkbox" id="rep" checked={replace} onChange={e=>setReplace(e.target.checked)} style={{ width:15, height:15, accentColor:G.pink }}/>
        <label htmlFor="rep" style={{ color:G.dim, fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer" }}>Replace all existing data (instead of appending)</label>
      </div>

      {status && (
        <div style={{
          marginTop:18, padding:"13px 16px", borderRadius:10,
          background:status.type==="error"?`${G.red}15`:status.type==="success"?`${G.green}15`:G.bg3,
          border:`1px solid ${status.type==="error"?G.red:status.type==="success"?G.green:G.border}`,
          color:status.type==="error"?G.red:status.type==="success"?G.green:G.med,
          fontFamily:"'DM Mono',monospace", fontSize:13,
        }}>{status.msg}</div>
      )}

      <div style={{ marginTop:28, padding:"18px 22px", background:G.bg2, borderRadius:12, border:`1px solid ${G.border}` }}>
        <div style={{ color:G.dim, fontFamily:"'DM Mono',monospace", fontSize:10, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.1em" }}>Expected CSV format</div>
        <pre style={{ color:G.teal, fontSize:11, fontFamily:"'DM Mono',monospace", margin:0, overflowX:"auto", lineHeight:1.7 }}>{`Date_Time,Platform,Username,Tip_Type,Tokens,USD
2026-02-12 05:05,Chaturbate,username,Tip,5,0.25
2025-09-27 22:19,BongaCams,username,FreeChat,50,2.50`}</pre>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"dashboard", label:"Dashboard", icon:"✦" },
  { id:"analytics",  label:"Analytics",  icon:"📈" },
  { id:"crm",        label:"Fan CRM",    icon:"💎" },
  { id:"upload",     label:"Import CSV", icon:"📥" },
]

const EMPTY_DATA = {
  daily:[], cumulative:[], monthly:[],
  hourly: Array.from({length:24},(_,h)=>({ h, label:`${h===0?12:h>12?h-12:h}${h<12?"am":"pm"}`, tokens:0, usd:0, count:0 })),
  topTippers:[], platforms:[], tipTypes:[],
  peakHour:{ label:"—", tokens:0 },
  bestDay:{ usd:0, date:"—" }, bestMonth:{ usd:0, month:"—" },
  biggestTip:{ usd:0, username:"—", tokens:0 }, maxStreak:0,
  totals:{ usd:0, tokens:0, tips:0, avgTip:0, avgPerDay:0, uniqueTippers:0, activeDays:0, topWhale:"—", topWhaleUsd:0, topWhaleTokens:0, whales:0, sharks:0, dormant:0 }
}

export default function Dashboard() {
  const router = useRouter()
  const [session, setSession]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [rows, setRows]         = useState([])
  const [notes, setNotes]       = useState({})
  const [followUp, setFollowUp] = useState({})
  const [tab, setTab]           = useState("dashboard")
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (!session) { router.replace("/login"); return }
      setSession(session); setLoading(false)
    })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => {
      if (!s) router.replace("/login"); else setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [router])

  const load = useCallback(async () => {
    if (!session) return
    setFetching(true)
    const [{ data:tips }, { data:noteRows }] = await Promise.all([
      supabase.from("tips").select("*").order("date_time",{ascending:true}),
      supabase.from("tipper_notes").select("*"),
    ])
    if (tips) setRows(tips)
    if (noteRows) {
      const n={}, f={}
      noteRows.forEach(r => { n[r.tipper_username]=r.note||""; f[r.tipper_username]=r.follow_up||false })
      setNotes(n); setFollowUp(f)
    }
    setFetching(false)
  }, [session])

  useEffect(() => { load() }, [load])

  const handleNote = async (username, note) => {
    setNotes(n=>({...n,[username]:note}))
    await supabase.from("tipper_notes").upsert({ user_id:session.user.id, tipper_username:username, note, follow_up:followUp[username]||false, updated_at:new Date().toISOString() },{ onConflict:"user_id,tipper_username" })
  }
  const handleFollow = async (username) => {
    const v = !followUp[username]
    setFollowUp(f=>({...f,[username]:v}))
    await supabase.from("tipper_notes").upsert({ user_id:session.user.id, tipper_username:username, follow_up:v, note:notes[username]||"", updated_at:new Date().toISOString() },{ onConflict:"user_id,tipper_username" })
  }
  const signOut = async () => { await supabase.auth.signOut(); router.replace("/landing") }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:G.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:36, height:36, borderRadius:"50%", border:"2px solid transparent", borderTopColor:G.glow, animation:"spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const data = rows.length > 0 ? aggregateRows(rows) : EMPTY_DATA
  const hasData = rows.length > 0

  return (
    <div style={{ minHeight:"100vh", background:G.bg, fontFamily:"'Syne', sans-serif" }}>
      <style>{`input::placeholder{color:#2e2a4a} input:focus{outline:none} button{cursor:pointer}`}</style>

      {/* NAV */}
      <nav style={{ background:G.bg1, borderBottom:`1px solid ${G.border}`, padding:"0 24px", position:"sticky", top:0, zIndex:100, backdropFilter:"blur(16px)" }}>
        <div style={{ maxWidth:1260, margin:"0 auto", display:"flex", alignItems:"center", height:58 }}>
          <div style={{ marginRight:32, display:"flex", alignItems:"center", gap:9 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#c084fc,#e879f9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, boxShadow:"0 0 16px #c084fc40" }}>✦</div>
            <span style={{ fontSize:15, fontWeight:800, color:G.white, letterSpacing:"-0.02em" }}>Glow<span style={{color:G.glow}}>Metrics</span></span>
          </div>

          <div style={{ display:"flex", gap:2, flex:1 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                background:"transparent",
                borderBottom:tab===t.id?`2px solid ${G.glow}`:"2px solid transparent",
                border:"none", borderRadius:0,
                color:tab===t.id?G.glow:G.dim,
                padding:"0 18px", height:58, fontWeight:700, fontSize:13,
                letterSpacing:"-0.01em", display:"flex", alignItems:"center", gap:7,
                transition:"color 0.2s",
              }}>
                <span style={{ fontSize:12 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {fetching && <div style={{ width:7, height:7, borderRadius:"50%", background:G.glow, animation:"pulse 1s infinite" }}/>}
            <div style={{
              background:hasData?`${G.green}18`:`${G.orange}18`,
              border:`1px solid ${hasData?G.green:G.orange}`,
              borderRadius:6, padding:"4px 12px",
              color:hasData?G.green:G.orange, fontSize:10, fontFamily:"'DM Mono',monospace", letterSpacing:"0.05em",
            }}>
              {hasData ? `● ${rows.length.toLocaleString()} rows` : "◉ No data"}
            </div>
            <button onClick={signOut} style={{ background:"none", border:`1px solid ${G.border}`, borderRadius:6, padding:"5px 12px", color:G.dim, fontSize:11, fontFamily:"'DM Mono',monospace" }}>Sign out</button>
          </div>
        </div>
      </nav>

      {/* HEADER */}
      <div style={{ background:`linear-gradient(180deg, ${G.bg1} 0%, ${G.bg} 100%)`, borderBottom:`1px solid ${G.border}`, padding:"16px 24px" }}>
        <div style={{ maxWidth:1260, margin:"0 auto" }}>
          <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:G.white, letterSpacing:"-0.02em" }}>
            {TABS.find(t=>t.id===tab)?.icon} {TABS.find(t=>t.id===tab)?.label}
          </h1>
          <p style={{ margin:"3px 0 0", fontSize:12, color:G.dim, fontFamily:"'DM Mono',monospace" }}>
            {hasData
              ? `${data.totals.tips.toLocaleString()} transactions · ${data.totals.uniqueTippers.toLocaleString()} tippers · $${data.totals.usd.toLocaleString("en-US",{minimumFractionDigits:2})} lifetime · ${data.totals.activeDays} active days`
              : `Welcome · Import your first CSV to get started`}
          </p>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth:1260, margin:"0 auto", padding:"24px 24px 80px" }}>
        {tab==="dashboard" && <DashboardView data={data}/>}
        {tab==="analytics"  && <AnalyticsView data={data}/>}
        {tab==="crm"        && <CRMView data={data} notes={notes} followUp={followUp} onNote={handleNote} onFollow={handleFollow}/>}
        {tab==="upload"     && <UploadView session={session} onDone={()=>{ load(); setTab("dashboard") }}/>}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}
