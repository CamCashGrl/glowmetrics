"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { parseCSV, detectSessions, identifyWhales, generateInsights, aggregateRows } from "../../lib/analytics"

const C = {
  bg: "#0B0F1A",
  card: "#121826",
  card2: "#161e2e",
  border: "#1e2d45",
  border2: "#2a3f5f",
  indigo: "#7C5CFF",
  cyan: "#22D3EE",
  pink: "#EC4899",
  gold: "#F59E0B",
  blue: "#60A5FA",
  green: "#10B981",
  red: "#F87171",
  orange: "#FB923C",
  white: "#F1F5F9",
  text: "#94A3B8",
  muted: "#475569",
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
    } finally {
      setLoading(false)
    }
  }

  const handleCSV = async (file) => {
    if (!file || !user) return
    
    // FREE TIER LIMIT: 3 uploads per month
    if (uploadCount >= 3) {
      showToast("🔒 Free tier: 3 uploads/month. Upgrade for unlimited imports!")
      return
    }
    
    setUploading(true)
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      if (!parsed.length) {
        showToast("❌ No valid rows found")
        setUploading(false)
        return
      }

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
      if (error) {
        showToast("❌ " + error.message)
        setUploading(false)
        return
      }

      setUploadCount(uploadCount + 1)
      showToast(`✅ Imported ${parsed.length} tips!`)
      await loadData(user.id)
    } catch (err) {
      showToast("❌ " + err.message)
    } finally {
      setUploading(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.cyan}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ color: C.muted, fontSize: 14 }}>Loading dashboard...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    )
  }

  const sessions = analytics?.sessions || []
  const whales = identifyWhales(tips)
  const insights = analytics?.insights || []
  
  // Stats
  const totalRevenue = analytics?.totalUSD || 0
  const revenueToday = tips.filter(t => {
    const d = new Date(t.date_time)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  }).reduce((sum, t) => sum + t.usd, 0)
  
  const avgEarningsPerHour = sessions.length > 0 ? 
    sessions.reduce((sum, s) => sum + s.usdPerHour, 0) / sessions.length : 0

  const topSession = sessions.length > 0 ? 
    sessions.sort((a, b) => b.totalUSD - a.totalUSD)[0] : null

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 3px; }
      `}</style>

      {/* SIDEBAR */}
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 240, background: C.card, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", zIndex: 50 }}>
        <div style={{ padding: "24px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: C.white }}>$</div>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.white }}>
              Cam<span style={{ background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cash</span>
            </span>
          </div>
          {user && <div style={{ fontSize: 11, color: C.muted, marginTop: 10, overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>}
        </div>

        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            ["overview", "📊", "Overview"],
            ["analytics", "📈", "Analytics"],
            ["whales", "🐳", "Whale Tracker"],
            ["sessions", "🎥", "Sessions"],
            ["upload", "📥", "Import CSV"]
          ].map(([id, icon, label]) => (
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

        <div style={{ padding: "12px", borderTop: `1px solid ${C.border}` }}>
          <button onClick={signOut} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, cursor: "pointer" }}>
            ↩ Sign Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ marginLeft: 240, minHeight: "100vh", padding: 32 }}>
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>Overview</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>{tips.length.toLocaleString()} tips · {whales.length} fans</p>

            {/* KPI CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Total Revenue", value: `$${totalRevenue.toFixed(2)}`, icon: "💰", color: C.green },
                { label: "Revenue Today", value: `$${revenueToday.toFixed(2)}`, icon: "📅", color: C.cyan },
                { label: "Avg Tip Value", value: `$${analytics?.avgTipSize?.toFixed(2) || 0}`, icon: "⭐", color: C.gold },
                { label: "Avg $/Hour", value: `$${avgEarningsPerHour.toFixed(2)}`, icon: "⏱️", color: C.pink }
              ].map((stat, i) => (
                <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</span>
                    <span style={{ fontSize: 20 }}>{stat.icon}</span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* SMART INSIGHTS */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 16 }}>💡 Smart Insights</h2>
              {insights.length > 0 ? (
                <>
                  <div style={{ background: `${C.cyan}10`, border: `1px solid ${C.cyan}30`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 14, color: C.white }}>{insights[0].icon} {insights[0].text}</div>
                  </div>
                  <div style={{ background: `${C.muted}10`, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, position: "relative", overflow: "hidden" }}>
                    <div style={{ filter: "blur(3px)", opacity: 0.4 }}>
                      <div style={{ fontSize: 14, color: C.white, marginBottom: 8 }}>📈 Your best earning hour is 9 PM - 11 PM</div>
                      <div style={{ fontSize: 14, color: C.white, marginBottom: 8 }}>🎯 Weekend streams earn 45% more</div>
                      <div style={{ fontSize: 14, color: C.white }}>⏰ Your whales are most active at night</div>
                    </div>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 28 }}>🔒</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: C.white }}>Unlock 15 more insights</div>
                      <button style={{ padding: "10px 24px", borderRadius: 10, background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, border: "none", color: C.white, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                        Upgrade to Pro
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📥</div>
                  <div>Import CSV data to unlock insights</div>
                </div>
              )}
            </div>

            {/* TOP SESSION */}
            {topSession && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 16 }}>🏆 Top Earning Stream</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Earnings</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.green }}>${topSession.totalUSD}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Duration</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.cyan }}>{topSession.durationHours.toFixed(1)}h</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>$/Hour</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.pink }}>${topSession.usdPerHour}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Fans</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.gold }}>{topSession.uniqueFans}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WHALE TRACKER TAB */}
        {activeTab === "whales" && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>🐳 Whale Tracker</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>Your highest-value supporters</p>

            {whales.length > 0 ? (
              <>
                {/* TOP WHALE - FREE */}
                <div style={{ background: C.card, border: `1px solid ${C.gold}50`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
                  <div style={{ fontSize: 14, color: C.gold, fontWeight: 600, marginBottom: 12 }}>👑 TOP SPENDER</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: C.white, marginBottom: 4 }}>{whales[0].username}</div>
                      <div style={{ fontSize: 14, color: C.muted }}>Last tip: {new Date(whales[0].lastTipDate).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 32, fontWeight: 800, color: C.gold }}>${whales[0].totalUSD.toFixed(2)}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{whales[0].tipCount} tips</div>
                    </div>
                  </div>
                </div>

                {/* LOCKED WHALE PROFILES */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, position: "relative", overflow: "hidden" }}>
                  <div style={{ filter: "blur(4px)", opacity: 0.3 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: C.white, marginBottom: 16 }}>Full Whale Profiles</div>
                    {whales.slice(1, 5).map((w, i) => (
                      <div key={i} style={{ background: C.card2, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: C.white }}>{w.username}</div>
                            <div style={{ fontSize: 12, color: C.muted }}>Spending pattern: Peak 9-11 PM</div>
                            <div style={{ fontSize: 12, color: C.muted }}>Re-engagement probability: High</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: C.cyan }}>${w.totalUSD}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{w.tipCount} tips</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, background: "rgba(11, 15, 26, 0.9)" }}>
                    <div style={{ fontSize: 40 }}>🔒</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.white }}>Unlock Full Whale Profiles</div>
                    <div style={{ fontSize: 14, color: C.muted, textAlign: "center", maxWidth: 400 }}>
                      • Spending patterns & timing<br />
                      • Best show time predictions<br />
                      • Private show probability<br />
                      • Re-engagement alerts
                    </div>
                    <button style={{ padding: "12px 32px", borderRadius: 10, background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, border: "none", color: C.white, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>
                      Unlock Whale Analytics
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ background: C.card, borderRadius: 14, padding: 60, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📥</div>
                <div style={{ fontSize: 16, color: C.muted }}>Import CSV to track your whales</div>
              </div>
            )}
          </div>
        )}

        {/* SESSIONS TAB */}
        {activeTab === "sessions" && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>🎥 Stream Sessions</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>{sessions.length} sessions detected</p>

            {sessions.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {sessions.slice(0, 10).map((session, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: C.white, marginBottom: 4 }}>
                          {new Date(session.startTime).toLocaleDateString()} • {new Date(session.startTime).toLocaleTimeString()}
                        </div>
                        <div style={{ fontSize: 13, color: C.muted }}>{session.platform}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>${session.totalUSD}</div>
                        <div style={{ fontSize: 12, color: C.cyan }}>{session.durationHours.toFixed(1)} hours</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize: 11, color: C.muted }}>$/Hour</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>${session.usdPerHour}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.muted }}>Tips</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>{session.tipCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.muted }}>Avg Tip</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>${session.avgTipSize}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.muted }}>Fans</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>{session.uniqueFans}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* ADVANCED SESSION ANALYTICS LOCK */}
                {sessions.length > 10 && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: "center", position: "relative", overflow: "hidden" }}>
                    <div style={{ filter: "blur(2px)", opacity: 0.3 }}>
                      <div style={{ fontSize: 16, color: C.white, marginBottom: 8 }}>Advanced Session Breakdown</div>
                      <div style={{ fontSize: 13, color: C.muted }}>Earnings per minute • Tip timing heatmaps • Viewer retention curves</div>
                    </div>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 32 }}>🔒</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: C.white }}>Unlock Advanced Analytics</div>
                      <button style={{ padding: "10px 28px", borderRadius: 10, background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, border: "none", color: C.white, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>
                        Upgrade to Pro
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: C.card, borderRadius: 14, padding: 60, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📥</div>
                <div style={{ fontSize: 16, color: C.muted }}>Import CSV to see sessions</div>
              </div>
            )}
          </div>
        )}

        {/* UPLOAD TAB */}
        {activeTab === "upload" && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>📥 Import CSV Data</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>Supported: Chaturbate, BongaCams, MyFreeCams, all formats</p>

            <div style={{ background: C.card, borderRadius: 14, padding: 40, textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 8 }}>Upload Your Tip Data</div>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>
                CSV Uploads: {uploadCount}/3 per month (Free tier)
              </div>
              <label style={{ display: "inline-block", padding: "14px 32px", borderRadius: 10, background: uploadCount >= 3 ? C.muted : `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, border: "none", color: C.white, fontSize: 15, fontWeight: 600, cursor: uploadCount >= 3 ? "not-allowed" : "pointer" }}>
                {uploading ? "Importing..." : uploadCount >= 3 ? "🔒 Limit Reached" : "Choose CSV File"}
                <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => handleCSV(e.target.files[0])} disabled={uploading || uploadCount >= 3} />
              </label>
              {tips.length > 0 && <div style={{ marginTop: 20, fontSize: 13, color: C.green }}>✅ {tips.length.toLocaleString()} tips imported</div>}
              
              {uploadCount >= 3 && (
                <div style={{ marginTop: 24, padding: 20, background: `${C.pink}10`, border: `1px solid ${C.pink}30`, borderRadius: 10 }}>
                  <div style={{ fontSize: 14, color: C.white, marginBottom: 12 }}>Need unlimited data imports?</div>
                  <button style={{ padding: "10px 24px", borderRadius: 10, background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, border: "none", color: C.white, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    Upgrade for Unlimited Analytics
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 20px", color: C.white, fontSize: 14, zIndex: 999, boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}>
          {toast}
        </div>
      )}
    </div>
  )
}
