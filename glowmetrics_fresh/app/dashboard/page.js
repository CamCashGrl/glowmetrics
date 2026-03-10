"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { aggregateRows } from "../../lib/analytics"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

const C = {
  bg:     "#0B0F1A",
  card:   "#121826",
  card2:  "#161e2e",
  border: "#1e2d45",
  border2:"#2a3f5f",
  indigo: "#7C5CFF",
  cyan:   "#22D3EE",
  gold:   "#F59E0B",
  blue:   "#60A5FA",
  green:  "#10B981",
  red:    "#F87171",
  orange: "#FB923C",
  white:  "#F1F5F9",
  text:   "#94A3B8",
  muted:  "#475569",
  dim:    "#1e2d45",
}

const TIER = {
  "🐳 WHALE":   { color:C.gold,   bg:"#F59E0B12", border:"#F59E0B35", label:"WHALE" },
  "🦈 SHARK":   { color:C.blue,   bg:"#60A5FA12", border:"#60A5FA35", label:"SHARK" },
  "🐟 REGULAR": { color:C.muted,  bg:"#47556912", border:"#47556935", label:"REGULAR" },
  "💤 DORMANT": { color:C.orange, bg:"#FB923C12", border:"#FB923C35", label:"DORMANT" },
}

const PLATFORM_COLORS = {
  Chaturbate:"#F472B6", BongaCams:"#A78BFA", Stripchat:"#7C5CFF",
  CamSoda:"#22D3EE", "Cherry.tv":"#F87171", Streamate:"#FBBF24",
  ImLive:"#34D399", Flirt4Free:"#818CF8", LiveJasmin:"#FB923C",
  MyFreeCams:"#60A5FA", Other:"#475569",
}

// ── UI PRIMITIVES ────────────────────────────────────────────────────────────

const Card = ({ children, style={}, glow, onClick }) => (
  <div onClick={onClick} style={{
    background:C.card, border:`1px solid ${glow?glow+"30":C.border}`,
    borderRadius:14, padding:24, position:"relative", overflow:"hidden",
    boxShadow: glow ? `0 0 0 1px ${glow}15, 0 4px 24px #00000050` : "0 2px 12px #00000040",
    transition:"all 0.2s", cursor:onClick?"pointer":"default", ...style,
  }}
    onMouseEnter={e=>{ if(onClick){ e.currentTarget.style.borderColor=(glow||C.indigo)+"60"; e.currentTarget.style.transform="translateY(-1px)" }}}
    onMouseLeave={e=>{ if(onClick){ e.currentTarget.style.borderColor=(glow||C.indigo)+"30"; e.currentTarget.style.transform="translateY(0)" }}}>
    {children}
  </div>
)

const Badge = ({ tier }) => {
  const t = TIER[tier] || TIER["🐟 REGULAR"]
  return (
    <span style={{ padding:"3px 10px", borderRadius:100, fontSize:11, fontWeight:700,
      background:t.bg, color:t.color, border:`1px solid ${t.border}`, letterSpacing:"0.05em",
      fontFamily:"'DM Mono',monospace" }}>
      {tier?.split(" ")[0]} {t.label}
    </span>
  )
}

const ChartTip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null
  return (
    <div style={{ background:"#0d1424", border:`1px solid ${C.border2}`, borderRadius:10,
      padding:"10px 14px", fontSize:12, boxShadow:"0 8px 24px #00000080" }}>
      <div style={{ color:C.muted, marginBottom:6, fontSize:11 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color||C.white, fontWeight:600 }}>
          {p.name}: {p.name?.includes("$")||p.name==="Earnings" ? "$" : ""}{typeof p.value==="number"?p.value.toFixed(2):p.value}
        </div>
      ))}
    </div>
  )
}

// ── MAIN DASHBOARD ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [agg, setAgg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState("")
  const [activeNav, setActiveNav] = useState("dashboard")
  const [crmSearch, setCrmSearch] = useState("")
  const [crmFilter, setCrmFilter] = useState("ALL")
  const [crmSort, setCrmSort] = useState("usd")
  const [noteModal, setNoteModal] = useState(null)
  const [noteText, setNoteText] = useState("")
  const [notes, setNotes] = useState({})
  const [followUps, setFollowUps] = useState({})

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""),3500) }

  useEffect(() => {
    supabase.auth.getUser().then(({ data:{ user } }) => {
      if (!user) { router.replace("/login"); return }
      setUser(user)
      loadData(user.id)
    })
  }, [])

  const loadData = async (uid) => {
    setLoading(true)
    try {
      const { data } = await supabase.from("tips").select("*").eq("user_id", uid).order("date_time", { ascending:true })
      if (data?.length) { setRows(data); setAgg(aggregateRows(data)) }
      // Load notes
      const { data: noteData } = await supabase.from("tipper_notes").select("*").eq("user_id", uid)
      if (noteData) {
        const n = {}, f = {}
        noteData.forEach(r => { n[r.tipper_username] = r.note; f[r.tipper_username] = r.follow_up })
        setNotes(n); setFollowUps(f)
      }
    } finally { setLoading(false) }
  }

  const handleCSV = async (file) => {
    if (!file || !user) return
    setUploading(true)
    try {
      const { parseCSV } = await import("../../lib/analytics")
      const text = await file.text()
      const parsed = parseCSV(text)
      if (!parsed.length) { showToast("❌ No valid rows found"); return }
      const toInsert = parsed.map(r => ({ user_id:user.id, date_time:r.dateRaw||r.date_time, platform:r.platform, username:r.username, tip_type:r.tip_type||"Tip", tokens:r.tokens, usd:r.usd }))
      const { error } = await supabase.from("tips").upsert(toInsert, { onConflict:"user_id,date_time,username,tokens" })
      if (error) { showToast("❌ "+error.message); return }
      showToast(`✅ Imported ${parsed.length} tips!`)
      loadData(user.id)
    } finally { setUploading(false) }
  }

  const saveNote = async (username) => {
    if (!user) return
    await supabase.from("tipper_notes").upsert({ user_id:user.id, tipper_username:username, note:noteText, follow_up:followUps[username]||false }, { onConflict:"user_id,tipper_username" })
    setNotes(n => ({...n, [username]:noteText}))
    setNoteModal(null)
    showToast("✅ Note saved!")
  }

  const toggleFollowUp = async (username) => {
    const newVal = !followUps[username]
    setFollowUps(f => ({...f, [username]:newVal}))
    if (user) await supabase.from("tipper_notes").upsert({ user_id:user.id, tipper_username:username, note:notes[username]||"", follow_up:newVal }, { onConflict:"user_id,tipper_username" })
  }

  const signOut = async () => { await supabase.auth.signOut(); router.replace("/login") }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:40, height:40, border:`2px solid ${C.border}`, borderTop:`2px solid ${C.indigo}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }}/>
        <div style={{ color:C.muted, fontSize:14 }}>Loading your dashboard...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  const totalUsd = agg ? rows.reduce((s,r)=>s+r.usd,0) : 0
  const totalTokens = agg ? rows.reduce((s,r)=>s+r.tokens,0) : 0
  const uniqueTippers = agg ? agg.topTippers.length : 0
  const avgTip = rows.length ? totalUsd/rows.length : 0
  const topTippers = agg?.topTippers || []

  const whales  = topTippers.filter(t=>t.status==="🐳 WHALE")
  const sharks  = topTippers.filter(t=>t.status==="🦈 SHARK")
  const regular = topTippers.filter(t=>t.status==="🐟 REGULAR")
  const dormant = topTippers.filter(t=>t.status==="💤 DORMANT")

  // CRM filtered list
  const crmList = topTippers
    .filter(t => {
      if (crmFilter!=="ALL" && !t.status.includes(crmFilter)) return false
      if (crmSearch && !t.username.toLowerCase().includes(crmSearch.toLowerCase())) return false
      return true
    })
    .sort((a,b) => crmSort==="usd"?b.usd-a.usd:crmSort==="tokens"?b.tokens-a.tokens:crmSort==="count"?b.count-a.count:crmSort==="last"?b.last.localeCompare(a.last):b.daysSince-a.daysSince)

  const monthlyArr = agg?.monthlyArr || []
  const hourlyArr = agg?.hourlyArr || []

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Inter','Plus Jakarta Sans',sans-serif", color:C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:3px}
        input,select,textarea{outline:none;font-family:inherit}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fadeIn 0.3s ease}
      `}</style>

      {/* SIDEBAR */}
      <div style={{ position:"fixed", left:0, top:0, bottom:0, width:220, background:C.card, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", zIndex:50 }}>
        {/* Logo */}
        <div style={{ padding:"24px 20px 20px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:9, background:"linear-gradient(135deg,#7C5CFF,#22D3EE)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, boxShadow:"0 0 20px #7C5CFF30" }}>📊</div>
            <span style={{ fontSize:17, fontWeight:800, color:C.white, letterSpacing:"-0.02em" }}>Cam<span style={{ background:"linear-gradient(90deg,#7C5CFF,#22D3EE)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>lytics</span></span>
          </div>
          {user && <div style={{ fontSize:11, color:C.muted, marginTop:10, fontFamily:"'DM Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.email}</div>}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"16px 12px", display:"flex", flexDirection:"column", gap:4 }}>
          {[
            ["dashboard","📊","Overview"],
            ["crm","👑","Fan CRM"],
            ["analytics","📈","Analytics"],
            ["upload","📥","Import CSV"],
          ].map(([id,icon,label]) => (
            <button key={id} onClick={()=>setActiveNav(id)} style={{
              display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10,
              background:activeNav===id?`${C.indigo}18`:"transparent",
              border:activeNav===id?`1px solid ${C.indigo}30`:"1px solid transparent",
              color:activeNav===id?C.white:C.muted, fontSize:14, fontWeight:activeNav===id?600:400,
              cursor:"pointer", transition:"all 0.15s", textAlign:"left",
            }}>
              <span style={{ fontSize:16 }}>{icon}</span>{label}
              {id==="crm" && topTippers.length>0 && <span style={{ marginLeft:"auto", background:`${C.indigo}25`, color:C.indigo, fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:100 }}>{topTippers.length}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding:"12px", borderTop:`1px solid ${C.border}` }}>
          <button onClick={signOut} style={{ width:"100%", padding:"10px 12px", borderRadius:10, background:"transparent", border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:"pointer", transition:"all 0.15s", textAlign:"left" }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red+"50";e.currentTarget.style.color=C.red}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted}}>
            ↩ Sign Out
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ marginLeft:220, minHeight:"100vh" }}>
        {/* Top bar */}
        <div style={{ position:"sticky", top:0, zIndex:40, background:"rgba(11,15,26,0.95)", backdropFilter:"blur(12px)", borderBottom:`1px solid ${C.border}`, padding:"0 32px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <span style={{ fontSize:16, fontWeight:700, color:C.white }}>
              {activeNav==="dashboard"?"Overview":activeNav==="crm"?"Fan CRM":activeNav==="analytics"?"Analytics":"Import CSV"}
            </span>
            {rows.length>0 && <span style={{ fontSize:12, color:C.muted, marginLeft:12 }}>{rows.length.toLocaleString()} tips · {uniqueTippers} fans</span>}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <label style={{ padding:"8px 16px", borderRadius:9, background:`${C.indigo}18`, border:`1px solid ${C.indigo}30`, color:C.indigo, fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}>
              {uploading?"Importing...":"+ Import CSV"}
              <input type="file" accept=".csv" style={{ display:"none" }} onChange={e=>handleCSV(e.target.files[0])} disabled={uploading}/>
            </label>
          </div>
        </div>

        <div style={{ padding:32 }} className="fade">

          {/* ── OVERVIEW ─────────────────────────────── */}
          {activeNav==="dashboard" && <>

            {/* KPI Cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
              {[
                { label:"Lifetime Earnings", value:`$${totalUsd.toFixed(2)}`, icon:"💰", color:C.green, sub:`${rows.length} total tips` },
                { label:"Total Tokens", value:totalTokens.toLocaleString(), icon:"🎫", color:C.indigo, sub:"across all platforms" },
                { label:"Avg Tip Value", value:`$${avgTip.toFixed(2)}`, icon:"⭐", color:C.gold, sub:"per tip" },
                { label:"Unique Fans", value:uniqueTippers.toLocaleString(), icon:"👥", color:C.cyan, sub:`${whales.length} whales · ${sharks.length} sharks` },
              ].map((k,i) => (
                <Card key={i} glow={k.color}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                    <div style={{ fontSize:12, color:C.muted, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.06em" }}>{k.label}</div>
                    <div style={{ width:32, height:32, borderRadius:8, background:`${k.color}15`, border:`1px solid ${k.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>{k.icon}</div>
                  </div>
                  <div style={{ fontSize:28, fontWeight:800, color:k.color, letterSpacing:"-0.02em", marginBottom:6 }}>{k.value}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{k.sub}</div>
                </Card>
              ))}
            </div>

            {/* Fan CRM Preview — HERO SECTION */}
            <Card glow={C.indigo} style={{ marginBottom:28 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:`${C.indigo}20`, border:`1px solid ${C.indigo}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>👑</div>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:C.white }}>Fan CRM — Top Supporters</div>
                    <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Your highest-value fans ranked by earnings</div>
                  </div>
                </div>
                <button onClick={()=>setActiveNav("crm")} style={{ padding:"8px 18px", borderRadius:9, background:`${C.indigo}20`, border:`1px solid ${C.indigo}40`, color:C.indigo, fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}
                  onMouseEnter={e=>{e.currentTarget.style.background=`${C.indigo}35`}}
                  onMouseLeave={e=>{e.currentTarget.style.background=`${C.indigo}20`}}>
                  View Full CRM →
                </button>
              </div>

              {topTippers.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>📥</div>
                  <div style={{ fontSize:14 }}>Import a CSV to see your fans here</div>
                </div>
              ) : (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                        {["#","Username","Total $","Tokens","Tips","Tier","Last Tip","Note"].map(h => (
                          <th key={h} style={{ padding:"8px 14px", textAlign:"left", color:C.muted, fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {topTippers.slice(0,5).map((t,i) => (
                        <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, transition:"background 0.15s" }}
                          onMouseEnter={e=>e.currentTarget.style.background=C.card2}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"12px 14px", color:C.muted, fontFamily:"'DM Mono',monospace", fontSize:12 }}>#{i+1}</td>
                          <td style={{ padding:"12px 14px", color:C.white, fontWeight:600 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${C.indigo},${C.cyan})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:C.white, flexShrink:0 }}>{t.username[0]?.toUpperCase()}</div>
                              {t.username}
                            </div>
                          </td>
                          <td style={{ padding:"12px 14px", color:C.green, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>${t.usd.toFixed(2)}</td>
                          <td style={{ padding:"12px 14px", color:C.indigo, fontFamily:"'DM Mono',monospace" }}>{t.tokens.toLocaleString()}</td>
                          <td style={{ padding:"12px 14px", color:C.muted, fontFamily:"'DM Mono',monospace" }}>{t.count}</td>
                          <td style={{ padding:"12px 14px" }}><Badge tier={t.status}/></td>
                          <td style={{ padding:"12px 14px", color:C.muted, fontSize:12, fontFamily:"'DM Mono',monospace" }}>{t.last||"—"}</td>
                          <td style={{ padding:"12px 14px" }}>
                            <button onClick={()=>{setNoteModal(t.username);setNoteText(notes[t.username]||"")}} style={{ padding:"4px 10px", borderRadius:7, background:notes[t.username]?`${C.cyan}15`:`${C.border}30`, border:`1px solid ${notes[t.username]?C.cyan+"40":C.border}`, color:notes[t.username]?C.cyan:C.muted, fontSize:11, cursor:"pointer" }}>
                              {notes[t.username]?"📝 Edit":"+ Note"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Tier Overview */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
              {[
                { icon:"🐳", label:"Whales", count:whales.length, sub:"$50+ total", color:C.gold, list:whales },
                { icon:"🦈", label:"Sharks", count:sharks.length, sub:"$20–$49", color:C.blue, list:sharks },
                { icon:"🐟", label:"Regulars", count:regular.length, sub:"Active fans", color:C.muted, list:regular },
                { icon:"💤", label:"Dormant", count:dormant.length, sub:"60+ days gone", color:C.orange, list:dormant },
              ].map((seg,i) => (
                <Card key={i} glow={seg.color} onClick={()=>{setCrmFilter(seg.label.toUpperCase().replace("REGULARS","REGULAR").replace("WHALES","WHALE").replace("SHARKS","SHARK"));setActiveNav("crm")}}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                    <span style={{ fontSize:24 }}>{seg.icon}</span>
                    <span style={{ fontSize:26, fontWeight:800, color:seg.color, fontFamily:"'DM Mono',monospace" }}>{seg.count}</span>
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, color:C.white, marginBottom:4 }}>{seg.label}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{seg.sub}</div>
                  {seg.list.length>0 && <div style={{ marginTop:12, fontSize:11, color:seg.color, fontWeight:500 }}>Top: {seg.list[0]?.username}</div>}
                </Card>
              ))}
            </div>

            {/* Charts */}
            {monthlyArr.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20, marginBottom:28 }}>
                <Card>
                  <div style={{ fontSize:13, fontWeight:600, color:C.white, marginBottom:4 }}>Earnings Over Time</div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:20 }}>Monthly revenue</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={monthlyArr}>
                      <defs>
                        <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.indigo} stopOpacity={0.3}/>
                          <stop offset="100%" stopColor={C.indigo} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                      <XAxis dataKey="month" stroke={C.muted} tick={{ fontSize:11, fill:C.muted }} tickLine={false} axisLine={false}/>
                      <YAxis stroke={C.muted} tick={{ fontSize:11, fill:C.muted }} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`}/>
                      <Tooltip content={<ChartTip/>}/>
                      <Area type="monotone" dataKey="usd" name="Earnings" stroke={C.indigo} strokeWidth={2} fill="url(#eg)"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <div style={{ fontSize:13, fontWeight:600, color:C.white, marginBottom:4 }}>Peak Hours</div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:20 }}>Best streaming times</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={hourlyArr.filter((_,i)=>i%2===0)} barSize={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                      <XAxis dataKey="label" stroke={C.muted} tick={{ fontSize:10, fill:C.muted }} tickLine={false} axisLine={false}/>
                      <YAxis hide/>
                      <Tooltip content={<ChartTip/>}/>
                      <Bar dataKey="usd" name="Earnings" fill={C.cyan} radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* Empty state */}
            {rows.length === 0 && (
              <Card style={{ textAlign:"center", padding:"60px 40px" }}>
                <div style={{ fontSize:48, marginBottom:16 }}>📥</div>
                <div style={{ fontSize:20, fontWeight:700, color:C.white, marginBottom:8 }}>Import your first CSV</div>
                <div style={{ fontSize:14, color:C.muted, marginBottom:28, maxWidth:400, margin:"0 auto 28px" }}>Upload a tip export from Chaturbate, BongaCams, MyFreeCams, or any supported platform to get started.</div>
                <label style={{ padding:"12px 28px", borderRadius:10, background:`linear-gradient(135deg,${C.indigo},${C.cyan}40)`, border:`1px solid ${C.indigo}50`, color:C.white, fontSize:14, fontWeight:600, cursor:"pointer" }}>
                  Choose CSV File
                  <input type="file" accept=".csv" style={{ display:"none" }} onChange={e=>handleCSV(e.target.files[0])}/>
                </label>
              </Card>
            )}
          </>}

          {/* ── FULL CRM ─────────────────────────────── */}
          {activeNav==="crm" && (
            <div className="fade">
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24, flexWrap:"wrap" }}>
                {/* Search */}
                <div style={{ position:"relative", flex:1, minWidth:220 }}>
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:14 }}>🔍</span>
                  <input value={crmSearch} onChange={e=>setCrmSearch(e.target.value)} placeholder="Search fans..." style={{ width:"100%", padding:"10px 12px 10px 36px", background:C.card, border:`1px solid ${C.border}`, borderRadius:10, color:C.white, fontSize:14 }}
                    onFocus={e=>e.target.style.borderColor=C.indigo} onBlur={e=>e.target.style.borderColor=C.border}/>
                </div>
                {/* Tier filters */}
                <div style={{ display:"flex", gap:6 }}>
                  {[["ALL","All"],["WHALE","🐳 Whales"],["SHARK","🦈 Sharks"],["REGULAR","🐟 Regulars"],["DORMANT","💤 Dormant"]].map(([val,label]) => (
                    <button key={val} onClick={()=>setCrmFilter(val)} style={{ padding:"9px 14px", borderRadius:9, border:`1px solid ${crmFilter===val?C.indigo+"60":C.border}`, background:crmFilter===val?`${C.indigo}20`:"transparent", color:crmFilter===val?C.white:C.muted, fontSize:12, fontWeight:crmFilter===val?600:400, cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s" }}>
                      {label}
                    </button>
                  ))}
                </div>
                {/* Sort */}
                <select value={crmSort} onChange={e=>setCrmSort(e.target.value)} style={{ padding:"9px 14px", background:C.card, border:`1px solid ${C.border}`, borderRadius:9, color:C.white, fontSize:13, cursor:"pointer" }}>
                  <option value="usd">Sort: Top Earners</option>
                  <option value="tokens">Sort: Most Tokens</option>
                  <option value="count">Sort: Most Tips</option>
                  <option value="last">Sort: Most Recent</option>
                </select>
                <div style={{ fontSize:12, color:C.muted, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{crmList.length} fans</div>
              </div>

              <Card style={{ padding:0, overflow:"hidden" }}>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr style={{ background:C.card2, borderBottom:`1px solid ${C.border}` }}>
                        {["#","Fan","Total $","Tokens","Tips","Avg Tip","Best Tip","First Tip","Last Tip","Days","Tier","Follow Up","Note"].map(h => (
                          <th key={h} style={{ padding:"12px 14px", textAlign:"left", color:C.muted, fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {crmList.length===0 ? (
                        <tr><td colSpan={13} style={{ padding:"48px 20px", textAlign:"center", color:C.muted }}>No fans found. Import a CSV to get started.</td></tr>
                      ) : crmList.map((t,i) => (
                        <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, transition:"background 0.15s" }}
                          onMouseEnter={e=>e.currentTarget.style.background=C.card2}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"12px 14px", color:C.muted, fontFamily:"'DM Mono',monospace", fontSize:11 }}>#{i+1}</td>
                          <td style={{ padding:"12px 14px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:120 }}>
                              <div style={{ width:30, height:30, borderRadius:"50%", background:`linear-gradient(135deg,${C.indigo},${C.cyan})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:C.white, flexShrink:0 }}>{t.username[0]?.toUpperCase()}</div>
                              <span style={{ color:C.white, fontWeight:600 }}>{t.username}</span>
                            </div>
                          </td>
                          <td style={{ padding:"12px 14px", color:C.green, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>${t.usd.toFixed(2)}</td>
                          <td style={{ padding:"12px 14px", color:C.indigo, fontFamily:"'DM Mono',monospace" }}>{t.tokens.toLocaleString()}</td>
                          <td style={{ padding:"12px 14px", color:C.muted, fontFamily:"'DM Mono',monospace" }}>{t.count}</td>
                          <td style={{ padding:"12px 14px", color:C.muted, fontFamily:"'DM Mono',monospace" }}>${(t.usd/t.count).toFixed(2)}</td>
                          <td style={{ padding:"12px 14px", color:C.gold, fontFamily:"'DM Mono',monospace" }}>${(t.usd).toFixed(2)}</td>
                          <td style={{ padding:"12px 14px", color:C.muted, fontSize:12, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{t.first||"—"}</td>
                          <td style={{ padding:"12px 14px", color:C.muted, fontSize:12, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{t.last||"—"}</td>
                          <td style={{ padding:"12px 14px", fontFamily:"'DM Mono',monospace", fontSize:12 }}>
                            <span style={{ color:t.daysSince>60?C.orange:t.daysSince>30?C.gold:C.green }}>{t.daysSince}d</span>
                          </td>
                          <td style={{ padding:"12px 14px" }}><Badge tier={t.status}/></td>
                          <td style={{ padding:"12px 14px", textAlign:"center" }}>
                            <button onClick={()=>toggleFollowUp(t.username)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", opacity:followUps[t.username]?1:0.3, transition:"opacity 0.15s" }} title="Toggle follow-up flag">🔔</button>
                          </td>
                          <td style={{ padding:"12px 14px" }}>
                            <button onClick={()=>{setNoteModal(t.username);setNoteText(notes[t.username]||"")}} style={{ padding:"4px 10px", borderRadius:7, background:notes[t.username]?`${C.cyan}15`:`${C.border}20`, border:`1px solid ${notes[t.username]?C.cyan+"40":C.border}`, color:notes[t.username]?C.cyan:C.muted, fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>
                              {notes[t.username]?"📝 Edit":"+ Add"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ── ANALYTICS ───────────────────────────── */}
          {activeNav==="analytics" && (
            <div className="fade" style={{ display:"flex", flexDirection:"column", gap:24 }}>
              {rows.length===0 ? (
                <Card style={{ textAlign:"center", padding:"60px" }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>📈</div>
                  <div style={{ color:C.muted }}>Import a CSV to see analytics</div>
                </Card>
              ) : <>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                  <Card>
                    <div style={{ fontSize:13, fontWeight:600, color:C.white, marginBottom:4 }}>Monthly Revenue</div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:20 }}>Earnings per month</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={monthlyArr}>
                        <defs>
                          <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={C.indigo} stopOpacity={0.3}/>
                            <stop offset="100%" stopColor={C.indigo} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                        <XAxis dataKey="month" stroke={C.muted} tick={{ fontSize:11, fill:C.muted }} tickLine={false} axisLine={false}/>
                        <YAxis stroke={C.muted} tick={{ fontSize:11, fill:C.muted }} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`}/>
                        <Tooltip content={<ChartTip/>}/>
                        <Area type="monotone" dataKey="usd" name="Earnings" stroke={C.indigo} strokeWidth={2} fill="url(#mg)"/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card>
                    <div style={{ fontSize:13, fontWeight:600, color:C.white, marginBottom:4 }}>Peak Streaming Hours</div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:20 }}>Best time to go live</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={hourlyArr} barSize={10}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                        <XAxis dataKey="label" stroke={C.muted} tick={{ fontSize:10, fill:C.muted }} tickLine={false} axisLine={false} interval={1}/>
                        <YAxis hide/>
                        <Tooltip content={<ChartTip/>}/>
                        <Bar dataKey="usd" name="Earnings" fill={C.cyan} radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                {/* Platform breakdown */}
                {agg?.platformArr?.length > 0 && (
                  <Card>
                    <div style={{ fontSize:13, fontWeight:600, color:C.white, marginBottom:4 }}>Revenue by Platform</div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:20 }}>Which site pays most</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {agg.platformArr.sort((a,b)=>b.usd-a.usd).map((p,i) => {
                        const max = agg.platformArr.reduce((m,x)=>x.usd>m?x.usd:m,0)
                        return (
                          <div key={i} style={{ display:"flex", alignItems:"center", gap:12 }}>
                            <div style={{ width:100, fontSize:13, color:C.white, flexShrink:0 }}>{p.platform}</div>
                            <div style={{ flex:1, height:8, background:C.border, borderRadius:4, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${(p.usd/max)*100}%`, background:PLATFORM_COLORS[p.platform]||C.indigo, borderRadius:4, transition:"width 0.5s" }}/>
                            </div>
                            <div style={{ width:70, textAlign:"right", color:C.green, fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:600 }}>${p.usd.toFixed(0)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )}
              </>}
            </div>
          )}

          {/* ── UPLOAD ───────────────────────────────── */}
          {activeNav==="upload" && (
            <div className="fade">
              <Card style={{ maxWidth:600, margin:"0 auto", textAlign:"center", padding:"52px 40px" }}>
                <div style={{ fontSize:48, marginBottom:16 }}>📥</div>
                <div style={{ fontSize:20, fontWeight:700, color:C.white, marginBottom:8 }}>Import Your Tip Data</div>
                <div style={{ fontSize:14, color:C.muted, marginBottom:8, lineHeight:1.7 }}>
                  Supported: Chaturbate, BongaCams, MyFreeCams, Stripchat, CamSoda, Cherry.tv, Streamate, ImLive, Flirt4Free, LiveJasmin
                </div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:32 }}>New data is merged — no duplicates</div>
                <label style={{ display:"inline-block", padding:"14px 32px", borderRadius:10, background:`linear-gradient(135deg,${C.indigo},${C.cyan}60)`, border:`1px solid ${C.indigo}60`, color:C.white, fontSize:15, fontWeight:600, cursor:"pointer", transition:"all 0.2s", boxShadow:`0 4px 20px ${C.indigo}30` }}>
                  {uploading ? "Importing..." : "Choose CSV File"}
                  <input type="file" accept=".csv" style={{ display:"none" }} onChange={e=>handleCSV(e.target.files[0])} disabled={uploading}/>
                </label>
                {rows.length>0 && <div style={{ marginTop:20, fontSize:13, color:C.green }}>✅ {rows.length.toLocaleString()} tips already imported</div>}
              </Card>
            </div>
          )}

        </div>
      </div>

      {/* NOTE MODAL */}
      {noteModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:16, padding:28, width:400, boxShadow:"0 24px 60px #00000080" }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:4 }}>Note for {noteModal}</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>Private — only you can see this</div>
            <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Add a note about this fan..." rows={4}
              style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", color:C.white, fontSize:14, resize:"vertical", fontFamily:"inherit" }}
              onFocus={e=>e.target.style.borderColor=C.indigo} onBlur={e=>e.target.style.borderColor=C.border}/>
            <div style={{ display:"flex", gap:10, marginTop:16, justifyContent:"flex-end" }}>
              <button onClick={()=>setNoteModal(null)} style={{ padding:"9px 18px", borderRadius:9, background:"transparent", border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:"pointer" }}>Cancel</button>
              <button onClick={()=>saveNote(noteModal)} style={{ padding:"9px 18px", borderRadius:9, background:`linear-gradient(135deg,${C.indigo},${C.cyan}60)`, border:"none", color:C.white, fontSize:13, fontWeight:600, cursor:"pointer" }}>Save Note</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, background:C.card2, border:`1px solid ${C.border2}`, borderRadius:12, padding:"14px 20px", color:C.white, fontSize:14, fontWeight:500, zIndex:300, boxShadow:"0 8px 32px #00000080", animation:"fadeIn 0.3s ease" }}>
          {toast}
        </div>
      )}
    </div>
  )
}
