"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { parseCSV, aggregateRows } from "../../lib/analytics"

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
  const [isPro, setIsPro] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [selectedWhale, setSelectedWhale] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [whaleNotes, setWhaleNotes] = useState({})
  const [editingNotes, setEditingNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500) }

  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      if (url) window.location.href = url
    } catch (err) {
      showToast("❌ " + err.message)
    } finally {
      setUpgrading(false)
    }
  }

  const handleManageBilling = async () => {
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      showToast("❌ " + err.message)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return }
      setUser(user)
      loadData(user.id)
      checkSubscription(user.id)
      loadWhaleNotes(user.id)
    })
  }, [])

  const checkSubscription = async (uid) => {
    const { data } = await supabase.from('subscriptions').select('status').eq('user_id', uid).single()
    setIsPro(data?.status === 'active')
  }

  const loadData = async (uid) => {
    setLoading(true)
    try {
      const { data } = await supabase.from("tips").select("*").eq("user_id", uid).order("date_time", { ascending: true })
      if (data?.length) {
        setTips(data)
        const analyzed = aggregateRows(data)
        setAnalytics(analyzed)
      }
    } finally { setLoading(false) }
  }

  const loadWhaleNotes = async (uid) => {
    const { data } = await supabase.from("tipper_notes").select("*").eq("user_id", uid)
    if (data) {
      const notesMap = {}
      data.forEach(n => { notesMap[n.username.toLowerCase()] = n.notes })
      setWhaleNotes(notesMap)
    }
  }

  const saveWhaleNotes = async (username) => {
    if (!user || !selectedWhale) return
    setSavingNotes(true)
    try {
      const { error } = await supabase.from("tipper_notes").upsert({
        user_id: user.id,
        username: username,
        notes: editingNotes,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,username' })
      
      if (error) throw error
      
      setWhaleNotes({ ...whaleNotes, [username.toLowerCase()]: editingNotes })
      showToast("✅ Notes saved!")
    } catch (err) {
      showToast("❌ " + err.message)
    } finally {
      setSavingNotes(false)
    }
  }

  const handleCSV = async (file) => {
    if (!file || !user) return
    if (!isPro && uploadCount >= 3) {
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

  const openWhaleProfile = (whale) => {
    setSelectedWhale(whale)
    setEditingNotes(whaleNotes[whale.username.toLowerCase()] || "")
  }

  const closeWhaleProfile = () => {
    setSelectedWhale(null)
    setEditingNotes("")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F2A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-gray-700 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
          <div className="text-gray-500 text-sm">Loading analytics...</div>
        </div>
      </div>
    )
  }

  const sessions = analytics?.sessions || []
  const whales = analytics?.whales || []
  const insights = analytics?.insights || []
  const platforms = analytics?.platforms || []
  const predictions = analytics?.predictions || {}
  const whaleAlerts = analytics?.whaleAlerts || []
  
  const totalRevenue = analytics?.totalUSD || 0
  const totalFans = whales.length
  const avgPerHour = sessions.length > 0 ? sessions.reduce((sum, s) => sum + s.usdPerHour, 0) / sessions.length : 0

  // Filter whales by search
  const filteredWhales = searchQuery.trim() === "" 
    ? whales 
    : whales.filter(w => w.username.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="min-h-screen bg-[#0B0F2A] text-gray-100 font-['Inter']">
      
      {/* SIDEBAR */}
      <div className="fixed left-0 top-0 bottom-0 w-60 bg-[#121826] border-r border-gray-800 flex flex-col z-40">
        
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <svg className="w-10 h-10" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{stopColor:"#00E5FF"}} />
                  <stop offset="50%" style={{stopColor:"#7B61FF"}} />
                  <stop offset="100%" style={{stopColor:"#FF4DCE"}} />
                </linearGradient>
              </defs>
              <rect x="5" y="12" width="40" height="30" rx="6" fill="none" stroke="url(#logoGrad)" strokeWidth="2.5"/>
              <path d="M 18 12 L 18 8 Q 18 6 20 6 L 30 6 Q 32 6 32 8 L 32 12" fill="none" stroke="url(#logoGrad)" strokeWidth="2.2"/>
              <circle cx="25" cy="27" r="9" fill="none" stroke="url(#logoGrad)" strokeWidth="2.8"/>
              <text x="25" y="32" fontFamily="Inter" fontSize="14" fontWeight="900" fill="url(#logoGrad)" textAnchor="middle">$</text>
              <circle cx="40" cy="17" r="2.5" fill="url(#logoGrad)"/>
            </svg>
            <div className="text-xl font-extrabold">
              <span className="text-white">Cash</span>
              <span className="bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">Cam</span>
            </div>
          </div>
          {user && <div className="text-xs text-gray-500 mb-2">{user.email}</div>}
          {isPro && (
            <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-cyan-400 to-pink-500 text-white text-xs font-bold">
              ✨ PRO
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
              activeTab === "overview" 
                ? "bg-cyan-500/10 border border-cyan-500/30 text-white font-medium" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="text-lg">📊</span> Overview
          </button>
          <button 
            onClick={() => setActiveTab("platforms")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
              activeTab === "platforms" 
                ? "bg-cyan-500/10 border border-cyan-500/30 text-white font-medium" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="text-lg">🎯</span> Platforms
          </button>
          <button 
            onClick={() => setActiveTab("fans")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
              activeTab === "fans" 
                ? "bg-cyan-500/10 border border-cyan-500/30 text-white font-medium" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="text-lg">🐳</span> Top Fans
          </button>
          <button 
            onClick={() => setActiveTab("predictions")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
              activeTab === "predictions" 
                ? "bg-cyan-500/10 border border-cyan-500/30 text-white font-medium" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="text-lg">🔮</span> AI Predictions
          </button>
          <button 
            onClick={() => setActiveTab("sessions")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
              activeTab === "sessions" 
                ? "bg-cyan-500/10 border border-cyan-500/30 text-white font-medium" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="text-lg">🎥</span> Sessions
          </button>
          <button 
            onClick={() => setActiveTab("import")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
              activeTab === "import" 
                ? "bg-cyan-500/10 border border-cyan-500/30 text-white font-medium" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="text-lg">📥</span> Import
          </button>
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-gray-800 space-y-2">
          {isPro && (
            <button 
              onClick={handleManageBilling}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-700 text-white text-sm hover:bg-gray-800"
            >
              💳 Manage Billing
            </button>
          )}
          <button 
            onClick={() => supabase.auth.signOut().then(() => router.replace("/login"))}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-700 text-gray-400 text-sm hover:bg-gray-800"
          >
            ↩ Sign Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="ml-60 p-8">
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            <h1 className="text-3xl font-extrabold text-white mb-8">Overview</h1>

            {/* Metric Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
                <div className="relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Total Revenue</div>
                    <div className="text-2xl">💰</div>
                  </div>
                  <div className="text-4xl font-extrabold text-green-400">${totalRevenue.toFixed(2)}</div>
                </div>
              </div>

              <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
                <div className="relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Avg $/Hour</div>
                    <div className="text-2xl">⏱️</div>
                  </div>
                  <div className="text-4xl font-extrabold text-blue-400">${avgPerHour.toFixed(2)}</div>
                </div>
              </div>

              <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent" />
                <div className="relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Total Fans</div>
                    <div className="text-2xl">👥</div>
                  </div>
                  <div className="text-4xl font-extrabold text-pink-400">{totalFans}</div>
                </div>
              </div>

              <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent" />
                <div className="relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Sessions</div>
                    <div className="text-2xl">🎥</div>
                  </div>
                  <div className="text-4xl font-extrabold text-yellow-400">{sessions.length}</div>
                </div>
              </div>
            </div>

            {/* Whale Alerts */}
            {whaleAlerts.length > 0 && (
              <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6 mb-8">
                <h2 className="text-xl font-bold text-white mb-6">🚨 Whale Alerts</h2>
                <div className="space-y-3">
                  {whaleAlerts.slice(0, 5).map((alert, i) => (
                    <div 
                      key={i}
                      className={`p-4 rounded-xl border flex items-start gap-4 ${
                        alert.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                        alert.severity === 'success' ? 'bg-green-500/10 border-green-500/30' :
                        'bg-cyan-500/10 border-cyan-500/20'
                      }`}
                    >
                      <span className="text-2xl">{alert.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm text-gray-200">{alert.message}</div>
                        {alert.action && (
                          <div className="text-xs text-gray-400 mt-1">💡 {alert.action}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Smart Insights */}
            <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-6">💡 Smart Insights</h2>
              <div className="space-y-3">
                {insights.slice(0, isPro ? insights.length : 5).map((insight, i) => (
                  <div 
                    key={i}
                    className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 flex items-center gap-4"
                  >
                    <span className="text-2xl">{insight.icon}</span>
                    <span className="text-sm text-gray-200">{insight.text}</span>
                  </div>
                ))}
              </div>

              {!isPro && insights.length > 5 && (
                <div className="mt-6 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/20 rounded-xl p-8 text-center">
                  <div className="text-4xl mb-4">🔒</div>
                  <div className="text-base text-gray-200 mb-6">Unlock {insights.length - 5}+ more AI-powered insights</div>
                  <button 
                    onClick={handleUpgrade}
                    disabled={upgrading}
                    className="px-8 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
                  >
                    {upgrading ? "Loading..." : "Upgrade to Pro - $19.99/mo"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* PLATFORMS TAB */}
        {activeTab === "platforms" && (
          <>
            <h1 className="text-3xl font-extrabold text-white mb-8">Platform Performance</h1>
            
            {platforms.map((platform, i) => (
              <div key={i} className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6 mb-6">
                <h2 className="text-2xl font-bold text-white mb-6">{platform.platform}</h2>
                
                <div className="grid grid-cols-5 gap-4 mb-6">
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Total Revenue</div>
                    <div className="text-2xl font-bold text-green-400">${platform.totalUSD.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2">$/Hour</div>
                    <div className="text-2xl font-bold text-cyan-400">${platform.usdPerHour}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Sessions</div>
                    <div className="text-2xl font-bold text-pink-400">{platform.sessions}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Total Hours</div>
                    <div className="text-2xl font-bold text-yellow-400">{platform.hours.toFixed(1)}h</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Avg Tip</div>
                    <div className="text-2xl font-bold text-blue-400">${platform.avgTipSize}</div>
                  </div>
                </div>

                <div className="bg-gray-800/30 rounded-xl p-4">
                  <div className="text-sm text-gray-300">
                    💡 Best performance on this platform during peak hours
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* TOP FANS TAB */}
        {activeTab === "fans" && (
          <>
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-extrabold text-white">🐳 Top Fans Deep Dive</h1>
              
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 w-64"
                />
                <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-white"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            
            {searchQuery && filteredWhales.length === 0 && (
              <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <div className="text-lg text-gray-400">No fans found matching "{searchQuery}"</div>
              </div>
            )}

            {filteredWhales.length > 0 && (
              <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50 border-b border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Username</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Total $</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Tips</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Avg Tip</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Platform</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Tier</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Last Tip</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Profile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWhales.map((whale, i) => (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="px-4 py-4 text-gray-400">#{whales.indexOf(whale)+1}</td>
                          <td className="px-4 py-4 text-white font-semibold">{whale.username}</td>
                          <td className="px-4 py-4 text-green-400 font-bold">${whale.totalUSD.toFixed(2)}</td>
                          <td className="px-4 py-4 text-gray-300">{whale.tipCount}</td>
                          <td className="px-4 py-4 text-cyan-400">${whale.avgTipSize.toFixed(2)}</td>
                          <td className="px-4 py-4 text-gray-300">{whale.platform}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              whale.tier === 'Whale' ? 'bg-yellow-500/20 text-yellow-400' :
                              whale.tier === 'Shark' ? 'bg-blue-500/20 text-blue-400' :
                              whale.tier === 'Dormant' ? 'bg-gray-500/20 text-gray-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {whale.tier === 'Whale' ? '🐳 Whale' :
                               whale.tier === 'Shark' ? '🦈 Shark' :
                               whale.tier === 'Dormant' ? '💤 Dormant' : '🐟 Regular'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-gray-400 text-sm">
                            {whale.daysSinceLastTip}d ago
                          </td>
                          <td className="px-4 py-4">
                            {isPro ? (
                              <button 
                                onClick={() => openWhaleProfile(whale)}
                                className="px-3 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs hover:bg-cyan-500/30"
                              >
                                View Profile
                              </button>
                            ) : (
                              <button 
                                onClick={handleUpgrade}
                                className="px-3 py-1 rounded-lg bg-pink-500/20 border border-pink-500/30 text-pink-400 text-xs"
                              >
                                🔒 Unlock
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* AI PREDICTIONS TAB */}
        {activeTab === "predictions" && (
          <>
            <h1 className="text-3xl font-extrabold text-white mb-8">🔮 AI Predictions</h1>

            {predictions.next7Days && (
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-8">
                  <div className="text-5xl mb-4">📈</div>
                  <div className="text-lg font-semibold text-gray-300 mb-3">Next 7 Days Revenue Forecast</div>
                  <div className="text-4xl font-extrabold text-cyan-400 mb-2">
                    ${predictions.next7Days.amount.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">
                    {predictions.next7Days.confidence} confidence
                  </div>
                </div>

                <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-8">
                  <div className="text-5xl mb-4">📊</div>
                  <div className="text-lg font-semibold text-gray-300 mb-3">Next 30 Days Revenue Forecast</div>
                  <div className="text-4xl font-extrabold text-pink-400 mb-2">
                    ${predictions.next30Days.amount.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">
                    {predictions.next30Days.confidence} confidence
                  </div>
                </div>
              </div>
            )}

            {predictions.tonightStream && (
              <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-2xl p-8 mb-8">
                <div className="text-5xl mb-4">🎥</div>
                <div className="text-2xl font-bold text-white mb-3">Tonight's Stream Prediction</div>
                <div className="text-5xl font-extrabold text-cyan-400 mb-4">
                  ${predictions.tonightStream.expected.toFixed(2)}
                </div>
                <div className="text-lg text-gray-300 mb-2">
                  Expected range: ${predictions.tonightStream.range.min.toFixed(2)} - ${predictions.tonightStream.range.max.toFixed(2)}
                </div>
                <div className="text-sm text-gray-400">
                  Based on {predictions.tonightStream.confidence} confidence from historical data
                </div>
              </div>
            )}

            {!isPro && (
              <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/20 rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">🔒</div>
                <div className="text-base text-gray-200 mb-6">Unlock advanced AI predictions and whale behavior analysis</div>
                <button 
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="px-8 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {upgrading ? "Loading..." : "Upgrade to Pro - $19.99/mo"}
                </button>
              </div>
            )}
          </>
        )}

        {/* SESSIONS TAB */}
        {activeTab === "sessions" && (
          <>
            <h1 className="text-3xl font-extrabold text-white mb-8">🎥 Stream Sessions</h1>
            
            {sessions.map((session, i) => (
              <div key={i} className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6 mb-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {new Date(session.startTime).toLocaleDateString()} • {session.platform}
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(session.startTime).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">${session.totalUSD.toFixed(2)}</div>
                    <div className="text-sm text-cyan-400">{session.durationHours.toFixed(1)}h</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-700">
                  <div>
                    <div className="text-xs text-gray-400">$/Hour</div>
                    <div className="text-lg font-semibold text-white">${session.usdPerHour.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Tips</div>
                    <div className="text-lg font-semibold text-white">{session.tipCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Avg Tip</div>
                    <div className="text-lg font-semibold text-white">${session.avgTipSize.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Unique Fans</div>
                    <div className="text-lg font-semibold text-white">{session.uniqueFans}</div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* IMPORT TAB */}
        {activeTab === "import" && (
          <>
            <h1 className="text-3xl font-extrabold text-white mb-8">📥 Import CSV Data</h1>
            
            <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-8 text-center">
              <div className="text-6xl mb-6">📊</div>
              <h2 className="text-2xl font-bold text-white mb-4">Upload Your Tips CSV</h2>
              <p className="text-gray-400 mb-8">
                Supports Chaturbate, BongaCams, and all major platforms
              </p>
              
              <input
                type="file"
                accept=".csv"
                onChange={e => e.target.files?.[0] && handleCSV(e.target.files[0])}
                className="hidden"
                id="csv-upload"
                disabled={uploading}
              />
              <label
                htmlFor="csv-upload"
                className={`inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-semibold cursor-pointer hover:opacity-90 transition ${
                  uploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uploading ? "Uploading..." : "Choose CSV File"}
              </label>

              {!isPro && (
                <div className="mt-6 text-sm text-gray-400">
                  Free tier: {uploadCount}/3 uploads this month
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* WHALE PROFILE MODAL */}
      {selectedWhale && isPro && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8" onClick={closeWhaleProfile}>
          <div className="bg-[#121826] border border-gray-700 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">🐳 {selectedWhale.username}</h2>
                <div className="text-sm text-gray-400">{selectedWhale.platform}</div>
              </div>
              <button onClick={closeWhaleProfile} className="text-gray-400 hover:text-white text-3xl leading-none">×</button>
            </div>

            {/* Basic Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-900/50 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-2">Lifetime Value</div>
                <div className="text-3xl font-bold text-green-400">${selectedWhale.totalUSD.toFixed(2)}</div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-2">Total Tips</div>
                <div className="text-3xl font-bold text-cyan-400">{selectedWhale.tipCount}</div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-2">Biggest Tip</div>
                <div className="text-3xl font-bold text-pink-400">${selectedWhale.biggestTip.toFixed(2)}</div>
              </div>
            </div>

            {/* AI Predictions */}
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">🔮 AI Predictions</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Next Tip Probability</div>
                  <div className={`text-2xl font-bold ${
                    selectedWhale.tipProbability?.level === 'High' ? 'text-green-400' :
                    selectedWhale.tipProbability?.level.includes('Medium') ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {selectedWhale.tipProbability?.level} ({selectedWhale.tipProbability?.percentage}%)
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Expected: {selectedWhale.expectedNextTip}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Churn Risk</div>
                  <div className={`text-2xl font-bold ${
                    selectedWhale.churnRisk?.level === 'Low' ? 'text-green-400' :
                    selectedWhale.churnRisk?.level === 'Medium' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {selectedWhale.churnRisk?.level}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{selectedWhale.churnRisk?.risk}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Predicted LTV (1 year)</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    ${selectedWhale.lifetimeValue?.prediction?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {selectedWhale.lifetimeValue?.confidence} confidence
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Typical Online Hours</div>
                  <div className="text-2xl font-bold text-pink-400">
                    {selectedWhale.typicalOnlineHours}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Best contact time</div>
                </div>
              </div>
            </div>

            {/* Activity Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-900/50 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-2">First Tip</div>
                <div className="text-lg font-semibold text-white">
                  {new Date(selectedWhale.firstTipDate).toLocaleDateString()}
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-2">Last Tip</div>
                <div className="text-lg font-semibold text-white">
                  {selectedWhale.daysSinceLastTip} days ago
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-2">Avg Tip Amount</div>
                <div className="text-lg font-semibold text-white">
                  ${selectedWhale.avgTipSize.toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-2">Tipping Frequency</div>
                <div className="text-lg font-semibold text-white">
                  Every {selectedWhale.avgDaysBetweenTips.toFixed(0)} days
                </div>
              </div>
            </div>

            {/* Private Shows */}
            {selectedWhale.hasPrivates && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🔒</span>
                  <div className="text-lg font-bold text-white">Private Shows</div>
                </div>
                <div className="text-sm text-gray-300">
                  {selectedWhale.privateCount} private session{selectedWhale.privateCount !== 1 ? 's' : ''} • 
                  Total spent: ${selectedWhale.privateSpent.toFixed(2)}
                </div>
              </div>
            )}

            {/* Tip Notes */}
            {selectedWhale.tipNotes && selectedWhale.tipNotes.length > 0 && (
              <div className="bg-gray-900/50 rounded-xl p-4 mb-6">
                <div className="text-lg font-bold text-white mb-3">💬 Tip Notes</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedWhale.tipNotes.slice(0, 10).map((note, i) => (
                    <div key={i} className="text-sm text-gray-300 bg-gray-800/50 rounded p-2">
                      "{note}"
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Notes */}
            <div className="bg-gray-900/50 rounded-xl p-4">
              <div className="text-lg font-bold text-white mb-3">📝 Your Notes</div>
              <textarea
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="Add your own notes about this fan (preferences, favorites, special requests, etc.)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 min-h-[120px]"
              />
              <button
                onClick={() => saveWhaleNotes(selectedWhale.username)}
                disabled={savingNotes}
                className="mt-3 px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white font-semibold disabled:opacity-50"
              >
                {savingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 border border-gray-700 rounded-xl px-5 py-3 text-white text-sm shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
