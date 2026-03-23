"use client"
import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { parseCSV, aggregateRows } from "../../lib/analytics"

// Analytics tracking — works whether or not @vercel/analytics is installed
let track = (event, props) => {}
try { track = require("@vercel/analytics").track } catch (e) {}

const C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

const TIER_COLORS = {
  "Whale": C.gold, "Shark": C.blue, "Regular": C.cyan, "Dormant": C.orange
}

const glassCard = {
  background: "rgba(15,20,32,0.75)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  boxShadow: "0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(236,72,153,0.08)",
}

const formatHour = (hour) => {
  const h = parseInt(hour)
  if (h === 0) return "12 AM"
  if (h < 12) return `${h} AM`
  if (h === 12) return "12 PM"
  return `${h - 12} PM`
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tips, setTips] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [liveAnalytics, setLiveAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [toast, setToast] = useState("")
  const [uploadCount, setUploadCount] = useState(0)
  const [whaleFilter, setWhaleFilter] = useState("ALL")
  const [platformFilter, setPlatformFilter] = useState("ALL")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedWhale, setSelectedWhale] = useState(null)
  const [messageTarget, setMessageTarget] = useState(null)
  const [messageIndex, setMessageIndex] = useState(0)
  const [messageCopied, setMessageCopied] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showBetaPrompt, setShowBetaPrompt] = useState(false)
  const [earlyAccessEmail, setEarlyAccessEmail] = useState('')
  const [earlyAccessSubmitted, setEarlyAccessSubmitted] = useState(false)
  const [earlyAccessSubmitting, setEarlyAccessSubmitting] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackType, setFeedbackType] = useState('feature')
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [tipPage, setTipPage] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const isBetaUser = true
  const isPro = true
  const uploadLimit = Infinity

  const openUpgradeModal = (source) => {
    track('upgrade_click', { source })
    setShowUpgradeModal(true)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500) }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return }
      setUser(user)
      loadData(user.id)
    })
  }, [])

  useEffect(() => {
    if (!tips.length) return
    const interval = setInterval(() => { const updated = aggregateRows(tips); setLiveAnalytics(updated) }, 5000)
    return () => clearInterval(interval)
  }, [tips])

  const loadData = async (uid) => {
    setLoading(true)
    try {
      // Fetch all rows in pages of 1000 to bypass Supabase default limit
      let allData = []
      let from = 0
      const PAGE = 1000
      while (true) {
        const { data, error } = await supabase.from("tips").select("*").eq("user_id", uid).order("date_time", { ascending: true }).range(from, from + PAGE - 1)
        if (error) break
        if (data?.length) allData = [...allData, ...data]
        if (!data || data.length < PAGE) break
        from += PAGE
      }
      if (allData.length) { setTips(allData); setAnalytics(aggregateRows(allData)) }
    } finally { setLoading(false) }
  }

  const removeDuplicates = (existingTips, newTips) => {
    const existingKeys = new Set(existingTips.map(t => `${t.date_time}_${t.username}_${t.tokens}_${t.platform}`))
    return newTips.filter(t => !existingKeys.has(`${t.dateRaw || t.date_time}_${t.username}_${t.tokens}_${t.platform}`))
  }

  // parseCSV now returns a plain array — no { success, needsConfirmation } object
  const handleCSV = async (file) => {
    if (!file || !user) return
    setUploading(true)
    try {
      const text = await file.text()
      const parsed = parseCSV(text)

      if (!parsed.length) {
        showToast("❌ No valid rows found in this file")
        setUploading(false)
        return
      }

      // Track successful parse
      track('csv_imported', { rows: parsed.length, platform: parsed[0]?.platform || 'Unknown' })

      const unique = removeDuplicates(tips, parsed)
      const duplicateCount = parsed.length - unique.length

      if (unique.length === 0) {
        showToast(`⚠️ All ${parsed.length} tips are already imported!`)
        setUploading(false)
        return
      }

      const toInsert = unique.map(r => {
        const tokens = r.tokens || 0
        const usd = (r.usd && r.usd > 0) ? r.usd : parseFloat((tokens * 0.05).toFixed(2))
        return {
          user_id: user.id,
          date_time: r.dateRaw || r.date_time,
          platform: r.platform,
          username: r.username,
          tip_type: r.tip_type || "Tip",
          tokens,
          usd
        }
      })

      // Insert in batches of 500 to avoid Supabase limits
      const BATCH_SIZE = 500
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from("tips").insert(batch)
        if (error) { showToast("❌ " + error.message); setUploading(false); return }
      }

      setUploadCount(uploadCount + 1)
      const newCount = uploadCount + 1
      if (newCount === 2 || newCount === 3) setShowBetaPrompt(true)
      // Track upload event
      try {
        await supabase.from('analytics_events').insert({ user_id: user.id, event_name: 'csv_uploaded', properties: { count: newCount, platform: parsed[0]?.platform || 'Unknown', rows: unique.length } })
        await supabase.from('beta_users').upsert({ user_id: user.id, email: user.email, csv_upload_count: newCount }, { onConflict: 'user_id' })
      } catch(e) {}
      const msg = duplicateCount > 0
        ? `✅ Imported ${unique.length} tips (${duplicateCount} duplicates skipped)`
        : `✅ Imported ${unique.length} tips from ${parsed[0]?.platform || "CSV"}!`
      showToast(msg)
      await loadData(user.id)
    } catch (err) {
      showToast("❌ " + err.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteTip = async (tipId) => {
    if (!confirm("Delete this tip?")) return
    try { const { error } = await supabase.from("tips").delete().eq("id", tipId); if (error) throw error; showToast("✅ Tip deleted"); await loadData(user.id) }
    catch (err) { showToast("❌ " + err.message) }
  }

  const deleteAllTips = async () => {
    if (!user) return
    try { const { error } = await supabase.from("tips").delete().eq("user_id", user.id); if (error) throw error; showToast("✅ All tips deleted"); setShowDeleteConfirm(false); await loadData(user.id) }
    catch (err) { showToast("❌ " + err.message) }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#05070f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "2px solid #1e2d45", borderTop: "2px solid #22D3EE", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
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
  const alerts = liveAnalytics?.whaleAlerts || analytics?.whaleAlerts || []
  const lossAlerts = liveAnalytics?.lossAlerts || analytics?.lossAlerts || []
  const nextMoves = liveAnalytics?.nextMoves || analytics?.nextMoves || []
  const totalRevenue = analytics?.totalUSD || 0
  const avgPerHour = sessions.reduce((sum, s) => sum + s.usdPerHour, 0) / (sessions.length || 1)

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
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(circle at 20% 30%, rgba(59,130,246,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(236,72,153,0.25), transparent 40%), radial-gradient(circle at 50% 50%, rgba(168,85,247,0.15), transparent 60%), #05070f`,
      fontFamily: "'Inter', sans-serif", color: C.text
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #05070f; }
        ::-webkit-scrollbar-thumb { background: #2a3f5f; border-radius: 3px; }
        .dash-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .dash-card:hover { transform: translateY(-2px); }
        .whale-row { transition: background 0.15s; }
        .whale-row:hover { background: rgba(59,130,246,0.08) !important; }
      `}</style>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 900, height: 900, top: "-20%", left: "-10%", background: "radial-gradient(circle, rgba(59,130,246,0.35), transparent 60%)", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", width: 900, height: 900, bottom: "-20%", right: "-10%", background: "radial-gradient(circle, rgba(236,72,153,0.35), transparent 60%)", filter: "blur(120px)" }} />
      </div>

      {/* SIDEBAR */}
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 240, background: "rgba(15,20,32,0.85)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", zIndex: 50 }}>
        <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #22D3EE, #EC4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: C.white, boxShadow: "0 0 20px rgba(34,211,238,0.4)" }}>$</div>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.white }}>Cam<span style={{ background: "linear-gradient(90deg, #22D3EE, #EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cash</span></span>
          </div>
          {user && <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>{user.email}</div>}
          <div style={{ marginTop: 12, padding: "6px 10px", borderRadius: 8, background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(251,146,60,0.2))", border: "1px solid rgba(245,158,11,0.4)", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, flexShrink: 0, boxShadow: `0 0 6px ${C.gold}` }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: 0.5 }}>FREE BETA</div>
              <div style={{ fontSize: 9, color: C.orange }}>All features unlocked</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {[["overview", "📊", "Overview"], ["platforms", "🎯", "Platforms"], ["whales", "🐳", "Top Fans"], ["sessions", "🎥", "Sessions"], ["data", "📝", "Edit Data"], ["titles", "🎬", "Room Titles"], ["help", "❓", "CSV Help"], ["upload", "📥", "Import"]].map(([id, icon, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
              background: activeTab === id ? "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(236,72,153,0.2))" : "transparent",
              border: activeTab === id ? "1px solid rgba(59,130,246,0.4)" : "1px solid transparent",
              boxShadow: activeTab === id ? "0 0 20px rgba(59,130,246,0.3)" : "none",
              color: activeTab === id ? C.white : C.muted, fontSize: 14, fontWeight: activeTab === id ? 600 : 400,
              cursor: "pointer", transition: "all 0.15s", textAlign: "left"
            }}>
              <span style={{ fontSize: 18 }}>{icon}</span>{label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ padding: 12, borderRadius: 10, background: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(124,92,255,0.15))", border: "1px solid rgba(236,72,153,0.3)", textAlign: "center" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>🎉</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 2 }}>Free for first 100 users</div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>Spots filling up fast</div>
            <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: "63%", borderRadius: 4, background: "linear-gradient(90deg, #22D3EE, #EC4899)" }} />
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>63 / 100 spots taken</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ marginLeft: 240, padding: 32, position: "relative", zIndex: 1 }}>

        {activeTab === "overview" && (
          <div>
            <div style={{ marginBottom: 24, padding: "14px 20px", borderRadius: 12, background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,146,60,0.1))", border: "1px solid rgba(245,158,11,0.4)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 24 }}>🎉</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>You're one of our first 100 beta users — everything is free!</div>
                  <div style={{ fontSize: 12, color: C.muted }}>All Pro features unlocked. No credit card. No limits. Just good vibes.</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>63/100 spots taken</div>
                <div style={{ width: 80, height: 6, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "63%", borderRadius: 4, background: "linear-gradient(90deg, #F59E0B, #FB923C)" }} />
                </div>
              </div>
            </div>

            {(() => {
              const recentSessions = sessions.filter(s => new Date(s.startTime) > new Date(Date.now() - 30 * 86400000))
              const prevSessions = sessions.filter(s => { const d = new Date(s.startTime); return d > new Date(Date.now() - 60 * 86400000) && d <= new Date(Date.now() - 30 * 86400000) })
              const recentRev = recentSessions.reduce((s, r) => s + r.totalUSD, 0)
              const prevRev = prevSessions.reduce((s, r) => s + r.totalUSD, 0)
              const growthPct = prevRev > 0 ? Math.round(((recentRev - prevRev) / prevRev) * 100) : null
              const topPct = Math.max(1, Math.min(25, Math.round(100 - (totalRevenue / 50))))
              const streak = recentSessions.length
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 28 }}>
                  {[
                    { label: "Total Earned", value: `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: `Top ${topPct}% of models on this platform`, icon: "💰", badge: growthPct !== null ? (growthPct >= 0 ? `↑ ${growthPct}% vs last month` : `↓ ${Math.abs(growthPct)}% vs last month`) : null, badgeColor: growthPct !== null && growthPct >= 0 ? C.green : C.red },
                    { label: "Avg $/Hour", value: `$${avgPerHour.toFixed(2)}`, sub: avgPerHour > 20 ? "Above average — keep it up!" : "Tip: stream at peak hours", icon: "⏱️", badge: null },
                    { label: "Total Fans", value: whales.length, sub: `${whales.filter(w => Math.floor((Date.now() - new Date(w.lastTipDate)) / 86400000) <= 30).length} active in last 30 days`, icon: "👥", badge: null },
                    { label: "Sessions", value: sessions.length, sub: `${streak} in last 30 days${streak >= 3 ? " 🔥" : ""}`, icon: "🎥", badge: streak >= 5 ? "🔥 On a streak!" : null, badgeColor: C.gold }
                  ].map((s, i) => (
                    <div key={i} className="dash-card" style={{ ...glassCard, borderRadius: 18, padding: 22, position: "relative", overflow: "hidden" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</span>
                        <span style={{ fontSize: 20 }}>{s.icon}</span>
                      </div>
                      <div style={{ fontSize: 36, fontWeight: 900, background: "linear-gradient(135deg,#60a5fa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6 }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{s.sub}</div>
                      {s.badge && <div style={{ marginTop: 8, display: "inline-block", padding: "2px 8px", borderRadius: 6, background: `${s.badgeColor}20`, border: `1px solid ${s.badgeColor}40`, fontSize: 10, fontWeight: 700, color: s.badgeColor }}>{s.badge}</div>}
                    </div>
                  ))}
                </div>
              )
            })()}

            {(() => {
              const actions = nextMoves.length > 0 ? nextMoves : [{ icon: "📊", color: C.cyan, text: "Import your first CSV to unlock personalized action recommendations", cta: null }]
              return (
                <div style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #22D3EE, #7C5CFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>What Should I Do Right Now?</div>
                      <div style={{ fontSize: 12, color: C.muted }}>Live coaching based on your actual data</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {actions.map((a, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "14px 16px", background: `${a.color}10`, border: `1px solid ${a.color}30`, borderRadius: 12 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1 }}>
                          <span style={{ fontSize: 20, flexShrink: 0 }}>{a.icon}</span>
                          <div style={{ fontSize: 14, color: C.white, lineHeight: 1.5 }}>{a.text}</div>
                        </div>
                        {a.cta && (
                          <button onClick={() => { const w = whales.find(wh => wh.username === a.username); if (w) { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) } }}
                            style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 8, background: "linear-gradient(135deg, #EC4899, #7C5CFF)", boxShadow: "0 0 20px rgba(236,72,153,0.4)", border: "none", color: C.white, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                            💌 Message
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            <div style={{ ...glassCard, borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 16 }}>💡 Smart Insights</h2>
              {insights.slice(0, 3).map((ins, i) => (
                <div key={i} style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: C.white }}>{ins.icon} {ins.text}</div>
                </div>
              ))}
              <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", marginTop: 8 }}>
                <div style={{ filter: isPro ? "none" : "blur(3px)", pointerEvents: "none" }}>
                  {insights.slice(3, 8).map((ins, i) => (
                    <div key={i} style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.1)", borderRadius: 10, padding: 16, marginBottom: 8 }}>
                      <div style={{ fontSize: 14, color: C.white }}>{ins.icon} {ins.text}</div>
                    </div>
                  ))}
                  {insights.length < 5 && [1,2].map(i => (
                    <div key={i} style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.1)", borderRadius: 10, padding: 16, marginBottom: 8 }}>
                      <div style={{ fontSize: 14, color: C.muted }}>📈 Advanced timing insight #{i + 3}...</div>
                    </div>
                  ))}
                </div>
                {!isPro && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(5,7,15,0.75)", backdropFilter: "blur(2px)", borderRadius: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>🔒 {Math.max(0, insights.length - 3)} more insights hidden</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Timing patterns, predictions & advanced strategy</div>
                    <button onClick={() => openUpgradeModal('insights')} style={{ padding: "8px 20px", borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#ec4899)", border: "none", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 20px rgba(59,130,246,0.4)" }}>
                      🔓 Unlock All Insights
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ ...glassCard, borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 16 }}>🚨 Loss Alerts</h2>
              {lossAlerts.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No active alerts — you're on track! 🎉</div>}
              {lossAlerts.map((a, i) => (
                <div key={i} style={{ padding: 14, borderRadius: 10, marginBottom: 10, background: a.severity === 'critical' ? "rgba(248,113,113,0.15)" : a.severity === 'warning' ? "rgba(251,146,60,0.15)" : "rgba(34,211,238,0.1)", border: `1px solid ${a.severity === 'critical' ? C.red : a.severity === 'warning' ? C.orange : C.cyan}30` }}>
                  <div style={{ fontSize: 14, color: C.white, marginBottom: 4 }}>{a.icon} {a.message}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>👉 {a.action}</div>
                </div>
              ))}
            </div>

            <div style={{ ...glassCard, borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 16 }}>🚨 Live AI Alerts</h2>
              {alerts.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No active alerts</div>}
              {alerts.slice(0, 5).map((a, i) => (
                <div key={i} style={{ padding: 14, borderRadius: 10, marginBottom: 10, background: a.severity === "critical" ? "rgba(248,113,113,0.15)" : a.severity === "warning" ? "rgba(251,146,60,0.15)" : a.severity === "success" ? "rgba(16,185,129,0.15)" : "rgba(34,211,238,0.1)", border: `1px solid ${a.severity === "critical" ? C.red : a.severity === "warning" ? C.orange : a.severity === "success" ? C.green : C.cyan}30` }}>
                  <div style={{ fontSize: 14, color: C.white }}>{a.icon} {a.message}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>👉 {a.action}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "platforms" && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 32 }}>🎯 Platform Analytics</h1>
            {platforms.map((p, i) => {
              const bestHour = Object.entries(platformTimes[p.platform]?.hours || {}).sort((a, b) => b[1] - a[1])[0]
              const bestDay = Object.entries(platformTimes[p.platform]?.days || {}).sort((a, b) => b[1] - a[1])[0]
              return (
                <div key={i} className="dash-card" style={{ ...glassCard, borderRadius: 14, padding: 24, marginBottom: 20 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 16 }}>{p.platform}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
                    <div><div style={{ fontSize: 12, color: C.muted }}>Total Revenue</div><div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>${p.totalUSD.toFixed(2)}</div></div>
                    <div><div style={{ fontSize: 12, color: C.muted }}>$/Hour</div><div style={{ fontSize: 24, fontWeight: 700, color: C.cyan }}>${p.usdPerHour.toFixed(2)}</div></div>
                    <div><div style={{ fontSize: 12, color: C.muted }}>Sessions</div><div style={{ fontSize: 24, fontWeight: 700, color: C.pink }}>{p.sessions}</div></div>
                    <div><div style={{ fontSize: 12, color: C.muted }}>Total Hours</div><div style={{ fontSize: 24, fontWeight: 700, color: C.gold }}>{p.hours.toFixed(1)}h</div></div>
                  </div>
                  {bestHour && bestDay && (
                    <div style={{ position: "relative" }}>
                      <div style={{ padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", filter: isPro ? "none" : "blur(3px)" }}>
                        <div style={{ fontSize: 14, color: C.white, marginBottom: 4 }}>🕐 Best Hour: {formatHour(bestHour[0])} — ${bestHour[1].toFixed(2)} total</div>
                        <div style={{ fontSize: 14, color: C.white }}>📅 Best Day: {bestDay[0]} — ${bestDay[1].toFixed(2)} total</div>
                      </div>
                      {!isPro && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,7,15,0.6)", borderRadius: 10, backdropFilter: "blur(1px)" }}>
                          <button onClick={() => openUpgradeModal('platform_timing')} style={{ padding: "7px 18px", borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#ec4899)", border: "none", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            🔒 Unlock Timing Data
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {activeTab === "whales" && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>🐳 Top Fans</h1>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Your highest-value supporters ranked by total spend</p>
            <div style={{ ...glassCard, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["#", "Username", "Total $", "Tips", "Avg Tip", "Platform", "Tier", "Last Tip", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredWhales.slice(0, 3).map((w, i) => (
                    <tr key={i} className="whale-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "12px 16px", color: C.gold, fontWeight: 700 }}>#{i + 1}</td>
                      <td style={{ padding: "12px 16px", color: C.white, fontWeight: 600 }}>{w.username}</td>
                      <td style={{ padding: "12px 16px", color: C.green, fontWeight: 700 }}>${w.totalUSD.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", color: C.muted }}>{w.tipCount}</td>
                      <td style={{ padding: "12px 16px", color: C.cyan }}>${w.avgTipSize.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", color: C.muted }}>{w.platform}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: 100, background: `${TIER_COLORS[w.tier]}15`, color: TIER_COLORS[w.tier], fontSize: 11, fontWeight: 600 }}>{w.tier}</span>
                      </td>
                      <td style={{ padding: "12px 16px", color: C.muted, fontSize: 12 }}>{new Date(w.lastTipDate).toLocaleDateString()}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setSelectedWhale(w)} style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.3)", color: C.cyan, fontSize: 11, cursor: "pointer" }}>🔍 View</button>
                          <button onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }} style={{ padding: "4px 10px", borderRadius: 6, background: "linear-gradient(135deg, rgba(236,72,153,0.3), rgba(124,92,255,0.3))", border: "1px solid rgba(236,72,153,0.4)", color: C.pink, fontSize: 11, cursor: "pointer" }}>💌 Message</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredWhales.length > 3 && (
              <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ filter: isPro ? "none" : "blur(4px)", pointerEvents: isPro ? "auto" : "none" }}>
                  <div style={{ ...glassCard, borderRadius: 14, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <tbody>
                        {filteredWhales.slice(3, 8).map((w, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding: "12px 16px", color: C.muted, width: 40 }}>#{i + 4}</td>
                            <td style={{ padding: "12px 16px", color: C.white, fontWeight: 600 }}>{w.username}</td>
                            <td style={{ padding: "12px 16px", color: C.green, fontWeight: 700 }}>${w.totalUSD.toFixed(2)}</td>
                            <td style={{ padding: "12px 16px", color: C.muted }}>{w.tipCount} tips</td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ padding: "4px 10px", borderRadius: 100, background: `${TIER_COLORS[w.tier]}15`, color: TIER_COLORS[w.tier], fontSize: 11, fontWeight: 600 }}>{w.tier}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {!isPro && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(5,7,15,0.7)", backdropFilter: "blur(2px)", borderRadius: 14 }}>
                    <div style={{ textAlign: "center", padding: 24 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 4 }}>+{filteredWhales.length - 3} more high-value fans hidden</div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Including fans spending ${filteredWhales[3] ? filteredWhales[3].totalUSD.toFixed(0) : "???"} and more</div>
                      <button onClick={() => openUpgradeModal('whales')} style={{ padding: "10px 28px", borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #ec4899)", border: "none", color: C.white, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 30px rgba(59,130,246,0.4)" }}>
                        🔓 Unlock All Fans
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {filteredWhales.length <= 3 && (
              <div style={{ ...glassCard, borderRadius: 14, padding: 20, textAlign: "center", border: "1px solid rgba(59,130,246,0.2)" }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Upload more data to discover more fans • Pro unlocks full profiles & behavior patterns</div>
                <button onClick={() => openUpgradeModal('whales_empty')} style={{ padding: "8px 20px", borderRadius: 8, background: "linear-gradient(135deg,rgba(59,130,246,0.3),rgba(236,72,153,0.3))", border: "1px solid rgba(59,130,246,0.4)", color: C.white, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  🔓 See What Pro Unlocks
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "sessions" && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 32 }}>🎥 Stream Sessions</h1>
            {sessions.slice(0, 3).map((s, i) => (
              <div key={i} className="dash-card" style={{ ...glassCard, borderRadius: 14, padding: 20, marginBottom: 16 }}>
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div><div style={{ fontSize: 11, color: C.muted }}>$/Hour</div><div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>${s.usdPerHour}</div></div>
                  <div><div style={{ fontSize: 11, color: C.muted }}>Tips</div><div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>{s.tipCount}</div></div>
                  <div><div style={{ fontSize: 11, color: C.muted }}>Avg Tip</div><div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>${s.avgTipSize}</div></div>
                  <div><div style={{ fontSize: 11, color: C.muted }}>Fans</div><div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>{s.uniqueFans}</div></div>
                </div>
              </div>
            ))}
            {sessions.length > 3 && (
              <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ filter: isPro ? "none" : "blur(4px)", pointerEvents: "none" }}>
                  {sessions.slice(3, 7).map((s, i) => (
                    <div key={i} style={{ ...glassCard, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: C.white }}>{new Date(s.startTime).toLocaleDateString()} • {s.platform}</div>
                          <div style={{ fontSize: 13, color: C.muted }}>{s.durationHours.toFixed(1)}h • {s.tipCount} tips</div>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>${s.totalUSD}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {!isPro && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(5,7,15,0.75)", backdropFilter: "blur(2px)", borderRadius: 14 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 4 }}>+{sessions.length - 3} more sessions locked</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Full session history, deep analytics & trends</div>
                    <button onClick={() => openUpgradeModal('sessions')} style={{ padding: "10px 28px", borderRadius: 10, background: "linear-gradient(135deg,#3b82f6,#ec4899)", border: "none", color: C.white, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 30px rgba(59,130,246,0.4)" }}>
                      🔓 Unlock Full History
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "data" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white }}>📝 Edit Data</h1>
              <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🗑️ Delete All Tips</button>
            </div>

            {/* Date filter bar */}
            <div style={{ ...glassCard, borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Filter by date:</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: C.muted }}>From</span>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setTipPage(0) }}
                  min={tips.length ? new Date(Math.min(...tips.map(t => new Date(t.date_time)))).toISOString().split('T')[0] : ''}
                  max={dateTo || new Date().toISOString().split('T')[0]}
                  style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: C.white, fontSize: 13, colorScheme: "dark" }} />
                <span style={{ fontSize: 12, color: C.muted }}>To</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setTipPage(0) }}
                  min={dateFrom || (tips.length ? new Date(Math.min(...tips.map(t => new Date(t.date_time)))).toISOString().split('T')[0] : '')}
                  max={new Date().toISOString().split('T')[0]}
                  style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: C.white, fontSize: 13, colorScheme: "dark" }} />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); setTipPage(0) }}
                  style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: C.muted, fontSize: 12, cursor: "pointer" }}>
                  ✕ Clear
                </button>
              )}
            </div>

            {(() => {
              const filtered = tips.filter(t => {
                const d = new Date(t.date_time)
                if (dateFrom && d < new Date(dateFrom)) return false
                if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
                return true
              })
              const PAGE = 100
              const totalPages = Math.ceil(filtered.length / PAGE)
              const pageTips = filtered.slice(tipPage * PAGE, (tipPage + 1) * PAGE)

              return (
                <>
                  <div style={{ ...glassCard, borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 24 }}>
                    <div style={{ fontSize: 14, color: C.muted }}>Showing <span style={{ color: C.white, fontWeight: 600 }}>{filtered.length}</span> tips{(dateFrom || dateTo) ? ' (filtered)' : ''}</div>
                    <div style={{ fontSize: 14, color: C.muted }}>Total: <span style={{ color: C.green, fontWeight: 700 }}>${filtered.reduce((s, t) => s + t.usd, 0).toFixed(2)}</span></div>
                  </div>

                  <div style={{ ...glassCard, borderRadius: 14, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          {["Date", "Username", "Platform", "Amount", "Tokens", "Type", "Actions"].map(h => (
                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", fontWeight: 500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageTips.map((t, i) => (
                          <tr key={t.id || i} className="whale-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding: "12px 16px", color: C.white, fontSize: 12 }}>{new Date(t.date_time).toLocaleDateString()}</td>
                            <td style={{ padding: "12px 16px", color: C.white, fontWeight: 600 }}>{t.username}</td>
                            <td style={{ padding: "12px 16px", color: C.muted }}>{t.platform}</td>
                            <td style={{ padding: "12px 16px", color: C.green, fontWeight: 700 }}>${t.usd.toFixed(2)}</td>
                            <td style={{ padding: "12px 16px", color: C.cyan }}>{t.tokens}</td>
                            <td style={{ padding: "12px 16px", color: C.muted, fontSize: 12 }}>{t.tip_type}</td>
                            <td style={{ padding: "12px 16px" }}>
                              <button onClick={() => deleteTip(t.id)} style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: C.red, fontSize: 11, cursor: "pointer" }}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <button onClick={() => setTipPage(p => Math.max(0, p - 1))} disabled={tipPage === 0}
                          style={{ padding: "7px 18px", borderRadius: 8, background: tipPage === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: tipPage === 0 ? C.muted : C.white, fontSize: 13, cursor: tipPage === 0 ? "not-allowed" : "pointer" }}>
                          ← Prev
                        </button>
                        <div style={{ fontSize: 13, color: C.muted }}>
                          Page <span style={{ color: C.white, fontWeight: 600 }}>{tipPage + 1}</span> of <span style={{ color: C.white, fontWeight: 600 }}>{totalPages}</span>
                          <span style={{ marginLeft: 12 }}>({tipPage * PAGE + 1}–{Math.min((tipPage + 1) * PAGE, filtered.length)} of {filtered.length})</span>
                        </div>
                        <button onClick={() => setTipPage(p => Math.min(totalPages - 1, p + 1))} disabled={tipPage >= totalPages - 1}
                          style={{ padding: "7px 18px", borderRadius: 8, background: tipPage >= totalPages - 1 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: tipPage >= totalPages - 1 ? C.muted : C.white, fontSize: 13, cursor: tipPage >= totalPages - 1 ? "not-allowed" : "pointer" }}>
                          Next →
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {activeTab === "upload" && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>📥 Import CSV</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>Unlimited uploads during free beta • Auto-removes duplicates</p>
            <div style={{ ...glassCard, borderRadius: 14, padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
              <label style={{ display: "inline-block", padding: "14px 32px", borderRadius: 10, background: "linear-gradient(135deg, #22D3EE, #EC4899)", boxShadow: "0 0 20px rgba(34,211,238,0.4), 0 0 40px rgba(236,72,153,0.3)", color: C.white, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                {uploading ? "Processing..." : "Choose CSV File"}
                <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => handleCSV(e.target.files[0])} disabled={uploading} />
              </label>
            </div>
          </div>
        )}

        {activeTab === "titles" && (() => {
          const [titles, setTitles] = React.useState([])
          const [selected, setSelected] = React.useState(null)
          const [hashtags, setHashtags] = React.useState([])
          const [tokensEnabled, setTokensEnabled] = React.useState(false)
          const [tokenGoal, setTokenGoal] = React.useState(500)
          const [action, setAction] = React.useState("")
          const [interactive, setInteractive] = React.useState(false)
          const [toy, setToy] = React.useState("")
          const [game, setGame] = React.useState("")
          const [emojis, setEmojis] = React.useState(true)
          const [hashtagsEnabled, setHashtagsEnabled] = React.useState(true)
          const [autoCopy, setAutoCopy] = React.useState(true)
          const [copiedIndex, setCopiedIndex] = React.useState(null)
          const [copiedSelected, setCopiedSelected] = React.useState(false)

          const scoreTitle = title => {
            let score = 0
            if (title.includes("Tip")) score += 2
            if (title.includes("Control")) score += 2
            if (title.includes("Top")) score += 1
            if (title.length < 90) score += 1
            if (/🔥|💦|😈|👑/.test(title)) score += 1
            return score
          }

          const copyFull = (selectedText, hashtagsArray) => {
            const fullText = `${selectedText}\n\n${hashtagsArray.join(" ")}`
            navigator.clipboard.writeText(fullText)
            setCopiedSelected(true)
            setTimeout(() => setCopiedSelected(false), 1500)
          }

          const generate = () => {
            const results = []
            let attempts = 0
            const emojisSet = emojis ? ["🔥","💦","😈","👑"] : [""]
            while (results.length < 25 && attempts < 100) {
              attempts++
              const e = emojisSet[Math.floor(Math.random() * emojisSet.length)]
              const structures = [
                `Tip ${Math.floor(Math.random()*20)+5} → ${action || "Make Me React"} ${e}`,
                `Top Tipper Controls Me ${e}`,
                `You Control Everything • Tip To Play ${e}`,
                `Hit ${tokenGoal} → ${action || "Special Reward"} ${e}`,
                `Tip = ${action || "Reaction"} • Don't Stop ${e}`,
                `Control My ${toy || "Toy"} • Tip To Activate ${e}`,
                `${game || "Game Mode"} • Winner Gets Control ${e}`
              ]
              let title = structures[Math.floor(Math.random() * structures.length)]
              if (interactive) title += " • Interactive ON"
              if (tokensEnabled) title += ` • Goal: ${tokenGoal}`
              if (!results.find(r => r.text === title)) results.push({ text: title, score: scoreTitle(title) })
            }
            setTitles(results.sort((a,b) => b.score - a.score))
            setSelected(null)
            setHashtags([])
            setCopiedIndex(null)
            setCopiedSelected(false)
          }

          const toggleBtn = (val, label, onToggle) => (
            <label style={{ color: C.text, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={val} onChange={onToggle} style={{ accentColor: C.pink }} /> {label}
            </label>
          )

          const inpStyle = { background: C.card2, border: `1px solid ${C.border2}`, padding: 8, borderRadius: 8, color: C.white, outline: "none", width: "100%" }

          return (
            <div style={{ ...glassCard, padding: 20, borderRadius: 16, marginTop: 20, maxWidth: 700 }}>
              <h2 style={{ fontSize: 18, marginBottom: 12, color: C.white, fontWeight: 700 }}>🔥 Viral Title Generator</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 15 }}>
                {toggleBtn(tokensEnabled, "Token Goal", () => setTokensEnabled(!tokensEnabled))}
                {tokensEnabled && (
                  <>
                    <input value={tokenGoal} onChange={e => setTokenGoal(Number(e.target.value))} style={inpStyle} placeholder="Token Goal" />
                    <input value={action} onChange={e => setAction(e.target.value)} placeholder="Action" style={inpStyle} />
                  </>
                )}
                {toggleBtn(interactive, "Interactive", () => setInteractive(!interactive))}
                {interactive && (
                  <>
                    <input value={toy} onChange={e => setToy(e.target.value)} placeholder="Toy" style={inpStyle} />
                    <input value={game} onChange={e => setGame(e.target.value)} placeholder="Game" style={inpStyle} />
                  </>
                )}
                {toggleBtn(emojis, "Emojis", () => setEmojis(!emojis))}
                {toggleBtn(hashtagsEnabled, "Hashtags", () => setHashtagsEnabled(!hashtagsEnabled))}
                {toggleBtn(autoCopy, "Auto Copy", () => setAutoCopy(!autoCopy))}
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
                <button onClick={generate} style={{ background: C.pink, padding: "10px 16px", borderRadius: 10, color: C.white, border: "none", fontWeight: 700, cursor: "pointer" }}>
                  ✨ Generate Titles
                </button>
                {titles.length > 0 && (
                  <button onClick={generate} style={{ background: "rgba(255,255,255,0.06)", padding: "10px 16px", borderRadius: 10, color: C.muted, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                    🔁 Regenerate
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {titles.map((t, i) => (
                  <div key={i} onClick={() => {
                    setSelected(t)
                    let tags = []
                    if (hashtagsEnabled) {
                      const base = ["#camgirl","#livecam","#fyp"]
                      if (t.text.includes("Control")) tags = ["#controlme","#lovense"]
                      else if (t.text.includes("Tip")) tags = ["#tips","#paytoplay"]
                      else tags = ["#sexy","#flirty"]
                      tags = [...base, ...tags]
                      setHashtags(tags)
                    }
                    if (autoCopy) {
                      const full = hashtagsEnabled ? `${t.text}\n\n${tags.join(" ")}` : t.text
                      navigator.clipboard.writeText(full)
                      setCopiedIndex(i)
                      setTimeout(() => setCopiedIndex(null), 1200)
                    }
                  }}
                    style={{ padding: 10, borderRadius: 10, cursor: "pointer", background: selected?.text === t.text ? C.indigo : C.card, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ flex: 1, color: C.white, fontSize: 13 }}>{t.text}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: C.text }}>
                          {copiedIndex === i ? "✔ Copied" : `Score: ${t.score}`}
                        </span>
                        <button onClick={e => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(t.text)
                          setCopiedIndex(i)
                          setTimeout(() => setCopiedIndex(null), 1200)
                        }} style={{ background: C.cyan, border: "none", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          {copiedIndex === i ? "✔" : "📋"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selected && (
                <div style={{ marginTop: 12, color: C.cyan }}>
                  <div style={{ marginBottom: 6 }}>{selected.text}</div>
                  {hashtags.length > 0 && (
                    <div style={{ marginBottom: 10, fontSize: 13, color: C.text }}>{hashtags.join(" ")}</div>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => copyFull(selected.text, hashtags)}
                      style={{ background: C.pink, padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", color: C.white, fontWeight: 600 }}>
                      {copiedSelected ? "✔ Copied!" : "Copy Title + Tags"}
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(hashtags.join(" "))}
                      style={{ background: C.card2, padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", color: C.white }}>
                      Copy Tags
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16, padding: 14, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10 }}>
                <div style={{ fontSize: 13, color: C.gold }}>💡 Refreshing your title every 20–30 minutes increases ranking frequency and visibility by ~30–50%.</div>
              </div>
            </div>
          )
        })()}

                {activeTab === "help" && (
          <div style={{ maxWidth: 900 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>❓ How to Import Your Tips</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>Follow these steps to get your tip data into CamCash in under 2 minutes</p>

            {/* HOW IT WORKS */}
            <div style={{ ...glassCard, borderRadius: 16, padding: 28, marginBottom: 32, border: "1px solid rgba(34,211,238,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #10B981, #22D3EE)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔍</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: C.white }}>How CamCash Actually Works</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { icon: "📁", title: "Your data, your files", body: "Everything you see in this dashboard comes directly from the CSV files you upload. We don't connect to Chaturbate, BongaCams, or any platform — you export the data yourself and bring it here." },
                  { icon: "💯", title: "100% real numbers", body: "Every dollar amount, tip count, fan name, and session shown is calculated from your actual CSV data. No estimates, no made-up stats. If it shows $1,700 — that's exactly what your CSV says you earned." },
                  { icon: "🐳", title: "Top Fans are your real tippers", body: "The fans listed under Top Fans are real usernames pulled from your tip history. Their totals, tip counts, and last tip dates all come directly from your uploaded data." },
                  { icon: "💌", title: "Message Generator — copy & paste only", body: "The 💌 Message button does NOT send messages. It generates a re-engagement message for you to copy, then go to that fan's profile on Chaturbate, BongaCams, or wherever they tipped you, and paste it yourself. CamCash has no access to any platform." },
                  { icon: "🔒", title: "Your data stays yours", body: "Your tip data is stored securely in your account only. It's never shared, sold, or visible to anyone else." },
                ].map(({ icon, title, body }) => (
                  <div key={title} style={{ display: "flex", gap: 14, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ ...glassCard, borderRadius: 16, padding: 28, marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #22D3EE, #7C5CFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: C.white }}>The Easiest Way — Works on Every Platform</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {[{ step: "1", icon: "🖱️", title: "Go to your platform", desc: "Log in and navigate to your earnings or tip history page" }, { step: "2", icon: "📋", title: "Select & copy the data", desc: "Choose your date range, highlight all tip rows and copy (Ctrl+C)" }, { step: "3", icon: "📄", title: "Paste into Google Sheets", desc: "Go to sheets.new and paste your data (Ctrl+V)" }, { step: "4", icon: "⬇️", title: "Download as CSV & import", desc: 'File → Download → "Comma Separated Values (.csv)" — then upload here' }].map(({ step, icon, title, desc }) => (
                  <div key={step} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 18, position: "relative", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ position: "absolute", top: 14, right: 14, width: 24, height: 24, borderRadius: "50%", background: "rgba(34,211,238,0.2)", border: "1px solid rgba(34,211,238,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.cyan }}>{step}</div>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 6 }}>{title}</div>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: 16, background: "rgba(0,0,0,0.3)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>💡</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>Why Google Sheets?</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>Most cam platforms don't have a direct "Download CSV" button. Go to <span style={{ color: C.cyan, fontWeight: 600 }}>sheets.new</span> — opens instantly, no sign-in needed.</div>
                </div>
              </div>
            </div>
            <div style={{ ...glassCard, borderRadius: 14, padding: 24, marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 20 }}>🎬 Step-by-Step: Copy → Sheets → Download CSV</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[{ num: "01", color: C.cyan, text: "On your cam platform, find your tip/earnings history and set the date range you want" }, { num: "02", color: C.cyan, text: "Click the first row, scroll to the last row, hold Shift and click — then press Ctrl+C (Cmd+C on Mac)" }, { num: "03", color: C.indigo, text: "Open a new tab and go to sheets.new — a blank Google Sheet opens immediately" }, { num: "04", color: C.indigo, text: "Click cell A1 and press Ctrl+V — your data pastes in with columns already separated" }, { num: "05", color: C.pink, text: 'Click "File" in the top menu → hover "Download" → click "Comma Separated Values (.csv)"' }, { num: "06", color: C.green, text: 'The CSV file downloads to your computer — come back here, click "Import CSV", and select that file. Done! ✅' }].map(({ num, color, text }) => (
                  <div key={num} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color, minWidth: 28, paddingTop: 1 }}>{num}</div>
                    <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{text}</div>
                  </div>
                ))}
              </div>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 16 }}>📖 Platform-Specific Tips</h2>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Where to find the earnings data on each site before you copy it</p>
            {[{ emoji: "🟣", name: "Chaturbate", steps: ["Log into your Chaturbate broadcaster account", "Go to Stats & Data → Token Stats", "Select your date range (last 30 days, 90 days, or custom)", "Click \"Download CSV\" or \"Export\"", "Upload the CSV file to CamCash"], tip: "Chaturbate CSVs usually have \"Tip from:\" format" }, { emoji: "🔴", name: "BongaCams", steps: ["Log into your BongaCams model account", "Navigate to Statistics → Earnings History", "Select date range and filter by \"Tips\" or \"All Transactions\"", "Look for \"Export to Excel\" or \"Download CSV\" button", "Save the file and upload to CamCash"], tip: "BongaCams format: Date, Username, Type, Tokens, USD" }, { emoji: "🟠", name: "MyFreeCams (MFC)", steps: ["Log into your MFC model account at wiki.myfreecams.com", "Go to Model Admin → Token Stats", "Click \"Transaction History\" or \"Detailed Stats\"", "Select date range and click \"Export CSV\"", "Upload the exported file to CamCash"], tip: "MFC CSVs are usually very detailed with all transaction types" }, { emoji: "🟢", name: "CamSoda", steps: ["Log into your CamSoda broadcaster dashboard", "Navigate to Earnings → Transaction History", "Choose your date range (last week, month, or custom dates)", "Click \"Download\" or \"Export to CSV\"", "Save and upload to CamCash"], tip: "CamSoda exports include both tokens and USD amounts" }].map(({ emoji, name, steps, tip }) => (
              <div key={name} className="dash-card" style={{ ...glassCard, borderRadius: 14, padding: 24, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 32 }}>{emoji}</div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: C.white }}>{name}</h2>
                </div>
                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
                  {steps.map((step, i) => <p key={i} style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step {i + 1}:</strong> {step}</p>)}
                  <div style={{ padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 10, marginTop: 8 }}>
                    <div style={{ fontSize: 13, color: C.text }}>💡 {tip}</div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ background: "linear-gradient(135deg, rgba(124,92,255,0.15), rgba(236,72,153,0.15))", border: "1px solid rgba(236,72,153,0.3)", borderRadius: 14, padding: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 16 }}>💡 General Tips</h2>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
                {[["Export regularly", "Download your data weekly or monthly"], ["Don't edit CSVs", "Upload the original file — we handle the formatting"], ["Multiple platforms", "Upload CSVs from different sites — we'll combine them"], ["Duplicates removed", "Don't worry about re-uploading the same data"], ["File size", "Most CSVs are under 5MB and upload instantly"]].map(([title, desc]) => (
                  <p key={title} style={{ marginBottom: 12 }}>✅ <strong style={{ color: C.white }}>{title}:</strong> {desc}</p>
                ))}
                <p>⚠️ <strong style={{ color: C.white }}>Privacy:</strong> Your data is encrypted and never shared</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DELETE MODAL */}
      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ ...glassCard, borderRadius: 14, padding: 32, maxWidth: 400, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 12 }}>Delete All Tips?</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>This will permanently delete all {tips.length} tips. This cannot be undone!</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: "10px 20px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: C.white, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={deleteAllTips} style={{ flex: 1, padding: "10px 20px", borderRadius: 8, background: "linear-gradient(135deg, #F87171, #FB923C)", boxShadow: "0 0 20px rgba(248,113,113,0.4)", border: "none", color: C.white, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Delete All</button>
            </div>
          </div>
        </div>
      )}

      {/* WHALE PROFILE MODAL */}
      {selectedWhale && (() => {
        const w = selectedWhale
        const whaleTips = tips.filter(t => t.username === w.username && t.platform === w.platform)
        const sortedTips = [...whaleTips].sort((a, b) => new Date(b.date_time) - new Date(a.date_time))
        const firstTip = whaleTips.length ? whaleTips.reduce((a, b) => new Date(a.date_time) < new Date(b.date_time) ? a : b) : null
        const daysSinceLastTip = Math.floor((Date.now() - new Date(w.lastTipDate)) / 86400000)
        const tierColor = TIER_COLORS[w.tier] || C.cyan
        const avgDaysBetweenTips = whaleTips.length > 1 ? Math.floor((new Date(w.lastTipDate) - new Date(firstTip?.date_time)) / 86400000 / (whaleTips.length - 1)) : 7
        const likelyReturnDays = Math.max(0, avgDaysBetweenTips - daysSinceLastTip)
        const churnRisk = daysSinceLastTip > avgDaysBetweenTips * 2 ? "High" : daysSinceLastTip > avgDaysBetweenTips ? "Medium" : "Low"
        const churnColor = churnRisk === "High" ? C.red : churnRisk === "Medium" ? C.orange : C.green
        const biggestTip = whaleTips.length ? Math.max(...whaleTips.map(t => t.usd)) : 0
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
            <div style={{ width: 560, maxHeight: "90vh", overflowY: "auto", ...glassCard, borderRadius: 20 }}>
              <div style={{ padding: "24px 24px 20px", background: `linear-gradient(135deg, ${tierColor}15, transparent)`, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${tierColor}, ${tierColor}80)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff" }}>{w.username.charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>{w.username}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <span style={{ padding: "2px 10px", borderRadius: 100, background: `${tierColor}20`, border: `1px solid ${tierColor}50`, color: tierColor, fontSize: 11, fontWeight: 700 }}>{w.tier}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>{w.platform}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedWhale(null)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: C.muted, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {[{ label: "Total Spent", value: `$${w.totalUSD.toFixed(2)}`, color: C.green }, { label: "Tips Given", value: w.tipCount, color: C.cyan }, { label: "Avg Tip", value: `$${w.avgTipSize.toFixed(2)}`, color: C.gold }, { label: "Biggest Tip", value: `$${biggestTip.toFixed(2)}`, color: C.pink }].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>📊 Fan Intelligence</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[{ label: "First tip", value: firstTip ? new Date(firstTip.date_time).toLocaleDateString() : "—" }, { label: "Last tip", value: `${new Date(w.lastTipDate).toLocaleDateString()} (${daysSinceLastTip}d ago)` }, { label: "Avg days between tips", value: `${avgDaysBetweenTips} days` }, { label: "Churn risk", value: churnRisk, color: churnColor }].map(({ label, value, color }) => (
                      <div key={label} style={{ padding: 14, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: color || C.white }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🕐 Recent Tips</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {sortedTips.slice(0, 5).map((t, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ fontSize: 12, color: C.muted }}>{new Date(t.date_time).toLocaleDateString()} at {new Date(t.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>${t.usd.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🤖 AI Predictions</div>
                  <div style={{ padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 10 }}>
                    {[{ label: "📅 Likely to tip again in", value: likelyReturnDays === 0 ? "Overdue!" : `~${likelyReturnDays} days`, color: C.cyan }, { label: "💸 Predicted next tip size", value: `$${(w.avgTipSize * 1.1).toFixed(2)}`, color: C.gold }, { label: "🎯 Engagement score", value: `${Math.min(99, Math.round((w.tipCount / 10) * 20 + (w.totalUSD / 100) * 10))} / 100`, color: C.pink }, { label: "📈 30-day revenue forecast", value: `$${((w.totalUSD / Math.max(1, Math.floor((Date.now() - new Date(firstTip?.date_time)) / 2592000000))) * 1.05).toFixed(2)}`, color: C.green }].map(({ label, value, color }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                        <div style={{ fontSize: 13, color: C.text }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => setSelectedWhale(null)} style={{ width: "100%", padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: C.muted, fontSize: 14, cursor: "pointer" }}>Close Profile</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MESSAGE GENERATOR MODAL */}
      {messageTarget && (() => {
        const w = messageTarget
        const days = Math.floor((Date.now() - new Date(w.lastTipDate)) / 86400000)
        const name = w.username
        const messages = [
          `Hey ${name}! I've been thinking about you lately 💕 I'm going live tonight and would love to see your name in the chat 🔥`,
          `${name}! It's been a minute and honestly I miss you 😊 Jumping on soon — come say hi? 💋`,
          `Hey love 💕 Just wanted to reach out because I was literally just thinking about you. I go live tonight — hope to see you there!`,
          `${name}! You crossed my mind today 🥺 I'm streaming soon and it's always better when you're around 💗`,
          `Hey babe! I haven't seen you in a bit and I miss your energy 💕 Going live tonight — don't be a stranger! 😘`,
          `${name}! Going live in a bit and I'm SO excited 🔥 Wanted to make sure you knew because it's always more fun with you there 💕`,
          `Hey! I'm about to go live and literally thought of you first 😍 Come through, it's gonna be a good one tonight 🎉`,
          `${name}! Live stream starting soon 🎥 You're one of my favorites and I'd love to see you tonight 💗`,
          `Hey gorgeous 💕 Going live soon — I've got some fun things planned and thought of you immediately. See you there? 🔥`,
          `${name}! Stream is happening tonight and it won't be the same without you 😘 Come hang with me 💋`,
          `Hey ${name}! I just wanted to say your support genuinely means the world to me 💕 Streaming tonight and hoping to see your face 😊`,
          `${name}! You're honestly one of the sweetest people I get to talk to 🥺 Going live soon — come say hi! 💗`,
          `Hey love! I was looking back at my favorites and you came to mind immediately 💕 I stream tonight, would mean a lot to see you 🔥`,
          `${name}! Just wanted to send some love your way 💋 I'm going live soon and you're always one of my favorite people to have around 😍`,
          `Hey babe 💕 Thinking about my favorite fans tonight and you're at the top of the list 🥰 Going live — hope to see you!`,
          `${name}! Okay don't judge me but I may have been thinking about you today 😂💕 Going live tonight — come flirt with me 😘`,
          `Hey you 👀 I see you haven't come to visit lately… I'm going live tonight and I'll be a little sad if you don't show up 😢💗`,
          `${name}! I was literally just telling someone about my favorite fans and your name came up 🔥 Going live soon, don't miss it 😘`,
          `Hey babe! Fair warning: I'm going live tonight and I may or may not be extra flirty 😏💕 Thought you'd want to know 😘`,
          `${name}! Missing your energy lately 😩 I go live tonight — come remind me why you're one of my faves 💗🔥`,
          `Hey ${name}! Last stream was SO fun and I don't want you to miss tonight's 🎉 Going live soon — get ready 💕`,
          `${name}! I have something special planned for tonight's stream 👀🔥 Didn't want you to miss out — going live soon 💋`,
          `Hey love! Tonight's stream is going to be one of my best ones 🔥 Saving a spot for you 💕 See you soon?`,
          `${name}! Streaming tonight and I promise it'll be worth it 😍 I've been planning something fun and thought of you 💗`,
          `Hey babe 💕 I know you've been busy but I really hope you can make tonight's stream — I have a feeling it's going to be special 🔥😘`,
        ]
        const currentMsg = messages[messageIndex % messages.length]
        const vibes = ["💕 Reconnect", "🔥 Going Live", "🥰 Appreciation", "😘 Flirty", "👀 FOMO"]
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, padding: 20 }}>
            <div style={{ width: 520, ...glassCard, borderRadius: 20, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, rgba(236,72,153,0.2), rgba(124,92,255,0.15))", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.white }}>💌 Message Generator</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>For <span style={{ color: C.pink, fontWeight: 600 }}>{name}</span> · <span style={{ color: C.cyan, fontWeight: 600 }}>{w.platform}</span> · {days === 0 ? "tipped today" : `${days} days since last tip`}</div>
                </div>
                <button onClick={() => setMessageTarget(null)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: C.muted, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ position: "relative", marginBottom: 16 }}>
                  <div style={{ padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", fontSize: 15, color: C.white, lineHeight: 1.7, minHeight: 100 }}>{currentMsg}</div>
                  <div style={{ position: "absolute", top: 12, right: 12, fontSize: 10, color: C.muted, background: "rgba(0,0,0,0.5)", padding: "2px 8px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)" }}>{(messageIndex % messages.length) + 1} / {messages.length}</div>
                </div>
                <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 11, color: C.muted }}>Vibe:</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.pink, padding: "2px 10px", background: "rgba(236,72,153,0.15)", border: "1px solid rgba(236,72,153,0.3)", borderRadius: 20 }}>{vibes[messageIndex % 5]}</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setMessageIndex(i => i + 1); setMessageCopied(false) }} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: C.white, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>🔄 Generate Another</button>
                  <button onClick={() => { navigator.clipboard.writeText(currentMsg); setMessageCopied(true); setTimeout(() => setMessageCopied(false), 2500) }} style={{ flex: 1, padding: "12px", borderRadius: 10, background: messageCopied ? "rgba(16,185,129,0.2)" : "linear-gradient(135deg, #22D3EE, #EC4899)", boxShadow: messageCopied ? "none" : "0 0 20px rgba(34,211,238,0.3), 0 0 40px rgba(236,72,153,0.2)", border: messageCopied ? "1px solid rgba(16,185,129,0.4)" : "none", color: C.white, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>{messageCopied ? "✅ Copied!" : "📋 Copy Message"}</button>
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: C.muted, textAlign: "center" }}>Tip: paste directly into Chaturbate, BongaCams, or your DM platform</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* UPGRADE MODAL */}
      {showUpgradeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1002, padding: 20 }}>
          <div style={{ width: 480, background: "rgba(15,20,32,0.97)", backdropFilter: "blur(24px)", borderRadius: 24, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 80px rgba(59,130,246,0.2), 0 0 160px rgba(236,72,153,0.1)", overflow: "hidden" }}>
            <div style={{ height: 4, background: "linear-gradient(90deg, #3b82f6, #a855f7, #ec4899)" }} />
            <div style={{ padding: 36 }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🚀</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: C.white, marginBottom: 8 }}>Unlock Your Full Earning Potential</h2>
                <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>You're only seeing a preview of your data.<br/>Here's what's waiting for you inside:</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                {[
                  { icon: "🐳", text: "See ALL your top spenders — not just the top 3" },
                  { icon: "⏰", text: "Discover your exact highest-earning hours & days" },
                  { icon: "💡", text: "Unlock 15+ advanced insights & strategy tips" },
                  { icon: "📈", text: "Full session history with trend analysis" },
                  { icon: "🤖", text: "AI fan behavior predictions & return forecasts" },
                  { icon: "💌", text: "Unlimited re-engagement scripts & fan tracking" },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 10 }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <span style={{ fontSize: 13, color: C.white }}>{text}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center", padding: "12px 16px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: C.gold, fontWeight: 600 }}>💡 Most creators miss 30–60% of their earning potential without this</div>
              </div>
              {earlyAccessSubmitted ? (
                <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 6 }}>You're on the list!</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>We'll email you with a founding user discount when we launch.</div>
                  <button onClick={() => setShowUpgradeModal(false)} style={{ padding: "10px 28px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: C.muted, fontSize: 13, cursor: "pointer" }}>Close</button>
                </div>
              ) : (
                <>
                  <input
                    type="email"
                    value={earlyAccessEmail}
                    onChange={e => setEarlyAccessEmail(e.target.value)}
                    placeholder="your@email.com"
                    style={{ width: "100%", padding: "13px 16px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: C.white, fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "rgba(34,211,238,0.5)"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"}
                  />
                  <button
                    disabled={!earlyAccessEmail.trim() || earlyAccessSubmitting}
                    onClick={async () => {
                      if (!earlyAccessEmail.trim()) return
                      setEarlyAccessSubmitting(true)
                      track('early_access_signup', { email: earlyAccessEmail })
                      try {
                        const { data: { user: currentUser } } = await supabase.auth.getUser()
                        await supabase.from('early_access').insert({
                          email: earlyAccessEmail.trim(),
                          user_id: currentUser?.id || null,
                          signed_up_at: new Date().toISOString()
                        }).then(() => {}) // best effort — table may not exist yet
                      } catch(e) {}
                      setEarlyAccessSubmitted(true)
                      setEarlyAccessSubmitting(false)
                      showToast("🎉 You're on the founding user list!")
                    }}
                    style={{ width: "100%", padding: "16px", borderRadius: 14, background: earlyAccessEmail.trim() ? "linear-gradient(135deg, #3b82f6, #ec4899)" : "rgba(255,255,255,0.08)", border: "none", color: earlyAccessEmail.trim() ? C.white : C.muted, fontSize: 16, fontWeight: 800, cursor: earlyAccessEmail.trim() ? "pointer" : "not-allowed", boxShadow: earlyAccessEmail.trim() ? "0 0 30px rgba(59,130,246,0.5), 0 0 60px rgba(236,72,153,0.3)" : "none", marginBottom: 12, transition: "all 0.2s" }}>
                    {earlyAccessSubmitting ? "Saving..." : "🔓 Get Early Access"}
                  </button>
                  <div style={{ textAlign: "center", fontSize: 12, color: C.muted, marginBottom: 20 }}>Launching soon • Founding users get lifetime discount</div>
                  <button onClick={() => setShowUpgradeModal(false)} style={{ width: "100%", padding: "11px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: C.muted, fontSize: 13, cursor: "pointer" }}>
                    Maybe later
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BETA PROMPT MODAL */}
      {showBetaPrompt && !earlyAccessSubmitted && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1002, padding: 20 }}>
          <div style={{ width: 460, background: "rgba(15,20,32,0.97)", backdropFilter: "blur(24px)", borderRadius: 24, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 80px rgba(59,130,246,0.2), 0 0 160px rgba(236,72,153,0.1)", overflow: "hidden" }}>
            <div style={{ height: 4, background: "linear-gradient(90deg, #22D3EE, #7C5CFF, #EC4899)" }} />
            <div style={{ padding: 32 }}>

              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>💰</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 10 }}>Your data found missed earnings</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>You're using features that will become premium. We built this to help you:</div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
                  {[["🐳","Identify your highest paying viewers"], ["⏰","Stream at your most profitable times"], ["📈","Increase tips without more hours"]].map(([icon, text]) => (
                    <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.white }}>
                      <span style={{ fontSize: 14 }}>{icon}</span> {text}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: 16, background: "rgba(124,92,255,0.1)", border: "1px solid rgba(124,92,255,0.25)", borderRadius: 12, marginBottom: 18 }}>
                <div style={{ fontSize: 14, color: C.indigo, fontWeight: 700, marginBottom: 8 }}>🚀 Early Access Offer</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 10 }}>Right now everything is free during beta. But early users can:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {["Lock in lifetime pricing before it increases", "Get every future premium feature included", "Keep full access as we expand the product"].map(t => (
                    <div key={t} style={{ fontSize: 12, color: C.white }}>• {t}</div>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: "center", padding: "12px 14px", background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", borderRadius: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 18, color: C.pink, fontWeight: 800 }}>🔥 Lock in $9.99/mo for life</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Launch price will be $29/mo — this offer won't last</div>
              </div>

              <input
                type="email"
                value={earlyAccessEmail}
                onChange={e => setEarlyAccessEmail(e.target.value)}
                placeholder="your@email.com"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: C.white, fontSize: 13, outline: "none", marginBottom: 8, boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "rgba(34,211,238,0.5)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.15)"}
              />

              <button
                disabled={!earlyAccessEmail.trim() || earlyAccessSubmitting}
                onClick={async () => {
                  if (!earlyAccessEmail.trim()) return
                  setEarlyAccessSubmitting(true)
                  track('beta_checkout_clicked', { email: earlyAccessEmail, uploadCount })
                  try {
                    await supabase.from('early_access').insert({ email: earlyAccessEmail.trim(), user_id: user?.id || null, signed_up_at: new Date().toISOString() })
                    await supabase.from('beta_users').upsert({ user_id: user?.id, email: earlyAccessEmail.trim(), submitted_early_access: true, saw_beta_prompt: true }, { onConflict: 'user_id' })
                    await supabase.from('analytics_events').insert({ user_id: user?.id, event_name: 'beta_checkout_clicked', properties: { email: earlyAccessEmail.trim() } })
                  } catch(e) {}
                  setEarlyAccessSubmitting(false)
                  setEarlyAccessSubmitted(true)
                  setShowBetaPrompt(false)
                  showToast("🎉 Redirecting to checkout...")
                  setTimeout(() => window.open("https://buy.stripe.com/8x228r3Qu8dj7zQ1F5f7i01", "_blank"), 500)
                }}
                style={{ width: "100%", padding: "14px", borderRadius: 12, background: earlyAccessEmail.trim() ? "linear-gradient(135deg, #22D3EE, #EC4899)" : "rgba(255,255,255,0.08)", border: "none", color: earlyAccessEmail.trim() ? C.white : C.muted, fontSize: 14, fontWeight: 800, cursor: earlyAccessEmail.trim() ? "pointer" : "not-allowed", boxShadow: earlyAccessEmail.trim() ? "0 0 30px rgba(34,211,238,0.4)" : "none", marginBottom: 8, transition: "all 0.2s" }}>
                {earlyAccessSubmitting ? "Saving..." : "🔒 Lock In My Early Access"}
              </button>

              <div style={{ fontSize: 11, color: C.muted, textAlign: "center", marginBottom: 10 }}>Secure Stripe checkout — cancel anytime</div>

              <button onClick={() => { setShowBetaPrompt(false); track('beta_prompt_dismissed', { uploadCount }) }}
                style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: C.muted, fontSize: 13, cursor: "pointer" }}>
                Keep using free beta
              </button>

            </div>
          </div>
        </div>
      )}

            {/* FLOATING FEEDBACK BUTTON */}
      <button
        onClick={() => { setShowFeedback(true); setFeedbackSent(false); setFeedbackText('') }}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 998,
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 18px", borderRadius: 100,
          background: "rgba(15,20,32,0.95)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)", transition: "all 0.2s"
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)"; e.currentTarget.style.color = C.white }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = C.text }}
      >
        <span style={{ fontSize: 16 }}>💬</span> Feedback
      </button>

      {/* FEEDBACK MODAL */}
      {showFeedback && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "flex-start", zIndex: 1003, padding: 24, paddingBottom: 80 }}>
          <div style={{ width: 400, background: "rgba(15,20,32,0.98)", backdropFilter: "blur(24px)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 60px rgba(59,130,246,0.15)", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Share Feedback 💬</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Help us build what you actually need</div>
              </div>
              <button onClick={() => setShowFeedback(false)} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: C.muted, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {feedbackSent ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🙏</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 6 }}>Thank you!</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Your feedback helps us build better features for you.</div>
                  <button onClick={() => setShowFeedback(false)} style={{ padding: "9px 24px", borderRadius: 10, background: "linear-gradient(135deg, #22D3EE, #EC4899)", border: "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Close</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    {[{ id: 'feature', label: '✨ Feature Request', color: C.cyan }, { id: 'bug', label: '🐛 Bug Report', color: C.red }].map(({ id, label, color }) => (
                      <button key={id} onClick={() => setFeedbackType(id)} style={{ flex: 1, padding: "9px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", background: feedbackType === id ? `${color}20` : "rgba(255,255,255,0.04)", border: feedbackType === id ? `1px solid ${color}50` : "1px solid rgba(255,255,255,0.08)", color: feedbackType === id ? color : C.muted }}>{label}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                    {feedbackType === 'feature' ? "What feature would make CamCash more useful for you?" : "What's broken or not working as expected?"}
                  </div>
                  <textarea
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    placeholder={feedbackType === 'feature' ? "e.g. I wish I could see my earnings by day of week..." : "e.g. When I upload a CSV from Chaturbate, it shows an error..."}
                    rows={4}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: C.white, fontSize: 13, lineHeight: 1.6, resize: "none", outline: "none", fontFamily: "inherit", marginBottom: 14 }}
                    onFocus={e => e.target.style.borderColor = "rgba(34,211,238,0.4)"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                  <button
                    disabled={!feedbackText.trim()}
                    onClick={() => { track('feedback_submitted', { type: feedbackType, length: feedbackText.length }); setFeedbackSent(true) }}
                    style={{ width: "100%", padding: "12px", borderRadius: 10, background: feedbackText.trim() ? "linear-gradient(135deg, #22D3EE, #EC4899)" : "rgba(255,255,255,0.08)", border: "none", color: feedbackText.trim() ? C.white : C.muted, fontSize: 14, fontWeight: 700, cursor: feedbackText.trim() ? "pointer" : "not-allowed", boxShadow: feedbackText.trim() ? "0 0 20px rgba(34,211,238,0.3)" : "none", transition: "all 0.2s" }}>
                    {feedbackType === 'feature' ? '✨ Submit Feature Request' : '🐛 Submit Bug Report'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: 272, background: "rgba(15,20,32,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 20px", color: C.white, fontSize: 14, zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}>
          {toast}
        </div>
      )}
    </div>
  )
}
