"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

const G = {
  bg:"#05050f", bg1:"#090918", bg2:"#0e0e22", bg3:"#13132d",
  border:"#1a1a3e", border2:"#252550",
  glow:"#c084fc", glow2:"#e879f9", teal:"#2dd4bf",
  gold:"#fbbf24", green:"#34d399", pink:"#f472b6",
  blue:"#60a5fa", orange:"#fb923c", red:"#f87171",
  white:"#faf5ff", med:"#a78bca", dim:"#5b4d7a",
}

const Card = ({ children, style={} }) => (
  <div style={{ background:G.bg2, border:`1px solid ${G.border}`, borderRadius:14, padding:24, ...style }}>{children}</div>
)

const Stat = ({ icon, label, value, accent, sub }) => (
  <div style={{ background:G.bg2, border:`1px solid ${G.border}`, borderRadius:14, padding:"20px 22px", borderTop:`3px solid ${accent}`, position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", top:0, right:0, width:80, height:80, background:`radial-gradient(circle at top right, ${accent}15, transparent 70%)`, pointerEvents:"none" }}/>
    <div style={{ fontSize:10, color:G.dim, fontFamily:"'DM Mono',monospace", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>{icon} {label}</div>
    <div style={{ fontSize:30, fontWeight:800, color:accent, fontFamily:"'DM Mono',monospace" }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:G.dim, marginTop:5, fontFamily:"'DM Mono',monospace" }}>{sub}</div>}
  </div>
)

export default function AdminPage() {
  const router = useRouter()
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState("")

  useEffect(() => {
    if (!document.cookie.includes("gm_admin=")) { router.replace("/login"); return }
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin-stats")
      if (res.status===401) { router.replace("/login"); return }
      const d = await res.json()
      if (d.error) { setError(d.error); return }
      setStats(d)
    } catch { setError("Failed to load.") }
    finally { setLoading(false) }
  }

  const signOut = () => { document.cookie="gm_admin=;path=/;max-age=0"; router.replace("/login") }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:G.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:36, height:36, borderRadius:"50%", border:"2px solid transparent", borderTopColor:G.glow, animation:"spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:"100vh", background:G.bg, display:"flex", alignItems:"center", justifyContent:"center", color:G.red, fontFamily:"'DM Mono',monospace" }}>{error}</div>
  )

  const platforms = Object.entries(stats?.platforms||{}).sort((a,b)=>b[1].usd-a[1].usd)
  const activity  = stats?.recentActivity || []

  return (
    <div style={{ minHeight:"100vh", background:G.bg, fontFamily:"'Syne',sans-serif" }}>

      {/* NAV */}
      <nav style={{ background:G.bg1, borderBottom:`1px solid ${G.border}`, padding:"0 28px", height:58, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:"linear-gradient(135deg, #fbbf24, #fb923c)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, boxShadow:"0 0 16px #fbbf2440" }}>👑</div>
          <span style={{ fontSize:15, fontWeight:800, color:G.white, letterSpacing:"-0.02em" }}>
            Glow<span style={{color:G.glow}}>Metrics</span>
            <span style={{ marginLeft:10, fontSize:11, color:G.gold, fontFamily:"'DM Mono',monospace", letterSpacing:"0.1em" }}>ADMIN</span>
          </span>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={load} style={{ background:G.bg2, border:`1px solid ${G.border}`, borderRadius:7, padding:"6px 14px", color:G.med, fontSize:12, fontFamily:"'DM Mono',monospace" }}>↻ Refresh</button>
          <button onClick={signOut} style={{ background:"none", border:`1px solid ${G.border}`, borderRadius:7, padding:"6px 14px", color:G.dim, fontSize:11, fontFamily:"'DM Mono',monospace" }}>Sign out</button>
        </div>
      </nav>

      {/* PRIVACY BANNER */}
      <div style={{ background:`${G.green}0d`, borderBottom:`1px solid ${G.green}25`, padding:"10px 28px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", alignItems:"center", gap:10, fontSize:12, color:G.green, fontFamily:"'DM Mono',monospace" }}>
          🔒 Admin view shows aggregate stats only — individual user data is encrypted and inaccessible to you.
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px 80px" }}>
        <div style={{ marginBottom:32 }}>
          <h1 style={{ margin:0, fontSize:28, fontWeight:800, color:G.white, letterSpacing:"-0.025em" }}>Admin Dashboard</h1>
          <p style={{ margin:"6px 0 0", fontSize:12, color:G.dim, fontFamily:"'DM Mono',monospace" }}>
            Last updated: {stats?.generatedAt ? new Date(stats.generatedAt).toLocaleString() : "—"}
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16, marginBottom:28 }}>
          <Stat icon="👥" label="Total Users"    value={(stats?.totalUsers||0).toLocaleString()} accent={G.glow}  sub="All registered accounts" />
          <Stat icon="🆕" label="New (30 days)"  value={(stats?.newUsers||0).toLocaleString()}   accent={G.green} sub="Recent signups" />
          <Stat icon="📊" label="Total Tip Rows" value={(stats?.totalTips||0).toLocaleString()}  accent={G.teal}  sub="Across all users" />
          <Stat icon="🌐" label="Platforms"      value={platforms.length.toString()}              accent={G.gold}  sub="With uploaded data" />
        </div>

        {/* Recent activity chart */}
        <Card style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, fontWeight:700, color:G.white, fontFamily:"'DM Mono',monospace", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:18 }}>📈 Platform Activity (Last 30 days — aggregate)</div>
          {activity.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activity} margin={{top:5,right:10,left:0,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke={G.border}/>
                <XAxis dataKey="date" tick={{fill:G.dim,fontSize:9,fontFamily:"'DM Mono',monospace"}} tickFormatter={d=>d.slice(5)} interval="preserveStartEnd"/>
                <YAxis tick={{fill:G.dim,fontSize:10,fontFamily:"'DM Mono',monospace"}} tickFormatter={v=>`$${v}`}/>
                <Tooltip contentStyle={{background:G.bg3,border:`1px solid ${G.border2}`,borderRadius:8,fontFamily:"'DM Mono',monospace",fontSize:11}}/>
                <Bar dataKey="usd" name="USD" fill={G.glow} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding:"32px 0", textAlign:"center", color:G.dim, fontFamily:"'DM Mono',monospace", fontSize:12 }}>No activity yet — users need to import their CSVs</div>
          )}
        </Card>

        {/* Platform table */}
        <Card style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, fontWeight:700, color:G.white, fontFamily:"'DM Mono',monospace", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:18 }}>🌐 Platform Breakdown (Aggregate)</div>
          {platforms.length > 0 ? (
            <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'DM Mono',monospace", fontSize:12 }}>
              <thead>
                <tr style={{ background:G.bg3 }}>
                  {["Platform","Total Tips","Total Tokens","Total USD"].map(h=>(
                    <th key={h} style={{ textAlign:"left", padding:"10px 14px", color:G.dim, borderBottom:`1px solid ${G.border}`, fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platforms.map(([name, d], i) => (
                  <tr key={name} style={{ background:i%2===0?G.bg2:G.bg3 }}>
                    <td style={{ padding:"10px 14px", color:G.white, fontWeight:700 }}>{name}</td>
                    <td style={{ padding:"10px 14px", color:G.dim }}>{d.count.toLocaleString()}</td>
                    <td style={{ padding:"10px 14px", color:G.glow }}>{d.tokens.toLocaleString()}</td>
                    <td style={{ padding:"10px 14px", color:G.green, fontWeight:700 }}>${d.usd.toLocaleString("en-US",{minimumFractionDigits:2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding:"20px 0", color:G.dim, fontFamily:"'DM Mono',monospace", fontSize:12 }}>No platform data yet.</div>
          )}
        </Card>

        {/* Checklist */}
        <Card>
          <div style={{ fontSize:12, fontWeight:700, color:G.white, fontFamily:"'DM Mono',monospace", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:18 }}>⚙️ Setup Checklist</div>
          {[
            [true,               "GlowMetrics app running"],
            [true,               "Supabase project connected"],
            [true,               "Admin panel accessible"],
            [!!stats?.totalUsers,"First user signed up"],
            [!!stats?.totalTips, "First CSV imported"],
          ].map(([done,label]) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
              <div style={{ width:20, height:20, borderRadius:"50%", background:done?`${G.green}20`:G.bg3, border:`1px solid ${done?G.green:G.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:done?G.green:G.dim }}>
                {done?"✓":"○"}
              </div>
              <span style={{ fontSize:13, color:done?G.white:G.dim, fontFamily:"'DM Mono',monospace" }}>{label}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
