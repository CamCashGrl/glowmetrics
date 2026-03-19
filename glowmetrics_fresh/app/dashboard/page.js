"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { parseCSV, detectSessions, identifyWhales, generateInsights, aggregateRows } from "../../lib/analytics"

const C = {
  bg: "#0B0F1A", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

const TIER_COLORS = {
  "Whale": C.gold, "Shark": C.blue, "Regular": C.cyan, "Dormant": C.orange
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tips, setTips] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [toast, setToast] = useState("")
  const [uploadCount, setUploadCount] = useState(0)
  const [whaleFilter, setWhaleFilter] = useState("ALL")
  const [platformFilter, setPlatformFilter] = useState("ALL")

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500) }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return }
      setUser(user)
      loadData(user.id)
    })
  }, [])

  const loadData = async (uid) => {
    setLoading(true)
    try {
      const { data } = await supabase.from("tips").select("*").eq("user_id", uid).order("date_time", { ascending: true })
      if (data?.length) {
        setTips(data)
        setAnalytics(aggregateRows(data))
      }
    } finally { setLoading(false) }
  }

  const handleCSV = async (file) => {
    if (!file || !user) return
    if (uploadCount >= 3) {
      showToast("🔒 Free tier: 3 uploads/month. Upgrade for unlimited!")
      return
    }
    setUploading(true)
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      if (!parsed.length) { showToast("❌ No valid rows found"); setUploading(false); return }
      
      const toInsert = parsed.map(r => ({
        user_id: user.id,
        date_time: r.dateRaw || r.date_time,
        platform: r.platform,
        username: r.username,
        tip_type: r.tip_type || "Tip",
        tokens: r.tokens,
        usd: r.usd
      }))
      
      const { error } = await supabase.from("tips").insert(toInsert)
      if (error) { showToast("❌ " + error.message); setUploading(false); return }
      
      setUploadCount(uploadCount + 1)
      showToast(`✅ Imported ${parsed.length} tips!`)
      await loadData(user.id)
    } catch (err) {
      showToast("❌ " + err.message)
    } finally { setUploading(false) }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.cyan}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ color: C.muted, fontSize: 14 }}>Loading...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    )
  }

  const sessions = analytics?.sessions || []
  const whales = analytics?.whales || []
  const insights = analytics?.insights || []
  const platforms = analytics?.platforms || []
  
  const totalRevenue = analytics?.totalUSD || 0
  const avgPerHour = sessions.reduce((sum, s) => sum + s.usdPerHour, 0) / (sessions.length || 1)

  // Platform best times
  const platformTimes = {}
  sessions.forEach(s => {
    if (!platformTimes[s.platform]) platformTimes[s.platform] = { hours: {}, days: {} }
    const hour = new Date(s.startTime).getHours()
    const day = new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'long' })
    platformTimes[s.platform].hours[hour] = (platformTimes[s.platform].hours[hour] || 0) + s.totalUSD
    platformTimes[s.platform].days[day] = (platformTimes[s.platform].days[day] || 0) + s.totalUSD
  })

  const filteredWhales = whales.filter(w => {
    if (whaleFilter !== "ALL" && w.tier !== whaleFilter) return false
    if (platformFilter !== "ALL" && w.platform !== platformFilter) return false
    return true
  })

  const allPlatforms = [...new Set(tips.map(t => t.platform))]

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 3px; }
      `}</style>

      {/* SIDEBAR */}
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 240, background: C.card, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", zIndex: 50 }}>
        <div style={{ padding: "24px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: C.white }}>$</div>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.white }}>Cam<span style={{ background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cash</span></span>
          </div>
          {user && <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>{user.email}</div>}
        </div>

        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {[["overview", "📊", "Overview"], ["platforms", "🎯", "Platforms"], ["whales", "🐳", "Top Fans"], ["sessions", "🎥", "Sessions"], ["upload", "📥", "Import"]].map(([id, icon, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
              background: activeTab === id ? `${C.cyan}15` : "transparent",
              border: activeTab === id ? `1px solid ${C.cyan}30` : "1px solid transparent",
              color: activeTab === id ? C.white : C.muted, fontSize: 14, fontWeight: activeTab === id ? 600 : 400,
              cursor: "pointer", transition: "all 0.15s", textAlign: "left"
            }}>
              <span style={{ fontSize: 18 }}>{icon}</span>{label}
            </button>
          ))}
        </nav>
            </div>
<div style={{ marginLeft: 240, padding: 32 }}>
      <div style={{ 
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 20,
  marginBottom: 36
}}>
  {[
    { label: "Total Revenue", value: `$${totalRevenue.toFixed(2)}`, icon: "💰", color: C.green },
    { label: "Avg $/Hour", value: `$${avgPerHour.toFixed(2)}`, icon: "⏱️", color: C.cyan },
    { label: "Total Fans", value: whales.length, icon: "👥", color: C.pink },
    { label: "Sessions", value: sessions.length, icon: "🎥", color: C.gold }
  ].map((s, i) => (
    <div key={i} style={{
      background: `linear-gradient(145deg, ${C.card}, ${C.card2})`,
      border: `1px solid ${C.border}`,
      borderRadius: 18,
      padding: 22,
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 10px 30px rgba(0,0,0,0.4)"
    }}>
      
      <div style={{
        position: "absolute",
        top: -40,
        right: -40,
        width: 120,
        height: 120,
        background: s.color,
        opacity: 0.08,
        filter: "blur(40px)"
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>
          {s.label}
        </span>
        <span style={{ fontSize: 20 }}>{s.icon}</span>
      </div>

      <div style={{ fontSize: 34, fontWeight: 800, color: s.color }}>
        {s.value}
      </div>
    </div>
  ))}
</div>
            {/* INSIGHTS */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 16 }}>💡 Smart Insights</h2>
              {insights.slice(0, 5).map((ins, i) => (
                <div key={i} style={{ background: `${C.cyan}10`, border: `1px solid ${C.cyan}30`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: C.white }}>{ins.icon} {ins.text}</div>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: 16, background: `${C.pink}10`, border: `1px solid ${C.pink}30`, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 14, color: C.white, marginBottom: 8 }}>🔒 Unlock 10+ more AI-powered insights</div>
                <button style={{ padding: "8px 20px", borderRadius: 8, background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, border: "none", color: C.white, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Upgrade to Pro</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "platforms" && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 32 }}>Platform Analytics</h1>
            
            {platforms.map((p, i) => {
              const bestHour = Object.entries(platformTimes[p.platform]?.hours || {}).sort((a, b) => b[1] - a[1])[0]
              const bestDay = Object.entries(platformTimes[p.platform]?.days || {}).sort((a, b) => b[1] - a[1])[0]
              
              return (
                <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 16 }}>{p.platform}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.muted }}>Total Revenue</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>${p.totalUSD.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: C.muted }}>$/Hour</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: C.cyan }}>${p.usdPerHour.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: C.muted }}>Sessions</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: C.pink }}>{p.sessions}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: C.muted }}>Total Hours</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: C.gold }}>{p.hours.toFixed(1)}h</div>
                    </div>
                  </div>
                  {bestHour && bestDay && (
                    <div style={{ padding: 16, background: C.card2, borderRadius: 10 }}>
                      <div style={{ fontSize: 14, color: C.white, marginBottom: 4 }}>🕐 Best Hour: {bestHour[0]}:00 - ${(bestHour[1] / (platformTimes[p.platform].hours[bestHour[0]] || 1)).toFixed(2)}/hr</div>
                      <div style={{ fontSize: 14, color: C.white }}>📅 Best Day: {bestDay[0]}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {activeTab === "whales" && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 16 }}>🐳 Top Fans</h1>
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              <select value={whaleFilter} onChange={e => setWhaleFilter(e.target.value)} style={{ padding: "8px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.white, fontSize: 13 }}>
                <option value="ALL">All Tiers</option>
                <option value="Whale">🐳 Whales</option>
                <option value="Shark">🦈 Sharks</option>
                <option value="Regular">🐟 Regular</option>
                <option value="Dormant">💤 Dormant</option>
              </select>
              <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} style={{ padding: "8px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.white, fontSize: 13 }}>
                <option value="ALL">All Platforms</option>
                {allPlatforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.card2, borderBottom: `1px solid ${C.border}` }}>
                    {["#", "Username", "Total $", "Tips", "Avg Tip", "Platform", "Tier", "Last Tip", "Profile"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredWhales.map((w, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "12px 16px", color: C.muted }}>#{i + 1}</td>
                      <td style={{ padding: "12px 16px", color: C.white, fontWeight: 600 }}>{w.username}</td>
                      <td style={{ padding: "12px 16px", color: C.green, fontWeight: 700 }}>${w.totalUSD.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", color: C.muted }}>{w.tipCount}</td>
                      <td style={{ padding: "12px 16px", color: C.cyan }}>${w.avgTipSize.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", color: C.muted }}>{w.platform}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: 100, background: `${TIER_COLORS[w.tier]}15`, color: TIER_COLORS[w.tier], fontSize: 11, fontWeight: 600 }}>
                          {w.tier}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: C.muted, fontSize: 12 }}>{new Date(w.lastTipDate).toLocaleDateString()}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <button style={{ padding: "4px 12px", borderRadius: 6, background: `${C.pink}15`, border: `1px solid ${C.pink}30`, color: C.pink, fontSize: 11, cursor: "pointer" }}>🔒 View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "sessions" && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 32 }}>🎥 Stream Sessions</h1>
            {sessions.map((s, i) => (
              <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: C.white }}>{new Date(s.startTime).toLocaleDateString()} • {s.platform}</div>
                    <div style={{ fontSize: 13, color: C.muted }}>{new Date(s.startTime).toLocaleTimeString()}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>${s.totalUSD}</div>
                    <div style={{ fontSize: 12, color: C.cyan }}>{s.durationHours.toFixed(1)}h</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                  <div><div style={{ fontSize: 11, color: C.muted }}>$/Hour</div><div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>${s.usdPerHour}</div></div>
                  <div><div style={{ fontSize: 11, color: C.muted }}>Tips</div><div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>{s.tipCount}</div></div>
                  <div><div style={{ fontSize: 11, color: C.muted }}>Avg Tip</div><div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>${s.avgTipSize}</div></div>
                  <div><div style={{ fontSize: 11, color: C.muted }}>Fans</div><div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>{s.uniqueFans}</div></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "upload" && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>📥 Import CSV</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>Uploads: {uploadCount}/3 per month</p>
            <div style={{ background: C.card, borderRadius: 14, padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
              <label style={{ display: "inline-block", padding: "14px 32px", borderRadius: 10, background: uploadCount >= 3 ? C.muted : `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, color: C.white, fontSize: 15, fontWeight: 600, cursor: uploadCount >= 3 ? "not-allowed" : "pointer" }}>
                {uploading ? "Importing..." : uploadCount >= 3 ? "🔒 Limit Reached" : "Choose CSV File"}
                <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => handleCSV(e.target.files[0])} disabled={uploading || uploadCount >= 3} />
              </label>
              {uploadCount >= 3 && (
                <div style={{ marginTop: 24, padding: 16, background: `${C.pink}15`, border: `1px solid ${C.pink}30`, borderRadius: 10 }}>
                  <div style={{ fontSize: 14, color: C.white, marginBottom: 12 }}>Upgrade for unlimited imports</div>
                  <button style={{ padding: "10px 24px", borderRadius: 8, background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, border: "none", color: C.white, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Go Pro</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 20px", color: C.white, fontSize: 14, zIndex: 999, boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}>
          {toast}
        </div>
      )}
    </div>
  )
}
