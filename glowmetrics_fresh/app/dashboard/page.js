"use client"
import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { parseCSV, aggregateRows as runEngine } from "../../lib/analytics"

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

// ── FIX: Standalone copy button component so each item can have its own
// copied state WITHOUT calling useState inside a .map() callback.
// Rules of Hooks require hooks to only be called at the top level of a
// React function component — never inside loops, conditions, or callbacks.
// ── Title Generator extracted as a proper component so useState calls are legal
// ============================================================
// ROOM TITLE ENGINE — ONE TITLE AT A TIME
// Formula: HOOK + TARGET + ACTION + REWARD + URGENCY
// ============================================================

function buildOneTitle(ctx) {
  const {
    isPeakNow, peakSoon, bestHourLabel, hoursUntilPeak,
    hasWhales, topWhaleName, whaleCount,
    hasReturners, returningPct,
    lowActivity, todayIsBestDay, todayDay,
    tokenGoal, action, toy,
    useEmojis, avgSessionUSD,
  } = ctx

  const e = (emoji) => useEmojis ? emoji : ""

  // ── POOLS for each formula component ──────────────────────

  const hooks = []
  if (isPeakNow)        hooks.push("going live NOW", `it's my best hour ${e("⏰")}`, `live right now ${e("🔴")}`)
  if (peakSoon)         hooks.push(`going hard for ${hoursUntilPeak}h then I'm done`, `starting soon ${e("⏳")}`, "catch me before I'm gone")
  if (lowActivity)      hooks.push(`miss me? ${e("👀")}`, "been a minute", `I've been thinking about you ${e("💭")}`)
  if (todayIsBestDay)   hooks.push(`${todayDay}s are my best ${e("🔥")}`, "tonight hits different", `peak night ${e("🌙")}`)
  hooks.push(
    `bad girl tonight ${e("😈")}`, `you won't behave… ${e("😏")}`,
    `naughty energy rn ${e("💋")}`, `feeling extra tonight ${e("🔥")}`,
    `the vibe is different ${e("👀")}`, `not holding back tonight ${e("😈")}`,
    `late night mode ${e("🌙")}`, `let's get into it ${e("💕")}`,
  )

  const targets = []
  if (hasWhales)   targets.push("my top tippers", "VIPs", `my ${e("💎")} fans`, "high rollers", "my favorites")
  if (hasReturners) targets.push("my regulars", "my favorites", "the ones who know")
  targets.push("good boys only", "the right ones", "you", "whoever wants in")

  const actions = []
  if (toy)        actions.push(`tip to control my ${toy}`, `control my ${toy} ${e("🎮")}`, `activate my ${toy}`)
  if (tokenGoal)  actions.push(`help me hit ${tokenGoal}`, `tip to reach ${tokenGoal}`, `get me to ${tokenGoal}`)
  if (action)     actions.push(`tip → ${action}`, `earn ${action}`, `unlock ${action}`)
  actions.push(
    "tip to control me", "decide what happens", "tip to run the show",
    "join now", "tip fast", "make it happen"
  )

  const rewards = []
  if (action)     rewards.push(`${action} ${e("😏")}`, `you pick what I do ${e("💋")}`, action)
  if (toy)        rewards.push(`I feel every tip ${e("⚡")}`, "I react to everything")
  if (tokenGoal)  rewards.push(`I'll make it worth it ${e("😏")}`, "special surprise at goal", `something special ${e("💕")}`)
  rewards.push(
    `private show ${e("💎")}`, `exclusive content ${e("🔒")}`,
    `I'll do anything ${e("😏")}`, `special surprise ${e("🎁")}`,
    `you choose everything ${e("👑")}`, `I react to every tip ${e("⚡")}`,
    `full attention ${e("💕")}`, `I'm all yours ${e("💋")}`,
  )

  const urgencies = []
  if (isPeakNow)  urgencies.push("starting now", "live now", "right now only")
  if (peakSoon)   urgencies.push(`${hoursUntilPeak}h left`, "for a limited time", "before I slow down")
  urgencies.push(
    "tonight only", "before I log off", "limited time",
    "now or never", "don't wait", "this hour only",
    "while I'm in this mood", "for the next hour",
  )

  // ── Pick components, weighted toward data context ──────────
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

  const hook    = pick(hooks)
  const target  = pick(targets)
  const act     = pick(actions)
  const reward  = pick(rewards)
  const urgency = pick(urgencies)

  // ── Assemble using formula variations ─────────────────────
  // Mix up the structure so it doesn't feel templated
  const structures = [
    // Full formula
    `${hook} • ${target} ${act} → ${reward} (${urgency})`,
    // Hook + target + action + reward
    `${hook} ${target} ${act} ${reward}`,
    // Hook + action + reward + urgency
    `${hook} ${act} → ${reward} ${urgency}`,
    // Target + action + reward + urgency
    `${target} ${act} • ${reward} • ${urgency}`,
    // Hook + target + reward
    `${hook} ${target} get ${reward}`,
    // Action + reward + urgency (clean/short)
    `${act} → ${reward} (${urgency})`,
  ]

  // Pick a structure, clean it up
  let title = pick(structures)

  // Clean: collapse multiple spaces, trim, cap at 100 chars
  title = title.replace(/\s{2,}/g, " ").trim()
  if (title.length > 100) title = title.slice(0, 97) + "..."

  // Determine which formula components drove this title
  const drivers = []
  if (isPeakNow || peakSoon)   drivers.push("peak hour timing")
  if (hasWhales)               drivers.push(`${whaleCount} high-value fans`)
  if (todayIsBestDay)          drivers.push(`${todayDay} is your best day`)
  if (lowActivity)             drivers.push("low recent activity")
  if (tokenGoal)               drivers.push(`${tokenGoal} token goal`)
  if (toy)                     drivers.push(`${toy} toy active`)
  if (hasReturners)            drivers.push(`${returningPct}% returning fans`)
  if (drivers.length === 0)    drivers.push("general engagement")

  return { title, drivers }
}

function TitleGenerator({ C, glassCard, analytics, tips, sessions, whales }) {
  const [current, setCurrent] = useState(null)   // { title, drivers }
  const [history, setHistory] = useState([])      // last 5 titles
  const [copiedCurrent, setCopiedCurrent] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [tokenGoal, setTokenGoal] = useState(500)
  const [action, setAction] = useState("")
  const [toy, setToy] = useState("")
  const [useEmojis, setUseEmojis] = useState(true)

  const buildCtx = () => {
    const now = new Date()
    const currentHour = now.getHours()
    const todayDay = now.toLocaleDateString("en-US", { weekday: "long" })

    // Best hour from sessions
    const hourTotals = {}
    ;(sessions || []).forEach(s => {
      const h = new Date(s.startTime).getHours()
      hourTotals[h] = (hourTotals[h] || 0) + s.totalUSD
    })
    const bestHourEntry = Object.entries(hourTotals).sort((a,b) => b[1]-a[1])[0]
    const bestHour = bestHourEntry ? parseInt(bestHourEntry[0]) : null
    const bestHourLabel = bestHour !== null
      ? (bestHour === 0 ? "12 AM" : bestHour < 12 ? `${bestHour} AM` : bestHour === 12 ? "12 PM" : `${bestHour-12} PM`)
      : null
    const hoursUntilPeak = bestHour !== null ? (bestHour - currentHour + 24) % 24 : 99
    const isPeakNow = hoursUntilPeak <= 1
    const peakSoon = hoursUntilPeak <= 3 && !isPeakNow

    // Best day
    const dayTotals = {}
    ;(sessions || []).forEach(s => {
      const d = new Date(s.startTime).toLocaleDateString("en-US", { weekday: "long" })
      dayTotals[d] = (dayTotals[d] || 0) + s.totalUSD
    })
    const bestDay = Object.entries(dayTotals).sort((a,b) => b[1]-a[1])[0]?.[0] || null
    const todayIsBestDay = bestDay === todayDay

    // Whales
    const sorted = [...(whales || [])].sort((a,b) => b.totalUSD - a.totalUSD)
    const whaleCount = sorted.filter(w => w.tier === "Whale" || w.tier === "Shark").length
    const topWhaleName = sorted[0]?.username || null
    const hasWhales = whaleCount > 0

    // Returning fans
    const fanCounts = {}
    ;(tips || []).forEach(t => { fanCounts[t.username] = (fanCounts[t.username] || 0) + 1 })
    const total = Object.keys(fanCounts).length
    const returning = Object.values(fanCounts).filter(c => c > 1).length
    const returningPct = total > 0 ? Math.round((returning / total) * 100) : 0
    const hasReturners = returningPct > 30

    // Low activity
    const recentTips = (tips || []).filter(t => (Date.now() - new Date(t.date_time||t.dateRaw)) / 86400000 <= 7)
    const lowActivity = recentTips.length < 5

    const avgSessionUSD = sessions?.length
      ? sessions.reduce((s,x) => s + x.totalUSD, 0) / sessions.length : 0

    return {
      isPeakNow, peakSoon, bestHour, bestHourLabel, hoursUntilPeak,
      hasWhales, topWhaleName, whaleCount,
      hasReturners, returningPct,
      lowActivity, todayIsBestDay, todayDay,
      tokenGoal, action, toy, useEmojis, avgSessionUSD,
    }
  }

  const generate = () => {
    const ctx = buildCtx()
    const result = buildOneTitle(ctx)
    // Push previous to history (keep last 5)
    if (current) setHistory(h => [current, ...h].slice(0, 5))
    setCurrent(result)
    setCopiedCurrent(false)
  }

  const copyTitle = (title, idx = null) => {
    navigator.clipboard.writeText(title)
    if (idx === null) {
      setCopiedCurrent(true)
      setTimeout(() => setCopiedCurrent(false), 2000)
    } else {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    }
  }

  const ctx = buildCtx()

  // Context badges for display
  const badges = []
  if (ctx.isPeakNow && ctx.bestHourLabel)  badges.push({ label: `🔴 Peak hour NOW (${ctx.bestHourLabel})`, color: C.orange })
  else if (ctx.peakSoon && ctx.bestHourLabel) badges.push({ label: `⏳ Peak in ${ctx.hoursUntilPeak}h (${ctx.bestHourLabel})`, color: C.gold })
  if (ctx.hasWhales)    badges.push({ label: `💎 ${ctx.whaleCount} VIP fans`, color: C.gold })
  if (ctx.todayIsBestDay) badges.push({ label: `📅 Best day: ${ctx.todayDay}`, color: C.green })
  if (ctx.hasReturners) badges.push({ label: `🔁 ${ctx.returningPct}% return rate`, color: C.cyan })
  if (ctx.lowActivity)  badges.push({ label: `💤 Low recent activity`, color: C.orange })
  if (ctx.tokenGoal)    badges.push({ label: `🎯 Goal: ${ctx.tokenGoal} tokens`, color: C.pink })

  const inp = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", padding: "10px 14px", borderRadius: 10, color: C.white, outline: "none", width: "100%", fontSize: 13 }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", paddingTop: 8 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.white, marginBottom: 4 }}>🎬 Room Title Generator</h1>
        <p style={{ fontSize: 13, color: C.muted }}>Formula: Hook + Target + Action + Reward + Urgency — one title at a time</p>
      </div>

      {/* LIVE DATA BADGES */}
      {badges.length > 0 && (
        <div style={{ ...glassCard, borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Influencing your titles right now</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {badges.map((b, i) => (
              <span key={i} style={{ padding: "4px 12px", borderRadius: 20, background: `${b.color}15`, border: `1px solid ${b.color}30`, fontSize: 12, fontWeight: 600, color: b.color }}>{b.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* INPUTS */}
      <div style={{ ...glassCard, borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Token Goal</div>
            <input type="number" value={tokenGoal} onChange={e => setTokenGoal(Number(e.target.value))} style={inp} placeholder="e.g. 500" />
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Reward / Action</div>
            <input value={action} onChange={e => setAction(e.target.value)} style={inp} placeholder="e.g. flash, dance" />
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Toy (optional)</div>
            <input value={toy} onChange={e => setToy(e.target.value)} style={inp} placeholder="e.g. Lush, Domi" />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: C.text }}>
            <input type="checkbox" checked={useEmojis} onChange={() => setUseEmojis(v => !v)} style={{ accentColor: C.pink }} />
            Include emojis
          </label>
          <button onClick={generate} style={{ padding: "11px 28px", borderRadius: 10, background: "linear-gradient(135deg, #EC4899, #7C5CFF)", border: "none", color: C.white, fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 0 24px rgba(236,72,153,0.4)", letterSpacing: 0.3 }}>
            ✨ Generate Title
          </button>
        </div>
      </div>

      {/* CURRENT TITLE — big, prominent */}
      {current && (
        <div style={{ ...glassCard, borderRadius: 16, padding: 28, marginBottom: 20, border: "1px solid rgba(236,72,153,0.3)", background: "linear-gradient(135deg, rgba(236,72,153,0.06), rgba(124,92,255,0.06))" }}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Your title</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.white, lineHeight: 1.4, marginBottom: 20 }}>
            {current.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {current.drivers.map((d, i) => (
                <span key={i} style={{ fontSize: 10, color: C.cyan, padding: "3px 9px", borderRadius: 20, background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)" }}>📊 {d}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={generate} style={{ padding: "8px 18px", borderRadius: 9, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: C.muted, fontSize: 13, cursor: "pointer" }}>
                🔁 Try Another
              </button>
              <button onClick={() => copyTitle(current.title)} style={{ padding: "8px 22px", borderRadius: 9, background: copiedCurrent ? "rgba(16,185,129,0.2)" : "linear-gradient(135deg, #22D3EE, #EC4899)", border: copiedCurrent ? "1px solid rgba(16,185,129,0.4)" : "none", color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {copiedCurrent ? "✔ Copied!" : "📋 Copy Title"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {!current && (
        <div style={{ textAlign: "center", padding: "52px 20px", color: C.muted }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 6 }}>One perfect title, every time</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>Built from the viral formula: Hook + Target + Action + Reward + Urgency.<br/>Your earnings data shapes every title.</div>
        </div>
      )}

      {/* HISTORY */}
      {history.length > 0 && (
        <div style={{ ...glassCard, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Previous titles</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((h, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", gap: 12 }}>
                <span style={{ fontSize: 13, color: C.text, flex: 1, lineHeight: 1.4 }}>{h.title}</span>
                <button onClick={() => copyTitle(h.title, i)} style={{ flexShrink: 0, padding: "4px 12px", borderRadius: 7, background: copiedIdx === i ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${copiedIdx === i ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)"}`, color: copiedIdx === i ? C.green : C.muted, fontSize: 11, cursor: "pointer" }}>
                  {copiedIdx === i ? "✔" : "📋"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, padding: "11px 16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 10 }}>
        <div style={{ fontSize: 12, color: C.gold }}>💡 Refresh every 20–30 min — platforms rank active streams higher when titles change frequently.</div>
      </div>
    </div>
  )
}

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
  const [platformTimeFilter, setPlatformTimeFilter] = useState("ALL")
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
      try {
        supabase.from('beta_users').upsert({
          user_id: user.id,
          email: user.email,
          signed_up_at: user.created_at
        }, { onConflict: 'user_id', ignoreDuplicates: true })
        supabase.from('analytics_events').insert({
          user_id: user.id,
          event_name: 'dashboard_opened',
          properties: { email: user.email }
        })
      } catch(e) {}
    })
  }, [])

  useEffect(() => {
    if (!tips.length) return
    const interval = setInterval(() => { setLiveAnalytics(analytics) }, 5000)
    return () => clearInterval(interval)
  }, [tips])

  const loadData = async (uid) => {
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
      if (allData.length) { setTips(allData); const result = runEngine(allData); setAnalytics(result) }
    } finally { setLoading(false) }
  }

  const removeDuplicates = (existingTips, newTips) => {
    const existingKeys = new Set(existingTips.map(t => `${t.date_time}_${t.username}_${t.tokens}_${t.platform}`))
    return newTips.filter(t => !existingKeys.has(`${t.dateRaw || t.date_time}_${t.username}_${t.tokens}_${t.platform}`))
  }

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
          usd,
          tip_note: r.tip_note || r.note || ""
        }
      })

      const BATCH_SIZE = 500
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from("tips").insert(batch)
        if (error) { showToast("❌ " + error.message); setUploading(false); return }
      }

      setUploadCount(uploadCount + 1)
      const newCount = uploadCount + 1
      if (newCount === 2 || newCount === 3) setShowBetaPrompt(true)
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
  const avgPerHour = sessions.length ? sessions.reduce((sum, s) => sum + (s.usdPerHour || 0), 0) / sessions.length : 0
  // Single source of truth — pre-computed in aggregateRows, same values used everywhere
  const analyticsbestDay  = analytics?.bestDay  || null
  const analyticsBestHour = analytics?.bestHour || null

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
        const h = new Date(t.date_time || t.dateRaw).getHours()
        hourCounts[h] = (hourCounts[h] || 0) + 1
      })
      const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
      if (!bestHour) return
      const peakHour = parseInt(bestHour[0])
      const currentHour = new Date().getHours()
      const hoursAway = Math.abs(currentHour - peakHour)
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
          message: `${bestDayCount} of your top-earning streams were on ${analyticsbestDay.day}s ($${analyticsbestDay.avg.toFixed(0)} avg). Plan your next high-effort stream for this day`,
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

  const buildRealTimeAlerts = () => {
    const now = Date.now()
    const currentHour = new Date().getHours()
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    const alerts = []

    // --- PLATFORM DAY-OF-WEEK PERFORMANCE ---
    // Computed from actual tip data per platform per day
    const platDayMap = {}
    tips.forEach(t => {
      const p = t.platform
      const day = new Date(t.date_time || t.dateRaw).toLocaleDateString('en-US', { weekday: 'long' })
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
    const platHourMap = {}
    tips.forEach(t => {
      const p = t.platform
      const h = new Date(t.date_time || t.dateRaw).getHours()
      if (!platHourMap[p]) platHourMap[p] = {}
      if (!platHourMap[p][h]) platHourMap[p][h] = 0
      platHourMap[p][h] += t.usd || 0
    })

    const platNames = Object.keys(platHourMap)
    if (platNames.length >= 2) {
      platNames.forEach(plat => {
        const hourVal = platHourMap[plat][currentHour] || 0
        const otherPlats = platNames.filter(p => p !== plat)
        otherPlats.forEach(other => {
          const otherVal = platHourMap[other][currentHour] || 0
          if (hourVal > 0 && otherVal > 0 && hourVal >= otherVal * 1.5) {
            const mult = (hourVal / otherVal).toFixed(1)
            const label = currentHour === 0 ? '12 AM' : currentHour < 12 ? `${currentHour} AM` : currentHour === 12 ? '12 PM' : `${currentHour - 12} PM`
            alerts.push({
              type: 'platform_hour', priority: 1, icon: '⚡', color: '#22D3EE',
              title: `Right now ${plat} earns ${mult}x more than ${other}`,
              message: `At ${label}, ${plat} historically earns $${hourVal.toFixed(0)} vs $${otherVal.toFixed(0)} on ${other}. Stream on ${plat} now.`
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

      const hourCounts = {}
      fanTips.forEach(t => {
        const h = new Date(t.date_time || t.dateRaw).getHours()
        hourCounts[h] = (hourCounts[h] || 0) + 1
      })
      const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])
      if (!sortedHours.length) return

      const peakHour = parseInt(sortedHours[0][0])
      const hoursAway = (peakHour - currentHour + 24) % 24
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
  const realTimeAlerts = buildRealTimeAlerts()

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
        @keyframes pulse-msg { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.25); } }
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
              const recentRev = recentSessions.reduce((s, r) => s + (r.totalUSD || 0), 0)
              const prevRev = prevSessions.reduce((s, r) => s + (r.totalUSD || 0), 0)
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

            {/* WHAT SHOULD I DO RIGHT NOW */}
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

            {/* REAL-TIME LIVE INTELLIGENCE */}
            {realTimeAlerts.length > 0 && (
              <div style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 28, border: "1px solid rgba(34,211,238,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981", animation: "pulse-msg 1.5s infinite" }} />
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>Live Intelligence</div>
                  <div style={{ fontSize: 11, color: C.green, padding: "2px 8px", borderRadius: 20, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>REAL DATA</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {realTimeAlerts.map((a, i) => (
                    <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: `${a.color}0d`, border: `1px solid ${a.color}30`, display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{a.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 3 }}>{a.title}</div>
                        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{a.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PLATFORM DAY PERFORMANCE GRID */}
            {(() => {
              const platDayData = {}
              tips.forEach(t => {
                const p = t.platform
                const day = new Date(t.date_time || t.dateRaw).toLocaleDateString('en-US', { weekday: 'short' })
                if (!platDayData[p]) platDayData[p] = {}
                platDayData[p][day] = (platDayData[p][day] || 0) + (t.usd || 0)
              })
              const platList = Object.keys(platDayData)
              if (platList.length < 1) return null
              const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
              const todayShort = new Date().toLocaleDateString('en-US', { weekday: 'short' })
              return (
                <div style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 28 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 4 }}>📅 Platform Performance by Day</h2>
                  <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Which platform earns most on each day — your real data</p>
                  <div style={{ display: "grid", gridTemplateColumns: `80px repeat(7, 1fr)`, gap: 4 }}>
                    <div />
                    {days.map(d => (
                      <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: d === todayShort ? C.cyan : C.muted, paddingBottom: 6 }}>{d}</div>
                    ))}
                    {platList.map(plat => {
                      const dayVals = days.map(d => platDayData[plat][d] || 0)
                      const maxVal = Math.max(...dayVals, 1)
                      return [
                        <div key={plat + '_label'} style={{ fontSize: 11, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", paddingRight: 8 }}>{plat.replace('BongaCams','Bonga')}</div>,
                        ...days.map((d, di) => {
                          const val = platDayData[plat][d] || 0
                          const intensity = val / maxVal
                          const isToday = d === todayShort
                          const bg = val === 0 ? "rgba(255,255,255,0.03)" : intensity < 0.3 ? "rgba(34,211,238,0.15)" : intensity < 0.6 ? "rgba(34,211,238,0.4)" : "rgba(34,211,238,0.85)"
                          return (
                            <div key={d} title={`${plat} ${d}: $${val.toFixed(0)}`} style={{ height: 32, borderRadius: 6, background: bg, border: isToday ? "2px solid rgba(34,211,238,0.6)" : "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {val > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: intensity > 0.4 ? "#fff" : C.muted }}>${val.toFixed(0)}</span>}
                            </div>
                          )
                        })
                      ]
                    })}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>Today ({todayShort}) is highlighted. Darker = more earnings.</div>
                </div>
              )
            })()}

            {/* TIPPERS LIKELY ONLINE NOW */}
            {(() => {
              const currentHour = new Date().getHours()
              const label = h => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`
              const likelyOnline = whales
                .filter(w => w.tipCount >= 3)
                .map(w => {
                  const fanTips = (w.tips && w.tips.length > 0) ? w.tips : tips.filter(t => t.username.toLowerCase() === w.username.toLowerCase())
                  const hourCounts = {}
                  fanTips.forEach(t => {
                    const h = new Date(t.date_time || t.dateRaw).getHours()
                    hourCounts[h] = (hourCounts[h] || 0) + 1
                  })
                  const sorted = Object.entries(hourCounts).sort((a,b) => b[1]-a[1])
                  if (!sorted.length) return null
                  const peakHour = parseInt(sorted[0][0])
                  const hoursAway = (peakHour - currentHour + 24) % 24
                  const confidence = Math.min(95, Math.round((sorted[0][1] / fanTips.length) * 100 * 2.5))
                  return { ...w, peakHour, hoursAway, confidence, peakLabel: label(peakHour) }
                })
                .filter(Boolean)
                .filter(w => w.hoursAway <= 2 && w.confidence >= 35)
                .sort((a,b) => b.totalUSD - a.totalUSD)
                .slice(0, 4)

              if (!likelyOnline.length) return null
              return (
                <div style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 28 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 4 }}>🟢 Tippers Likely Online Now</h2>
                  <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Based on their real tip-time patterns from your data</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {likelyOnline.map((w, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", flexWrap: "wrap", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{w.username}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>${w.totalUSD.toFixed(0)} lifetime · peaks at {w.peakLabel} · {w.platform}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(16,185,129,0.2)", color: C.green, fontWeight: 700 }}>{w.confidence}% likely</span>
                          <button onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }} style={{ padding: "5px 12px", borderRadius: 8, background: "linear-gradient(135deg,#22D3EE,#EC4899)", border: "none", color: C.white, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>💌 Message</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* SMART INSIGHTS */}
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

            {/* WHAT'S NEXT — FIX: alerts built outside JSX, CopyButton component handles per-item state */}
            <div style={{ ...glassCard, borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #F59E0B, #EC4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧭</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>What's Next</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Personalized alerts based on your tippers' real behavior</div>
                </div>
              </div>

              {whatsNextAlerts.length === 0 ? (
                <div style={{ fontSize: 13, color: C.muted }}>Import more CSV data to unlock personalized alerts based on your tippers' behavior.</div>
              ) : (
                whatsNextAlerts.slice(0, 8).map((a, i) => (
                  <div key={i} style={{ padding: 16, borderRadius: 12, marginBottom: 10, background: `${a.color}08`, border: `1px solid ${a.color}25`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 200 }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{a.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>{a.title}</div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{a.message}</div>
                      </div>
                    </div>
                    {a.cta && (
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                        {/* FIX: CopyButton is a proper component — each instance has its own state */}
                        <CopyButton text={a.reengageMsg} />
                        <button
                          onClick={() => { if (a.whale) { setMessageTarget(a.whale); setMessageIndex(0); setMessageCopied(false) } }}
                          style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", animation: "pulse-msg 2s infinite" }}>
                          💌
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* RE-ENGAGE NOW — FIX: same pattern, CopyButton handles per-row state */}
            <div style={{ ...glassCard, borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 6 }}>💌 Re-engage Now</h2>
              <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Top spenders who haven't tipped recently — reach out before they go cold</p>

              {reengageList.length === 0 ? (
                <div style={{ fontSize: 13, color: C.muted }}>No dormant fans right now — your audience is active! 🎉</div>
              ) : (
                reengageList.map(({ whale: w, days, urgency, msg }, i) => (
                  <div key={i} style={{ padding: 16, borderRadius: 12, marginBottom: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 200 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${urgency}20`, border: `1px solid ${urgency}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: urgency, flexShrink: 0 }}>
                        {w.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{w.username}</span>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${urgency}20`, color: urgency, fontWeight: 600 }}>{days}d ago</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>${w.totalUSD.toFixed(0)} lifetime · {w.tipCount} tips · {w.platform}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      {/* FIX: CopyButton component — no useState inside map */}
                      <CopyButton
                        text={msg}
                        label="📋 Copy Message"
                        copiedLabel="✅ Copied!"
                        style={{ padding: "8px 14px" }}
                      />
                      <button
                        onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }}
                        style={{ padding: "8px 14px", borderRadius: 8, background: "linear-gradient(135deg, rgba(236,72,153,0.3), rgba(124,92,255,0.3))", border: "1px solid rgba(236,72,153,0.4)", color: C.pink, fontSize: 12, fontWeight: 600, cursor: "pointer", animation: "pulse-msg 2s infinite" }}>
                        💌
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* LOSS ALERTS */}
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

            {/* LIVE AI ALERTS */}
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

        {activeTab === "platforms" && (() => {
          // ── Time filter
          const now = Date.now()
          const filterMs = platformTimeFilter === "7D" ? 7 * 86400000
                         : platformTimeFilter === "30D" ? 30 * 86400000
                         : platformTimeFilter === "90D" ? 90 * 86400000
                         : null

          const filteredTips = filterMs
            ? tips.filter(t => now - new Date(t.date_time).getTime() <= filterMs)
            : tips

          // Rebuild platform stats from filtered tips using same logic as engine
          const pfMap = {}
          filteredTips.forEach(t => {
            const k = t.platform || "Unknown"
            if (!pfMap[k]) pfMap[k] = { platform: k, totalUSD: 0, tips: 0, sessions: new Set(), hours: 0 }
            pfMap[k].totalUSD += t.usd || 0
            pfMap[k].tips += 1
          })
          // Overlay session data for hour counts
          const filteredSessions = filterMs
            ? sessions.filter(s => now - new Date(s.startTime).getTime() <= filterMs)
            : sessions
          filteredSessions.forEach(s => {
            if (!pfMap[s.platform]) pfMap[s.platform] = { platform: s.platform, totalUSD: 0, tips: 0, sessions: new Set(), hours: 0 }
            pfMap[s.platform].sessions.add(s.id || s.startTime)
            pfMap[s.platform].hours += s.durationHours || 0
          })
          const filteredPlatforms = Object.values(pfMap).map(p => ({
            platform: p.platform,
            totalUSD: parseFloat(p.totalUSD.toFixed(2)),
            sessions: p.sessions.size,
            hours: parseFloat(p.hours.toFixed(1)),
            usdPerHour: p.hours > 0 ? parseFloat((p.totalUSD / p.hours).toFixed(2)) : 0,
            avgTipSize: p.tips > 0 ? parseFloat((p.totalUSD / p.tips).toFixed(2)) : 0,
            tipCount: p.tips
          })).sort((a, b) => b.totalUSD - a.totalUSD)

          const displayPlatforms = filteredPlatforms.length > 0 ? filteredPlatforms : platforms
          const maxUSD = Math.max(...displayPlatforms.map(p => p.totalUSD), 1)
          const maxUPH = Math.max(...displayPlatforms.map(p => p.usdPerHour), 1)

          const getPlatformInsights = (p) => {
            const insights = []
            const avgUPH = displayPlatforms.reduce((s, x) => s + x.usdPerHour, 0) / (displayPlatforms.length || 1)
            const pctAbove = displayPlatforms.length > 1 ? Math.round(((p.usdPerHour - avgUPH) / avgUPH) * 100) : null
            const bHour = Object.entries(platformTimes[p.platform]?.hours || {}).sort((a, b) => b[1] - a[1])[0]
            const bDay  = Object.entries(platformTimes[p.platform]?.days  || {}).sort((a, b) => b[1] - a[1])[0]
            const isTop = displayPlatforms.length > 1 && p.totalUSD === maxUSD
            const isTopUPH = displayPlatforms.length > 1 && p.usdPerHour === maxUPH
            if (isTop)    insights.push({ icon: "🏆", text: "Your highest revenue platform", color: C.gold })
            if (isTopUPH && !isTop) insights.push({ icon: "⚡", text: "Most efficient — highest $/hour", color: C.cyan })
            if (pctAbove !== null && pctAbove >= 20)  insights.push({ icon: "🔥", text: `Earns ${pctAbove}% more per hour than your average`, color: C.green })
            if (pctAbove !== null && pctAbove <= -20) insights.push({ icon: "📉", text: `${Math.abs(pctAbove)}% below your avg $/hour — consider shifting time`, color: C.orange })
            if (bDay)  insights.push({ icon: "📅", text: `Best day: ${bDay[0]} ($${parseFloat(bDay[1]).toFixed(0)} avg)`, color: C.white })
            if (bHour) insights.push({ icon: "🕐", text: `Peak time: ${formatHour(bHour[0])} ($${parseFloat(bHour[1]).toFixed(0)} earned)`, color: C.white })
            if (p.sessions >= 5 && p.hours / p.sessions < 1) insights.push({ icon: "⏱️", text: "Short sessions — try streaming longer to boost earnings", color: C.muted })
            return insights
          }

          const PLATFORM_EMOJI = { Chaturbate: "🟣", BongaCams: "🔴", MyFreeCams: "🟠", CamSoda: "🟢", Stripchat: "🔵", Flirt4Free: "💜" }

          return (
            <div>
              {/* HEADER + TIME FILTER */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 6 }}>🎯 Platform Comparison</h1>
                  <p style={{ fontSize: 13, color: C.muted }}>See exactly where your time is most valuable</p>
                </div>
                <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                  {[["ALL","All Time"],["7D","7 Days"],["30D","30 Days"],["90D","90 Days"]].map(([val, label]) => (
                    <button key={val} onClick={() => setPlatformTimeFilter(val)} style={{
                      padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s",
                      background: platformTimeFilter === val ? "linear-gradient(135deg, #3b82f6, #ec4899)" : "transparent",
                      color: platformTimeFilter === val ? C.white : C.muted,
                      boxShadow: platformTimeFilter === val ? "0 0 12px rgba(59,130,246,0.4)" : "none"
                    }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* PLATFORM RECOMMENDATION BANNER */}
              {displayPlatforms.length >= 2 && (() => {
                const sorted = [...displayPlatforms].sort((a, b) => b.usdPerHour - a.usdPerHour)
                const top = sorted[0]
                const bottom = sorted[sorted.length - 1]
                if (top.usdPerHour > 0 && bottom.usdPerHour > 0 && top.usdPerHour >= bottom.usdPerHour * 2) {
                  const mult = (top.usdPerHour / bottom.usdPerHour).toFixed(1)
                  return (
                    <div style={{ padding: "14px 18px", borderRadius: 12, background: "linear-gradient(135deg, rgba(34,211,238,0.1), rgba(124,92,255,0.1))", border: "1px solid rgba(34,211,238,0.3)", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20 }}>⚡</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>You earn {mult}x more per hour on {top.platform} than {bottom.platform}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>${top.usdPerHour.toFixed(2)}/hr vs ${bottom.usdPerHour.toFixed(2)}/hr — consider shifting more time to {top.platform}</div>
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* SUMMARY ROW — only when 2+ platforms */}
              {displayPlatforms.length >= 2 && (() => {
                const topRev = [...displayPlatforms].sort((a, b) => b.totalUSD - a.totalUSD)[0]
                const topEff = [...displayPlatforms].sort((a, b) => b.usdPerHour - a.usdPerHour)[0]
                const totalHours = displayPlatforms.reduce((s, p) => s + p.hours, 0)
                const totalEarned = displayPlatforms.reduce((s, p) => s + p.totalUSD, 0)
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
                    {[
                      { icon: "💰", label: "Top Revenue", value: topRev.platform, sub: `$${topRev.totalUSD.toFixed(2)} total`, color: C.gold },
                      { icon: "⚡", label: "Most Efficient", value: topEff.platform, sub: `$${topEff.usdPerHour.toFixed(2)}/hour`, color: C.cyan },
                      { icon: "🕒", label: "Total Hours", value: `${totalHours.toFixed(1)}h`, sub: `across ${displayPlatforms.length} platforms`, color: C.pink },
                      { icon: "💵", label: "Combined Earned", value: `$${totalEarned.toFixed(2)}`, sub: platformTimeFilter === "ALL" ? "all time" : `last ${platformTimeFilter}`, color: C.green },
                    ].map(({ icon, label, value, sub, color }) => (
                      <div key={label} className="dash-card" style={{ ...glassCard, borderRadius: 14, padding: 20 }}>
                        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{icon} {label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* PLATFORM CARDS */}
              {displayPlatforms.map((p, i) => {
                const insights = getPlatformInsights(p)
                const revenueBarPct = Math.round((p.totalUSD / maxUSD) * 100)
                const uphBarPct     = Math.round((p.usdPerHour / maxUPH) * 100)
                const isTop = p.totalUSD === maxUSD && displayPlatforms.length > 1
                const avgSessionUSD = p.sessions > 0 ? (p.totalUSD / p.sessions) : 0
                const emoji = PLATFORM_EMOJI[p.platform] || "🎥"

                return (
                  <div key={i} className="dash-card" style={{
                    ...glassCard, borderRadius: 16, padding: 28, marginBottom: 20,
                    border: isTop ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: isTop ? "0 0 30px rgba(245,158,11,0.1), 0 0 60px rgba(236,72,153,0.08)" : glassCard.boxShadow
                  }}>
                    {/* HEADER */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: isTop ? "linear-gradient(135deg, rgba(245,158,11,0.3), rgba(251,146,60,0.2))" : "rgba(255,255,255,0.06)", border: isTop ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                          {emoji}
                        </div>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>{p.platform}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{p.sessions} sessions · {p.hours.toFixed(1)}h streamed</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {isTop && <div style={{ padding: "4px 12px", borderRadius: 20, background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", fontSize: 11, fontWeight: 700, color: C.gold }}>🏆 Top Platform</div>}
                        <div style={{ fontSize: 11, color: C.muted, padding: "4px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>#{i + 1} of {displayPlatforms.length}</div>
                      </div>
                    </div>

                    {/* STAT GRID */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                      {[
                        { label: "Total Revenue", value: `$${p.totalUSD.toFixed(2)}`, color: C.green },
                        { label: "$/Hour", value: `$${p.usdPerHour.toFixed(2)}`, color: C.cyan },
                        { label: "Avg Session", value: `$${avgSessionUSD.toFixed(2)}`, color: C.pink },
                        { label: "Avg Tip Size", value: `$${p.avgTipSize.toFixed(2)}`, color: C.gold },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* PERFORMANCE BARS */}
                    <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { label: "Revenue share", pct: revenueBarPct, color: C.green },
                        { label: "$/Hour efficiency", pct: uphBarPct, color: C.cyan },
                      ].map(({ label, pct, color }) => (
                        <div key={label}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color }}>{pct}%</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${color}, ${color}80)`, transition: "width 0.6s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* HOURLY HEATMAP */}
                    {(() => {
                      const hourData = platformTimes[p.platform]?.hours || {}
                      const maxEarning = Math.max(...Object.values(hourData), 1)
                      return (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>⏰ Earnings by hour of day</div>
                          <div style={{ display: "flex", gap: 2, flexWrap: "nowrap", overflowX: "auto" }}>
                            {Array.from({ length: 24 }, (_, h) => {
                              const val = hourData[h] || 0
                              const intensity = val / maxEarning
                              const bg = intensity === 0
                                ? "rgba(255,255,255,0.04)"
                                : intensity < 0.33
                                ? "rgba(34,211,238,0.2)"
                                : intensity < 0.66
                                ? "rgba(34,211,238,0.55)"
                                : "rgba(34,211,238,0.95)"
                              const label = h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h-12}p`
                              return (
                                <div key={h} title={`${label}: $${val.toFixed(0)}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: "0 0 auto" }}>
                                  <div style={{ width: 18, height: 24, borderRadius: 3, background: bg, border: "1px solid rgba(255,255,255,0.06)" }} />
                                  {h % 6 === 0 && <div style={{ fontSize: 8, color: C.muted }}>{label}</div>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    {/* FAN LOYALTY + BEST STREAM LENGTH */}
                    {(() => {
                      const platTips = tips.filter(t => t.platform === p.platform)
                      const fanCounts = {}
                      platTips.forEach(t => { fanCounts[t.username] = (fanCounts[t.username] || 0) + 1 })
                      const loyalFans = Object.values(fanCounts).filter(c => c >= 3).length

                      const platSessions = sessions.filter(s => s.platform === p.platform)
                      const longS = platSessions.filter(s => s.durationMinutes > 60)
                      const shortS = platSessions.filter(s => s.durationMinutes <= 60)
                      const longAvg = longS.length ? longS.reduce((s, x) => s + x.totalUSD, 0) / longS.length : 0
                      const shortAvg = shortS.length ? shortS.reduce((s, x) => s + x.totalUSD, 0) / shortS.length : 0
                      const streamLengthPct = shortAvg > 0 && longAvg > shortAvg ? Math.round(((longAvg - shortAvg) / shortAvg) * 100) : 0

                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                          <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>👥 Fan Loyalty</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: C.pink }}>{loyalFans}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>fans tipped 3+ times</div>
                          </div>
                          {streamLengthPct >= 10 && longS.length >= 2 && shortS.length >= 2 ? (
                            <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>⏱️ Stream Length</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>+{streamLengthPct}%</div>
                              <div style={{ fontSize: 11, color: C.muted }}>more earned over 60 min</div>
                            </div>
                          ) : (
                            <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>📊 Sessions</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: C.cyan }}>{p.sessions}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>total streams</div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* INSIGHTS */}
                    {insights.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {insights.map((ins, j) => (
                          <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                            <span style={{ fontSize: 16, flexShrink: 0 }}>{ins.icon}</span>
                            <span style={{ fontSize: 13, color: ins.color || C.text }}>{ins.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {displayPlatforms.length === 0 && (
                <div style={{ ...glassCard, borderRadius: 14, padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>No platform data yet</div>
                  <div style={{ fontSize: 13, color: C.muted }}>Import your CSV files to see how your platforms compare</div>
                </div>
              )}
            </div>
          )
        })()}

        {activeTab === "whales" && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>🐳 Top Fans</h1>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Your highest-value supporters ranked by total spend</p>

            {/* FILTERS */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                {["ALL","Whale","Shark","Regular","Dormant"].map(t => (
                  <button key={t} onClick={() => setWhaleFilter(t)} style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s", background: whaleFilter === t ? "linear-gradient(135deg, #3b82f6, #ec4899)" : "transparent", color: whaleFilter === t ? C.white : C.muted }}>{t}</button>
                ))}
              </div>
              {allPlatforms.length > 1 && (
                <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                  {["ALL", ...allPlatforms].map(p => (
                    <button key={p} onClick={() => setPlatformFilter(p)} style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s", background: platformFilter === p ? "rgba(34,211,238,0.2)" : "transparent", color: platformFilter === p ? C.cyan : C.muted }}>{p}</button>
                  ))}
                </div>
              )}
            </div>

            {/* ALL TIPPERS TABLE — shows everyone */}
            <div style={{ ...glassCard, borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["#", "Username", "Total $", "Tips", "Avg Tip", "Platform", "Tier", "Last Tip", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredWhales.map((w, i) => (
                    <tr key={i} className="whale-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "12px 16px", color: i < 3 ? C.gold : C.muted, fontWeight: i < 3 ? 700 : 400 }}>#{i + 1}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: C.white, fontWeight: 600 }}>{w.username}</span>
                          <button onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }}
                            style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}
                            title="Message">💌</button>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: C.green, fontWeight: 700 }}>${w.totalUSD.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", color: C.muted }}>{w.tipCount}</td>
                      <td style={{ padding: "12px 16px", color: C.cyan }}>${w.avgTipSize.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", color: C.muted }}>{w.platform}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: 100, background: `${TIER_COLORS[w.tier]}15`, color: TIER_COLORS[w.tier], fontSize: 11, fontWeight: 600 }}>{w.tier}</span>
                      </td>
                      <td style={{ padding: "12px 16px", color: C.muted, fontSize: 12 }}>{new Date(w.lastTipDate).toLocaleDateString()}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <button onClick={() => setSelectedWhale(w)} style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.3)", color: C.cyan, fontSize: 11, cursor: "pointer" }}>🔍 View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 💎 WHALE INTELLIGENCE PANEL */}
            {filteredWhales.length > 0 && (
              <div style={{ ...glassCard, borderRadius: 16, padding: 24, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #F59E0B, #EC4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧠</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>Fan Intelligence</div>
                    <div style={{ fontSize: 12, color: C.muted }}>Deep behavior patterns, projections & how to engage each fan</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {filteredWhales.slice(0, isPro ? 5 : 3).map((w, i) => {
                    const tags = []
                    if (w.hasPrivates && w.privateCount >= 2) tags.push({ label: "📷 Cam2Cam spender", color: C.pink })
                    if (w.avgTipSize >= 20) tags.push({ label: "💸 Big tipper", color: C.gold })
                    if (w.tipCount >= 20 && w.avgTipSize < 5) tags.push({ label: "🎯 Micro-tipper", color: C.cyan })
                    if (w.tipProbability?.level === "High") tags.push({ label: "🟢 Likely to tip soon", color: C.green })
                    if (w.churnRisk?.level === "High" || w.churnRisk?.level === "Critical") tags.push({ label: "🚨 At churn risk", color: C.red })
                    if (w.daysSinceLastTip <= 3) tags.push({ label: "🔥 Recently active", color: C.orange })
                    if (w.tipNotes && w.tipNotes.length > 0) tags.push({ label: "💬 Leaves tip notes", color: C.indigo })
                    if (w.spendPercentile >= 90) tags.push({ label: `👑 Top ${100 - w.spendPercentile}% spender`, color: C.gold })

                    // Relationship status
                    const relStatus = w.daysSinceLastTip <= 7
                      ? { label: "🔥 Hot", color: C.orange }
                      : w.daysSinceLastTip <= 30
                      ? { label: "👀 Watching", color: C.cyan }
                      : w.daysSinceLastTip <= 60
                      ? { label: "❄️ Cooling", color: C.blue }
                      : { label: "💀 At Risk", color: C.red }

                    // Spending velocity vs avg fan
                    const avgFanUSD = whales.length > 0 ? whales.reduce((s, ww) => s + ww.totalUSD, 0) / whales.length : 1
                    const velocity = avgFanUSD > 0 ? (w.totalUSD / avgFanUSD).toFixed(1) : "1.0"
                    const velocityPct = Math.min(100, Math.round((w.totalUSD / Math.max(...whales.map(ww => ww.totalUSD))) * 100))

                    // Coaching bullets
                    const getCoachingBullets = () => {
                      const bullets = []
                      if (w.churnRisk?.level === "Critical") {
                        bullets.push({ text: "Send a personal message today — they may not return without one", color: C.red })
                        bullets.push({ text: "Reference something specific — their username, a past tip, or a show they loved", color: C.red })
                        bullets.push({ text: "Offer something exclusive to bring them back (early access, private goal)", color: C.orange })
                      } else if (w.churnRisk?.level === "High") {
                        bullets.push({ text: "Re-engage this week — their pattern shows they go cold fast without contact", color: C.orange })
                        bullets.push({ text: "Offer something special: a goal just for them or a shoutout next stream", color: C.gold })
                        bullets.push({ text: "Keep the message short and warm — don't make it feel like a sales pitch", color: C.muted })
                      } else if (w.tipProbability?.level === "High") {
                        bullets.push({ text: "Go live during their active window — they're very likely to tip", color: C.green })
                        bullets.push({ text: "Set a tip goal that matches their avg ($" + w.avgTipSize.toFixed(0) + ") — it feels achievable to them", color: C.cyan })
                        bullets.push({ text: "Acknowledge them by name in stream — they respond to direct recognition", color: C.muted })
                      } else if (w.hasPrivates) {
                        bullets.push({ text: "Offer a private show — they've already bought one before", color: C.pink })
                        bullets.push({ text: "Mention privates casually in stream — a soft reminder works well with this fan type", color: C.muted })
                        bullets.push({ text: "They respond to exclusivity — make them feel like a VIP", color: C.gold })
                      } else if (w.avgTipSize >= 20) {
                        bullets.push({ text: "Give them VIP attention in stream — big tippers notice when they're seen", color: C.gold })
                        bullets.push({ text: "Set a goal around their avg tip size ($" + w.avgTipSize.toFixed(0) + ") — they enjoy being the hero", color: C.cyan })
                        bullets.push({ text: "Thank them publicly and specifically — it reinforces the behavior", color: C.muted })
                      } else if (w.tipCount >= 20) {
                        bullets.push({ text: "Thank them publicly — frequent tippers love recognition in front of the room", color: C.cyan })
                        bullets.push({ text: "Small goals and countdowns keep micro-tippers engaged and clicking", color: C.muted })
                        bullets.push({ text: "Consistency is their love language — show up regularly and they will too", color: C.muted })
                      } else {
                        bullets.push({ text: "Keep them warm — consistent presence builds loyalty over time", color: C.muted })
                        bullets.push({ text: "Greet them by name next time they appear in chat", color: C.muted })
                        bullets.push({ text: "They have potential — early engagement now converts them to regulars", color: C.cyan })
                      }
                      return bullets
                    }
                    const coachingBullets = getCoachingBullets()
                    const tierColor = TIER_COLORS[w.tier] || C.cyan

                    return (
                      <div key={i} style={{ padding: 18, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        {/* HEADER ROW */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${tierColor}20`, border: `1px solid ${tierColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: tierColor }}>
                              {w.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{w.username}</span>
                                <span style={{ padding: "2px 8px", borderRadius: 20, background: `${relStatus.color}15`, border: `1px solid ${relStatus.color}30`, fontSize: 10, fontWeight: 700, color: relStatus.color }}>{relStatus.label}</span>
                              </div>
                              <span style={{ fontSize: 11, color: C.muted }}>${w.totalUSD.toFixed(0)} lifetime · {w.tipCount} tips · {w.platform}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => setSelectedWhale(w)} style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.25)", color: C.cyan, fontSize: 11, cursor: "pointer" }}>🔍 Profile</button>
                            <button onClick={() => { setMessageTarget(w); setMessageIndex(0); setMessageCopied(false) }} style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.25)", color: C.pink, fontSize: 11, cursor: "pointer" }}>💌 Message</button>
                          </div>
                        </div>

                        {/* PERSONALITY TAGS */}
                        {tags.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                            {tags.map((tag, j) => (
                              <span key={j} style={{ padding: "3px 10px", borderRadius: 20, background: `${tag.color}15`, border: `1px solid ${tag.color}30`, fontSize: 11, fontWeight: 600, color: tag.color }}>{tag.label}</span>
                            ))}
                          </div>
                        )}

                        {/* METRICS ROW */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                          {/* Spending velocity */}
                          <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>SPENDING VELOCITY</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 6 }}>{velocity}x avg fan</div>
                            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                              <div style={{ height: "100%", width: `${velocityPct}%`, borderRadius: 2, background: `linear-gradient(90deg, ${C.gold}, ${C.orange})` }} />
                            </div>
                          </div>
                          {/* Visit pattern */}
                          <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>ACTIVE WINDOW</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.cyan }}>{w.typicalOnlineHours !== 'Unknown' ? w.typicalOnlineHours : '—'}</div>
                          </div>
                          {/* Monthly projection */}
                          <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>MONTHLY VALUE</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>${w.lifetimeValue?.monthly > 0 ? w.lifetimeValue.monthly.toFixed(0) : '—'}</div>
                          </div>
                        </div>

                        {/* TIP NOTES */}
                        {w.tipNotes && w.tipNotes.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Recent Tip Notes</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 64, overflowY: "auto" }}>
                              {w.tipNotes.slice(-2).reverse().map((note, j) => (
                                <div key={j} style={{ padding: "6px 10px", background: `${C.indigo}10`, border: `1px solid ${C.indigo}20`, borderRadius: 6, fontSize: 11, color: C.text, fontStyle: "italic" }}>
                                  "{note}"
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* COACHING BULLETS */}
                        <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>💡 Action Plan</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {coachingBullets.map((b, j) => (
                              <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ color: b.color, fontSize: 12, flexShrink: 0, marginTop: 1 }}>•</span>
                                <span style={{ fontSize: 12, color: b.color, lineHeight: 1.4 }}>{b.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {filteredWhales.length <= 3 && (
              <div style={{ ...glassCard, borderRadius: 14, padding: 20, textAlign: "center", border: "1px solid rgba(59,130,246,0.2)" }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Upload more data to discover more fans • Pro unlocks full profiles & behavior patterns</div>
                <button onClick={() => openUpgradeModal("whales_empty")} style={{ padding: "8px 20px", borderRadius: 8, background: "linear-gradient(135deg,rgba(59,130,246,0.3),rgba(236,72,153,0.3))", border: "1px solid rgba(59,130,246,0.4)", color: C.white, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  🔓 See What Pro Unlocks
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "sessions" && (() => {
          // ── SESSION BREAKDOWN ENGINE ────────────────────────────────
          // Pure logic — runs on each session's tips array
          const getSessionBreakdown = (s) => {
            const rawTips = s.tips || []
            if (rawTips.length === 0) return null

            const sorted = [...rawTips].sort((a, b) =>
              new Date(a.dateRaw || a.date_time) - new Date(b.dateRaw || b.date_time)
            )

            const startMs = new Date(s.startTime).getTime()
            const endMs   = new Date(s.endTime).getTime()
            const durationMins = Math.max(s.durationMinutes || 1, 1)

            // ── TIMELINE BUCKETS (5-min intervals) ──────────────────
            const bucketCount = Math.max(Math.ceil(durationMins / 5), 1)
            const buckets = Array.from({ length: bucketCount }, (_, i) => ({
              label: `${i * 5}m`,
              usd: 0,
              count: 0,
            }))
            sorted.forEach(t => {
              const tMs = new Date(t.dateRaw || t.date_time).getTime()
              const minOffset = (tMs - startMs) / 60000
              const idx = Math.min(Math.floor(minOffset / 5), bucketCount - 1)
              if (idx >= 0 && idx < buckets.length) {
                buckets[idx].usd += parseFloat(t.usd) || 0
                buckets[idx].count += 1
              }
            })

            // ── PEAK BUCKET ─────────────────────────────────────────
            const peakBucket = [...buckets].sort((a, b) => b.usd - a.usd)[0]
            const peakBucketIdx = buckets.indexOf(peakBucket)
            const peakMinute = peakBucketIdx * 5
            const peakTime = new Date(startMs + peakMinute * 60000)

            // ── FIRST HALF vs SECOND HALF ────────────────────────────
            const half = Math.floor(buckets.length / 2)
            const firstHalfUSD = buckets.slice(0, half).reduce((s, b) => s + b.usd, 0)
            const secondHalfUSD = buckets.slice(half).reduce((s, b) => s + b.usd, 0)
            const firstHalfPct = s.totalUSD > 0 ? Math.round((firstHalfUSD / s.totalUSD) * 100) : 0

            // ── TOP TIPPERS ─────────────────────────────────────────
            const tipperMap = {}
            sorted.forEach(t => {
              const u = t.username || "unknown"
              tipperMap[u] = (tipperMap[u] || 0) + (parseFloat(t.usd) || 0)
            })
            const topTippers = Object.entries(tipperMap)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([username, usd]) => ({
                username,
                usd: parseFloat(usd.toFixed(2)),
                pct: s.totalUSD > 0 ? Math.round((usd / s.totalUSD) * 100) : 0,
              }))

            // ── SPIKES (bucket > 2x avg) ─────────────────────────────
            const avgBucketUSD = s.totalUSD / buckets.length
            const spikes = buckets
              .map((b, i) => ({ ...b, idx: i }))
              .filter(b => b.usd >= avgBucketUSD * 2 && b.usd > 0)
              .map(b => ({
                minute: b.idx * 5,
                usd: parseFloat(b.usd.toFixed(2)),
                time: new Date(startMs + b.idx * 5 * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              }))

            // ── PERFORMANCE vs historical avg ────────────────────────
            const allAvg = sessions.length > 0
              ? sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length
              : 0
            const performance = s.totalUSD >= allAvg * 1.3
              ? "high"
              : s.totalUSD <= allAvg * 0.6
              ? "low"
              : "average"

            // ── REVENUE PER MINUTE ───────────────────────────────────
            const revenuePerMin = parseFloat((s.totalUSD / durationMins).toFixed(3))

            // ── INSIGHTS ────────────────────────────────────────────
            const insights = []
            if (firstHalfPct >= 60)
              insights.push(`You earned ${firstHalfPct}% of your revenue in the first half of the stream`)
            if (firstHalfPct <= 35 && durationMins > 20)
              insights.push(`Your stream warmed up slowly — earnings picked up in the second half`)
            if (topTippers[0] && topTippers[0].pct >= 40)
              insights.push(`${topTippers[0].username} drove ${topTippers[0].pct}% of this session's revenue`)
            if (spikes.length > 0)
              insights.push(`Your biggest spike was at ${spikes[0].time} — $${spikes[0].usd} in 5 minutes`)
            if (s.uniqueFans === 1)
              insights.push(`Only one fan tipped this session — great loyalty, but audience diversity helps`)
            if (s.uniqueFans >= 5)
              insights.push(`${s.uniqueFans} different fans tipped — strong audience engagement`)
            if (durationMins < 20 && s.totalUSD > 0)
              insights.push(`Short session (${Math.round(durationMins)} min) with solid earnings — your hook is working`)
            if (performance === "high")
              insights.push(`This was one of your top sessions — $${s.totalUSD} vs $${allAvg.toFixed(0)} avg`)
            if (performance === "low")
              insights.push(`Below your average session ($${allAvg.toFixed(0)}) — see recommendations below`)

            // ── RECOMMENDATIONS ─────────────────────────────────────
            const recommendations = []
            if (firstHalfPct >= 60)
              recommendations.push("Your best earnings happen early — open with high energy and a strong tip goal right away")
            if (firstHalfPct <= 35)
              recommendations.push("Slow start detected — open with a countdown goal or shoutout to get early tipping momentum")
            if (topTippers[0] && topTippers[0].pct >= 50)
              recommendations.push(`Retain ${topTippers[0].username} — they drove half your session. Give them public recognition next time`)
            if (s.uniqueFans <= 2 && s.tipCount > 10)
              recommendations.push("Diversify your audience — most tips came from 1–2 fans. Engage lurkers with low-barrier goals")
            if (durationMins < 30 && s.totalUSD > 0)
              recommendations.push(`You earned $${s.totalUSD} in ${Math.round(durationMins)} min. Extending to 45–60 min could 2x your earnings`)
            if (spikes.length >= 2)
              recommendations.push("Multiple spike moments detected — identify what triggered them and recreate it intentionally")
            if (revenuePerMin > 0 && revenuePerMin < 0.10)
              recommendations.push("Low revenue per minute — try setting a token goal every 15 min to maintain tipping momentum")
            if (performance === "high")
              recommendations.push("Replicate this stream: same time, same platform, similar energy — your data supports it")
            if (recommendations.length === 0)
              recommendations.push("Keep streaming consistently — more data helps us give you sharper recommendations")

            return {
              buckets, peakTime, peakBucket, firstHalfPct,
              topTippers, spikes, performance, revenuePerMin,
              insights, recommendations,
            }
          }

          // ── PERFORMANCE BADGE CONFIG ────────────────────────────────
          const PERF = {
            high:    { label: "🔥 High Performing", color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)" },
            average: { label: "📊 Average",          color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
            low:     { label: "📉 Underperforming",  color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
          }

          const avgSession = sessions.length ? sessions.reduce((s,x) => s+x.totalUSD,0)/sessions.length : 0

          return (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 4 }}>🎥 Session Breakdown</h1>
                <p style={{ fontSize: 13, color: C.muted }}>What happened in each stream and how to earn more next time</p>
              </div>

              {/* OVERVIEW STATS BAR */}
              {sessions.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
                  {[
                    { label: "Total Sessions", value: sessions.length, color: C.cyan },
                    { label: "Avg Earnings", value: `$${avgSession.toFixed(2)}`, color: C.green },
                    { label: "Best Session", value: `$${Math.max(...sessions.map(s => s.totalUSD)).toFixed(2)}`, color: C.gold },
                    { label: "Total Earned", value: `$${sessions.reduce((s,x) => s+x.totalUSD,0).toFixed(2)}`, color: C.pink },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ ...glassCard, borderRadius: 12, padding: "16px 18px" }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* SESSION CARDS — ALL of them, fully broken down */}
              {sessions.length === 0 && (
                <div style={{ ...glassCard, borderRadius: 14, padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎥</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.white }}>No sessions yet</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>Import your CSV data to see session breakdowns</div>
                </div>
              )}

              {sessions.map((s, si) => {
                const bd = getSessionBreakdown(s)
                if (!bd) return null
                const perf = PERF[bd.performance]
                const maxBucketUSD = Math.max(...bd.buckets.map(b => b.usd), 0.01)
                const fmt = dt => new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

                return (
                  <div key={si} style={{ ...glassCard, borderRadius: 16, marginBottom: 24, overflow: "hidden" }}>

                    {/* SESSION HEADER */}
                    <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: C.white }}>
                            {new Date(s.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                          <span style={{ fontSize: 13, color: C.muted }}>{fmt(s.startTime)} → {fmt(s.endTime)}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>• {s.platform}</span>
                        </div>
                        <span style={{ padding: "3px 10px", borderRadius: 20, background: perf.bg, border: `1px solid ${perf.border}`, fontSize: 11, fontWeight: 700, color: perf.color }}>{perf.label}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: C.green }}>${s.totalUSD.toFixed(2)}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{Math.round(s.durationMinutes)} min • ${bd.revenuePerMin.toFixed(2)}/min</div>
                      </div>
                    </div>

                    <div style={{ padding: 24 }}>

                      {/* CORE METRICS */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }}>
                        {[
                          { label: "Tips",        value: s.tipCount,                    color: C.cyan  },
                          { label: "Unique Fans", value: s.uniqueFans,                  color: C.pink  },
                          { label: "Avg Tip",     value: `$${s.avgTipSize}`,            color: C.gold  },
                          { label: "$/Hour",      value: `$${s.usdPerHour}`,            color: C.green },
                          { label: "Spikes",      value: bd.spikes.length,              color: C.orange },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* TIMELINE CHART */}
                      {bd.buckets.length > 1 && (
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>⏱ Earnings Timeline (5-min buckets)</div>
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 64, padding: "0 0 4px" }}>
                            {bd.buckets.map((b, bi) => {
                              const heightPct = maxBucketUSD > 0 ? (b.usd / maxBucketUSD) : 0
                              const isPeak = bi === bd.buckets.indexOf(bd.peakBucket)
                              const barColor = isPeak ? C.gold : b.usd > 0 ? C.cyan : "rgba(255,255,255,0.06)"
                              return (
                                <div key={bi} title={`${b.label}: $${b.usd.toFixed(2)}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                                  <div style={{ width: "100%", height: `${Math.max(heightPct * 100, b.usd > 0 ? 4 : 2)}%`, background: barColor, borderRadius: "3px 3px 0 0", transition: "height 0.3s", minHeight: b.usd > 0 ? 4 : 2 }} />
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                            <span style={{ fontSize: 9, color: C.muted }}>{fmt(s.startTime)}</span>
                            {bd.spikes.length > 0 && <span style={{ fontSize: 9, color: C.gold }}>🔥 Peak at {bd.spikes[0].time}</span>}
                            <span style={{ fontSize: 9, color: C.muted }}>{fmt(s.endTime)}</span>
                          </div>
                        </div>
                      )}

                      {/* FIRST HALF vs SECOND HALF */}
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>📊 Session Pacing</div>
                        <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ width: `${bd.firstHalfPct}%`, background: "linear-gradient(90deg, #22D3EE, #60A5FA)", display: "flex", alignItems: "center", justifyContent: "center", transition: "width 0.4s" }}>
                            {bd.firstHalfPct >= 20 && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff" }}>First half {bd.firstHalfPct}%</span>}
                          </div>
                          <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {100 - bd.firstHalfPct >= 20 && <span style={{ fontSize: 10, color: C.muted }}>Second half {100 - bd.firstHalfPct}%</span>}
                          </div>
                        </div>
                      </div>

                      {/* TOP TIPPERS */}
                      {bd.topTippers.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>🏆 Top Contributors</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {bd.topTippers.map((t, ti) => (
                              <div key={ti} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 14, flexShrink: 0 }}>{["🥇","🥈","🥉"][ti]}</span>
                                <span style={{ fontSize: 13, color: C.white, fontWeight: 600, minWidth: 100 }}>{t.username}</span>
                                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${t.pct}%`, background: ti === 0 ? `linear-gradient(90deg, ${C.gold}, ${C.orange})` : ti === 1 ? C.cyan : C.muted, borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 12, color: C.green, fontWeight: 700, flexShrink: 0 }}>${t.usd}</span>
                                <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{t.pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* INSIGHTS + RECOMMENDATIONS side by side */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        {/* INSIGHTS */}
                        <div style={{ padding: "14px 16px", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>💡 What Happened</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            {bd.insights.map((ins, ii) => (
                              <div key={ii} style={{ fontSize: 12, color: C.text, lineHeight: 1.5, display: "flex", gap: 6 }}>
                                <span style={{ color: C.cyan, flexShrink: 0 }}>→</span>
                                <span>{ins}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* RECOMMENDATIONS */}
                        <div style={{ padding: "14px 16px", background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.pink, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>🚀 Do This Next Time</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            {bd.recommendations.map((rec, ri) => (
                              <div key={ri} style={{ fontSize: 12, color: C.text, lineHeight: 1.5, display: "flex", gap: 6 }}>
                                <span style={{ color: C.pink, flexShrink: 0 }}>•</span>
                                <span>{rec}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {activeTab === "data" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white }}>📝 Edit Data</h1>
              <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🗑️ Delete All Tips</button>
            </div>

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

        {activeTab === "titles" && <TitleGenerator C={C} glassCard={glassCard} analytics={analytics} tips={tips} sessions={sessions} whales={whales} />}

        {activeTab === "help" && (
          <div style={{ maxWidth: 900 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>❓ How to Import Your Tips</h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>Follow these steps to get your tip data into CamCash in under 2 minutes</p>

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
                      const d = new Date(t.date_time).getDay()
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
