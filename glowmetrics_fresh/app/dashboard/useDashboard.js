"use client"
import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { parseCSV, aggregateRows as runEngine } from "../../lib/analytics"

let track = (event, props) => {}
try { track = require("@vercel/analytics").track } catch (e) {}

export function useDashboard() {

  const [user, setUser] = useState(null)
  const [tips, setTips] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [liveAnalytics, setLiveAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadPlatform, setUploadPlatform] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [toast, setToast] = useState("")
  const [uploadCount, setUploadCount] = useState(0)
  const [whaleFilter, setWhaleFilter] = useState("ALL")
  const [platformFilter, setPlatformFilter] = useState("ALL")
  const [platformTimeFilter, setPlatformTimeFilter] = useState("ALL")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedWhale, setSelectedWhale] = useState(null)
  const [messageTarget, setMessageTarget] = useState(null)
  const [messageIndex, setMessageIndex] = useState(0)
  const [messageCopied, setMessageCopied] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showBetaPrompt, setShowBetaPrompt] = useState(false)
  const [fanSearchOpen, setFanSearchOpen] = useState(false)
  const [fanSearchQuery, setFanSearchQuery] = useState("")
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [chartDrillDay, setChartDrillDay] = useState(null)
  // ── LIVE MODE STATE ───────────────────────────────────────
  const [liveActive, setLiveActive] = useState(false)
  const [liveStartTime, setLiveStartTime] = useState(null)
  const [liveEvents, setLiveEvents] = useState([])
  const [liveGoalTokens, setLiveGoalTokens] = useState(0)
  const [livePlatform, setLivePlatform] = useState('Chaturbate')
  const [liveTipInput, setLiveTipInput] = useState({ username: '', tokens: '', usd: '' })
  const [liveAlerts, setLiveAlerts] = useState([])
  const [liveTick, setLiveTick] = useState(0)
  const [minuteTick, setMinuteTick] = useState(0) // increments every 60s to refresh time-based alerts
  const [betaCount, setBetaCount] = useState(null)
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
  const [tokenRates, setTokenRates] = useState({ Chaturbate: 0.05, BongaCams: 0.05, MyFreeCams: 0.05, Stripchat: 0.05, CamSoda: 0.05 })
  const [showRateEditor, setShowRateEditor] = useState(false)
  // ── ROUND 1 FEATURES ─────────────────────────────────────────────
  const [monthlyGoal, setMonthlyGoal] = useState(null)
  const [goalInput, setGoalInput] = useState('')
  const [showGoalEditor, setShowGoalEditor] = useState(false)
  const [tipperNotes, setTipperNotes] = useState({}) // { username: { note, followUp } }
  const [noteTarget, setNoteTarget] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  // ── ANIMATION STATE ──────────────────────────────────────
  const [counterBumping, setCounterBumping] = useState(false)
  const [lastUpdatedSection, setLastUpdatedSection] = useState(null)
  const [newAlertKey, setNewAlertKey] = useState(0)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [newTipCount, setNewTipCount] = useState(0)
  const prevTipCountRef = useRef(0)
  const realtimeChannelRef = useRef(null)
  const refreshTimerRef = useRef(null)

  const isBetaUser = true
  const isPro = true
  const uploadLimit = Infinity

  const openUpgradeModal = (source) => {
    track('upgrade_click', { source })
    setShowUpgradeModal(true)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500) }

  // ── SAVE TIPPER NOTE ─────────────────────────────────────────────
  const saveTipperNote = async (username, note, followUp = false) => {
    if (!user) return
    setNoteSaving(true)
    try {
      await supabase.from('tipper_notes').upsert({
        user_id: user.id,
        tipper_username: username.toLowerCase(),
        note,
        follow_up: followUp,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,tipper_username' })
      setTipperNotes(prev => ({ ...prev, [username.toLowerCase()]: { note, followUp } }))
      showToast('✅ Note saved')
      setNoteTarget(null)
    } catch(e) { showToast('❌ Failed to save note') }
    finally { setNoteSaving(false) }
  }

  // ── SAVE MONTHLY GOAL ─────────────────────────────────────────────
  const saveMonthlyGoal = async (amount) => {
    if (!user || !amount) return
    const target = parseFloat(amount)
    if (isNaN(target) || target <= 0) return
    try {
      await supabase.from('user_goals').upsert({
        user_id: user.id,
        goal_type: 'monthly',
        target_usd: target,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,goal_type' })
      setMonthlyGoal(target)
      setShowGoalEditor(false)
      showToast(`✅ Goal set: $${target.toFixed(0)}/month`)
    } catch(e) { showToast('❌ Failed to save goal') }
  }

  // Tab persistence
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      localStorage.setItem('camcash_tab', tab)
      // Scroll both window and the main content div to top
      window.scrollTo({ top: 0, behavior: 'instant' })
      document.querySelector('.dash-main')?.scrollTo({ top: 0, behavior: 'instant' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
  }

  // Counter bump when new tips arrive
  useEffect(() => {
    if (newTipCount > prevTipCountRef.current) {
      setCounterBumping(true)
      setLastUpdatedSection('tips')
      setTimeout(() => setCounterBumping(false), 320)
      setTimeout(() => setLastUpdatedSection(null), 2500)
    }
    prevTipCountRef.current = newTipCount
  }, [newTipCount])

  // ── EXTENSION LISTENER — receives tips from Chrome extension ────────────
  useEffect(() => {
    const handleExtensionMessage = (event) => {
      if (event.source !== window) return
      if (event.data?.type !== 'CAMCASH_TIP_EVENT') return
      const { event: tipEvent } = event.data
      if (!tipEvent || !tipEvent.username) return
      // Only feed into live mode if active
      setLiveActive(active => {
        if (active) {
          const rate = 0.05 // will use tokenRates from state in real impl
          const tokens = parseInt(tipEvent.tokens) || 0
          const usd    = parseFloat(tipEvent.usd) || 0
          const normalized = {
            username: tipEvent.username,
            tokens,
            usd,
            normalizedRevenue: usd > 0 ? usd : parseFloat((tokens * rate).toFixed(2)),
            sourceUsed: usd > 0 ? 'usd' : 'tokens',
            timestamp: new Date(tipEvent.timestamp || Date.now()),
            platform: tipEvent.platform || 'Unknown',
            source: 'extension',
          }
          setLiveEvents(prev => [...prev, normalized])
        }
        return active
      })
    }
    window.addEventListener('message', handleExtensionMessage)
    return () => window.removeEventListener('message', handleExtensionMessage)
  }, [])

  useEffect(() => {
    // Restore saved tab
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('camcash_tab')
      if (saved) setActiveTab(saved)
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return }
      setUser(user)
      loadData(user.id)
      // Load monthly goal from DB
      supabase.from('user_goals').select('*').eq('user_id', user.id).eq('goal_type', 'monthly').maybeSingle()
        .then(({ data }) => { if (data) { setMonthlyGoal(data.target_usd); setGoalInput(data.target_usd.toString()) } })
      // Load tipper notes
      supabase.from('tipper_notes').select('*').eq('user_id', user.id)
        .then(({ data }) => {
          if (data?.length) {
            const map = {}
            data.forEach(n => { map[n.tipper_username.toLowerCase()] = { note: n.note, followUp: n.follow_up } })
            setTipperNotes(map)
          }
        })
      supabase.from('beta_users').select('id', { count: 'exact', head: true })
        .then(({ count }) => { if (count !== null) setBetaCount(count) })
      try {
        supabase.from('beta_users').upsert({
          user_id: user.id, email: user.email, signed_up_at: user.created_at
        }, { onConflict: 'user_id', ignoreDuplicates: true })
        supabase.from('analytics_events').insert({
          user_id: user.id, event_name: 'dashboard_opened', properties: { email: user.email }
        })
      } catch(e) {}

      // ── SUPABASE REALTIME ──────────────────────────────────
      const channel = supabase
        .channel(`tips_live_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'tips',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          setTips(prev => {
            const exists = prev.some(t =>
              t.date_time === payload.new.date_time &&
              t.username === payload.new.username &&
              t.tokens === payload.new.tokens
            )
            if (exists) return prev
            const updated = [...prev, payload.new].sort((a,b) => new Date(a.date_time)-new Date(b.date_time))
            try { const r = runEngine(updated); if(r) setAnalytics(r) } catch(e) { console.error('realtime runEngine failed:', e) }
            return updated
          })
          setNewTipCount(n => n + 1)
          setNewAlertKey(k => k + 1)
          setLastRefreshed(new Date())
          // Invalidate the sessionStorage cache so next hard reload gets fresh data
          try { sessionStorage.removeItem(`camcash_tips_${user.id}`) } catch(e) {}
        })
        .subscribe()
      realtimeChannelRef.current = channel

      // ── LIGHTWEIGHT 30s analytics re-run (NO DB calls — just re-runs engine on cached data)
      // Full reloads only happen on: initial load, CSV upload, focus after 5+ min away
      refreshTimerRef.current = setInterval(() => {
        setTips(prev => {
          if (!prev.length) return prev
          try { const r = runEngine(prev); if(r) setAnalytics(r) } catch(e) { console.error('refresh runEngine failed:', e) }
          return prev
        })
      }, 30000)

      // ── MINUTE TICK — re-evaluates time-based alerts every 60s ──
      // Daily Brief, real-time alerts, and best-time alert update as the hour changes
      const minuteTimer = setInterval(() => {
        setMinuteTick(t => t + 1)
      }, 60000)
    })
    return () => {
      if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current)
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      // minuteTimer cleared inline
    }
  }, [])

  // ── VISIBILITY REFRESH: only reload if tab was hidden for 15+ min ──
  // Uses visibilitychange instead of focus so switching windows doesn't fire it
  useEffect(() => {
    if (!user) return
    let hiddenAt = null
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else if (hiddenAt && Date.now() - hiddenAt > 15 * 60 * 1000) {
        // Tab was hidden for 15+ min — reload fresh data
        try { sessionStorage.removeItem(`camcash_tips_${user.id}`) } catch(e) {}
        loadData(user.id, true).then(() => setLastRefreshed(new Date()))
        hiddenAt = null
      } else {
        hiddenAt = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [user])

  useEffect(() => {
    if (analytics) setLiveAnalytics(analytics)
  }, [analytics])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const loadData = async (uid, force = false) => {
    
    

    setLoading(true)
    try {
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
      if (allData.length) {
        setTips(allData)
        try {
          const result = runEngine(allData)
          setAnalytics(result)
        } catch (engineErr) {
          console.error('[loadData] runEngine failed:', engineErr)
        }
        // Save to cache
        try {
          sessionStorage.setItem(`camcash_tips_${uid}`, JSON.stringify(allData))
          sessionStorage.setItem(`camcash_tips_time_${uid}`, Date.now().toString())
        } catch(e) {} // quota exceeded — fine, skip cache
      }
      setLastRefreshed(new Date())
    } finally { setLoading(false) }
  }
const handleCSV = async (file, forcePlatform = null) => {
    if (!file || !user) return
    setUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { showToast("❌ Not logged in"); setUploading(false); return }

      const fd = new FormData()
      fd.append('file', file)
      if (forcePlatform) fd.append('platform', forcePlatform)

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })

      const result = await res.json()

      if (!res.ok || result.error) {
        showToast("❌ " + (result.error || 'Upload failed'))
        setUploading(false)
        return
      }

      track('csv_imported', { rows: result.inserted, platform: result.platform || 'Unknown' })

      const msg = result.skipped > 0
        ? `✅ Imported ${result.inserted} tips (${result.skipped} duplicates skipped)`
        : `✅ Imported ${result.inserted} tips from ${result.platform}!`
      showToast(msg)

      setUploadCount(c => c + 1)
      // Force reload after upload — bypass cache so new tips appear immediately
      try { sessionStorage.removeItem(`camcash_tips_${user.id}`) } catch(e) {}
      await loadData(user.id, true)

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
    try { const { error } = await supabase.from("tips").delete().eq("user_id", user.id); if (error) throw error; showToast("✅ All tips deleted"); setShowDeleteConfirm(false); try { sessionStorage.removeItem(`camcash_tips_${user.id}`) } catch(e) {}; await loadData(user.id, true) }
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
  const dependencyRisk = analytics?.dependencyRisk || null
  const preTipBehavior = analytics?.preTipBehavior || null
  const trueHourlyAvg  = analytics?.trueHourlyAvg  || []
  const alerts = liveAnalytics?.whaleAlerts || analytics?.whaleAlerts || []
  const lossAlerts = liveAnalytics?.lossAlerts || analytics?.lossAlerts || []
  const nextMoves = liveAnalytics?.nextMoves || analytics?.nextMoves || []
  const totalRevenue = analytics?.totalUSD || 0
  // Only average sessions with real duration (exclude zero-timestamp BongaCams exports)
  const timedSessions = sessions.filter(s => !s.durationUnknown && s.usdPerHour !== null)
  // FIX: use total USD / total hours (not avg of per-session rates — that inflates short sessions)
  const timedTotalUSD = timedSessions.reduce((sum, s) => sum + (s.totalUSD || 0), 0)
  const timedTotalHours = timedSessions.reduce((sum, s) => sum + (s.durationHours || 0), 0)
  const avgPerHour = timedTotalHours > 0 ? timedTotalUSD / timedTotalHours : 0
  // Single source of truth — pre-computed in aggregateRows, same values used everywhere
  const analyticsbestDay  = analytics?.bestDay  || null
  const analyticsBestHour = analytics?.bestHour || null
  // Advanced analytics — from aggregateRows
  const platformBestTimes     = analytics?.platformBestTimes     || {}
  const earningsVelocity      = analytics?.earningsVelocity      ?? null
  const platformVelocity      = analytics?.platformVelocity      || {}
  const missedRevenueByPlat   = analytics?.missedRevenueByPlatform || {}
  const returningVsNew        = analytics?.returningVsNew        || null
  const topFanDependency      = analytics?.topFanDependency      || null

  // Build platformTimes from INDIVIDUAL TIPS (not session start time)
  // so hour/day reflects when money actually came in, not when the session started
  // Use UTC to match the database timestamps
  const UTC_DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const platformTimes = {}
  tips.forEach(t => {
    if (!platformTimes[t.platform]) platformTimes[t.platform] = { hours: {}, days: {} }
    const dt = new Date(t.date_time || t.dateRaw)
    const hour = dt.getUTCHours()
    const day = UTC_DAYS_LONG[dt.getUTCDay()]
    platformTimes[t.platform].hours[hour] = (platformTimes[t.platform].hours[hour] || 0) + (t.usd || 0)
    platformTimes[t.platform].days[day]   = (platformTimes[t.platform].days[day]   || 0) + (t.usd || 0)
  })

  const filteredWhales = whales.filter(w => {
    if (whaleFilter !== "ALL" && w.tier !== whaleFilter) return false
    if (platformFilter !== "ALL" && w.platform !== platformFilter) return false
    if (chartDrillDay) {
      const fanTips = (w.tips && w.tips.length > 0) ? w.tips : tips.filter(t => t.username?.toLowerCase() === w.username?.toLowerCase())
      const tippedOnDay = fanTips.some(t => {
        const dayShort = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(t.date_time || t.dateRaw).getUTCDay()]
        return dayShort === chartDrillDay
      })
      if (!tippedOnDay) return false
    }
    return true
  })

  const allPlatforms = [...new Set(tips.map(t => t.platform))]

  // ── Build "What's Next" alerts — smarter, personalized, prioritized
  const buildWhatsNextAlerts = () => {
    const now = Date.now()
    const strikeHot = []
    const winBack = []
    const milestone = []
    const onlineNow = []
    const dormant = []
    const performance = []

    // Helper: get personalized re-engage message based on fan behavior
    const getPersonalMsg = (w) => {
      const name = w.username
      if (w.hasPrivates && w.privateCount >= 2)
        return `Hey ${name}! Been thinking about doing more privates lately 👀 You always make them so fun 💕`
      if (w.tipCount >= 20 && w.avgTipSize < 5)
        return `Hey ${name}! I always love seeing your name pop up in chat 💕 Going live soon — come say hi!`
      if (w.avgTipSize >= 20)
        return `Hey ${name}! I was literally just thinking about that amazing tip you sent 🥺 Going live tonight 🔥`
      return `Hey ${name}! I've been thinking about you lately 💕 I'm going live soon and would love to see you there 🔥`
    }

    // 1. STRIKE WHILE HOT — tipped in last 24h AND high tip probability
    whales.forEach(w => {
      const hrs = (now - new Date(w.lastTipDate)) / 3600000
      if (hrs <= 24 && w.tipProbability?.level === 'High') {
        strikeHot.push({
          type: 'strike_hot', icon: '🔥', color: C.orange, severity: 'success',
          title: `Strike while ${w.username} is hot`,
          message: `They tipped in the last 24 hours and their tip probability is high — go live NOW while they're warm`,
          cta: 'Copy Message', username: w.username, whale: w,
          reengageMsg: getPersonalMsg(w)
        })
      }
    })

    // 2. WIN BACK — $50+ lifetime, 45–90 days gone
    whales.filter(w => w.totalUSD >= 50).forEach(w => {
      const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000)
      if (days >= 45 && days <= 90) {
        const name = w.username
        winBack.push({
          type: 'win_back', icon: '💔', color: C.pink, severity: 'warning',
          title: `Win back ${name} — $${w.totalUSD.toFixed(0)} lifetime fan`,
          message: `They spent $${w.totalUSD.toFixed(0)} total but haven't tipped in ${days} days. A personal message could bring them back.`,
          cta: 'Copy Message', username: name, whale: w,
          reengageMsg: `Hey ${name}! I miss you — it's been a while and I just wanted to check in 💕 I'm going live tonight and it would mean a lot to see you there`
        })
      }
    })

    // 3. MILESTONE — within 10% of $50 / $100 / $200 / $500
    const milestones = [50, 100, 200, 500]
    whales.forEach(w => {
      for (const m of milestones) {
        const remaining = m - w.totalUSD
        if (remaining > 0 && remaining <= m * 0.10) {
          milestone.push({
            type: 'milestone', icon: '💰', color: C.gold, severity: 'info',
            title: `${w.username} is $${remaining.toFixed(0)} away from $${m}`,
            message: `They've spent $${w.totalUSD.toFixed(0)} lifetime — a little encouragement could push them to the $${m} milestone`,
            cta: 'Copy Message', username: w.username, whale: w,
            reengageMsg: getPersonalMsg(w)
          })
          break
        }
      }
    })

    // 4. ONLINE NOW / ONLINE SOON
    whales.slice(0, 5).forEach(w => {
      if (w.tipCount < 5) return
      const fanTips = (w.tips && w.tips.length > 0)
        ? w.tips
        : tips.filter(t => t.username.toLowerCase() === w.username.toLowerCase())
      if (fanTips.length < 5) return
      const hourCounts = {}
      fanTips.forEach(t => {
        // FIX: use getUTCHours() — tips stored in UTC
        const h = new Date(t.date_time || t.dateRaw).getUTCHours()
        hourCounts[h] = (hourCounts[h] || 0) + 1
      })
      const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
      if (!bestHour) return
      const peakHour = parseInt(bestHour[0])
      const currentUTCHr = new Date().getUTCHours()
      const hoursAway = (peakHour - currentUTCHr + 24) % 24
      const probability = Math.min(95, Math.round((bestHour[1] / fanTips.length) * 100 * 2.5))
      const label = peakHour === 0 ? '12 AM' : peakHour < 12 ? `${peakHour} AM` : peakHour === 12 ? '12 PM' : `${peakHour - 12} PM`
      if (hoursAway <= 2 && probability >= 40) {
        onlineNow.push({
          type: 'online_now', icon: '🟢', color: C.green, severity: 'success',
          title: `${w.username} is probably online right now`,
          message: `They usually tip around ${label} — ~${probability}% chance they're active. Go live or message now!`,
          cta: 'Copy Message', username: w.username, whale: w,
          reengageMsg: getPersonalMsg(w)
        })
      } else if (hoursAway <= 10 && probability >= 40) {
        onlineNow.push({
          type: 'online_soon', icon: '⏰', color: C.gold, severity: 'warning',
          title: `${w.username} is likely online in ~${hoursAway}h`,
          message: `They typically tip around ${label} (${probability}% probability). Plan your stream around it.`,
          cta: null, username: w.username, whale: w, reengageMsg: ''
        })
      }
    })

    // 5. DORMANT
    whales.filter(w => w.totalUSD >= 20).slice(0, 3).forEach(w => {
      const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000)
      if (days >= 7 && days <= 44) {
        const timeStr = days >= 30 ? `${Math.round(days / 30)} month${days >= 60 ? 's' : ''}` : `${days} days`
        dormant.push({
          type: 'dormant', icon: '💤', color: C.orange, severity: 'warning',
          title: `You haven't heard from ${w.username} in ${timeStr}`,
          message: `They've spent $${w.totalUSD.toFixed(0)} total — send them a message so they know you're thinking of them`,
          cta: 'Copy Message', username: w.username, whale: w,
          reengageMsg: getPersonalMsg(w)
        })
      }
    })

    // 6. PERFORMANCE — best day insight
    const analyticsbestDay = analytics?.bestDay
    if (analyticsbestDay) {
      const avgSession = sessions.length ? sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length : 0
      const bestSessions = sessions.filter(s => s.totalUSD >= avgSession * 1.5)
      const bestDayCount = bestSessions.filter(s =>
        new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'long' }) === analyticsbestDay.day
      ).length
      if (bestDayCount >= 2) {
        performance.push({
          type: 'performance', icon: '📈', color: C.pink, severity: 'info',
          title: `Your best sessions happen on ${analyticsbestDay.day}s`,
          message: `${bestDayCount} of your top-earning streams were on ${analyticsbestDay.day}s. Plan your next high-effort stream for this day`,
          cta: null, reengageMsg: ''
        })
      }
    }

    // Social mention alerts (keep, they're genuinely useful)
    const socialAlerts = []
    const SOCIAL_KEYWORDS = {
      snapchat: /snap\s?chat|snapchat|snap/i,
      instagram: /instagram|insta|ig\b/i,
      twitter: /twitter|x\.com|\bx\b/i,
      onlyfans: /onlyfans|only fans|of\b/i,
    }
    whales.forEach(w => {
      if (!w.tipNotes || w.tipNotes.length === 0) return
      Object.entries(SOCIAL_KEYWORDS).forEach(([platform, regex]) => {
        const matchingNote = w.tipNotes.find(n => regex.test(n))
        if (matchingNote) {
          const usernameMatch = matchingNote.match(/@[\w.]+|(?:my|is|:)\s*([\w.@]+)/i)
          const extractedUser = usernameMatch ? usernameMatch[1] || usernameMatch[0] : null
          socialAlerts.push({
            type: 'social_mention', icon: '📱', color: C.cyan, severity: 'info',
            title: `${w.username} mentioned ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
            message: extractedUser
              ? `They left their ${platform} as "${extractedUser}" in a tip note — add them before you forget!`
              : `They mentioned ${platform} in a tip note — ask them for their handle next time`,
            cta: 'Copy Message', username: w.username, whale: w,
            reengageMsg: getPersonalMsg(w)
          })
        }
      })
    })

    // Merge in priority order, cap at 6
    return [
      ...strikeHot,
      ...winBack,
      ...milestone,
      ...onlineNow,
      ...dormant,
      ...performance,
      ...socialAlerts,
    ].slice(0, 6)
  }

  // ── Build re-engage list outside JSX for the same reason
  const buildReengageList = () => {
    const now = Date.now()
    const messageSets = [
      (name) => `Hey ${name}! I've been thinking about you lately 💕 I'm going live tonight and would love to see your name in the chat 🔥`,
      (name) => `${name}! It's been a minute and honestly I miss you 😊 Jumping on soon — come say hi? 💋`,
      (name) => `Hey love 💕 Just wanted to reach out because I was literally just thinking about you. Going live tonight — hope to see you there!`,
    ]
    return whales
      .filter(w => {
        const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000)
        return days >= 3 && days <= 60 && w.totalUSD >= 10
      })
      .sort((a, b) => b.totalUSD - a.totalUSD)
      .slice(0, 5)
      .map((w, i) => {
        const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000)
        return {
          whale: w,
          days,
          urgency: days > 30 ? C.red : days > 14 ? C.orange : C.gold,
          msg: messageSets[i % messageSets.length](w.username)
        }
      })
  }

  // ============================================================
  // REAL-TIME INTELLIGENCE COMPUTED FROM ACTUAL DB DATA
  // ============================================================

  const buildDailyBrief = () => {
    if (!tips || tips.length === 0 || !analytics) return null
    const now = new Date()
    const utcHour = now.getUTCHours()
    const utcDay = now.getUTCDay()
    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const todayName = DAYS[utcDay]

    // Best hour: today-specific per platform first, then all-time fallback
    // Formula: SUM(usd) / COUNT(DISTINCT hour-bucket) for THIS day of week on THIS platform
    const fmtHour = h => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`
    const platBestTimes = analytics?.platformBestTimes || {}
    let todayBestPlat = null, todayBestHourNum = null, todayBestAvg = 0
    Object.entries(platBestTimes).forEach(([plat, times]) => {
      const todayEntry = times?.bestHourByDay?.[todayName]
      if (todayEntry && todayEntry.avg > todayBestAvg) {
        todayBestAvg = todayEntry.avg
        todayBestHourNum = todayEntry.hour
        todayBestPlat = plat
      }
    })
    const bestHour = analytics?.bestHour
    const bh = todayBestHourNum !== null ? todayBestHourNum : (bestHour ? parseInt(bestHour.hour) : null)
    const bhLabel = bh === null ? null : fmtHour(bh)
    const hoursUntilPeak = bh !== null ? (bh - utcHour + 24) % 24 : null
    const atPeak = hoursUntilPeak === 0 || hoursUntilPeak === 1

    // Best platform per hour
    const platHourUSD = {}; const platHourSessions = {}
    tips.forEach(t => {
      const p = t.platform || 'Chaturbate'
      const d = new Date(t.date_time || t.dateRaw)
      const h = d.getUTCHours()
      const bucket = Math.floor(d.getTime() / 3600000)
      if (!platHourUSD[p]) { platHourUSD[p] = {}; platHourSessions[p] = {} }
      if (!platHourUSD[p][h]) { platHourUSD[p][h] = 0; platHourSessions[p][h] = new Set() }
      platHourUSD[p][h] += t.usd || 0
      platHourSessions[p][h].add(bucket)
    })
    let bestPlatNow = null; let bestPlatNowAvg = 0
    Object.keys(platHourUSD).forEach(plat => {
      const sessions = platHourSessions[plat][utcHour]?.size || 0
      if (sessions === 0) return
      const avg = platHourUSD[plat][utcHour] / sessions
      if (avg > bestPlatNowAvg) { bestPlatNowAvg = avg; bestPlatNow = plat }
    })
    let bestPlatPeak = null; let bestPlatPeakAvg = 0
    if (bh !== null) {
      Object.keys(platHourUSD).forEach(plat => {
        const sessions = platHourSessions[plat][bh]?.size || 0
        if (sessions === 0) return
        const avg = platHourUSD[plat][bh] / sessions
        if (avg > bestPlatPeakAvg) { bestPlatPeakAvg = avg; bestPlatPeak = plat }
      })
    }
    const displayPlat = todayBestPlat || bestPlatPeak || bestPlatNow || 'Chaturbate'
    const displayAvg = todayBestAvg || bestPlatPeakAvg || bestPlatNowAvg || bestHour?.avg || 0

    // Best day
    const bestDay = analytics?.bestDay
    const isBestDay = bestDay?.day === todayName
    const sessionAvg = analytics?.sessions?.length
      ? analytics.sessions.reduce((s, x) => s + x.totalUSD, 0) / analytics.sessions.length : 0

    // Income prediction for peak window
    const sessionsAtPeak = (analytics?.sessions || []).filter(s => {
      const h = new Date(s.startTime).getUTCHours()
      return bh !== null && Math.abs(h - bh) <= 1
    })
    const peakAvg = sessionsAtPeak.length >= 2
      ? sessionsAtPeak.reduce((s, x) => s + x.totalUSD, 0) / sessionsAtPeak.length
      : (bestHour?.avg || sessionAvg)
    const predictionLow = Math.round(peakAvg * 0.6)
    const predictionHigh = Math.round(peakAvg * 1.5)

    // Re-engage list — fans who tip 50+ tokens avg per session, appear in 2+ streams, and are overdue
    // "Every 2-3 streams" = session-level frequency, not tip count
    const SESSION_GAP_MS = 3 * 60 * 60 * 1000
    const reengageFans = (whales || [])
      .filter(w => {
        if (!w.tips || w.tips.length < 2) return false

        // Group this fan's tips into sessions (3hr gap = new session)
        const sorted = [...w.tips].sort((a, b) =>
          new Date(a.date_time || a.dateRaw) - new Date(b.date_time || b.dateRaw)
        )
        const fanSessions = []
        let cur = [sorted[0]]
        for (let i = 1; i < sorted.length; i++) {
          const gap = new Date(sorted[i].date_time || sorted[i].dateRaw) -
                      new Date(sorted[i-1].date_time || sorted[i-1].dateRaw)
          if (gap > SESSION_GAP_MS) { fanSessions.push(cur); cur = [sorted[i]] }
          else cur.push(sorted[i])
        }
        fanSessions.push(cur)

        // Must have appeared in 2+ sessions
        if (fanSessions.length < 2) return false

        // Avg tokens per session must be 50+
        const avgTokensPerSession = fanSessions.reduce((sum, s) =>
          sum + s.reduce((t, tip) => t + (tip.tokens || 0), 0), 0) / fanSessions.length
        if (avgTokensPerSession < 50) return false

        // Calculate avg days between sessions
        const sessionDates = fanSessions.map(s => new Date(s[0].date_time || s[0].dateRaw))
        let totalGap = 0
        for (let i = 1; i < sessionDates.length; i++) {
          totalGap += (sessionDates[i] - sessionDates[i-1]) / 86400000
        }
        const avgDaysBetweenSessions = fanSessions.length > 1 ? totalGap / (fanSessions.length - 1) : 30

        // Must be overdue — gone longer than 1.5x their normal interval
        // (accounts for "every 2-3 streams" — if they stream 2-3x/week that's a few days)
        const daysSince = w.daysSinceLastTip
        const overdueThreshold = Math.max(avgDaysBetweenSessions * 1.5, 3)
        return daysSince >= overdueThreshold
      })
      .sort((a, b) => b.totalUSD - a.totalUSD)
      .slice(0, 5)

    // Likely online right now
    const likelyOnline = (whales || [])
      .filter(w => {
        if (!w.tips || w.tips.length < 3) return false
        const hc = {}
        w.tips.forEach(t => { const h = new Date(t.date_time || t.dateRaw).getUTCHours(); hc[h] = (hc[h] || 0) + 1 })
        const peakH = parseInt(Object.entries(hc).sort((a,b) => b[1]-a[1])[0][0])
        return (peakH - utcHour + 24) % 24 <= 1
      })
      .sort((a, b) => b.totalUSD - a.totalUSD)
      .slice(0, 3)

    const platTodayStats = {}
    Object.entries(platBestTimes).forEach(([plat, times]) => {
      const todayHour = times?.bestHourByDay?.[todayName]
      const bestDayEntry = times?.bestDay
      platTodayStats[plat] = {
        todayBestHour: todayHour ? fmtHour(todayHour.hour) : null,
        todayBestAvg: todayHour?.avg || 0,
        bestDay: bestDayEntry?.day || null,
        bestDayAvg: bestDayEntry?.avg || 0,
        overallBestHour: times?.hour ? fmtHour(times.hour.hour) : null,
        overallBestHourAvg: times?.hour?.avg || 0,
      }
    })
    return { todayName, bhLabel, bh, atPeak, hoursUntilPeak, displayPlat, displayAvg,
      isBestDay, bestDay, sessionAvg, peakAvg, predictionLow, predictionHigh,
      reengageFans, likelyOnline, platTodayStats }
  }

  const buildRealTimeAlerts = () => {
    const now = Date.now()
    const alertCurrentHour = new Date().getUTCHours()
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    const alerts = []

    // --- PLATFORM DAY-OF-WEEK PERFORMANCE ---
    // Use UTC day to avoid timezone shifts (DB stores UTC timestamps)
    const UTC_DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const platDayMap = {}
    tips.forEach(t => {
      const p = t.platform
      const d = new Date(t.date_time || t.dateRaw)
      const day = UTC_DAYS_LONG[d.getUTCDay()]
      if (!platDayMap[p]) platDayMap[p] = {}
      if (!platDayMap[p][day]) platDayMap[p][day] = 0
      platDayMap[p][day] += t.usd || 0
    })

    // Find best day per platform
    const platBestDay = {}
    Object.entries(platDayMap).forEach(([plat, days]) => {
      const sorted = Object.entries(days).sort((a, b) => b[1] - a[1])
      if (sorted.length > 0) platBestDay[plat] = { day: sorted[0][0], usd: sorted[0][1] }
    })

    // "Best day of the week" alert — fire if today is the best day for any platform
    Object.entries(platBestDay).forEach(([plat, { day, usd }]) => {
      if (day === currentDay) {
        const otherPlat = Object.entries(platBestDay).find(([p]) => p !== plat)
        const comparison = otherPlat
          ? ` — ${(usd / Math.max(otherPlat[1].usd, 1)).toFixed(1)}x more than ${otherPlat[0]}`
          : ''
        alerts.push({
          type: 'best_day', priority: 0, icon: '📅', color: '#F59E0B',
          title: `${currentDay} is your best day on ${plat}`,
          message: `You earn more on ${plat} on ${currentDay}s than any other day${comparison}. Go live now.`
        })
      }
    })

    // --- PLATFORM vs PLATFORM HOUR COMPARISON ---
    // FIX: use avg USD per hour-session (not raw cumulative totals)
    // FIX: use getUTCHours() — tips are stored in UTC
    const platHourUSD = {}; const platHourSessions = {}
    tips.forEach(t => {
      const p = t.platform
      const d = new Date(t.date_time || t.dateRaw)
      // Floor to UTC hour-bucket key for deduplication
      const bucketKey = Math.floor(d.getTime() / 3600000)
      const h = d.getUTCHours()
      if (!platHourUSD[p]) { platHourUSD[p] = {}; platHourSessions[p] = {} }
      if (!platHourUSD[p][h]) { platHourUSD[p][h] = 0; platHourSessions[p][h] = new Set() }
      platHourUSD[p][h] += t.usd || 0
      platHourSessions[p][h].add(bucketKey)
    })
    // Compute avg per session at each UTC hour per platform
    const platHourAvg = {}
    Object.keys(platHourUSD).forEach(p => {
      platHourAvg[p] = {}
      Object.keys(platHourUSD[p]).forEach(h => {
        const sessions = platHourSessions[p][h].size || 1
        platHourAvg[p][h] = platHourUSD[p][h] / sessions
      })
    })

    const platNames = Object.keys(platHourAvg)
    // Use UTC current hour to match stored data
    const currentUTCHour = new Date().getUTCHours()
    if (platNames.length >= 2) {
      platNames.forEach(plat => {
        const hourVal = platHourAvg[plat][currentUTCHour] || 0
        const otherPlats = platNames.filter(p => p !== plat)
        otherPlats.forEach(other => {
          const otherVal = platHourAvg[other][currentUTCHour] || 0
          if (hourVal > 0 && otherVal > 0 && hourVal >= otherVal * 1.5) {
            const mult = (hourVal / otherVal).toFixed(1)
            const label = currentUTCHour === 0 ? '12 AM' : currentUTCHour < 12 ? `${currentUTCHour} AM` : currentUTCHour === 12 ? '12 PM' : `${currentUTCHour - 12} PM`
            alerts.push({
              type: 'platform_hour', priority: 1, icon: '⚡', color: '#22D3EE',
              title: `Right now ${plat} earns ${mult}x more than ${other}`,
              message: `At ${label} UTC, ${plat} historically averages $${hourVal.toFixed(0)} vs $${otherVal.toFixed(0)} on ${other}. Stream on ${plat} now.`
            })
          }
        })
      })
    }

    // --- TOP WHALE LIKELY ONLINE ---
    // Uses actual peak hour from their tip history
    const topWhales = [...whales].sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 5)
    topWhales.forEach(w => {
      const fanTips = (w.tips && w.tips.length > 0)
        ? w.tips
        : tips.filter(t => t.username.toLowerCase() === w.username.toLowerCase())
      if (fanTips.length < 3) return

      // FIX: use getUTCHours() — tips stored in UTC
      const hourCounts = {}
      fanTips.forEach(t => {
        const h = new Date(t.date_time || t.dateRaw).getUTCHours()
        hourCounts[h] = (hourCounts[h] || 0) + 1
      })
      const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])
      if (!sortedHours.length) return

      const peakHour = parseInt(sortedHours[0][0])
      const hoursAway = (peakHour - new Date().getUTCHours() + 24) % 24
      const confidence = Math.min(95, Math.round((sortedHours[0][1] / fanTips.length) * 100 * 2.5))
      const label = peakHour === 0 ? '12 AM' : peakHour < 12 ? `${peakHour} AM` : peakHour === 12 ? '12 PM' : `${peakHour - 12} PM`
      const daysSince = Math.floor((now - new Date(w.lastTipDate)) / 86400000)

      if (hoursAway === 0 || hoursAway === 1) {
        alerts.push({
          type: 'whale_online_now', priority: 0, icon: '🟢', color: '#10B981',
          title: `${w.username} is likely online RIGHT NOW on ${w.platform}`,
          message: `Your #${topWhales.indexOf(w)+1} tipper ($${w.totalUSD.toFixed(0)} lifetime) peaks at ${label} — go live on ${w.platform} immediately. ${daysSince > 0 ? `They haven't tipped in ${daysSince} days.` : 'They tipped recently!'}`
        })
      } else if (hoursAway <= 3) {
        alerts.push({
          type: 'whale_online_soon', priority: 1, icon: '⏰', color: '#F59E0B',
          title: `${w.username} likely online in ~${hoursAway}h on ${w.platform}`,
          message: `Your top whale peaks at ${label} with ${confidence}% confidence. Prep your stream on ${w.platform} — they've spent $${w.totalUSD.toFixed(0)} with you.`
        })
      }
    })

    // --- PLATFORM DOMINANCE ALERT ---
    const platTotals = {}
    tips.forEach(t => {
      platTotals[t.platform] = (platTotals[t.platform] || 0) + (t.usd || 0)
    })
    const sortedPlats = Object.entries(platTotals).sort((a, b) => b[1] - a[1])
    if (sortedPlats.length >= 2) {
      const [topPlat, topUSD] = sortedPlats[0]
      const [bottomPlat, bottomUSD] = sortedPlats[sortedPlats.length - 1]
      if (bottomUSD > 0) {
        const mult = (topUSD / bottomUSD).toFixed(1)
        alerts.push({
          type: 'platform_dominance', priority: 2, icon: '🏆', color: '#F59E0B',
          title: `${topPlat} earns ${mult}x more than ${bottomPlat} overall`,
          message: `$${topUSD.toFixed(0)} on ${topPlat} vs $${bottomUSD.toFixed(0)} on ${bottomPlat} all time. Your time on ${topPlat} is ${mult}x more valuable.`
        })
      }
    }

    return alerts.sort((a, b) => a.priority - b.priority).slice(0, 6)
  }

  const whatsNextAlerts = buildWhatsNextAlerts()
  const reengageList = buildReengageList()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dailyBrief = buildDailyBrief() // re-runs every minuteTick
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const realTimeAlerts = buildRealTimeAlerts() // re-runs every minuteTick
  void minuteTick // ensures re-render when minute changes


  return {
    // Auth + user
    user, loading,
    // Data
    tips, analytics, liveAnalytics, sessions, whales, insights, platforms,
    // Computed metrics
    totalRevenue, avgPerHour, returningPct, fansActiveLast30, thisMonthRev,
    forecast, tokenRates, tipperNotes, userGoals,
    // Platform analytics
    platformVelocity, platformBestTimes, earningsVelocity, missedRevenueByPlat,
    returningVsNew, topFanDependency,
    // AI/computed
    whatsNextAlerts, reengageList, dailyBrief, realTimeAlerts,
    // Upload state
    uploading, uploadPlatform, uploadCount, setUploadPlatform,
    // Live mode
    liveSession, liveTips, liveElapsed, liveLoading,
    setLiveSession, setLiveTips, setLiveElapsed,
    // UI state
    activeTab, toast, messageTarget, messageIndex, messageCopied,
    selectedSession, noteTarget, noteText, noteSaving,
    chartDrillDay, shareModalOpen, goalModalOpen, betaModalOpen,
    onboardingStep, showOnboarding, titleInput, titlePlatform, generatedTitles,
    tokenRateInputs, liveGoalTokens, livePlatform, liveTipsInput, liveNotes,
    minuteTick, fanSearchQuery, fanSearchResults, fanSearchLoading,
    // Setters
    setActiveTab, setMessageTarget, setMessageIndex, setMessageCopied,
    setSelectedSession, setNoteTarget, setNoteText,
    setChartDrillDay, setShareModalOpen, setGoalModalOpen, setBetaModalOpen,
    setOnboardingStep, setShowOnboarding, setTitleInput, setTitlePlatform,
    setGeneratedTitles, setTokenRateInputs, setLiveGoalTokens, setLivePlatform,
    setLiveTipsInput, setLiveNotes, setFanSearchQuery, setFanSearchResults,
    // Actions
    handleTabChange, loadData, saveTipperNote, showToast,
    handleLiveStart, handleLiveSaveTip, handleLiveEnd,
    handleGenerateTitles, handleFanSearch,
  }
}
