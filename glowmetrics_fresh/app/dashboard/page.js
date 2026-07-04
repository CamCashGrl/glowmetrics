"use client"
import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { parseCSV, aggregateRows as runEngine } from "../../lib/analytics"
import dynamic from "next/dynamic"
import Sidebar from "./Sidebar"
import SiteFooter from "../components/SiteFooter"
import { PLATFORM_TOKEN_RATES } from "../../lib/constants"
import { track as gtmTrack } from '../../lib/track'
import { getDashboardReadiness, getModuleLockState, LockedInsightCard, DashboardProgressCard } from './DashboardPreview'
import { C, TIER_COLORS, glassCard, formatHour, TAB_LOADING } from './dashboardTheme'

// Tab-only components loaded on demand instead of in the initial dashboard
// bundle — each is only ever rendered behind an `activeTab === '...'` check,
// and StreamPlanner/MoneyMap alone pull in all of recharts.
const AnalyticsCharts = dynamic(() => import('./AnalyticsCharts'), { ssr: false, loading: () => TAB_LOADING })
const StreamPlanner = dynamic(() => import('./StreamPlanner'), { ssr: false, loading: () => TAB_LOADING })
const MoneyMap = dynamic(() => import('./MoneyMap'), { ssr: false, loading: () => TAB_LOADING })
const TitleGenerator = dynamic(() => import('./TitleGenerator'), { ssr: false, loading: () => TAB_LOADING })
const PlatformsTab = dynamic(() => import('./PlatformsTab'), { ssr: false, loading: () => TAB_LOADING })
const WhalesTab = dynamic(() => import('./WhalesTab'), { ssr: false, loading: () => TAB_LOADING })
const LiveTab = dynamic(() => import('./LiveTab'), { ssr: false, loading: () => TAB_LOADING })
const SessionsTab = dynamic(() => import('./SessionsTab'), { ssr: false, loading: () => TAB_LOADING })
const DataTab = dynamic(() => import('./DataTab'), { ssr: false, loading: () => TAB_LOADING })
const UploadTab = dynamic(() => import('./UploadTab'), { ssr: false, loading: () => TAB_LOADING })
const MonthlyTab = dynamic(() => import('./MonthlyTab'), { ssr: false, loading: () => TAB_LOADING })
const HelpTab = dynamic(() => import('./HelpTab'), { ssr: false, loading: () => TAB_LOADING })

// Analytics tracking — works whether or not @vercel/analytics is installed
let track = (event, props) => {}
try { track = require("@vercel/analytics").track } catch (e) {}

function CopyButton({ text, label = "📋 Copy", copiedLabel = "✅ Copied!", style = {} }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      style={{
        padding: "7px 14px", borderRadius: 8,
        background: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${copied ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)"}`,
        color: copied ? C.green : C.muted,
        fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
        ...style
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  )
}

export default function Dashboard() {
  const router = useRouter()
  // Open directly to a specific tab when ?tab=X is in the URL
  const initialTab = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('tab') || localStorage.getItem('camcash_tab') || 'overview')
    : 'overview'
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tips, setTips] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [liveAnalytics, setLiveAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadPlatform, setUploadPlatform] = useState("")
  const [activeTab, setActiveTab] = useState(initialTab)
  const [toast, setToast] = useState("")
  const [uploadCount, setUploadCount] = useState(0)
  const [whaleFilter, setWhaleFilter] = useState("ALL")
  const [platformFilter, setPlatformFilter] = useState("ALL")
  const [meaningfulOnly, setMeaningfulOnly] = useState(true)
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
  const [tokenRates, setTokenRates] = useState({ ...PLATFORM_TOKEN_RATES })
  const [showRateEditor, setShowRateEditor] = useState(false)
  // ── ROUND 1 FEATURES ─────────────────────────────────────────────
  const [monthlyGoal, setMonthlyGoal] = useState(null)
  const [goalInput, setGoalInput] = useState('')
  const [showGoalEditor, setShowGoalEditor] = useState(false)
  const [tipperNotes, setTipperNotes] = useState({}) // { username: { note, followUp } }
  const [noteTarget, setNoteTarget] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [engineInsights, setEngineInsights] = useState(null)

  // ── ANIMATION STATE ──────────────────────────────────────
  const [counterBumping, setCounterBumping] = useState(false)
  const [lastUpdatedSection, setLastUpdatedSection] = useState(null)
  const [newAlertKey, setNewAlertKey] = useState(0)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [newTipCount, setNewTipCount] = useState(0)
  const [flashTipId, setFlashTipId] = useState(null)   // for new-tip highlight animation
  const prevTipCountRef = useRef(0)
  const realtimeChannelRef = useRef(null)
  const liveTipsChannelRef = useRef(null)
  const refreshTimerRef = useRef(null)
  const liveTickerRef = useRef(null)
  // ── LIVE MODE INTELLIGENCE ────────────────────────────────────────────
  const [liveStrategy, setLiveStrategy]       = useState('balanced')
  const [coachingHistory, setCoachingHistory] = useState([])
  const prevPhaseRef       = useRef(null)
  const isHydratingHistory = useRef(false)
  const processedTipIds    = useRef(new Set())
  const coachingCooldowns  = useRef({})
  const firedAlertsLog     = useRef([])
  const phaseChangeLog     = useRef([])

  const isBetaUser = true
  const isPro = profile?.plan === 'pro' || profile?.plan === 'unlimited'
  const uploadLimit = Infinity

  const fmtHour = h => { if (h == null || isNaN(h)) return 'N/A'; return h === 0 ? '12 AM' : h < 12 ? h+' AM' : h === 12 ? '12 PM' : (h-12)+' PM' }

  const openUpgradeModal = (source) => {
    track('upgrade_click', { source })
    gtmTrack('paywall_hit', { feature: source })
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
    gtmTrack('tab_switched', { tab_name: tab })
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

      // Deduplication: extension may fire the same event twice on reload
      const dedupKey = tipEvent.id || `${tipEvent.username}:${tipEvent.tokens}:${tipEvent.timestamp}`
      if (processedTipIds.current.has(dedupKey)) return
      processedTipIds.current.add(dedupKey)

      const rate    = 0.05
      const tokens  = parseInt(tipEvent.tokens) || 0
      const usd     = parseFloat(tipEvent.usd)  || 0
      const normalized = {
        _id:              dedupKey,
        _isHistory:       false,
        username:         tipEvent.username,
        tokens,
        usd,
        normalizedRevenue: usd > 0 ? usd : parseFloat((tokens * rate).toFixed(2)),
        sourceUsed:       usd > 0 ? 'usd' : 'tokens',
        timestamp:        new Date(tipEvent.timestamp || Date.now()),
        platform:         tipEvent.platform || 'Unknown',
        source:           'extension',
      }
      setLiveEvents(prev => [...prev, normalized])
      // Auto-activate live mode on first real tip
      setLiveActive(active => {
        if (!active) setLiveStartTime(prev => prev || new Date())
        return true
      })
    }
    window.addEventListener('message', handleExtensionMessage)
    return () => window.removeEventListener('message', handleExtensionMessage)
  }, [])

  // ── LIVE TIPS: historical hydration + realtime subscription ─────────────
  // Runs whenever the live tab is opened and a user is present.
  // SAFETY RULES:
  //   1. Singleton — only one channel ever; skips if already subscribed
  //   2. isHydratingHistory.current = true during the initial DB query so
  //      coaching / alerts / animations are suppressed for stale data
  //   3. Every event is checked against processedTipIds before processing
  //   4. Historical events get _isHistory:true so computeState() excludes
  //      them from timing/pace calculations (only uses them for totals)
  useEffect(() => {
    if (activeTab !== 'live' || !user) return
    if (liveTipsChannelRef.current) return // singleton guard

    isHydratingHistory.current = true
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

    supabase
      .from('live_tips')
      .select('*')
      .eq('user_id', user.id)
      .gte('received_at', since)
      .order('received_at', { ascending: true })
      .then(({ data }) => {
        if (data?.length) {
          const normalized = data.map(tip => {
            const id = tip.id
            processedTipIds.current.add(id)
            return {
              _id:              id,
              _isHistory:       true,
              username:         tip.username || 'Unknown',
              tokens:           parseInt(tip.tokens) || 0,
              usd:              parseFloat(tip.usd) || 0,
              normalizedRevenue: parseFloat(tip.usd) || parseFloat(((tip.tokens || 0) * 0.05).toFixed(2)),
              sourceUsed:       tip.source || 'extension',
              timestamp:        new Date(tip.received_at),
              platform:         tip.platform || 'extension',
              source:           'history',
            }
          })
          setLiveEvents(prev => {
            const existingIds = new Set(prev.map(e => e._id).filter(Boolean))
            return [...prev, ...normalized.filter(t => !existingIds.has(t._id))]
          })
        }
        isHydratingHistory.current = false
      })

    const channel = supabase
      .channel(`live_tips_dash_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'live_tips',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (isHydratingHistory.current) return
        const tip = payload.new
        if (!tip?.id) return
        if (processedTipIds.current.has(tip.id)) return
        processedTipIds.current.add(tip.id)

        const normalized = {
          _id:              tip.id,
          _isHistory:       false,
          username:         tip.username || 'Unknown',
          tokens:           parseInt(tip.tokens) || 0,
          usd:              parseFloat(tip.usd) || 0,
          normalizedRevenue: parseFloat(tip.usd) || parseFloat(((tip.tokens || 0) * 0.05).toFixed(2)),
          sourceUsed:       tip.source || 'extension',
          timestamp:        new Date(tip.received_at),
          platform:         tip.platform || 'extension',
          source:           'extension',
        }
        setLiveEvents(prev => [...prev, normalized])
        setLiveActive(prev => {
          if (!prev) setLiveStartTime(st => st || new Date())
          return true
        })
      })
      .subscribe()

    liveTipsChannelRef.current = channel

    return () => {
      if (liveTipsChannelRef.current) {
        supabase.removeChannel(liveTipsChannelRef.current)
        liveTipsChannelRef.current = null
      }
      isHydratingHistory.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user])

  useEffect(() => {
    // Restore saved tab
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('camcash_tab')
      if (saved) setActiveTab(saved)
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return }
      setUser(user)
      supabase.from('profiles')
        .select('plan')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => { if (data) setProfile(data) })
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
            try { const userTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'; const r = runEngine(updated, userTz); if(r) setAnalytics(r) } catch(e) { console.error('realtime runEngine failed:', e) }
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

      // ── EXTENSION LIVE TIPS — realtime feed from chrome extension sync ──
      const liveTipsChannel = supabase
        .channel(`live_tips_ext_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'live_tips',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          const tip = payload.new
          const tokens = parseInt(tip.tokens) || 0
          const usd = parseFloat(tip.usd) || parseFloat((tokens * 0.05).toFixed(2))
          const normalized = {
            username: tip.username || 'Unknown',
            tokens, usd,
            normalizedRevenue: usd,
            sourceUsed: 'extension',
            timestamp: new Date(tip.received_at || Date.now()),
            platform: tip.platform || 'chaturbate',
            _id: tip.id || Date.now(),
          }
          setLiveActive(true)
          setLiveStartTime(prev => prev || new Date())
          setLiveEvents(prev => [...prev, normalized])
          // Flash animation: highlight the new tip row for 2.5s
          setFlashTipId(normalized._id)
          setTimeout(() => setFlashTipId(null), 2500)
          // Switch to Live Mode tab automatically if user is on another tab
          setActiveTab('live')
        })
        .subscribe()
      liveTipsChannelRef.current = liveTipsChannel

      // ── LIGHTWEIGHT 30s analytics re-run (NO DB calls — just re-runs engine on cached data)
      // Full reloads only happen on: initial load, CSV upload, focus after 5+ min away
      refreshTimerRef.current = setInterval(() => {
        setTips(prev => {
          if (!prev.length) return prev
          try { const userTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'; const r = runEngine(prev, userTz); if(r) setAnalytics(r) } catch(e) { console.error('refresh runEngine failed:', e) }
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
      if (liveTipsChannelRef.current) supabase.removeChannel(liveTipsChannelRef.current)
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

  // ── LIVE MODE: load existing tips when tab is activated ───────────────────
  useEffect(() => {
    if (activeTab !== 'live' || !user) return
    let cancelled = false

    const loadRecentLiveTips = async () => {
      // Load tips from the last 12 hours so the session has real context
      const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('live_tips')
        .select('*')
        .eq('user_id', user.id)
        .gte('received_at', since)
        .order('received_at', { ascending: true })

      if (cancelled || error || !data || data.length === 0) return

      const normalized = data.map(tip => ({
        username:          tip.username || 'Unknown',
        tokens:            parseInt(tip.tokens) || 0,
        usd:               parseFloat(tip.usd) || parseFloat(((tip.tokens || 0) * 0.05).toFixed(2)),
        normalizedRevenue: parseFloat(tip.usd) || parseFloat(((tip.tokens || 0) * 0.05).toFixed(2)),
        sourceUsed:        tip.source || 'extension',
        timestamp:         new Date(tip.received_at),
        platform:          tip.platform || 'chaturbate',
      }))

      setLiveEvents(normalized)
      setLiveActive(true)
      // Use earliest tip as session start so pace/coaching calculations are accurate
      setLiveStartTime(prev => prev || new Date(data[0].received_at))
    }

    loadRecentLiveTips()
    return () => { cancelled = true }
  }, [activeTab, user])

  // ── LIVE TICKER: 1-second interval drives time-based re-renders ─────────────
  // Without this, computeState() / getAlerts() / coaching never update because
  // React only re-renders on state changes — Date.now() alone is not enough.
  useEffect(() => {
    if (activeTab === 'live' && liveActive) {
      liveTickerRef.current = setInterval(() => setLiveTick(t => t + 1), 1000)
    } else {
      clearInterval(liveTickerRef.current)
    }
    return () => clearInterval(liveTickerRef.current)
  }, [activeTab, liveActive])

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
          const userTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
          const result = runEngine(allData, userTz)
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
      const { data: engineData } = await supabase.rpc('get_user_insights', { p_user_id: uid })
      setEngineInsights(engineData)
      setLastRefreshed(new Date())
    } finally { setLoading(false) }
  }
const handleCSV = async (file, forcePlatform = null) => {
    if (!file || !user) return
    // Free plan tracks a single platform — block explicit uploads for a different platform
    if (freePlatformLimitReached && forcePlatform && !allPlatforms.includes(forcePlatform)) {
      showToast("🔒 Free plan tracks 1 platform. Upgrade to Pro to add another (see sidebar).")
      return
    }
    setUploading(true)
    gtmTrack('csv_upload_started', { platform: forcePlatform || uploadPlatform || 'unknown' })
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
      gtmTrack('csv_upload_success', { platform: result.platform || 'unknown', row_count: result.inserted })

      const msg = result.skipped > 0
        ? `✅ Imported ${result.inserted} tips (${result.skipped} duplicates skipped)`
        : `✅ Imported ${result.inserted} tips from ${result.platform}!`
      showToast(msg)

      // Google Ads — CSV Upload conversion
      try {
        if (typeof window.gtag !== 'undefined') {
          window.gtag('event', 'conversion', {
            'send_to': 'AW-18107430539/5qolCPeRnLMcEIvtpbpD',
            'value': 0.0,
            'currency': 'USD'
          })
        }
      } catch(e) {}

      setUploadCount(c => c + 1)
      if (typeof window !== 'undefined') localStorage.setItem('camcash_onboarded', '1')
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
  // timedSessions kept for sparkline/MoM trend calculations only (not for avg $/hr)
  const timedSessions = sessions.filter(s => !s.durationUnknown && (s.durationMinutes || 0) >= 20)
  const timedTotalUSD = timedSessions.reduce((sum, s) => sum + (s.totalUSD || 0), 0)
  const timedTotalHours = timedSessions.reduce((sum, s) => sum + (s.durationHours || 0), 0)
  // Single canonical $/hr — uses analytics.earningsVelocity (totalUSD / totalHours across all
  // meaningful sessions) so the header, KPI card, and "Overall" chip all show the same number.
  const avgPerHour = analytics?.earningsVelocity ?? (timedTotalHours > 0 ? timedTotalUSD / timedTotalHours : 0)
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
  const freePlatformLimitReached = !isPro && allPlatforms.length > 0

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
    // Exclude fans gone > 90 days: they belong in At Risk, not Close to Milestone
    const milestones = [50, 100, 200, 500]
    whales.forEach(w => {
      const daysSinceMilestone = Math.floor((now - new Date(w.lastTipDate)) / 86400000)
      if (daysSinceMilestone > 90) return
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
      const _pf0 = bestHour[1] / fanTips.length
      const _pd0 = hoursAway === 0 ? 1.0 : hoursAway === 1 ? 0.65 : 0.35
      const probability = Math.min(90, Math.max(25, Math.round(_pf0 * 200 * _pd0)))
      const label = (() => { const _off=new Date().getTimezoneOffset()/-60; const _lh=Math.round(((peakHour+_off)%24+24)%24); return _lh===0?'12 AM':_lh<12?`${_lh} AM`:_lh===12?'12 PM':`${_lh-12} PM` })()
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
    const utcHour = now.getHours() // local hour — analytics hours are already local
    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const todayName = DAYS[now.getDay()] // local day of week

    // Best hour: today-specific per platform first, then all-time fallback
    // Formula: SUM(usd) / COUNT(DISTINCT hour-bucket) for THIS day of week on THIS platform
    // bestHour values from analytics are already local hours — format directly, no offset
    const fmtHour = h => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
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
    const _bhRaw = todayBestHourNum !== null ? todayBestHourNum : (bestHour ? parseInt(bestHour.hour) : null)
    const bh = (_bhRaw !== null && !isNaN(_bhRaw)) ? _bhRaw : null
    const bhLabel = bh === null ? null : fmtHour(bh)
    const hoursUntilPeak = bh !== null ? (bh - utcHour + 24) % 24 : null
    const atPeak = hoursUntilPeak === 0 || hoursUntilPeak === 1

    // Best platform per hour
    const platHourUSD = {}; const platHourSessions = {}
    tips.forEach(t => {
      const p = t.platform || 'Chaturbate'
      const d = new Date(t.date_time || t.dateRaw)
      const h = d.getHours() // local hour to match analytics.js toLocalHour
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

    // Income prediction for peak window — use median-based displayAvg as single source of truth
    const sessionsAtPeak = (analytics?.sessions || []).filter(s => {
      const h = new Date(s.startTime).getHours() // local hour
      return bh !== null && Math.abs(h - bh) <= 1
    })
    const peakAvg = displayAvg || bestHour?.avg || sessionAvg
    const predictionLow = Math.max(0, Math.round(peakAvg - (peakAvg * 0.4)))
    const predictionHigh = Math.round(peakAvg + (peakAvg * 0.4))

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
        // Cap at 90 days: beyond that the fan is "At Risk", not "Re-engage"
        return daysSince >= overdueThreshold && daysSince <= 90
      })
      .sort((a, b) => b.totalUSD - a.totalUSD)
      .slice(0, 5)

    // Likely online right now
    const likelyOnline = (whales || [])
      .filter(w => {
        if (!w.tips || w.tips.length < 3) return false
        if (w.totalUSD < 3) return false
        const hc = {}
        w.tips.forEach(t => { const h = new Date(t.date_time || t.dateRaw).getUTCHours(); hc[h] = (hc[h] || 0) + 1 })
        const peakH = parseInt(Object.entries(hc).sort((a,b) => b[1]-a[1])[0][0])
        return (peakH - utcHour + 24) % 24 <= 1
      })
      .sort((a, b) => b.totalUSD - a.totalUSD)
      .slice(0, 3)

    return { todayName, bhLabel, bh, atPeak, hoursUntilPeak, displayPlat, displayAvg,
      isBestDay, bestDay, sessionAvg, peakAvg, predictionLow, predictionHigh,
      reengageFans, likelyOnline, sessionsAtPeakCount: sessionsAtPeak.length }
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
            const label = (() => { const _off=new Date().getTimezoneOffset()/-60; const _lh=Math.round(((currentUTCHour+_off)%24+24)%24); return _lh===0?'12 AM':_lh<12?`${_lh} AM`:_lh===12?'12 PM':`${_lh-12} PM` })()
            alerts.push({
              type: 'platform_hour', priority: 1, icon: '⚡', color: '#22D3EE',
              title: `Right now ${plat} earns ${mult}x more than ${other}`,
              message: `At ${label}, ${plat} historically averages $${hourVal.toFixed(0)} vs $${otherVal.toFixed(0)} on ${other}. Stream on ${plat} now.`
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

      // Use local hours — tips' date_time is UTC but getHours() converts to browser local
      const hourCounts = {}
      fanTips.forEach(t => {
        const h = new Date(t.date_time || t.dateRaw).getHours() // local hour
        hourCounts[h] = (hourCounts[h] || 0) + 1
      })
      const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])
      if (!sortedHours.length) return

      const peakHour = parseInt(sortedHours[0][0]) // already local
      const hoursAway = (peakHour - new Date().getHours() + 24) % 24
      const _pf1 = sortedHours[0][1] / fanTips.length
      const _pd1 = hoursAway === 0 ? 1.0 : hoursAway === 1 ? 0.65 : 0.35
      const confidence = Math.min(90, Math.max(25, Math.round(_pf1 * 200 * _pd1)))
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

  // ── CANONICAL PEAK HOUR ──────────────────────────────────────────────────────
  // Single source of truth used by the header, Daily Brief, and Losing Money.
  // Prefer engineInsights daily_plan (most specific), then today's analytics best
  // hour from dailyBrief, then the all-time analytics best hour as final fallback.
  const canonicalPeakHourUTC = (
    engineInsights?.daily_plan?.best_hour ??
    dailyBrief?.bh ??
    (analytics?.bestHour ? parseInt(analytics.bestHour.hour) : null)
  )
  const canonicalPeakLabel = canonicalPeakHourUTC != null
    ? (() => { const _off = new Date().getTimezoneOffset()/-60; const _lh = Math.round(((canonicalPeakHourUTC+_off)%24+24)%24); return _lh===0?'12 AM':_lh<12?`${_lh} AM`:_lh===12?'12 PM':`${_lh-12} PM` })()
    : null

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const realTimeAlerts = buildRealTimeAlerts() // re-runs every minuteTick
  void minuteTick // ensures re-render when minute changes

  // ── MONTH-OVER-MONTH GROWTH ── used by Momentum indicator and KPI cards
  const _momNow = new Date()
  const _momThisStart = new Date(Date.UTC(_momNow.getUTCFullYear(), _momNow.getUTCMonth(), 1))
  const _momPrevStart = new Date(Date.UTC(_momNow.getUTCFullYear(), _momNow.getUTCMonth() - 1, 1))
  const _momThisRev = tips.reduce((s, t) => new Date(t.date_time || t.dateRaw) >= _momThisStart ? s + (t.usd || 0) : s, 0)
  const _momPrevRev = tips.reduce((s, t) => { const d = new Date(t.date_time || t.dateRaw); return d >= _momPrevStart && d < _momThisStart ? s + (t.usd || 0) : s }, 0)
  const growthPct = (_momPrevRev > 0 && _momThisRev > 0) ? Math.round(((_momThisRev - _momPrevRev) / _momPrevRev) * 100) : null

  // ── DASHBOARD READINESS — always renders real dashboard, module-level locking ─
  const _drDates      = tips.map(t => new Date(t.date_time || t.dateRaw)).filter(d => !isNaN(d)).sort((a, b) => a - b)
  const _drRangeDays  = _drDates.length >= 2 ? Math.round((_drDates[_drDates.length - 1] - _drDates[0]) / 86400000) : 0
  const _drStreamDays = new Set(_drDates.map(d => d.toDateString())).size
  const _drPlatCount  = [...new Set(tips.map(t => t.platform).filter(p => p && p !== 'Unknown'))].length
  const dashboardReadiness = getDashboardReadiness({
    totalTips:     tips.length,
    totalSessions: analytics?.meaningfulSessionCount || 0,
    totalFans:     analytics?.uniqueFanCount || [...new Set(tips.map(t => (t.username || '').toLowerCase()).filter(Boolean))].length,
    totalEarnings: analytics?.totalUSD || 0,
    dateRangeDays: _drRangeDays,
    streamDays:    _drStreamDays,
  })
  const _isLowData   = dashboardReadiness !== 'ready'
  const _modLockArgs = { totalTips: tips.length, totalSessions: analytics?.meaningfulSessionCount || 0, totalFans: analytics?.uniqueFanCount || 0, totalEarnings: analytics?.totalUSD || 0, totalStreamMinutes: analytics?.totalStreamMinutes || 0, importedPlatformCount: _drPlatCount, isPro, liveModeSessions: 0 }
  const _plannerLock  = getModuleLockState({ module: 'streamPlanner',  ..._modLockArgs })
  const _moneyMapLock = getModuleLockState({ module: 'moneyMap',       ..._modLockArgs })

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
        .whale-row { transition: background 0.15s, transform 0.12s ease; }
        .whale-row:hover { background: rgba(59,130,246,0.08) !important; transform: translateX(2px); }
        @keyframes pulse-msg { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.25); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── ALERT ANIMATIONS ── */
        @keyframes alertEnter {
          0%   { opacity: 0; transform: translateY(-10px) scale(0.97); }
          60%  { opacity: 1; transform: translateY(1px) scale(1.01); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes alertExit {
          0%   { opacity: 1; transform: translateY(0) scale(1); max-height: 200px; margin-bottom: 8px; }
          100% { opacity: 0; transform: translateY(6px) scale(0.97); max-height: 0; margin-bottom: 0; padding: 0; }
        }
        @keyframes alertPulseCritical {
          0%   { box-shadow: 0 0 0 0 rgba(248,113,113,0.45); }
          50%  { box-shadow: 0 0 0 8px rgba(248,113,113,0); }
          100% { box-shadow: 0 0 0 0 rgba(248,113,113,0); }
        }
        @keyframes alertPulseWarning {
          0%   { box-shadow: 0 0 0 0 rgba(251,146,60,0.4); }
          50%  { box-shadow: 0 0 0 7px rgba(251,146,60,0); }
          100% { box-shadow: 0 0 0 0 rgba(251,146,60,0); }
        }
        @keyframes alertPulseSuccess {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          50%  { box-shadow: 0 0 0 7px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        @keyframes alertPulseInfo {
          0%   { box-shadow: 0 0 0 0 rgba(34,211,238,0.35); }
          50%  { box-shadow: 0 0 0 6px rgba(34,211,238,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,211,238,0); }
        }
        @keyframes counterBump {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.4); }
          70%  { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes recentlyUpdated {
          0%   { background-color: rgba(34,211,238,0.14); }
          100% { background-color: transparent; }
        }
        @keyframes listSlotIn {
          0%   { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes timestampTick {
          0%   { opacity: 0.45; }
          50%  { opacity: 1; }
          100% { opacity: 0.45; }
        }
        .alert-enter { animation: alertEnter 280ms cubic-bezier(0.34,1.2,0.64,1) forwards; }
        .alert-exit  { animation: alertExit 180ms ease-in forwards; overflow: hidden; pointer-events: none; }
        .alert-pulse-critical { animation: alertPulseCritical 500ms ease-out 280ms 1 forwards; }
        .alert-pulse-warning  { animation: alertPulseWarning  500ms ease-out 280ms 1 forwards; }
        .alert-pulse-success  { animation: alertPulseSuccess  500ms ease-out 280ms 1 forwards; }
        .alert-pulse-info     { animation: alertPulseInfo     500ms ease-out 280ms 1 forwards; }
        .counter-bump { display: inline-block; animation: counterBump 300ms cubic-bezier(0.34,1.3,0.64,1) forwards; }
        .recently-updated { animation: recentlyUpdated 2500ms ease-out forwards; border-radius: inherit; }
        .list-slot-in { animation: listSlotIn 220ms ease-out forwards; }
        .timestamp-idle { animation: timestampTick 3s ease-in-out infinite; }
        .hoverable { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .hoverable:hover { transform: translateY(-2px) scale(1.005); box-shadow: 0 6px 24px rgba(0,0,0,0.35); }
        .alert-row { transition: transform 0.12s ease; }
        .alert-row:hover { transform: translateX(3px); }
        button:active { transform: scale(0.96) !important; transition: transform 0.1s ease !important; }
        .dash-main { margin-left: 240px; width: calc(100% - 240px); overflow-x: hidden; box-sizing: border-box; }
        @media (max-width: 768px) { .dash-main { margin-left: 0 !important; width: 100% !important; } }

        @keyframes shimmer-sweep {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .hero-revenue-shimmer {
          background: linear-gradient(90deg, #60a5fa 0%, #f472b6 25%, #a78bfa 50%, #22d3ee 75%, #60a5fa 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-sweep 5s linear infinite;
        }
        .card-glow-pink:hover  { box-shadow: 0 0 38px rgba(244,114,182,0.32), 0 8px 32px rgba(0,0,0,0.5) !important; transform: translateY(-4px) !important; }
        .card-glow-cyan:hover  { box-shadow: 0 0 38px rgba(34,211,238,0.28), 0 8px 32px rgba(0,0,0,0.5) !important; transform: translateY(-4px) !important; }
        .card-glow-violet:hover{ box-shadow: 0 0 38px rgba(167,139,250,0.28),0 8px 32px rgba(0,0,0,0.5) !important; transform: translateY(-4px) !important; }
        .card-glow-gold:hover  { box-shadow: 0 0 38px rgba(251,191,36,0.26), 0 8px 32px rgba(0,0,0,0.5) !important; transform: translateY(-4px) !important; }
        .stat-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        @keyframes cmd-pulse { 0%,100% { opacity:1; } 50% { opacity:0.55; } }
      `}</style>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 900, height: 900, top: "-20%", left: "-10%", background: "radial-gradient(circle, rgba(59,130,246,0.35), transparent 60%)", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", width: 900, height: 900, bottom: "-20%", right: "-10%", background: "radial-gradient(circle, rgba(236,72,153,0.35), transparent 60%)", filter: "blur(120px)" }} />
      </div>

      {/* SIDEBAR — desktop only, hidden on mobile via CSS */}
      <Sidebar activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); if (typeof window !== "undefined") { localStorage.setItem("camcash_tab", tab); window.scrollTo({ top: 0, behavior: "instant" }); } }} user={user} onSignOut={async () => { await supabase.auth.signOut(); router.replace("/login"); }} isPro={isPro} />{/* MAIN CONTENT */}
      <div className="dash-main" style={{ marginLeft: 240, width: "calc(100% - 240px)", minWidth: 0, padding: 32, boxSizing: "border-box", overflowX: "hidden" }}>

        {/* ── STICKY COMMAND BAR ── */}
        {(() => {
          const safeAvg = (!isNaN(avgPerHour) && isFinite(avgPerHour)) ? avgPerHour : 0
          const brief = dailyBrief
          const atPeak = brief?.atPeak
          const momentumData = analytics?.momentum
          const momentum = atPeak ? '🔥 AT PEAK'
            : momentumData ? `${momentumData.emoji} ${momentumData.label}`
            : tips.length === 0 ? '— No data' : '→ Steady'
          const momentumColor = atPeak ? '#10B981'
            : momentumData?.pct > 50 ? '#f472b6'
            : momentumData?.pct > 10 ? '#10B981'
            : momentumData?.pct > -10 ? '#22D3EE'
            : tips.length === 0 ? '#475569' : '#f87171'
          const localNow = new Date().getHours()
          const hoursUntilLocal = canonicalPeakHourUTC != null ? (canonicalPeakHourUTC - localNow + 24) % 24 : brief?.hoursUntilPeak
          const peakLabel = hoursUntilLocal === 0 ? 'NOW' : hoursUntilLocal === 1 ? 'in 1 hr' : (hoursUntilLocal > 0 && !isNaN(hoursUntilLocal)) ? `in ${hoursUntilLocal}h` : null
          const _eiPeakLabel = canonicalPeakLabel || brief?.bhLabel
          const bestPlat = brief?.displayPlat || (tips.length > 0 ? tips[0]?.platform : null)
          const safeRevenue = (!isNaN(totalRevenue) && isFinite(totalRevenue)) ? totalRevenue : 0
          return (
            <div style={{ position: 'sticky', top: 0, zIndex: 20, marginBottom: 20, marginLeft: -32, marginRight: -32, width: 'calc(100% + 64px)', maxWidth: 'none', padding: '0 32px', background: 'rgba(5,7,15,0.86)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', borderBottom: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: 58, gap: 0, overflowX: 'auto' }}>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', paddingRight:24, borderRight:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
                  <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:1.2, fontWeight:600, marginBottom:2 }}>Total Earned</div>
                  <div style={{ fontSize:19, fontWeight:900, background:'linear-gradient(135deg,#60a5fa,#f472b6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', whiteSpace:'nowrap' }}>${safeRevenue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 24px', borderRight:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
                  <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:1.2, fontWeight:600, marginBottom:2 }}>Avg $/Hour</div>
                  <div style={{ fontSize:19, fontWeight:900, color:'#22D3EE', whiteSpace:'nowrap' }}>{safeAvg > 0 ? `$${safeAvg.toFixed(2)}` : '—'}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 24px', borderRight:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
                  <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:1.2, fontWeight:600, marginBottom:2 }}>Momentum</div>
                  <div style={{ fontSize:13, fontWeight:800, color:momentumColor, whiteSpace:'nowrap', animation: atPeak ? 'cmd-pulse 1.5s infinite' : 'none' }}>{momentum}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 24px', borderRight:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
                  <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:1.2, fontWeight:600, marginBottom:2 }}>Best Platform</div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#a78bfa', whiteSpace:'nowrap' }}>{bestPlat || '—'}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 24px', borderRight:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
                  <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:1.2, fontWeight:600, marginBottom:2 }}>Peak Window</div>
                  <div style={{ fontSize:13, fontWeight:800, color: atPeak ? '#10B981' : '#fbbf24', whiteSpace:'nowrap' }}>{_eiPeakLabel ? `${_eiPeakLabel}${peakLabel ? ` · ${peakLabel}` : ''}` : '—'}</div>
                </div>
                <div style={{ marginLeft:'auto', paddingLeft:24, flexShrink:0 }}>
                  <button onClick={() => { setActiveTab('live'); if (typeof window !== 'undefined') { localStorage.setItem('camcash_tab','live'); window.scrollTo({top:0,behavior:'instant'}); } }} style={{ padding:'9px 22px', borderRadius:12, background:'linear-gradient(135deg,#10B981,#22D3EE)', border:'none', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer', whiteSpace:'nowrap', boxShadow:'0 0 22px rgba(16,185,129,0.4)', letterSpacing:0.3 }}>
                    ⚡ Go Live
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── LIVE STATUS BAR ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981", animation: "pulse-msg 2s infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981" }}>LIVE</span>
          </div>
          {isRefreshing && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94A3B8" }}>
              <div style={{ width: 12, height: 12, border: "1.5px solid rgba(34,211,238,0.3)", borderTopColor: "#22D3EE", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              Refreshing...
            </div>
          )}
          {lastRefreshed && !isRefreshing && (
            <span key={lastRefreshed.getTime()} className="recently-updated" style={{ fontSize: 11, color: "#475569", padding: "2px 6px", borderRadius: 4 }}>
              Updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {newTipCount > 0 && (
            <div style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(236,72,153,0.15)", border: "1px solid rgba(236,72,153,0.35)", fontSize: 11, fontWeight: 700, color: "#EC4899", animation: "alertEnter 0.3s ease forwards" }}>
              +<span key={newTipCount} className={counterBumping ? "counter-bump" : ""}>{newTipCount}</span> new tip{newTipCount > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* ── DASHBOARD PROGRESS CARD — visible on all tabs when data is warming up ── */}
        {_isLowData && (
          <DashboardProgressCard
            totalTips={tips.length}
            totalSessions={analytics?.meaningfulSessionCount || 0}
            totalFans={analytics?.uniqueFanCount || 0}
            totalEarnings={analytics?.totalUSD || 0}
            readiness={dashboardReadiness}
            onImport={() => handleTabChange('import')}
          />
        )}

        {activeTab === "overview" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>

            {/* ═══════════════════════════════════════
                1. MONEY SNAPSHOT
            ═══════════════════════════════════════ */}
            {(() => {
              // ── empty state — show null; DashboardProgressCard above covers zero-data ──
              if (tips.length === 0) return null

              const now = new Date()
              const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
              const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
              const thisMonthRev = tips.filter(t => new Date(t.date_time || t.dateRaw) >= thisMonthStart).reduce((s, t) => s + (t.usd || 0), 0)
              const prevMonthRev = tips.filter(t => { const d = new Date(t.date_time || t.dateRaw); return d >= prevMonthStart && d < thisMonthStart }).reduce((s, t) => s + (t.usd || 0), 0)
              const growthPct = (prevMonthRev > 0 && thisMonthRev > 0) ? Math.round(((thisMonthRev - prevMonthRev) / prevMonthRev) * 100) : null
              const isPositive = growthPct !== null && growthPct >= 0
              const safeRevenue = (!isNaN(totalRevenue) && isFinite(totalRevenue)) ? totalRevenue : 0
              const safeAvgHr = (!isNaN(avgPerHour) && isFinite(avgPerHour)) ? avgPerHour : 0
              const topPct = safeRevenue > 0 ? Math.max(1, Math.min(25, Math.round(100 - (safeRevenue / 50)))) : null
              const sessionsLast30 = sessions.filter(s => (Date.now() - new Date(s.startTime)) / 86400000 <= 30).length
              const fansActiveLast30 = new Set(tips.filter(t => (Date.now() - new Date(t.date_time || t.dateRaw)) / 86400000 <= 30).map(t => t.username)).size

              // ── Per-card month-over-month trend ──
              const thisMonthTimed = timedSessions.filter(s => new Date(s.startTime) >= thisMonthStart)
              const prevMonthTimed = timedSessions.filter(s => { const d = new Date(s.startTime); return d >= prevMonthStart && d < thisMonthStart })
              const tmAvgHr = thisMonthTimed.reduce((s,x) => s+(x.durationHours||0),0) > 0 ? thisMonthTimed.reduce((s,x) => s+(x.totalUSD||0),0) / thisMonthTimed.reduce((s,x) => s+(x.durationHours||0),0) : null
              const pmAvgHr = prevMonthTimed.reduce((s,x) => s+(x.durationHours||0),0) > 0 ? prevMonthTimed.reduce((s,x) => s+(x.totalUSD||0),0) / prevMonthTimed.reduce((s,x) => s+(x.durationHours||0),0) : null
              const avgHrGrowth = (tmAvgHr !== null && pmAvgHr !== null && pmAvgHr > 0) ? Math.round(((tmAvgHr - pmAvgHr) / pmAvgHr) * 100) : null
              const thisMonthFans = new Set(tips.filter(t => new Date(t.date_time || t.dateRaw) >= thisMonthStart).map(t => t.username)).size
              const prevMonthFans = new Set(tips.filter(t => { const d = new Date(t.date_time || t.dateRaw); return d >= prevMonthStart && d < thisMonthStart }).map(t => t.username)).size
              const fansGrowth = (prevMonthFans > 0 && thisMonthFans > 0) ? Math.round(((thisMonthFans - prevMonthFans) / prevMonthFans) * 100) : null
              const thisMonthSess = sessions.filter(s => new Date(s.startTime) >= thisMonthStart).length
              const prevMonthSess = sessions.filter(s => { const d = new Date(s.startTime); return d >= prevMonthStart && d < thisMonthStart }).length
              const sessGrowth = (prevMonthSess > 0 && thisMonthSess > 0) ? Math.round(((thisMonthSess - prevMonthSess) / prevMonthSess) * 100) : null

              // ── 6-month sparkline data ──
              const last6Rev = [], last6Fans = [], last6Sess = []
              for (let i = 5; i >= 0; i--) {
                const ms = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
                const me = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1))
                const monthTips = tips.filter(t => { const d = new Date(t.date_time || t.dateRaw); return d >= ms && d < me })
                last6Rev.push(monthTips.reduce((acc,t) => acc+(t.usd||0),0))
                last6Fans.push(new Set(monthTips.map(t => t.username)).size)
                last6Sess.push(sessions.filter(x => { const d = new Date(x.startTime); return d >= ms && d < me }).length)
              }
              const last6AvgHr = []
              for (let i = 5; i >= 0; i--) {
                const ms = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
                const me = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1))
                const mts = timedSessions.filter(s => { const d = new Date(s.startTime); return d >= ms && d < me })
                const mh = mts.reduce((s,x) => s+(x.durationHours||0),0)
                last6AvgHr.push(mh > 0 ? mts.reduce((s,x) => s+(x.totalUSD||0),0) / mh : 0)
              }

              // mini sparkline renderer (6 bars)
              const MiniSpark = ({ data, accent }) => {
                const max = Math.max(...data, 0.01)
                const W = 7, H = 24, G = 3
                return (
                  <svg width={(W+G)*6-G} height={H} style={{ display:'block', marginTop:10 }}>
                    {data.map((v, j) => {
                      const bh = Math.max(2, Math.round((v / max) * H))
                      return <rect key={j} x={j*(W+G)} y={H-bh} width={W} height={bh} rx={2} fill={j === 5 ? accent : 'rgba(255,255,255,0.10)'} />
                    })}
                  </svg>
                )
              }

              // trend badge renderer
              const TrendBadge = ({ pct, color }) => {
                if (pct === null || isNaN(pct)) return null
                const up = pct >= 0
                return <span style={{ fontSize:10, fontWeight:700, color: up ? '#10B981' : '#f87171', marginLeft:6 }}>{up ? '↑' : '↓'}{Math.abs(pct)}%</span>
              }

              const cardDefs = [
                { label:"Total Earned", accent:'#f472b6', glowClass:'card-glow-pink', sparkData:last6Rev, trend:growthPct,
                  value: `$${safeRevenue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
                  sub: topPct ? `Top ${topPct}% of models on this platform` : 'Upload more data to rank',
                  icon:'💰', badge: growthPct !== null ? (isPositive ? `↑ ${growthPct}% vs last month` : `↓ ${Math.abs(growthPct)}% vs last month`) : null,
                  badgeColor: isPositive ? C.green : C.red, isHero: true },
                { label:"Avg $/Hour", accent:'#22d3ee', glowClass:'card-glow-cyan', sparkData:last6AvgHr, trend:avgHrGrowth,
                  value: safeAvgHr > 0 ? `$${safeAvgHr.toFixed(2)}` : '—',
                  sub: safeAvgHr > 20 ? 'Above average — keep it up!' : safeAvgHr > 0 ? 'Tip: stream at peak hours' : 'Start timed sessions to track',
                  icon:'⏱️', badge:null },
                { label:"Total Fans", accent:'#a78bfa', glowClass:'card-glow-violet', sparkData:last6Fans, trend:fansGrowth,
                  value: whales.length > 0 ? whales.length.toLocaleString() : '—',
                  sub: fansActiveLast30 > 0 ? `${fansActiveLast30} active in last 30 days` : 'No fan activity tracked yet',
                  icon:'👥', badge:null },
                { label:"Sessions", accent:'#fbbf24', glowClass:'card-glow-gold', sparkData:last6Sess, trend:sessGrowth,
                  value: sessions.length > 0 ? sessions.length.toLocaleString() : '—',
                  sub: (analytics?.meaningfulSessionCount > 0)
                    ? `${analytics.meaningfulSessionCount} meaningful · ${analytics.lowSignalSessionCount} low-signal`
                    : (sessionsLast30 > 0 ? `${sessionsLast30} in last 30 days${sessionsLast30 >= 3 ? ' 🔥' : ''}` : 'No sessions in last 30 days'),
                  icon:'🎥',
                  badge: sessionsLast30 >= 5 ? '🔥 On a streak!' : null, badgeColor: C.gold,
                  info: 'Analytics use meaningful sessions only by default' }
              ]

              // Earnings velocity per platform for velocity strip
              const velPlatforms = Object.entries(platformVelocity).filter(([,v]) => v !== null).sort((a,b) => (b[1]||0)-(a[1]||0))
              return (
                <>
                  <div className="stat-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                    {cardDefs.map((s, i) => (
                      <div key={i} className={`stat-card ${s.glowClass}`} style={{ ...glassCard, borderRadius: 18, padding: "16px 20px", position: "relative", overflow: "hidden", animation: `fadeUp 0.3s ease ${i * 0.06}s both`, cursor:'default' }}>
                        {/* accent top bar */}
                        <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${s.accent}80,${s.accent}20)`, borderRadius:'18px 18px 0 0' }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{s.label}</span>
                          <span style={{ fontSize: 22 }}>{s.icon}</span>
                        </div>
                        {s.isHero
                          ? <div className="hero-revenue-shimmer" style={{ fontSize: 'clamp(20px, 3vw, 34px)', fontWeight: 900, marginBottom: 4, lineHeight: 1.05 }}>{s.value}</div>
                          : <div style={{ fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 900, color: s.accent, marginBottom: 4, lineHeight: 1.1 }}>{s.value}<TrendBadge pct={s.trend} /></div>
                        }
                        {s.isHero && <div style={{ marginBottom:4 }}><TrendBadge pct={s.trend} /></div>}
                        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{s.sub}</div>
                        {s.badge && <div style={{ marginTop: 8, display: "inline-block", padding: "2px 8px", borderRadius: 6, background: `${s.badgeColor}20`, border: `1px solid ${s.badgeColor}40`, fontSize: 10, fontWeight: 700, color: s.badgeColor }}>{s.badge}</div>}
                        {s.info && <div style={{ marginTop: 6, fontSize: 9, color: C.muted, opacity: 0.7, lineHeight: 1.3 }}>ℹ️ {s.info}</div>}
                      </div>
                    ))}
                  </div>
                  {/* section divider */}
                  <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)', marginBottom:20 }} />
                </>
              )
            })()}

            {/* ═══════════════════════════════════════
                DAILY BRIEF — overview only, below earnings
            ═══════════════════════════════════════ */}
        {/* ═══════════════════════════════════════════════════════
            DAILY BRIEF — always visible, above all tabs
            Refreshes based on UTC time + your real session data
        ═══════════════════════════════════════════════════════ */}
        {dailyBrief && (() => {
          const { todayName, bhLabel: _bhLabel, bh, atPeak, hoursUntilPeak, displayPlat: _displayPlat, displayAvg,
            isBestDay, bestDay, sessionAvg, peakAvg, predictionLow, predictionHigh,
            reengageFans, likelyOnline, sessionsAtPeakCount } = dailyBrief
          const bhLabel = canonicalPeakLabel || _bhLabel
          const displayPlat = engineInsights?.summary?.best_platform || _displayPlat
          return (
            <div style={{ marginBottom: 20, borderRadius: 18, overflow: 'hidden', border: `1px solid ${atPeak ? 'rgba(16,185,129,0.45)' : 'rgba(124,92,255,0.3)'}`, background: 'rgba(10,12,24,0.7)', backdropFilter: 'blur(16px)', animation: 'fadeUp 0.3s ease both' }}>

              {/* Header bar */}
              <div style={{ padding: '13px 20px', background: atPeak ? 'linear-gradient(135deg,rgba(16,185,129,0.2),rgba(34,211,238,0.1))' : 'linear-gradient(135deg,rgba(124,92,255,0.18),rgba(34,211,238,0.08))', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: atPeak ? 'linear-gradient(135deg,#10B981,#22D3EE)' : 'linear-gradient(135deg,#7C5CFF,#22D3EE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                    {atPeak ? '🟢' : '📋'}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>
                      {atPeak ? 'Peak Window LIVE — Go Live Now' : 'Daily Brief'}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{todayName} · based on your real session history</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {atPeak
                    ? <div style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)', fontSize: 12, fontWeight: 700, color: C.green }}>🟢 Peak Now</div>
                    : bhLabel && <div style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(124,92,255,0.12)', border: '1px solid rgba(124,92,255,0.3)', fontSize: 12, fontWeight: 600, color: C.indigo }}>⏰ Peak in {hoursUntilPeak}h</div>
                  }
                </div>
              </div>

              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* ═══ BEST TIME TO STREAM ALERT ═══ */}
                {bhLabel && (
                  <div style={{ padding: '14px 16px', borderRadius: 13, background: atPeak ? 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(34,211,238,0.08))' : 'linear-gradient(135deg,rgba(124,92,255,0.12),rgba(34,211,238,0.06))', border: `1px solid ${atPeak ? 'rgba(16,185,129,0.4)' : 'rgba(124,92,255,0.35)'}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{atPeak ? '🟢' : '⏰'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: atPeak ? C.green : C.white, marginBottom: 5 }}>
                        {atPeak
                          ? `Your peak window is RIGHT NOW — go live on ${displayPlat} immediately`
                          : `Your best time to stream today is ${bhLabel} on ${displayPlat}`
                        }
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>
                        {`Since it's ${todayName}`}
                        {isBestDay ? ` (your highest-earning day)` : ``}
                        {`, you peak at ${bhLabel} on ${displayPlat} with `}
                        <span style={{ color: C.gold, fontWeight: 700 }}>${displayAvg.toFixed(0)} avg/session</span>
                        {`. Stream `}
                        <span style={{ color: C.cyan, fontWeight: 700 }}>60+ min</span>
                        {` to earn `}
                        <span style={{ color: C.green, fontWeight: 700 }}>${predictionLow}–${predictionHigh}</span>
                        {` — longer sessions earn `}
                        <span style={{ color: C.indigo, fontWeight: 700 }}>+101% more</span>
                        {` on average.`}
                      </div>
                      {!atPeak && hoursUntilPeak !== null && hoursUntilPeak > 0 && (
                        <div style={{ marginTop: 8, fontSize: 11, color: C.indigo, fontWeight: 600 }}>
                          ⏳ {hoursUntilPeak === 1 ? 'Starting in ~1 hour — prep your room now' : `${hoursUntilPeak} hours away — set a reminder`}
                        </div>
                      )}
                      {atPeak && (
                        <div style={{ marginTop: 8, fontSize: 11, color: C.green, fontWeight: 700 }}>
                          🔥 This window closes in ~{(60 - new Date().getUTCMinutes())} minutes — don't wait
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ROW 1 — Today / Peak Window / Best Platform */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 130, padding: '11px 14px', borderRadius: 11, background: 'rgba(124,92,255,0.08)', border: '1px solid rgba(124,92,255,0.18)' }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>Today</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>{todayName}</div>
                    <div style={{ fontSize: 11, color: C.indigo, marginTop: 2 }}>
                      {(() => {
                        const _bdA = bestDay?.avg || sessionAvg
                        const _safeA = (!isNaN(_bdA) && isFinite(_bdA) && _bdA > 0) ? _bdA : null
                        if (isBestDay) return _safeA ? `🏆 Your best day — avg $${_safeA.toFixed(0)}/session` : '🏆 Your best day'
                        return _safeA ? `avg ~$${_safeA.toFixed(0)}/session` : 'Not enough data yet'
                      })()}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 130, padding: '11px 14px', borderRadius: 11, background: atPeak ? 'rgba(16,185,129,0.12)' : 'rgba(34,211,238,0.07)', border: `1px solid ${atPeak ? 'rgba(16,185,129,0.4)' : 'rgba(34,211,238,0.18)'}` }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>Best Time</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: atPeak ? C.green : C.white }}>{bhLabel || 'Calculating...'}</div>
                    <div style={{ fontSize: 11, color: atPeak ? C.green : C.cyan, marginTop: 2 }}>
                      {atPeak ? 'ON RIGHT NOW — stream!' : hoursUntilPeak !== null ? `in ${hoursUntilPeak}h${(!isNaN(displayAvg) && displayAvg > 0) ? ` · $${displayAvg.toFixed(0)} avg` : ''}` : ''}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 130, padding: '11px 14px', borderRadius: 11, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>Best Platform</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>{displayPlat}</div>
                    <div style={{ fontSize: 11, color: C.gold, marginTop: 2 }}>{(!isNaN(displayAvg) && displayAvg > 0) ? `$${displayAvg.toFixed(0)} avg at ${bhLabel || 'peak'}` : bhLabel ? `at ${bhLabel}` : 'Not enough data yet'}</div>
                  </div>

                  {bhLabel && (
                    <div style={{ flex: 1, minWidth: 130, padding: '11px 14px', borderRadius: 11, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>Income Forecast</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>${predictionLow}–${predictionHigh}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>if you stream at {bhLabel}</div>
                      {sessionsAtPeakCount < 2 && <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontStyle: 'italic' }}>based on limited data</div>}
                    </div>
                  )}
                </div>

                {/* ROW 2 — Likely Online + Re-engage */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>

                  {/* Likely Online */}
                  {likelyOnline.length > 0 && (
                    <div style={{ flex: 1, minWidth: 200, padding: '12px 14px', borderRadius: 11, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block', boxShadow: `0 0 5px ${C.green}`, animation: 'pulse-msg 2s infinite' }}/>
                        Likely Online Right Now
                      </div>
                      {likelyOnline.map((w, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < likelyOnline.length - 1 ? 7 : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: `linear-gradient(135deg,#10B981,#22D3EE)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                              {w.username[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{w.username}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>${w.totalUSD.toFixed(0)} lifetime · {w.platform}</div>
                            </div>
                          </div>
                          <button onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }}
                            style={{ padding: '4px', borderRadius: 8, background: 'none', border: 'none', color: C.green, fontSize: 26, cursor: 'pointer', lineHeight: 1, animation: 'pulse-msg 2s infinite', flexShrink: 0 }}>
                            💌
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Re-engage */}
                  {!atPeak && reengageFans.length > 0 && (
                    <div style={{ flex: 1, minWidth: 200, padding: '12px 14px', borderRadius: 11, background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.18)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.pink, marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6 }}>
                        ⚠️ Re-engage Today
                      </div>
                      {reengageFans.map((w, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < reengageFans.length - 1 ? 7 : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: `linear-gradient(135deg,#EC4899,#7C5CFF)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                              {w.username[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{w.username}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>${w.totalUSD.toFixed(0)} · {w.avgTipSize >= 50*0.05 ? Math.round(w.avgTipSize/0.05) + ' tok avg' : w.totalTokens + ' tok'} · {w.daysSinceLastTip}d gone</div>
                            </div>
                          </div>
                          <button onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }}
                            style={{ padding: '4px', borderRadius: 8, background: 'none', border: 'none', color: C.pink, fontSize: 26, cursor: 'pointer', lineHeight: 1, animation: 'pulse-msg 2s infinite', flexShrink: 0 }}>
                            💌
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* If neither list has data */}
                  {likelyOnline.length === 0 && reengageFans.length === 0 && (
                    <div style={{ flex: 1, padding: '12px 14px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: C.muted }}>
                      No fan alerts right now — check back after more sessions.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )
        })()}

            {/* section divider */}
            <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)', margin:'4px 0 24px' }} />
            {/* ═══════════════════════════════════════
                2. PRIMARY ACTION CENTER — "Make Money Right Now"
                Merges: What Should I Do + Live Intelligence top alerts
                Shows max 3 actions ranked by revenue impact
            ═══════════════════════════════════════ */}
            {(() => {
              // Merge nextMoves + top realTimeAlerts, deduplicate, cap at 3
              const merged = []

              // Add nextMoves first (already ranked by priority)
              ;(nextMoves || []).forEach(a => {
                merged.push({ icon: a.icon, color: a.color || C.cyan, text: a.text, cta: a.cta, username: a.username, source: 'move' })
              })

              // Add top realTimeAlerts that aren't duplicated
              ;(realTimeAlerts || []).slice(0, 3).forEach(a => {
                const isDupe = merged.some(m => m.text && a.message && m.text.toLowerCase().includes((a.title || '').toLowerCase().slice(0, 20)))
                if (!isDupe) merged.push({ icon: a.icon, color: a.color || C.cyan, text: `${a.title} — ${a.message}`, cta: false, source: 'alert' })
              })

              // Prepend engineInsights go_live_status as the top signal when available
              if (engineInsights?.go_live_status?.status) {
                const gl = engineInsights.go_live_status
                const glColor = gl.status === 'peak' ? C.green : gl.status === 'good' ? C.cyan : C.muted
                const glIcon = gl.status === 'peak' ? '🟢' : gl.status === 'good' ? '⚡' : '⏰'
                const localHour = (new Date().getUTCHours() - new Date().getTimezoneOffset() / 60 + 24) % 24
                const localLabel = localHour === 0 ? '12 AM' : localHour < 12 ? `${Math.floor(localHour)} AM` : localHour === 12 ? '12 PM' : `${Math.floor(localHour) - 12} PM`
                const glText = gl.multiplier
                  ? `${gl.status === 'peak' ? 'Peak hour right now' : 'Good time to stream'} (${localLabel}) — this window earns ${gl.multiplier}x your average. Go live on ${engineInsights?.summary?.best_platform || 'your top platform'}.`
                  : `Go-live signal: ${gl.status} — check your stream timing`
                merged.unshift({ icon: glIcon, color: glColor, text: glText, cta: false, source: 'engine' })
              }

              const actions = merged.slice(0, 3)
              if (!actions.length) return null

              return (
                <div style={{ ...glassCard, borderRadius: 18, padding: 24, marginBottom: 28, border: "1px solid rgba(34,211,238,0.2)", animation: "fadeUp 0.3s ease 0.1s both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#22D3EE,#7C5CFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>⚡</div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>Make Money Right Now</div>
                      <div style={{ fontSize: 12, color: C.muted }}>Ranked by estimated revenue impact from your real data</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {actions.map((a, i) => (
                      <div key={i} className={`alert-enter alert-pulse-info alert-row`} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "14px 16px", background: i === 0 ? `${a.color}18` : `${a.color}0d`, border: `1px solid ${i === 0 ? a.color + '50' : a.color + '28'}`, borderRadius: 12, boxShadow: i === 0 ? `0 0 18px ${a.color}18` : 'none', animationDelay: `${i * 40}ms` }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 20px ${a.color}28` }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = i === 0 ? `0 0 18px ${a.color}18` : 'none' }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1 }}>
                          <span style={{ fontSize: 20, flexShrink: 0 }}>{a.icon}</span>
                          <div style={{ fontSize: 14, color: C.white, lineHeight: 1.55 }}>{a.text}</div>
                        </div>
                        {a.cta && (
                          <button onClick={() => { const w = whales.find(wh => wh.username === a.username); if (w) { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) } }}
                            style={{ flexShrink: 0, padding: "6px", borderRadius: 8, background: "none", border: "none", color: C.pink, fontSize: 28, cursor: "pointer", animation: "pulse-msg 2s infinite", lineHeight: 1 }}>
                            💌
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* section divider */}
            <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)', margin:'4px 0 24px' }} />
            {/* ═══════════════════════════════════════
                3. WHAT'S WORKING — Strategy
                Platform performance + best time + best day merged
            ═══════════════════════════════════════ */}
            <div style={{ ...glassCard, borderRadius: 18, padding: 24, marginBottom: 28, animation: "fadeUp 0.3s ease 0.15s both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#F59E0B,#10B981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📊</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>What's Working</div>
                    <div style={{ fontSize: 12, color: C.muted }}>Platform, time & session strategy from your data</div>
                  </div>
                </div>
              </div>

              {/* Platform ROI + Per-Platform Best Time (mandatory: always show platform context) */}
              {(() => {
                const fmtH = h => { if (h == null || isNaN(h)) return 'N/A'; const _off=new Date().getTimezoneOffset()/-60; const _lh=Math.round(((h+_off)%24+24)%24); return _lh===0?'12 AM':_lh<12?`${_lh} AM`:_lh===12?'12 PM':`${_lh-12} PM` }
                const platColors = { Chaturbate: C.cyan, BongaCams: C.pink, MyFreeCams: C.gold }
                const allPlats = [...(analytics?.platforms || [])].sort((a,b) => b.totalUSD - a.totalUSD)
                if (!allPlats.length) return null
                return (
                  <div style={{ marginBottom: 18 }}>
                    {/* Platform ROI row: formula = total_earnings / total_hours */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Platform ROI ($/hr streamed)</div>
                    <div className="platform-roi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
                      {allPlats.map((p, i) => {
                        const roi = platformVelocity[p.platform] ?? (p.hours > 0 ? parseFloat((p.totalUSD / Math.max(p.hours, 0.5)).toFixed(2)) : null)
                        const bestTime = platformBestTimes[p.platform]
                        const col = platColors[p.platform] || C.blue
                        const isTop = i === 0
                        return (
                          <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: isTop ? `${col}12` : `${col}08`, border: `1px solid ${isTop ? col + '40' : col + '20'}`, transition: "transform 0.15s, box-shadow 0.15s", position: "relative" }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.boxShadow = `0 4px 16px ${col}20` }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "" }}>
                            {isTop && <div style={{ position: "absolute", top: 8, right: 8, fontSize: 9, padding: "2px 6px", borderRadius: 10, background: `${col}25`, color: col, fontWeight: 700 }}>TOP ROI</div>}
                            <div style={{ fontSize: 11, fontWeight: 700, color: col, marginBottom: 6 }}>{p.platform.replace('BongaCams','Bonga').replace('MyFreeCams','MFC')}</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: C.white, marginBottom: 2 }}>{roi !== null ? `$${(roi || 0).toFixed(2)}/hr` : '—'}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginBottom: bestTime ? 8 : 0 }}>${(p.totalUSD || 0).toFixed(0)} total · {(p.hours || 0).toFixed(0)}h streamed</div>
                            {(() => {
                            const todayUTCName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getUTCDay()]
                            const ptimes = analytics?.platformBestTimes?.[p.platform]
                            const todayHour = ptimes?.bestHourByDay?.[todayUTCName]
                            const bestDayEntry = ptimes?.bestDay
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                                {bestDayEntry && (
                                  <div style={{ padding: '5px 8px', borderRadius: 8, background: `${col}10`, border: `1px solid ${col}25`, fontSize: 11, color: col }}>
                                    Best day: <strong>{bestDayEntry.day}s</strong> ${(bestDayEntry.avg || 0).toFixed(0)} avg
                                  </div>
                                )}
                                {todayHour && (
                                  <div style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 11, color: '#10B981' }}>
                                    Today ({todayUTCName}): <strong>{fmtH(todayHour.hour)}</strong> ${(todayHour.avg || 0).toFixed(0)}/hr avg
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                          </div>
                        )
                      })}
                    </div>
                    {/* Best day — use the top per-platform figure so the number matches the platform cards above */}
                    {(() => {
                      const platTimes = analytics?.platformBestTimes || {}
                      let topPlat = null, topDay = null, topAvg = 0
                      Object.entries(platTimes).forEach(([plat, times]) => {
                        if (times?.bestDay && times.bestDay.avg > topAvg) {
                          topAvg = times.bestDay.avg
                          topDay = times.bestDay.day
                          topPlat = plat
                        }
                      })
                      if (!topPlat) return null
                      const platLabel = topPlat.replace('BongaCams','Bonga').replace('MyFreeCams','MFC')
                      return (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: 0 }}>
                          <span style={{ fontSize: 16 }}>📅</span>
                          <div style={{ fontSize: 13, color: C.white }}>
                            <strong>{topDay}s on {platLabel}</strong> earn the most — <span style={{ color: C.gold }}>${topAvg.toFixed(0)} avg per session</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}

              {/* Platform day heatmap */}
              {(() => {
                const UTC_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                const platDayUSD = {}; const platDayDates = {}
                tips.forEach(t => {
                  const p = t.platform; const dt = new Date(t.date_time || t.dateRaw)
                  const shortDay = UTC_DAYS[dt.getUTCDay()]; const dateKey = dt.toISOString().slice(0, 10)
                  if (!platDayUSD[p]) platDayUSD[p] = {}
                  if (!platDayDates[p]) platDayDates[p] = {}
                  platDayUSD[p][shortDay] = (platDayUSD[p][shortDay] || 0) + (t.usd || 0)
                  if (!platDayDates[p][shortDay]) platDayDates[p][shortDay] = new Set()
                  platDayDates[p][shortDay].add(dateKey)
                })
                const platDayAvg = {}
                Object.keys(platDayUSD).forEach(p => {
                  platDayAvg[p] = {}
                  UTC_DAYS.forEach(d => {
                    const total = platDayUSD[p][d] || 0; const activeDays = platDayDates[p]?.[d]?.size || 1
                    platDayAvg[p][d] = total > 0 ? parseFloat((total / activeDays).toFixed(2)) : 0
                  })
                })
                const platList = Object.keys(platDayAvg)
                if (platList.length < 1) return null
                const todayShort = UTC_DAYS[new Date().getUTCDay()]
                const todayLong = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getUTCDay()]
                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Platform by Day of Week</span>
                      <span style={{ fontSize: 11, color: C.muted, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>avg $/active day</span>
                    </div>
                    <div className="heatmap-wrap" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "80px repeat(7, 1fr)", gap: 3, minWidth: 480 }}>
                      <div />
                      {UTC_DAYS.map(d => (
                        <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: d === todayShort ? C.cyan : C.muted, paddingBottom: 4 }}>{d}</div>
                      ))}
                      {platList.map(plat => {
                        const dayVals = UTC_DAYS.map(d => platDayAvg[plat][d] || 0)
                        const maxVal = Math.max(...dayVals, 0.01)
                        return [
                          <div key={plat + '_l'} style={{ fontSize: 10, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", paddingRight: 4, lineHeight: 1.3 }}>{plat.replace('BongaCams','Bonga').replace(/chaturbate/i,'CB').replace('MyFreeCams','MFC')}</div>,
                          ...UTC_DAYS.map(d => {
                            const val = platDayAvg[plat][d] || 0
                            const intensity = maxVal > 0 ? val / maxVal : 0
                            const isToday = d === todayShort
                            const bg = val === 0 ? "rgba(255,255,255,0.03)" : intensity < 0.25 ? "rgba(34,211,238,0.12)" : intensity < 0.5 ? "rgba(34,211,238,0.30)" : intensity < 0.75 ? "rgba(34,211,238,0.60)" : "rgba(34,211,238,0.90)"
                            return (
                              <div key={d} title={`${plat} ${d}: avg $${val.toFixed(2)}/day`}
                                onClick={() => { if (val > 0) { setChartDrillDay(d); handleTabChange("whales") } }}
                                style={{ height: 32, borderRadius: 5, background: bg, border: isToday ? "2px solid rgba(34,211,238,0.7)" : "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: val > 0 ? "pointer" : "default", transition: "all 0.15s", transform: "scale(1)" }}
                                onMouseEnter={e => { if (val > 0) { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 0 8px rgba(34,211,238,0.5)" } }}
                                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "" }}>
                                {val > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: intensity > 0.45 ? "#fff" : C.muted }}>${val >= 100 ? Math.round(val) : val.toFixed(0)}</span>}
                              </div>
                            )
                          })
                        ]
                      })}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: C.muted }}>Today ({todayLong}) highlighted in cyan. Darker = more earnings. Click any cell to filter Top Fans by that day. <span style={{ color: C.cyan }}>Click any cell to filter Top Fans by that day.</span></div>
                  </div>
                  </div>
                )
              })()}
            </div>

            {/* section divider */}
            <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)', margin:'4px 0 24px' }} />
            {/* ═══════════════════════════════════════
                4. YOUR TOP EARNERS
                A. Likely Online Now  B. Milestones  C. At Risk
            ═══════════════════════════════════════ */}
            {(() => {
              const currentUTCHourTE = new Date().getUTCHours()
              const labelH = h => { const _off=new Date().getTimezoneOffset()/-60; const _lh=Math.round(((h+_off)%24+24)%24); return _lh===0?'12 AM':_lh<12?`${_lh} AM`:_lh===12?'12 PM':`${_lh-12} PM` }

              const likelyOnline = whales
                .filter(w => w.tipCount >= 3)
                .map(w => {
                  const fanTips = (w.tips && w.tips.length > 0) ? w.tips : tips.filter(t => t.username.toLowerCase() === w.username.toLowerCase())
                  const hourCounts = {}
                  fanTips.forEach(t => { const h = new Date(t.date_time || t.dateRaw).getUTCHours(); hourCounts[h] = (hourCounts[h] || 0) + 1 })
                  const sorted = Object.entries(hourCounts).sort((a,b) => b[1]-a[1])
                  if (!sorted.length) return null
                  const peakHour = parseInt(sorted[0][0])
                  const hoursAway = (peakHour - currentUTCHourTE + 24) % 24
                  // peakFraction: share of this fan's tips that fall at their peak hour
                  const peakFraction = sorted[0][1] / fanTips.length
                  // proximityDecay: current hour vs peak hour (exact match = 1.0, 1h off = 0.65, 2h off = 0.35)
                  const proximityDecay = hoursAway === 0 ? 1.0 : hoursAway === 1 ? 0.65 : 0.35
                  // Scale by 200 so a fan with 40% tips at peak + exact match → 80%; 25% + 1h off → 33%
                  const confidence = Math.min(90, Math.max(25, Math.round(peakFraction * 200 * proximityDecay)))
                  return { ...w, peakHour, hoursAway, confidence, peakLabel: labelH(peakHour) }
                })
                .filter(Boolean)
                .filter(w => w.hoursAway <= 2 && w.confidence >= 35)
                .sort((a,b) => b.totalUSD - a.totalUSD)
                .slice(0, 3)

              // Deduplicate: a fan should only appear in one category (highest priority wins)
              // Priority: Likely Online > Close to Milestone > At Risk
              const seenUsernames = new Set(likelyOnline.map(w => w.username.toLowerCase()))

              const milestones = (whatsNextAlerts || [])
                .filter(a => a.type === 'milestone' && !seenUsernames.has((a.username || '').toLowerCase()))
                .slice(0, 3)
              milestones.forEach(a => seenUsernames.add((a.username || '').toLowerCase()))

              const atRisk = reengageList
                .filter(({ whale: w }) => !seenUsernames.has(w.username.toLowerCase()))
                .slice(0, 3)

              const hasAny = likelyOnline.length || milestones.length || atRisk.length
              if (!hasAny) return null

              const fanCard = (w, opts = {}) => (
                <div style={{ padding: "12px 14px", borderRadius: 12, background: opts.bg || "rgba(255,255,255,0.03)", border: opts.border || "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", transition: "transform 0.15s, box-shadow 0.15s", cursor: "default" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px) scale(1.01)"; e.currentTarget.style.boxShadow = opts.hoverGlow || "0 4px 16px rgba(255,255,255,0.06)" }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 160 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: opts.avatarBg || "rgba(34,211,238,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: opts.avatarColor || C.cyan, flexShrink: 0 }}>
                      {w.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{w.username}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                      <span style={{ color: C.white, fontWeight: 600 }}>${w.totalUSD.toFixed(0)}</span> lifetime
                      {opts.sub ? ` · ${opts.sub}` : ''}
                      {w.tipCount > 1 && ` · ${w.tipCount} tips`}
                      {w.avgDaysBetweenTips && w.tipCount > 1 && <span style={{ color: w.churnRisk?.level === 'High' || w.churnRisk?.level === 'Critical' ? C.red : C.muted }}>{` · every ~${Math.round(w.avgDaysBetweenTips)}d`}</span>}
                      {` · ${w.platform}`}
                    </div>
                    </div>
                  </div>
                  {opts.badge && <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: opts.badgeBg, color: opts.badgeColor, fontWeight: 700, whiteSpace: "nowrap" }}>{opts.badge}</span>}
                  {opts.action && (
                    <button onClick={opts.action} style={{ padding: "6px 12px", borderRadius: 8, background: opts.btnBg || "linear-gradient(135deg,#22D3EE,#EC4899)", border: "none", color: C.white, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, animation: opts.pulseBtn ? "pulse-msg 2.5s infinite" : "none" }}>
                      {opts.btnLabel || "💌"}
                    </button>
                  )}
                </div>
              )

              return (
                <div style={{ ...glassCard, borderRadius: 18, padding: 24, marginBottom: 28, animation: "fadeUp 0.3s ease 0.2s both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#EC4899,#7C5CFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>👑</div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>Your Top Earners</div>
                      <div style={{ fontSize: 12, color: C.muted }}>Who's online, who's close to a milestone, who needs a message</div>
                    </div>
                  </div>

                  {/* A. Likely Online Now */}
                  {likelyOnline.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
                        Likely Online Now
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {likelyOnline.map((w, i) => fanCard(w, {
                          bg: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.22)", hoverGlow: "0 4px 16px rgba(16,185,129,0.15)",
                          avatarBg: "rgba(16,185,129,0.18)", avatarColor: C.green,
                          sub: `peaks at ${w.peakLabel}`,
                          badge: `${w.confidence}% likely`, badgeBg: "rgba(16,185,129,0.2)", badgeColor: C.green,
                          action: () => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) },
                          btnBg: "none", pulseBtn: true
                        }))}
                      </div>
                    </div>
                  )}

                  {/* B. Close to Milestone */}
                  {milestones.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>💰 Close to Milestone</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {milestones.map((a, i) => {
                          const w = a.whale
                          if (!w) return null
                          return fanCard(w, {
                            bg: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)", hoverGlow: "0 4px 16px rgba(245,158,11,0.12)",
                            avatarBg: "rgba(245,158,11,0.18)", avatarColor: C.gold,
                            sub: a.message?.match(/\$[\d.]+ away/)?.[0] || '',
                            action: () => { if (a.whale) { setMessageTarget(a.whale); setMessageIndex(0); setMessageCopied(false) } },
                            btnBg: "linear-gradient(135deg,#F59E0B,#EC4899)", pulseBtn: false
                          })
                        })}
                      </div>
                    </div>
                  )}

                  {/* C. At Risk — Re-engage */}
                  {atRisk.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>⚠️ At Risk — Re-engage</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {atRisk.map(({ whale: w, days, urgency, msg }, i) => fanCard(w, {
                          bg: `${urgency}08`, border: `1px solid ${urgency}25`, hoverGlow: `0 4px 16px ${urgency}18`,
                          avatarBg: `${urgency}20`, avatarColor: urgency,
                          sub: `${days}d since last tip`,
                          badge: `${days}d ago`, badgeBg: `${urgency}20`, badgeColor: urgency,
                          action: () => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) },
                          btnBg: `linear-gradient(135deg,${urgency},#EC4899)`, pulseBtn: i === 0,
                          btnLabel: "💌"
                        }))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* section divider */}
            <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)', margin:'4px 0 24px' }} />
            {/* ═══════════════════════════════════════
                5. YOU'RE LOSING MONEY — Risk / Loss + Missed Revenue
            ═══════════════════════════════════════ */}
            {(() => {
              // Only show a fan re-engagement warning if the model has actually
              // been online enough for the fan to have had a realistic chance to tip.
              // Rule: model must have ≥3 sessions in the last N days, where N = fan's
              // average tipping frequency. No-shows aren't "at risk" — we just weren't live.
              const hasStreamedEnough = (whale) => {
                if (!whale?.avgDaysBetweenTips) return true
                const windowDays = Math.max(7, Math.round(whale.avgDaysBetweenTips))
                const cutoff = Date.now() - windowDays * 86400000
                const sessionsInWindow = sessions.filter(s => new Date(s.startTime).getTime() >= cutoff).length
                return sessionsInWindow >= 3
              }
              const allAlerts = [
                ...(lossAlerts || []).filter(a =>
                  (a.type === 'fan_churn') ? hasStreamedEnough(a.whale) : true
                ),
                ...(alerts || []).filter(a =>
                  (a.type === 'churn_risk') ? hasStreamedEnough(a.whale) : true
                ).slice(0, 3)
              ].slice(0, 6)
              const missedEntries = Object.entries(missedRevenueByPlat)
                .filter(([,m]) => m.missedRevenue > 5)
                .sort((a,b) => b[1].missedRevenue - a[1].missedRevenue)
              if (!allAlerts.length && !missedEntries.length) return null
              const peakHourLabel = canonicalPeakLabel
              return (
                <div style={{ ...glassCard, borderRadius: 18, padding: 24, marginBottom: 28, border: "1px solid rgba(251,146,60,0.2)", animation: "fadeUp 0.3s ease 0.25s both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(251,146,60,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🚨</div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>You're Losing Money</div>
                      <div style={{ fontSize: 12, color: C.muted }}>Inactivity, cold fans, missed windows</div>
                    </div>
                  </div>

                  {/* Missed Revenue — formula: (bestHourAvg - overallAvg) × sessionsNotAtBestHour */}
                  {missedEntries.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>💸 Missed Revenue (by streaming off-peak)</div>
                      {missedEntries.map(([plat, m], i) => (
                        <div key={i} style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 8, background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.22)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 3 }}>
                                📉 {plat} — peak hour earns <span style={{ color: C.cyan }}>{m.multiplier || (m.bestHourAvg && m.overallAvg ? (m.bestHourAvg/m.overallAvg).toFixed(1) : "5")}x</span> your avg session. Shift more streams to {peakHourLabel} to add ~<span style={{ color: C.green }}>${Math.round((m.bestHourAvg||0) - (m.overallAvg||0))}/stream</span>
                              </div>
                              <div style={{ fontSize: 12, color: C.muted }}>
                                {m.sessionsNotAtBestHour} sessions ran off-peak · Best hour is {peakHourLabel} (${m.bestHourAvg.toFixed(0)} avg) vs your overall ${m.overallAvg.toFixed(0)} avg
                              </div>
                            </div>
                            <div style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "rgba(251,146,60,0.2)", color: C.orange, fontWeight: 700, whiteSpace: "nowrap" }}>
                              Stream at {peakHourLabel}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {allAlerts.map((a, i) => (
                      <div key={i} className={`alert-enter alert-pulse-${a.severity === "critical" ? "critical" : "warning"} alert-row`} style={{ padding: "12px 14px", borderRadius: 10, background: a.severity === 'critical' ? "rgba(248,113,113,0.1)" : "rgba(251,146,60,0.08)", border: `1px solid ${a.severity === 'critical' ? 'rgba(248,113,113,0.25)' : 'rgba(251,146,60,0.2)'}`, animationDelay: `${i * 50}ms` }}>
                        <div style={{ fontSize: 13, color: C.white, marginBottom: 3 }}>{a.icon} {a.message}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>👉 {a.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* ═══════════════════════════════════════
                6. SMART INSIGHTS — scannable, lower priority
            ═══════════════════════════════════════ */}
            <div style={{ ...glassCard, borderRadius: 18, padding: 24, marginBottom: 28, animation: "fadeUp 0.3s ease 0.3s both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(34,211,238,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>💡</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>Smart Insights</div>
                </div>

                {(() => {
                  // Build insights from data already in scope — no API call needed
                  const _ins = []

                  // 1. Peak hour insight
                  if (canonicalPeakLabel) {
                    const _pPlat = dailyBrief?.displayPlat || 'your top platform'
                    const _pAvg = dailyBrief?.displayAvg
                    _ins.push({
                      title: `Your peak window is ${canonicalPeakLabel} on ${_pPlat}`,
                      body: _pAvg > 0
                        ? `Sessions at this hour average $${_pAvg.toFixed(0)} — ${Math.round(_pAvg / Math.max(avgPerHour, 0.01) * 10) / 10}x your overall rate. Go live during this window to maximise earnings.`
                        : `This is when your fans are most active. Streaming at this time consistently will grow your peak-hour session count.`,
                      action: `Schedule your next stream around ${canonicalPeakLabel}`
                    })
                  }

                  // 2. Best platform insight
                  const _topPlatEntry = Object.entries(platformVelocity || {}).filter(([,v]) => v != null).sort((a,b) => b[1]-a[1])[0]
                  if (_topPlatEntry) {
                    const [_tp, _tv] = _topPlatEntry
                    const _tpLabel = _tp.replace('BongaCams','Bonga').replace('MyFreeCams','MFC').replace(/chaturbate/i,'Chaturbate')
                    _ins.push({
                      title: `${_tpLabel} is your highest-ROI platform at $${_tv.toFixed(2)}/hr`,
                      body: Object.keys(platformVelocity).length > 1
                        ? `Focus your high-effort streams here. Lower-ROI platforms can fill off-peak slots, but ${_tpLabel} should get your peak-hour time.`
                        : `Your sessions here average $${_tv.toFixed(2)}/hr. Consistent streaming builds compounding fan loyalty — each session raises your baseline.`,
                      action: `Prioritise ${_tpLabel} for peak-hour streams`
                    })
                  }

                  // 3. Session average vs top fan contribution
                  const _topWhale = whales?.[0]
                  if (_topWhale && _topWhale.totalUSD > 0) {
                    const _pct = totalRevenue > 0 ? Math.round((_topWhale.totalUSD / totalRevenue) * 100) : 0
                    _ins.push({
                      title: `${_topWhale.username} accounts for ${_pct}% of your lifetime revenue`,
                      body: _pct >= 30
                        ? `High fan concentration is a risk — if they churn your earnings drop sharply. Nurture 2–3 backup whales to reduce dependency.`
                        : `They've spent $${_topWhale.totalUSD.toFixed(0)} lifetime. A personalised message when they've been quiet for 7+ days typically brings them back.`,
                      action: _topWhale.daysSinceLastTip > 7 ? `Send ${_topWhale.username} a re-engage message now` : `Keep ${_topWhale.username} warm — they tipped recently`
                    })
                  } else if (avgPerHour > 0) {
                    // Fallback: session avg insight
                    const _sessAvg = sessions.length > 0 ? totalRevenue / sessions.length : 0
                    _ins.push({
                      title: `You average $${_sessAvg.toFixed(0)} per session at $${avgPerHour.toFixed(2)}/hr`,
                      body: `Sessions over 60 minutes earn disproportionately more — longer streams let tipping patterns compound. Aim for at least one 90-min session per week.`,
                      action: `Try a 90-min stream at your peak hour`
                    })
                  }

                  if (_ins.length === 0) return (
                    <div style={{ fontSize: 13, color: C.muted, padding: '12px 0' }}>Upload more session data to generate personalised insights.</div>
                  )

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {_ins.map((ins, i) => (
                        <div key={i} style={{ padding: "13px 16px", borderRadius: 10, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4, lineHeight: 1.4 }}>{ins.title}</div>
                          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.55, marginBottom: 8 }}>{ins.body}</div>
                          <div style={{ fontSize: 11, color: C.cyan, fontWeight: 600 }}>👉 {ins.action}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

            {/* Dependency risk + pre-tip behavior — kept, moved lower */}
            {dependencyRisk && dependencyRisk.level !== 'low' && (
              <div style={{ ...glassCard, borderRadius: 14, padding: 20, marginBottom: 20, border: `1px solid ${dependencyRisk.level === 'high' ? 'rgba(248,113,113,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: dependencyRisk.level === 'high' ? "rgba(248,113,113,0.15)" : "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {dependencyRisk.level === 'high' ? '🚨' : '⚠️'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>Revenue Dependency Risk — {dependencyRisk.level === 'high' ? 'High' : 'Medium'}</div>
                    <div style={{ fontSize: 13, color: C.text, marginBottom: 10 }}>{dependencyRisk.message}</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {[
                        { label: "Top fan", value: `${dependencyRisk.top1Pct}%` },
                        { label: "Top 3 fans", value: `${dependencyRisk.top3Pct}%` },
                        { label: "Top 5 fans", value: `${dependencyRisk.top5Pct}%` },
                        { label: "Loss if #1 leaves", value: `$${dependencyRisk.lossIfTopFanLeaves}` },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ fontSize: 10, color: C.muted }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {preTipBehavior && (
              <div style={{ ...glassCard, borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 20 }}>🧠</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.white }}>Tip Behavior Patterns</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>Avg gap between tips</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.cyan }}>{preTipBehavior.avgGapMinutes} min</div>
                  </div>
                  {preTipBehavior.peakTippingWindow && (
                    <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>Peak tipping window</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>{preTipBehavior.peakTippingWindow.label}</div>
                    </div>
                  )}
                </div>
                <div style={{ padding: "10px 14px", background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 9, fontSize: 13, color: C.text }}>
                  💡 {preTipBehavior.recommendation}
                </div>
                {preTipBehavior.clusteringDetected && (
                  <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 8, fontSize: 12, color: C.cyan }}>
                    🔥 Tip clustering detected — fans tip in bursts. Acknowledge tips publicly to trigger more.
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {activeTab === "platforms" && <PlatformsTab tips={tips} sessions={sessions} platforms={platforms} platformTimes={platformTimes} platformTimeFilter={platformTimeFilter} setPlatformTimeFilter={setPlatformTimeFilter} />}

        {activeTab === "whales" && <WhalesTab whales={whales} filteredWhales={filteredWhales} allPlatforms={allPlatforms} whaleFilter={whaleFilter} setWhaleFilter={setWhaleFilter} platformFilter={platformFilter} setPlatformFilter={setPlatformFilter} chartDrillDay={chartDrillDay} setChartDrillDay={setChartDrillDay} setFanSearchOpen={setFanSearchOpen} setSelectedWhale={setSelectedWhale} setMessageTarget={setMessageTarget} setMessageIndex={setMessageIndex} setMessageCopied={setMessageCopied} tipperNotes={tipperNotes} setNoteTarget={setNoteTarget} setNoteText={setNoteText} isPro={isPro} openUpgradeModal={openUpgradeModal} />}

        {activeTab === "live" && <LiveTab sessions={sessions} tokenRates={tokenRates} liveActive={liveActive} setLiveActive={setLiveActive} liveStartTime={liveStartTime} setLiveStartTime={setLiveStartTime} liveEvents={liveEvents} setLiveEvents={setLiveEvents} liveGoalTokens={liveGoalTokens} setLiveGoalTokens={setLiveGoalTokens} livePlatform={livePlatform} setLivePlatform={setLivePlatform} liveTipInput={liveTipInput} setLiveTipInput={setLiveTipInput} liveTick={liveTick} liveStrategy={liveStrategy} setLiveStrategy={setLiveStrategy} flashTipId={flashTipId} isHydratingHistory={isHydratingHistory} processedTipIds={processedTipIds} prevPhaseRef={prevPhaseRef} coachingCooldowns={coachingCooldowns} firedAlertsLog={firedAlertsLog} phaseChangeLog={phaseChangeLog} liveTipsChannelRef={liveTipsChannelRef} />}

        {activeTab === "sessions" && <SessionsTab sessions={sessions} analytics={analytics} meaningfulOnly={meaningfulOnly} setMeaningfulOnly={setMeaningfulOnly} />}

        {activeTab === "data" && <DataTab tips={tips} tokenRates={tokenRates} setTokenRates={setTokenRates} showRateEditor={showRateEditor} setShowRateEditor={setShowRateEditor} tipPage={tipPage} setTipPage={setTipPage} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} deleteTip={deleteTip} setShowDeleteConfirm={setShowDeleteConfirm} />}

        {activeTab === "upload" && <UploadTab user={user} router={router} uploading={uploading} uploadPlatform={uploadPlatform} setUploadPlatform={setUploadPlatform} handleCSV={handleCSV} isPro={isPro} allPlatforms={allPlatforms} freePlatformLimitReached={freePlatformLimitReached} />}

        {activeTab === "monthly" && <MonthlyTab analytics={analytics} monthlyGoal={monthlyGoal} goalInput={goalInput} setGoalInput={setGoalInput} showGoalEditor={showGoalEditor} setShowGoalEditor={setShowGoalEditor} saveMonthlyGoal={saveMonthlyGoal} />}

        {activeTab === "titles" && (
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <TitleGenerator C={C} glassCard={glassCard} analytics={analytics} tips={tips} sessions={sessions} whales={whales} />
          </div>
        )}

        {activeTab === "help" && <HelpTab />}

        {activeTab === 'analytics' && <AnalyticsCharts tips={tips} />}
        {activeTab === 'planner' && (
          _plannerLock.locked
            ? <div style={{ padding: '32px 0' }}><LockedInsightCard title="Stream Planner" description="Plan your schedule around your best earning windows." lockType="needs_data" requirement={_plannerLock.message} ctaLabel="Upload More Data" ctaAction={() => handleTabChange('import')} /></div>
            : <StreamPlanner tips={tips} isPro={true} />
        )}
        {activeTab === 'moneymap' && (
          _moneyMapLock.locked
            ? <div style={{ padding: '32px 0' }}><LockedInsightCard title="Money Map" description="See where and when your money comes from across sessions and platforms." lockType="needs_data" requirement={_moneyMapLock.message} ctaLabel="Upload More Data" ctaAction={() => handleTabChange('import')} /></div>
            : <MoneyMap tips={tips} isPro={true} />
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
            <div className="modal-inner" style={{ width: 560, maxHeight: "90vh", overflowY: "auto", ...glassCard, borderRadius: 20 }}>
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    {[{ label: "First tip", value: firstTip ? new Date(firstTip.date_time).toLocaleDateString() : "—" }, { label: "Last tip", value: `${new Date(w.lastTipDate).toLocaleDateString()} (${daysSinceLastTip}d ago)` }, { label: "Avg days between tips", value: `${avgDaysBetweenTips} days` }, { label: "Churn risk", value: churnRisk, color: churnColor }].map(({ label, value, color }) => (
                      <div key={label} style={{ padding: 14, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: color || C.white }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {w.typicalOnlineHours && w.typicalOnlineHours !== "Unknown" && (
                    <div style={{ padding: "9px 14px", background: `${C.cyan}10`, border: `1px solid ${C.cyan}25`, borderRadius: 9, marginBottom: 12 }}>
                      <span style={{ fontSize: 12, color: C.cyan }}>🕐 Best time to reach: <strong>{w.typicalOnlineHours}</strong></span>
                    </div>
                  )}
                  {(() => {
                    const dayKeys = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
                    const dayCounts = { Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0 }
                    whaleTips.forEach(t => {
                      const d = new Date(t.date_time).getUTCDay()
                      const key = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]
                      if (key in dayCounts) dayCounts[key]++
                    })
                    const maxCount = Math.max(...Object.values(dayCounts), 1)
                    return (
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>📅 Tips by day of week</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                          {dayKeys.map(d => {
                            const count = dayCounts[d]
                            const intensity = count / maxCount
                            const bg = intensity === 0 ? "rgba(255,255,255,0.04)" : intensity < 0.33 ? "rgba(124,92,255,0.2)" : intensity < 0.66 ? "rgba(124,92,255,0.5)" : "rgba(124,92,255,0.9)"
                            return (
                              <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <div style={{ width: "100%", height: 30, borderRadius: 6, background: bg, border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: count > 0 ? C.white : C.muted }}>{count || ""}</span>
                                </div>
                                <span style={{ fontSize: 9, color: C.muted }}>{d}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🏆 Top 3 Tips</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[...whaleTips].sort((a,b) => b.usd - a.usd).slice(0,3).map((t, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 14 }}>{["🥇","🥈","🥉"][i]}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>{new Date(t.date_time).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>${t.usd.toFixed(2)}</div>
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
            <div className="modal-inner" style={{ width: 520, ...glassCard, borderRadius: 20, overflow: "hidden" }}>
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
                        }).then(() => {})
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
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 10 }}>Early access users can lock in founding pricing:</div>
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

      {/* FAN SEARCH MODAL */}
      {fanSearchOpen && (() => {
        const q = fanSearchQuery.toLowerCase().trim()
        const results = q.length < 1 ? [] : whales.filter(w => w.username?.toLowerCase().includes(q)).slice(0, 8)
        return (
          <div onClick={() => { setFanSearchOpen(false); setFanSearchQuery("") }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1010, padding: "80px 20px 20px" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 540, background: "rgba(15,20,32,0.98)", backdropFilter: "blur(24px)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 80px rgba(59,130,246,0.2)", overflow: "hidden" }}>
              <div style={{ height: 3, background: "linear-gradient(90deg, #3b82f6, #a855f7, #ec4899)" }} />
              <div style={{ padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, background: "rgba(255,255,255,0.05)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", padding: "10px 14px" }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🔍</span>
                  <input
                    autoFocus
                    value={fanSearchQuery}
                    onChange={e => setFanSearchQuery(e.target.value)}
                    placeholder="Search by username..."
                    style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.white, fontSize: 15, fontFamily: "inherit" }}
                  />
                  {fanSearchQuery && (
                    <button onClick={() => setFanSearchQuery("")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
                  )}
                </div>

                {q.length < 1 && (
                  <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "20px 0" }}>Type a username to search your fans</p>
                )}

                {q.length >= 1 && results.length === 0 && (
                  <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "20px 0" }}>No fans found matching "{fanSearchQuery}"</p>
                )}

                {results.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(236,72,153,0.3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: C.white, flexShrink: 0 }}>
                        {w.username?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{w.username}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{w.platform} · {w.tipCount} tips · last {new Date(w.lastTipDate).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.green }}>${w.totalUSD.toFixed(2)}</div>
                      <span style={{ padding: "3px 8px", borderRadius: 100, background: `${TIER_COLORS[w.tier]}20`, color: TIER_COLORS[w.tier], fontSize: 10, fontWeight: 600 }}>{w.tier}</span>
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <button onClick={() => { setFanSearchOpen(false); setFanSearchQuery("") }} style={{ padding: "8px 20px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: C.muted, fontSize: 13, cursor: "pointer" }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* SHARE MY STATS MODAL */}
      {/* ── NOTE MODAL ── */}
      {noteTarget && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ ...glassCard, borderRadius:20, padding:28, width:"100%", maxWidth:440, border:"1px solid rgba(245,158,11,0.3)" }}>
            <div style={{ fontSize:18, fontWeight:800, color:C.white, marginBottom:4 }}>📝 Note for {noteTarget}</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>Private note — only you can see this</div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="e.g. Loves privates, tips on Sundays, favorite toy is the Lush..."
              rows={4}
              style={{ width:"100%", padding:"10px 12px", borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(245,158,11,0.3)", color:C.white, fontSize:13, outline:"none", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }}
            />
            <div style={{ display:"flex", gap:10, marginTop:14 }}>
              <button onClick={() => saveTipperNote(noteTarget, noteText)}
                disabled={noteSaving}
                style={{ flex:1, padding:"10px 0", borderRadius:10, background:"linear-gradient(135deg,#F59E0B,#EC4899)", border:"none", color:C.white, fontSize:14, fontWeight:700, cursor:"pointer" }}>
                {noteSaving ? "Saving..." : "Save Note"}
              </button>
              {tipperNotes[noteTarget?.toLowerCase()]?.note && (
                <button onClick={() => saveTipperNote(noteTarget, '')}
                  style={{ padding:"10px 14px", borderRadius:10, background:"rgba(248,113,113,0.15)", border:"1px solid rgba(248,113,113,0.3)", color:C.red, fontSize:13, cursor:"pointer" }}>
                  Delete
                </button>
              )}
              <button onClick={() => setNoteTarget(null)}
                style={{ padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:C.muted, fontSize:13, cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {shareModalOpen && (() => {
        const topFan = whales[0]
        const bestDayLabel = analyticsbestDay?.day || null
        const platforms = [...new Set(tips.map(t => t.platform))].join(" & ")
        const oneTimerPct = whales.length > 0 ? Math.round((whales.filter(w => w.tipCount === 1).length / whales.length) * 100) : 0
        const cardLines = [
          `💰 Total Earned: $${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          topFan ? `🏆 Top Fan: ${topFan.username} ($${topFan.totalUSD.toFixed(2)})` : null,
          bestDayLabel ? `📅 Best Day: ${bestDayLabel}s` : null,
          `👥 ${whales.length} total fans across ${platforms}`,
          `🔁 ${oneTimerPct}% one-time tippers — that many to win back!`,
          `\nAnalytics by CamCash → camcashgrl.com`,
        ].filter(Boolean).join("\n")

        return (
          <div onClick={() => setShareModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1010, padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "rgba(15,20,32,0.98)", backdropFilter: "blur(24px)", borderRadius: 24, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 80px rgba(236,72,153,0.2)", overflow: "hidden" }}>
              <div style={{ height: 4, background: "linear-gradient(90deg, #ec4899, #a855f7, #3b82f6)" }} />
              <div style={{ padding: 32 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 6 }}>📤 Share My Stats</h2>
                <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Copy your earnings snapshot to flex on Twitter or in cam communities</p>

                {/* Stats card preview */}
                <div style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(236,72,153,0.1))", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", padding: 20, marginBottom: 20, fontFamily: "monospace" }}>
                  {cardLines.split("\n").map((line, i) => (
                    <div key={i} style={{ fontSize: 13, color: line.startsWith("Analytics") ? C.cyan : C.white, lineHeight: 1.9, fontWeight: line.startsWith("Analytics") ? 600 : 400 }}>{line}</div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { navigator.clipboard.writeText(cardLines); setShareModalOpen(false); setToast("Copied to clipboard! 🎉") }}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, background: "linear-gradient(135deg, #ec4899, #a855f7)", border: "none", color: C.white, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 20px rgba(236,72,153,0.3)" }}>
                    📋 Copy to Clipboard
                  </button>
                  <button
                    onClick={() => { const encoded = encodeURIComponent(cardLines); window.open(`https://twitter.com/intent/tweet?text=${encoded}`, "_blank") }}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, background: "rgba(29,161,242,0.15)", border: "1px solid rgba(29,161,242,0.4)", color: "#1DA1F2", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    𝕏 Post to Twitter
                  </button>
                </div>

                <button onClick={() => setShareModalOpen(false)} style={{ width: "100%", marginTop: 12, padding: "10px", borderRadius: 10, background: "transparent", border: "none", color: C.muted, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: 272, background: "rgba(15,20,32,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 20px", color: C.white, fontSize: 14, zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}>
        {toast}
        </div>
      )}
      <SiteFooter variant="simple" />
    </div>
  )
}
