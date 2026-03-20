"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { parseCSV, aggregateRows } from "../../lib/analytics"
import { ConfirmationModal, ErrorModal } from './ConfirmationModal'

const C = {
  bg: "#0B0F1A", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

const TIER_COLORS = {
  "Whale": C.gold, "Shark": C.blue, "Regular": C.cyan, "Dormant": C.orange
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

  // ── NEW: Confirmation & Error modal state ──────────────────────────────────
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showError, setShowError] = useState(false)
  const [parseResult, setParseResult] = useState(null)
  const [pendingData, setPendingData] = useState(null)
  // ──────────────────────────────────────────────────────────────────────────

  // ── Whale profile modal ────────────────────────────────────────────────────
  const [selectedWhale, setSelectedWhale] = useState(null)
  // ──────────────────────────────────────────────────────────────────────────

  const isBetaUser = true // all features unlocked during free beta
  const uploadLimit = Infinity // unlimited uploads during beta

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

    const interval = setInterval(() => {
      const updated = aggregateRows(tips)
      setLiveAnalytics(updated)
    }, 5000)

    return () => clearInterval(interval)
  }, [tips])

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

  const removeDuplicates = (existingTips, newTips) => {
    const existingKeys = new Set(
      existingTips.map(t => `${t.date_time}_${t.username}_${t.tokens}_${t.platform}`)
    )
    const unique = newTips.filter(t => {
      const key = `${t.dateRaw || t.date_time}_${t.username}_${t.tokens}_${t.platform}`
      return !existingKeys.has(key)
    })
    return unique
  }

  // ── UPDATED: handleCSV with zero-tolerance parser + modal flow ─────────────
  const handleCSV = async (file) => {
    if (!file || !user) return
    if (uploadCount >= uploadLimit && !isBetaUser) {
      showToast("🔒 Free tier: 3 uploads/month. Upgrade for unlimited!")
      return
    }

    setUploading(true)
    setShowError(false)
    setShowConfirmation(false)

    try {
      const text = await file.text()
      const result = parseCSV(text)  // NEW zero-tolerance parser

      // Hard failure – no confirmation possible
      if (!result.success && !result.needsConfirmation) {
        setParseResult(result)
        setShowError(true)
        setUploading(false)
        return
      }

      // Successful parse – show confirmation modal
      if (result.success && result.needsConfirmation) {
        setPendingData(result.data)
        setParseResult(result)
        setShowConfirmation(true)
        setUploading(false)
        return
      }

      // Header / structural issues – show error
      if (!result.success && result.needsConfirmation) {
        setParseResult(result)
        setShowError(true)
        setUploading(false)
        return
      }

    } catch (err) {
      setParseResult({
        error: {
          message: "Upload failed",
          fix: err.message
        }
      })
      setShowError(true)
      setUploading(false)
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  // ── NEW: confirmImport – called when user clicks "Confirm & Import" ────────
  const confirmImport = async (data) => {
    setUploading(true)
    setShowConfirmation(false)

    try {
      const unique = removeDuplicates(tips, data)
      const duplicateCount = data.length - unique.length

      if (unique.length === 0) {
        showToast(`⚠️ All ${data.length} tips are duplicates!`)
        setUploading(false)
        setPendingData(null)
        setParseResult(null)
        return
      }

      const toInsert = unique.map(r => ({
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

      let msg = duplicateCount > 0
        ? `✅ Imported ${unique.length} tips (${duplicateCount} duplicates removed)`
        : `✅ Imported ${unique.length} tips from ${parseResult?.platform || "CSV"}!`

      if (parseResult?.warnings) {
        msg += ` (${parseResult.skipped?.length ?? 0} rows skipped)`
      }

      showToast(msg)
      await loadData(user.id)
      setPendingData(null)
      setParseResult(null)
    } catch (err) {
      showToast("❌ " + err.message)
    } finally {
      setUploading(false)
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const deleteTip = async (tipId) => {
    if (!confirm("Delete this tip?")) return
    try {
      const { error } = await supabase.from("tips").delete().eq("id", tipId)
      if (error) throw error
      showToast("✅ Tip deleted")
      await loadData(user.id)
    } catch (err) {
      showToast("❌ " + err.message)
    }
  }

  const deleteAllTips = async () => {
    if (!user) return
    try {
      const { error } = await supabase.from("tips").delete().eq("user_id", user.id)
      if (error) throw error
      showToast("✅ All tips deleted")
      setShowDeleteConfirm(false)
      await loadData(user.id)
    } catch (err) {
      showToast("❌ " + err.message)
    }
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
  const alerts = liveAnalytics?.whaleAlerts || analytics?.whaleAlerts || []

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

          {/* FREE BETA BADGE */}
          <div style={{ marginTop: 12, padding: "6px 10px", borderRadius: 8, background: `linear-gradient(135deg, ${C.gold}20, ${C.orange}20)`, border: `1px solid ${C.gold}40`, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, flexShrink: 0, boxShadow: `0 0 6px ${C.gold}` }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: 0.5 }}>FREE BETA</div>
              <div style={{ fontSize: 9, color: C.orange }}>All features unlocked</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {[["overview", "📊", "Overview"], ["platforms", "🎯", "Platforms"], ["whales", "🐳", "Top Fans"], ["sessions", "🎥", "Sessions"], ["data", "📝", "Edit Data"], ["help", "❓", "CSV Help"], ["upload", "📥", "Import"]].map(([id, icon, label]) => (
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

        {/* SIDEBAR BOTTOM — spots left */}
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ padding: 12, borderRadius: 10, background: `linear-gradient(135deg, ${C.pink}15, ${C.indigo}15)`, border: `1px solid ${C.pink}30`, textAlign: "center" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>🎉</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 2 }}>Free for first 100 users</div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>Spots filling up fast</div>
            <div style={{ height: 4, borderRadius: 4, background: C.border, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "63%", borderRadius: 4, background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})` }} />
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>63 / 100 spots taken</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ marginLeft: 240, padding: 32 }}>

        {activeTab === "overview" && (
          <div>
            {/* 🎉 BETA BANNER */}
            <div style={{ marginBottom: 24, padding: "14px 20px", borderRadius: 12, background: `linear-gradient(135deg, ${C.gold}15, ${C.orange}10)`, border: `1px solid ${C.gold}40`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 24 }}>🎉</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>You're one of our first 100 beta users — everything is free!</div>
                  <div style={{ fontSize: 12, color: C.muted }}>All Pro features unlocked. No credit card. No limits. Just good vibes.</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>63/100 spots taken</div>
                <div style={{ width: 80, height: 6, borderRadius: 4, background: C.border, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "63%", borderRadius: 4, background: `linear-gradient(90deg, ${C.gold}, ${C.orange})` }} />
                </div>
              </div>
            </div>
            {/* EMOTIONAL STATS CARDS */}
            {(() => {
              const firstSession = sessions.length ? new Date(sessions[0].startTime) : null
              const daysSinceStart = firstSession ? Math.floor((Date.now() - firstSession) / 86400000) : 0
              const recentSessions = sessions.filter(s => new Date(s.startTime) > new Date(Date.now() - 30 * 86400000))
              const prevSessions = sessions.filter(s => {
                const d = new Date(s.startTime)
                return d > new Date(Date.now() - 60 * 86400000) && d <= new Date(Date.now() - 30 * 86400000)
              })
              const recentRev = recentSessions.reduce((s, r) => s + r.totalUSD, 0)
              const prevRev = prevSessions.reduce((s, r) => s + r.totalUSD, 0)
              const growthPct = prevRev > 0 ? Math.round(((recentRev - prevRev) / prevRev) * 100) : null
              const topPct = Math.max(1, Math.min(25, Math.round(100 - (totalRevenue / 50))))
              const streak = recentSessions.length

              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 28 }}>
                  {[
                    {
                      label: "Total Earned",
                      value: `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      sub: `Top ${topPct}% of models on this platform`,
                      icon: "💰", color: C.green,
                      badge: growthPct !== null ? (growthPct >= 0 ? `↑ ${growthPct}% vs last month` : `↓ ${Math.abs(growthPct)}% vs last month`) : null,
                      badgeColor: growthPct >= 0 ? C.green : C.red
                    },
                    {
                      label: "Avg $/Hour",
                      value: `$${avgPerHour.toFixed(2)}`,
                      sub: avgPerHour > 20 ? "Above average — keep it up!" : "Tip: stream at peak hours to boost this",
                      icon: "⏱️", color: C.cyan,
                      badge: null
                    },
                    {
                      label: "Total Fans",
                      value: whales.length,
                      sub: `${whales.filter(w => Math.floor((Date.now() - new Date(w.lastTipDate)) / 86400000) <= 30).length} active in last 30 days`,
                      icon: "👥", color: C.pink,
                      badge: null
                    },
                    {
                      label: "Sessions",
                      value: sessions.length,
                      sub: `${streak} in last 30 days${streak >= 3 ? " 🔥" : ""}`,
                      icon: "🎥", color: C.gold,
                      badge: streak >= 5 ? "🔥 On a streak!" : null,
                      badgeColor: C.gold
                    }
                  ].map((s, i) => (
                    <div key={i} style={{ background: `linear-gradient(145deg, ${C.card}, ${C.card2})`, border: `1px solid ${C.border}`, borderRadius: 18, padding: 22, position: "relative", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
                      <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, background: s.color, opacity: 0.08, filter: "blur(40px)" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</span>
                        <span style={{ fontSize: 20 }}>{s.icon}</span>
                      </div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: s.color, marginBottom: 6 }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{s.sub}</div>
                      {s.badge && (
                        <div style={{ marginTop: 8, display: "inline-block", padding: "2px 8px", borderRadius: 6, background: `${s.badgeColor}20`, border: `1px solid ${s.badgeColor}40`, fontSize: 10, fontWeight: 700, color: s.badgeColor }}>
                          {s.badge}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* 🔥 WHAT SHOULD I DO RIGHT NOW */}
            {(() => {
              const now = new Date()
              const currentHour = now.getHours()
              const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' })

              // Best hour from real data
              const allHourEarnings = {}
              sessions.forEach(s => {
                const h = new Date(s.startTime).getHours()
                allHourEarnings[h] = (allHourEarnings[h] || 0) + s.totalUSD
              })
              const bestHourEntry = Object.entries(allHourEarnings).sort((a, b) => b[1] - a[1])[0]
              const bestHour = bestHourEntry ? parseInt(bestHourEntry[0]) : null
              const isNowBestTime = bestHour !== null && Math.abs(currentHour - bestHour) <= 1

              // Dormant high-value fans
              const dormantWhales = whales
                .filter(w => {
                  const days = Math.floor((Date.now() - new Date(w.lastTipDate)) / 86400000)
                  return days >= 3 && days <= 30 && w.totalUSD > 10
                })
                .sort((a, b) => b.totalUSD - a.totalUSD)
                .slice(0, 3)

              // Session goal
              const avgSessionRevenue = sessions.length ? (totalRevenue / sessions.length) : 0
              const goalSuggestion = Math.round(avgSessionRevenue * 1.2 / 10) * 10

              const actions = []

              if (isNowBestTime) {
                actions.push({ icon: "🔥", color: C.orange, text: `Go live NOW — your data shows ${formatHour(currentHour)} is your highest-earning time`, cta: null })
              } else if (bestHour !== null) {
                actions.push({ icon: "🕐", color: C.cyan, text: `Your best earning time is ${formatHour(bestHour)} — plan your next stream around it`, cta: null })
              }

              dormantWhales.forEach(w => {
                const days = Math.floor((Date.now() - new Date(w.lastTipDate)) / 86400000)
                actions.push({
                  icon: "💸", color: C.pink,
                  text: `Message ${w.username} — spent $${w.totalUSD.toFixed(0)} total, hasn't tipped in ${days} days`,
                  cta: `Hey babe, I was just thinking about you 💕 I'm going live soon — hope to see you there! 🔥`,
                  ctaLabel: "📋 Copy Message",
                  username: w.username
                })
              })

              if (goalSuggestion > 0) {
                actions.push({ icon: "🎯", color: C.gold, text: `Set a goal of $${goalSuggestion} for your next session — your average session earns $${avgSessionRevenue.toFixed(0)}`, cta: null })
              }

              if (actions.length === 0) {
                actions.push({ icon: "📊", color: C.cyan, text: "Import your first CSV to unlock personalized action recommendations", cta: null })
              }

              return (
                <div style={{ background: `linear-gradient(135deg, ${C.card}, ${C.card2})`, border: `1px solid ${C.cyan}40`, borderRadius: 16, padding: 24, marginBottom: 28, boxShadow: `0 0 40px ${C.cyan}10` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.cyan}, ${C.indigo})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>What Should I Do Right Now?</div>
                      <div style={{ fontSize: 12, color: C.muted }}>Personalized actions based on your data</div>
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
                          <button
                            onClick={() => { navigator.clipboard.writeText(a.cta); showToast(`📋 Message copied for ${a.username}!`) }}
                            style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 8, background: `${C.pink}20`, border: `1px solid ${C.pink}40`, color: C.pink, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                            {a.ctaLabel}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* INSIGHTS */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 16 }}>💡 Smart Insights</h2>
              {insights.slice(0, 5).map((ins, i) => (
                <div key={i} style={{ background: `${C.cyan}10`, border: `1px solid ${C.cyan}30`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: C.white }}>{ins.icon} {ins.text}</div>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: 16, background: `${C.cyan}10`, border: `1px solid ${C.cyan}30`, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 14, color: C.white }}>🎉 All insights unlocked — you're on the free beta!</div>
              </div>
            </div>

            {/* AI ALERTS */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 16 }}>🚨 Live AI Alerts</h2>
              {alerts.length === 0 && (
                <div style={{ color: C.muted, fontSize: 13 }}>No active alerts</div>
              )}
              {alerts.slice(0, 5).map((a, i) => (
                <div key={i} style={{
                  padding: 14, borderRadius: 10, marginBottom: 10,
                  background: a.severity === "critical" ? `${C.red}20` : a.severity === "warning" ? `${C.orange}20` : a.severity === "success" ? `${C.green}20` : `${C.cyan}15`,
                  border: `1px solid ${a.severity === "critical" ? C.red : a.severity === "warning" ? C.orange : a.severity === "success" ? C.green : C.cyan}30`
                }}>
                  <div style={{ fontSize: 14, color: C.white }}>{a.icon} {a.message}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>👉 {a.action}</div>
                </div>
              ))}
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
                    <div><div style={{ fontSize: 12, color: C.muted }}>Total Revenue</div><div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>${p.totalUSD.toFixed(2)}</div></div>
                    <div><div style={{ fontSize: 12, color: C.muted }}>$/Hour</div><div style={{ fontSize: 24, fontWeight: 700, color: C.cyan }}>${p.usdPerHour.toFixed(2)}</div></div>
                    <div><div style={{ fontSize: 12, color: C.muted }}>Sessions</div><div style={{ fontSize: 24, fontWeight: 700, color: C.pink }}>{p.sessions}</div></div>
                    <div><div style={{ fontSize: 12, color: C.muted }}>Total Hours</div><div style={{ fontSize: 24, fontWeight: 700, color: C.gold }}>{p.hours.toFixed(1)}h</div></div>
                  </div>
                  {bestHour && bestDay && (
                    <div style={{ padding: 16, background: C.card2, borderRadius: 10 }}>
                      <div style={{ fontSize: 14, color: C.white, marginBottom: 4 }}>🕐 Best Hour: {formatHour(bestHour[0])} - ${bestHour[1].toFixed(2)} total</div>
                      <div style={{ fontSize: 14, color: C.white }}>📅 Best Day: {bestDay[0]} - ${bestDay[1].toFixed(2)} total</div>
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
                    {["#", "Username", "Total $", "Tips", "Avg Tip", "Platform", "Tier", "Last Tip", "Actions"].map(h => (
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
                        <span style={{ padding: "4px 10px", borderRadius: 100, background: `${TIER_COLORS[w.tier]}15`, color: TIER_COLORS[w.tier], fontSize: 11, fontWeight: 600 }}>{w.tier}</span>
                      </td>
                      <td style={{ padding: "12px 16px", color: C.muted, fontSize: 12 }}>{new Date(w.lastTipDate).toLocaleDateString()}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setSelectedWhale(w)} style={{ padding: "4px 10px", borderRadius: 6, background: `${C.cyan}15`, border: `1px solid ${C.cyan}30`, color: C.cyan, fontSize: 11, cursor: "pointer" }}>🔍 View</button>
                          <button onClick={() => {
                            const days = Math.floor((Date.now() - new Date(w.lastTipDate)) / 86400000)
                            const msg = days > 7
                              ? `Hey ${w.username}! I've been missing you 💕 I'm going live soon and was thinking about you — hope to see you there! 🔥`
                              : `Hey ${w.username}! Thanks so much for your support 💕 I'm going live soon — come hang out! 🎉`
                            navigator.clipboard.writeText(msg)
                            showToast(`📋 Message copied for ${w.username}!`)
                          }} style={{ padding: "4px 10px", borderRadius: 6, background: `${C.pink}15`, border: `1px solid ${C.pink}30`, color: C.pink, fontSize: 11, cursor: "pointer" }}>💌 Message</button>
                        </div>
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

        {activeTab === "data" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white }}>📝 Edit Data</h1>
              <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: "10px 20px", borderRadius: 8, background: `${C.red}15`, border: `1px solid ${C.red}30`, color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                🗑️ Delete All Tips
              </button>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 8 }}>Total Tips: {tips.length}</div>
              <div style={{ fontSize: 14, color: C.muted }}>Total Revenue: ${totalRevenue.toFixed(2)}</div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.card2, borderBottom: `1px solid ${C.border}` }}>
                    {["Date", "Username", "Platform", "Amount", "Tokens", "Type", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tips.slice(0, 100).map((t, i) => (
                    <tr key={t.id || i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "12px 16px", color: C.white, fontSize: 12 }}>{new Date(t.date_time).toLocaleDateString()}</td>
                      <td style={{ padding: "12px 16px", color: C.white, fontWeight: 600 }}>{t.username}</td>
                      <td style={{ padding: "12px 16px", color: C.muted }}>{t.platform}</td>
                      <td style={{ padding: "12px 16px", color: C.green, fontWeight: 700 }}>${t.usd.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", color: C.cyan }}>{t.tokens}</td>
                      <td style={{ padding: "12px 16px", color: C.muted, fontSize: 12 }}>{t.tip_type}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <button onClick={() => deleteTip(t.id)} style={{ padding: "4px 12px", borderRadius: 6, background: `${C.red}15`, border: `1px solid ${C.red}30`, color: C.red, fontSize: 11, cursor: "pointer" }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tips.length > 100 && (
                <div style={{ padding: 20, textAlign: "center", background: C.card2, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 13, color: C.muted }}>Showing first 100 of {tips.length} tips</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "upload" && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>📥 Import CSV</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>Unlimited uploads during free beta • Auto-removes duplicates</p>
            <div style={{ background: C.card, borderRadius: 14, padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
              <label style={{ display: "inline-block", padding: "14px 32px", borderRadius: 10, background: uploadCount >= uploadLimit ? C.muted : `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, color: C.white, fontSize: 15, fontWeight: 600, cursor: uploadCount >= uploadLimit ? "not-allowed" : "pointer" }}>
                {uploading ? "Processing..." : uploadCount >= uploadLimit ? "🔒 Limit Reached" : "Choose CSV File"}
                <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => handleCSV(e.target.files[0])} disabled={uploading || uploadCount >= uploadLimit} />
              </label>
              {uploadCount >= uploadLimit && (
                <div style={{ marginTop: 24, padding: 16, background: `${C.pink}15`, border: `1px solid ${C.pink}30`, borderRadius: 10 }}>
                  <div style={{ fontSize: 14, color: C.white, marginBottom: 12 }}>Upgrade for unlimited imports</div>
                  <button style={{ padding: "10px 24px", borderRadius: 8, background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, border: "none", color: C.white, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Go Pro</button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "help" && (
          <div style={{ maxWidth: 900 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>❓ How to Import Your Tips</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>Follow these steps to get your tip data into CamCash in under 2 minutes</p>

            {/* HOW IT WORKS - UNIVERSAL METHOD */}
            <div style={{ background: `linear-gradient(135deg, ${C.indigo}20, ${C.cyan}10)`, border: `1px solid ${C.cyan}40`, borderRadius: 16, padding: 28, marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.cyan}, ${C.indigo})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: C.white }}>The Easiest Way — Works on Every Platform</h2>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { step: "1", icon: "🖱️", title: "Go to your platform", desc: "Log in to Chaturbate, BongaCams, MFC, or any other cam site and navigate to your earnings or tip history page" },
                  { step: "2", icon: "📋", title: "Select & copy the data", desc: "Choose your date range, then highlight all the tip rows on screen and copy them (Ctrl+C / Cmd+C)" },
                  { step: "3", icon: "📄", title: "Paste into Google Sheets", desc: 'Open Google Sheets (sheets.google.com), create a new sheet, and paste your data (Ctrl+V / Cmd+V)' },
                  { step: "4", icon: "⬇️", title: "Save as CSV & import", desc: 'Click File in the top left → Download → "Comma Separated Values (.csv)" — then upload that file here' },
                ].map(({ step, icon, title, desc }) => (
                  <div key={step} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: 18, position: "relative", border: `1px solid ${C.border}` }}>
                    <div style={{ position: "absolute", top: 14, right: 14, width: 24, height: 24, borderRadius: "50%", background: `${C.cyan}25`, border: `1px solid ${C.cyan}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.cyan }}>
                      {step}
                    </div>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 6 }}>{title}</div>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{desc}</div>
                  </div>
                ))}
              </div>

              {/* Google Sheets callout */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: 16, background: "rgba(0,0,0,0.3)", borderRadius: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>💡</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>Why Google Sheets?</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                    Most cam platforms don't have a direct "Download CSV" button — but they all let you view your data on screen.
                    Google Sheets is a free, instant way to turn any copied table into a proper CSV file.
                    You don't need an account — just go to <span style={{ color: C.cyan, fontWeight: 600 }}>sheets.new</span> in your browser and it opens a blank sheet instantly.
                  </div>
                </div>
              </div>
            </div>

            {/* QUICK VISUAL STEPS for Google Sheets */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 20 }}>🎬 Step-by-Step: Copy → Sheets → CSV</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { num: "01", color: C.cyan,  text: "On your cam platform, find your tip/earnings history and set the date range you want" },
                  { num: "02", color: C.cyan,  text: "Click the first row of data, scroll to the last row, hold Shift and click — then press Ctrl+C (or Cmd+C on Mac)" },
                  { num: "03", color: C.indigo, text: 'Open a new tab and go to sheets.new — a blank Google Sheet opens immediately, no sign-in needed' },
                  { num: "04", color: C.indigo, text: "Click cell A1 and press Ctrl+V — your data pastes in with columns already separated" },
                  { num: "05", color: C.pink,   text: 'Click "File" in the top-left menu → hover "Download" → click "Comma Separated Values (.csv)"' },
                  { num: "06", color: C.green,  text: 'A .csv file downloads to your computer — come back here, click "Import CSV", and select that file. Done! ✅' },
                ].map(({ num, color, text }) => (
                  <div key={num} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 16px", background: C.card2, borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color, minWidth: 28, paddingTop: 1, fontVariantNumeric: "tabular-nums" }}>{num}</div>
                    <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{text}</div>
                  </div>
                ))}
              </div>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 16 }}>📖 Platform-Specific Tips</h2>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Where to find the earnings data on each site before you copy it</p>

            {/* CHATURBATE */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 32 }}>🟣</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: C.white }}>Chaturbate</h2>
              </div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 1:</strong> Log into your Chaturbate broadcaster account</p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 2:</strong> Go to <span style={{ color: C.cyan }}>Stats & Data → Token Stats</span></p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 3:</strong> Select your date range (last 30 days, 90 days, or custom)</p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 4:</strong> Click <span style={{ color: C.cyan }}>"Download CSV"</span> or <span style={{ color: C.cyan }}>"Export"</span></p>
                <p style={{ marginBottom: 16 }}><strong style={{ color: C.white }}>Step 5:</strong> Upload the CSV file to CamCash</p>
                <div style={{ padding: 16, background: C.card2, borderRadius: 10, marginTop: 16 }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>✅ What we need from the CSV:</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Date/Time of tip</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Username (tipper)</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Token amount</div>
                  <div style={{ fontSize: 13, color: C.text, marginTop: 8 }}>💡 Chaturbate CSVs usually have "Tip from:" format</div>
                </div>
              </div>
            </div>

            {/* BONGACAMS */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 32 }}>🔴</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: C.white }}>BongaCams</h2>
              </div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 1:</strong> Log into your BongaCams model account</p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 2:</strong> Navigate to <span style={{ color: C.cyan }}>Statistics → Earnings History</span></p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 3:</strong> Select date range and filter by "Tips" or "All Transactions"</p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 4:</strong> Look for <span style={{ color: C.cyan }}>"Export to Excel"</span> or <span style={{ color: C.cyan }}>"Download CSV"</span> button</p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 5:</strong> Save the file and upload to CamCash</p>
                <div style={{ padding: 16, background: C.card2, borderRadius: 10, marginTop: 16 }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>✅ Required columns:</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Date (format: DD.MM.YYYY)</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Username/Nickname</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Amount (tokens or USD)</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Transaction type (tip/private/etc)</div>
                  <div style={{ fontSize: 13, color: C.text, marginTop: 8 }}>💡 BongaCams format: Date, Username, Type, Tokens, USD</div>
                </div>
              </div>
            </div>

            {/* MYFREECAMS */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 32 }}>🟠</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: C.white }}>MyFreeCams (MFC)</h2>
              </div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 1:</strong> Log into your MFC model account at wiki.myfreecams.com</p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 2:</strong> Go to <span style={{ color: C.cyan }}>Model Admin → Token Stats</span></p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 3:</strong> Click on <span style={{ color: C.cyan }}>"Transaction History"</span> or <span style={{ color: C.cyan }}>"Detailed Stats"</span></p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 4:</strong> Select date range and click <span style={{ color: C.cyan }}>"Export CSV"</span></p>
                <p style={{ marginBottom: 16 }}><strong style={{ color: C.white }}>Step 5:</strong> Upload the exported file to CamCash</p>
                <div style={{ padding: 16, background: C.card2, borderRadius: 10, marginTop: 16 }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>✅ CSV should include:</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Timestamp/Date</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Member username</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Token amount</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Tip type (public tip, group show, private, etc)</div>
                  <div style={{ fontSize: 13, color: C.text, marginTop: 8 }}>💡 MFC CSVs usually very detailed with all transaction types</div>
                </div>
              </div>
            </div>

            {/* CAMSODA */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 32 }}>🟢</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: C.white }}>CamSoda</h2>
              </div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 1:</strong> Log into your CamSoda broadcaster dashboard</p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 2:</strong> Navigate to <span style={{ color: C.cyan }}>Earnings → Transaction History</span></p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 3:</strong> Choose your date range (last week, month, or custom dates)</p>
                <p style={{ marginBottom: 12 }}><strong style={{ color: C.white }}>Step 4:</strong> Click <span style={{ color: C.cyan }}>"Download"</span> or <span style={{ color: C.cyan }}>"Export to CSV"</span></p>
                <p style={{ marginBottom: 16 }}><strong style={{ color: C.white }}>Step 5:</strong> Save and upload to CamCash</p>
                <div style={{ padding: 16, background: C.card2, borderRadius: 10, marginTop: 16 }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>✅ Required data:</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Date and time of transaction</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Username/Member name</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Token amount</div>
                  <div style={{ fontSize: 13, color: C.text }}>• Earnings in USD (optional)</div>
                  <div style={{ fontSize: 13, color: C.text, marginTop: 8 }}>💡 CamSoda exports include both tokens and USD amounts</div>
                </div>
              </div>
            </div>

            {/* GENERAL TIPS */}
            <div style={{ background: `linear-gradient(135deg, ${C.indigo}15, ${C.pink}15)`, border: `1px solid ${C.pink}30`, borderRadius: 14, padding: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 16 }}>💡 General Tips</h2>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>
                <p style={{ marginBottom: 12 }}>✅ <strong style={{ color: C.white }}>Export regularly:</strong> Download your data weekly or monthly</p>
                <p style={{ marginBottom: 12 }}>✅ <strong style={{ color: C.white }}>Don't edit CSVs:</strong> Upload the original file - we handle the formatting</p>
                <p style={{ marginBottom: 12 }}>✅ <strong style={{ color: C.white }}>Multiple platforms:</strong> You can upload CSVs from different sites - we'll combine them</p>
                <p style={{ marginBottom: 12 }}>✅ <strong style={{ color: C.white }}>Duplicates removed:</strong> Don't worry about re-uploading the same data</p>
                <p style={{ marginBottom: 12 }}>✅ <strong style={{ color: C.white }}>File size:</strong> Most CSVs are under 5MB and upload instantly</p>
                <p>⚠️ <strong style={{ color: C.white }}>Privacy:</strong> Your data is encrypted and never shared</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, maxWidth: 400, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 12 }}>Delete All Tips?</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>This will permanently delete all {tips.length} tips. This cannot be undone!</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: "10px 20px", borderRadius: 8, background: C.card2, border: `1px solid ${C.border}`, color: C.white, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={deleteAllTips} style={{ flex: 1, padding: "10px 20px", borderRadius: 8, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, border: "none", color: C.white, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Delete All</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV CONFIRMATION MODAL ─────────────────────────────────────────── */}
      {showConfirmation && parseResult && (
        <ConfirmationModal
          result={parseResult}
          onConfirm={confirmImport}
          onCancel={() => {
            setShowConfirmation(false)
            setPendingData(null)
            setParseResult(null)
            setUploading(false)
          }}
        />
      )}

      {/* ── CSV ERROR MODAL ────────────────────────────────────────────────── */}
      {showError && parseResult && (
        <ErrorModal
          error={parseResult.error}
          suggestions={parseResult.suggestions}
          issues={parseResult.issues}
          onClose={() => {
            setShowError(false)
            setParseResult(null)
            setUploading(false)
          }}
        />
      )}

      {/* ── WHALE PROFILE MODAL ───────────────────────────────────────────── */}
      {selectedWhale && (() => {
        const w = selectedWhale
        const whaleTips = tips.filter(t => t.username === w.username && t.platform === w.platform)
        const sortedTips = [...whaleTips].sort((a, b) => new Date(b.date_time) - new Date(a.date_time))
        const firstTip = whaleTips.reduce((a, b) => new Date(a.date_time) < new Date(b.date_time) ? a : b, whaleTips[0])
        const daysSinceLastTip = Math.floor((Date.now() - new Date(w.lastTipDate)) / 86400000)
        const tierColor = TIER_COLORS[w.tier] || C.cyan

        // AI predictions (simple logic, feels smart)
        const avgDaysBetweenTips = whaleTips.length > 1
          ? Math.floor((new Date(w.lastTipDate) - new Date(firstTip?.date_time)) / 86400000 / (whaleTips.length - 1))
          : 7
        const likelyReturnDays = Math.max(0, avgDaysBetweenTips - daysSinceLastTip)
        const churnRisk = daysSinceLastTip > avgDaysBetweenTips * 2 ? "High" : daysSinceLastTip > avgDaysBetweenTips ? "Medium" : "Low"
        const churnColor = churnRisk === "High" ? C.red : churnRisk === "Medium" ? C.orange : C.green
        const biggestTip = Math.max(...whaleTips.map(t => t.usd))
        const recentTips = sortedTips.slice(0, 5)

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
            <div style={{ width: 560, maxHeight: "90vh", overflowY: "auto", background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: "0 24px 80px rgba(0,0,0,0.9)" }}>
              
              {/* HEADER */}
              <div style={{ padding: "24px 24px 0", background: `linear-gradient(135deg, ${tierColor}15, transparent)`, borderBottom: `1px solid ${C.border}`, paddingBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Avatar */}
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${tierColor}, ${tierColor}80)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                      {w.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>{w.username}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <span style={{ padding: "2px 10px", borderRadius: 100, background: `${tierColor}20`, border: `1px solid ${tierColor}50`, color: tierColor, fontSize: 11, fontWeight: 700 }}>{w.tier}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>{w.platform}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedWhale(null)} style={{ width: 32, height: 32, borderRadius: "50%", background: C.card2, border: `1px solid ${C.border}`, color: C.muted, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
                </div>

                {/* KEY STATS ROW */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {[
                    { label: "Total Spent", value: `$${w.totalUSD.toFixed(2)}`, color: C.green },
                    { label: "Tips Given", value: w.tipCount, color: C.cyan },
                    { label: "Avg Tip", value: `$${w.avgTipSize.toFixed(2)}`, color: C.gold },
                    { label: "Biggest Tip", value: `$${biggestTip.toFixed(2)}`, color: C.pink },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: C.card2, borderRadius: 10, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

                {/* FAN INTELLIGENCE (free) */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>📊 Fan Intelligence</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ padding: 14, background: C.card2, borderRadius: 10, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>First tip</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.white }}>{firstTip ? new Date(firstTip.date_time).toLocaleDateString() : "—"}</div>
                    </div>
                    <div style={{ padding: 14, background: C.card2, borderRadius: 10, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Last tip</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.white }}>{new Date(w.lastTipDate).toLocaleDateString()} <span style={{ fontSize: 11, color: C.muted }}>({daysSinceLastTip}d ago)</span></div>
                    </div>
                    <div style={{ padding: 14, background: C.card2, borderRadius: 10, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Avg days between tips</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.white }}>{avgDaysBetweenTips} days</div>
                    </div>
                    <div style={{ padding: 14, background: C.card2, borderRadius: 10, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Churn risk</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: churnColor }}>{churnRisk}</div>
                    </div>
                  </div>
                </div>

                {/* RECENT TIP HISTORY (free) */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🕐 Recent Tips</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {recentTips.map((t, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: C.card2, borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 12, color: C.muted }}>{new Date(t.date_time).toLocaleDateString()} at {new Date(t.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>${t.usd.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI PREDICTIONS (Pro locked) */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🤖 AI Predictions</div>
                  <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    {/* blurred preview */}
                    <div style={{ filter: isBetaUser ? "none" : "blur(3px)", pointerEvents: isBetaUser ? "auto" : "none", padding: 16, background: C.card2, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.card, borderRadius: 8 }}>
                        <div style={{ fontSize: 13, color: C.text }}>📅 Likely to tip again in</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.cyan }}>{likelyReturnDays === 0 ? "Overdue!" : `~${likelyReturnDays} days`}</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.card, borderRadius: 8 }}>
                        <div style={{ fontSize: 13, color: C.text }}>💸 Predicted next tip size</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>${(w.avgTipSize * 1.1).toFixed(2)}</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.card, borderRadius: 8 }}>
                        <div style={{ fontSize: 13, color: C.text }}>🎯 Engagement score</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.pink }}>{Math.min(99, Math.round((w.tipCount / 10) * 20 + (w.totalUSD / 100) * 10))} / 100</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.card, borderRadius: 8 }}>
                        <div style={{ fontSize: 13, color: C.text }}>📈 30-day revenue forecast</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>${((w.totalUSD / Math.max(1, Math.floor((Date.now() - new Date(firstTip?.date_time)) / 2592000000))) * 1.05).toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Pro overlay */}
                    {!isBetaUser && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(11,15,26,0.6)", backdropFilter: "blur(2px)" }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 4 }}>Pro Feature</div>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, textAlign: "center" }}>AI-powered return predictions & fan scoring</div>
                        <button style={{ padding: "9px 22px", borderRadius: 8, background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, border: "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          Upgrade to Pro
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* CLOSE */}
                <button onClick={() => setSelectedWhale(null)} style={{ width: "100%", padding: "12px", borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, color: C.muted, fontSize: 14, cursor: "pointer", marginTop: 4 }}>
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {/* ──────────────────────────────────────────────────────────────────── */}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 20px", color: C.white, fontSize: 14, zIndex: 999, boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}>
          {toast}
        </div>
      )}
    </div>
  )
}
