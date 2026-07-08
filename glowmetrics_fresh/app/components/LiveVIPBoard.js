"use client"
import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  VIP_PLATFORMS, RANGE_TABS, SORT_OPTIONS, CONTEST_TYPES, PRIVACY_MODES,
  getRangeStart, buildFanIndex, buildLeaderboard, applyClimberSort, withRankChange,
  snapshotRanks, maskUsername, detectLeaderboardAlerts,
  normalizeHistoricalTip, normalizeLiveTip,
  attachFanStatus, getNextBestAction, FAN_STATUS_META,
  getFanNote, saveFanNote, markFanThanked, applyPrivacyModeDefaults,
  DEFAULT_BOARD_SETTINGS, loadBoardSettings, saveBoardSettings,
} from "../../lib/analytics/vipBoard"

const DEFAULT_C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9", text: "#94A3B8", muted: "#475569",
}

const AUTO_RESET_INACTIVITY_MINUTES = 30

function fmtMoney(usd, tokens, settings) {
  if (settings.hideDollarAmounts) return "•••"
  if (settings.showTokensInsteadOfUsd) return `${Math.round(tokens).toLocaleString()} tok`
  return `$${usd.toFixed(2)}`
}

function fmtRankChange(entry) {
  if (entry.rankChange == null) return entry.rankPrevious === undefined ? "—" : "New"
  if (entry.rankChange > 0) return `↑ ${entry.rankChange}`
  if (entry.rankChange < 0) return `↓ ${Math.abs(entry.rankChange)}`
  return "—"
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function copyToClipboard(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
}

/**
 * Live VIP Board — a "who needs attention right now" leaderboard for Live Mode.
 * Purely additive: renders as its own card, does not touch any existing
 * Live Mode state, cards, or coaching logic. Collapsed by default so it
 * doesn't compete with the Do This Now card for attention.
 *
 * @param {Array} liveEvents - the host page's in-memory live tip list (already normalized)
 * @param {Array} historicalTips - raw rows from the `tips` table (may be empty/null if not loaded)
 * @param {boolean} liveActive
 * @param {Date|null} liveStartTime
 * @param {object} [colors] - optional brand color overrides (defaults match the dashboard's C tokens)
 */
export default function LiveVIPBoard({ liveEvents = [], historicalTips = [], liveActive = false, liveStartTime = null, colors }) {
  const C = { ...DEFAULT_C, ...(colors || {}) }
  const [collapsed, setCollapsed] = useState(true)
  const [range, setRange] = useState("session")
  const [platformFilter, setPlatformFilter] = useState("all")
  const [sortBy, setSortBy] = useState("total")
  const [expandedKey, setExpandedKey] = useState(null)
  const [settings, setSettings] = useState(DEFAULT_BOARD_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [sessionDisplayResetAt, setSessionDisplayResetAt] = useState(null)
  const [vipAlerts, setVipAlerts] = useState([])
  const [now, setNow] = useState(new Date())
  const [notesVersion, setNotesVersion] = useState(0)

  const prevRanksRef = useRef({}) // per range+platform+ -> {key: rank}, canonical "total" ordering
  const prevSessionTopRef = useRef(null)
  const prevPlatformLeaderRef = useRef(null)
  const lastLiveTsRef = useRef(null)

  useEffect(() => {
    setSettings(loadBoardSettings())
  }, [])

  useEffect(() => { saveBoardSettings(settings) }, [settings])

  // A new stream start clears the display's session boundary automatically.
  useEffect(() => { setSessionDisplayResetAt(null) }, [liveStartTime])

  // 1s ticker so "time ago" / auto-reset checks stay fresh, same cadence as the rest of Live Mode.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const isOverlay = settings.privacyMode === "overlay"
  const effectiveSettings = useMemo(() => applyPrivacyModeDefaults(settings.privacyMode, settings), [settings])

  const availablePlatforms = useMemo(() => {
    const set = new Set()
    historicalTips.forEach(t => t.platform && set.add(t.platform))
    liveEvents.forEach(e => e.platform && set.add(e.platform.charAt(0).toUpperCase() + e.platform.slice(1)))
    return set
  }, [historicalTips, liveEvents])

  const normalizedHistorical = useMemo(() => historicalTips.map(normalizeHistoricalTip), [historicalTips])
  const normalizedLive = useMemo(() => liveEvents.map(normalizeLiveTip), [liveEvents])

  // Auto-reset the live display after N minutes of no new tips (display-only; never touches data).
  useEffect(() => {
    if (!settings.autoResetAfterInactivity || !normalizedLive.length) return
    const lastTs = normalizedLive[normalizedLive.length - 1].timestamp
    if (lastLiveTsRef.current && lastTs > lastLiveTsRef.current) lastLiveTsRef.current = lastTs
    if (!lastLiveTsRef.current) lastLiveTsRef.current = lastTs
    const minutesSince = (now - lastLiveTsRef.current) / 60000
    if (minutesSince > AUTO_RESET_INACTIVITY_MINUTES && (!sessionDisplayResetAt || sessionDisplayResetAt < lastLiveTsRef.current)) {
      setSessionDisplayResetAt(now)
    }
  }, [now, settings.autoResetAfterInactivity, normalizedLive, sessionDisplayResetAt])

  const allRecords = useMemo(() => [...normalizedHistorical, ...normalizedLive], [normalizedHistorical, normalizedLive])
  const fanIndex = useMemo(() => buildFanIndex(allRecords, now), [allRecords, now])

  const sessionStart = sessionDisplayResetAt || liveStartTime

  const recordsForRange = useMemo(() => {
    if (range === "session") {
      if (!sessionStart) return []
      return normalizedLive.filter(r => r.timestamp >= sessionStart)
    }
    const start = getRangeStart(range, now)
    const pool = [...normalizedHistorical, ...normalizedLive]
    return start ? pool.filter(r => r.timestamp >= start) : pool
  }, [range, sessionStart, normalizedLive, normalizedHistorical, now])

  const rankSnapKey = `${range}::${platformFilter}`

  const baseEntries = useMemo(() => buildLeaderboard({
    records: recordsForRange,
    fanIndex,
    platformFilter,
    sortBy: "total",
    excludedFans: settings.excludedFans,
    minTipUsd: settings.minimumTipUsd,
    sessionStart: range === "session" ? sessionStart : null,
    now,
  }), [recordsForRange, fanIndex, platformFilter, settings.excludedFans, settings.minimumTipUsd, sessionStart, range, now])

  const entriesWithRank = useMemo(
    () => withRankChange(baseEntries, prevRanksRef.current[rankSnapKey]),
    [baseEntries, rankSnapKey]
  )

  // Attach a situational relationship status ("who needs attention right now")
  // to each entry, on top of the plain rank/money fields.
  const statusedEntries = useMemo(
    () => attachFanStatus(entriesWithRank, fanIndex, {
      now, liveActive: liveActive && range === "session", sessionStart: range === "session" ? sessionStart : null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entriesWithRank, fanIndex, range, sessionStart, now, liveActive, notesVersion]
  )

  const displayEntries = useMemo(() => {
    if (sortBy === "climber") return applyClimberSort(statusedEntries, prevRanksRef.current[rankSnapKey])
    const copy = [...statusedEntries]
    if (sortBy === "count") copy.sort((a, b) => b.tipCount - a.tipCount)
    else if (sortBy === "biggest") copy.sort((a, b) => b.biggestTipUsd - a.biggestTipUsd)
    else if (sortBy === "recent") copy.sort((a, b) => b.lastTipAt - a.lastTipAt)
    return copy
  }, [statusedEntries, sortBy, rankSnapKey])

  // Snapshot canonical ("total") rank order per range+platform after each recompute, for next comparison.
  useEffect(() => {
    prevRanksRef.current[rankSnapKey] = snapshotRanks(baseEntries)
  }, [baseEntries, rankSnapKey])

  // Live-session leaderboard alerts (only meaningful while a session is running).
  useEffect(() => {
    if (range !== "session" || !liveActive) return
    const top5 = baseEntries.slice(0, 5)
    const { alerts, platformLeader } = detectLeaderboardAlerts({
      previousTop: prevSessionTopRef.current,
      currentTop: top5,
      hideFullUsernames: effectiveSettings.hideFullUsernames,
      previousPlatformLeader: prevPlatformLeaderRef.current,
    })
    if (alerts.length) {
      setVipAlerts(prev => [...alerts.map(text => ({ id: `${Date.now()}-${Math.random()}`, text })), ...prev].slice(0, 6))
    }
    prevSessionTopRef.current = top5
    prevPlatformLeaderRef.current = platformLeader
  }, [baseEntries, range, liveActive, effectiveSettings.hideFullUsernames])

  useEffect(() => {
    if (!vipAlerts.length) return
    const t = setTimeout(() => setVipAlerts(prev => prev.slice(0, -1)), 12000)
    return () => clearTimeout(t)
  }, [vipAlerts])

  const hasAnyHistory = normalizedHistorical.length > 0 || normalizedLive.length > 0
  const hasLiveTipsThisSession = range === "session" && recordsForRange.length > 0

  const fallbackSuggestion = useMemo(() => {
    if (range !== "session" || hasLiveTipsThisSession || !hasAnyHistory) return null
    const weekStart = getRangeStart("week", now)
    const weekEntries = buildLeaderboard({
      records: [...normalizedHistorical, ...normalizedLive].filter(r => r.timestamp >= weekStart),
      fanIndex, platformFilter: "all", sortBy: "total", excludedFans: settings.excludedFans,
      minTipUsd: settings.minimumTipUsd, now,
    })
    return weekEntries.length ? weekEntries : null
  }, [range, hasLiveTipsThisSession, hasAnyHistory, normalizedHistorical, normalizedLive, fanIndex, settings.excludedFans, settings.minimumTipUsd, now])

  const setSetting = (key, value) => setSettings(s => ({ ...s, [key]: value }))

  const setPrivacyMode = (mode) => setSettings(s => applyPrivacyModeDefaults(mode, s))

  const toggleExclude = (username) => {
    setSettings(s => {
      const lower = username.trim().toLowerCase()
      const exists = s.excludedFans.some(u => u.toLowerCase() === lower)
      return { ...s, excludedFans: exists ? s.excludedFans.filter(u => u.toLowerCase() !== lower) : [...s.excludedFans, username] }
    })
  }

  const resetDisplay = () => { setSessionDisplayResetAt(new Date()); setVipAlerts([]) }
  const bumpNotesVersion = () => setNotesVersion(v => v + 1)

  const topEntry = displayEntries[0]

  return (
    <div style={{ ...glassCardStyle(C), borderRadius: 16, padding: "18px 20px" }}>
      <style>{`
        @keyframes vip-slide-in { from{opacity:0;transform:translateY(-6px);} to{opacity:1;transform:translateY(0);} }
        @keyframes vip-row-in { from{opacity:0;transform:translateX(-6px);} to{opacity:1;transform:translateX(0);} }
        .vip-row:hover { background: rgba(255,255,255,0.04) !important; }
        .vip-tab-btn:hover, .vip-chip:hover { filter: brightness(1.15); }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: collapsed ? 0 : 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setCollapsed(v => !v)}>
          <span style={{ fontSize: 17 }}>👑</span>
          <span style={{
            fontSize: 15, fontWeight: 900, letterSpacing: 0.2,
            background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>Live VIP Board</span>
          <span style={{ fontSize: 10, color: C.muted }}>Top Fans</span>
          {collapsed && topEntry && (
            <span style={{ fontSize: 11, color: C.text, marginLeft: 4 }}>
              · {displayEntries.length} VIP{displayEntries.length === 1 ? "" : "s"} · Top: {maskUsername(topEntry.username, effectiveSettings.hideFullUsernames)} {fmtMoney(topEntry.totalUsd, topEntry.totalTokens, effectiveSettings)}
            </span>
          )}
          <span style={{ fontSize: 11, color: C.muted }}>{collapsed ? "▸ Show board" : "▾ Collapse"}</span>
        </div>
        {!collapsed && (
          <button onClick={() => setShowSettings(v => !v)} style={ghostBtnStyle(C)}>
            {showSettings ? "Close Settings" : "⚙ Display & Privacy"}
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Live alerts */}
          {vipAlerts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, marginTop: 14 }}>
              {vipAlerts.map(a => (
                <div key={a.id} style={{
                  animation: "vip-slide-in 0.25s ease-out", fontSize: 12, fontWeight: 700, color: C.white,
                  background: "rgba(236,72,153,0.10)", border: `1px solid ${C.pink}55`, borderRadius: 10, padding: "8px 12px",
                }}>🔔 {a.text}</div>
              ))}
            </div>
          )}

          {showSettings && (
            <SettingsPanel
              C={C} settings={settings} setSetting={setSetting} setPrivacyMode={setPrivacyMode}
              onResetDisplay={resetDisplay} liveActive={liveActive} entries={displayEntries} onToggleExclude={toggleExclude}
            />
          )}

          {/* Range tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", marginTop: showSettings || vipAlerts.length ? 0 : 14 }}>
            {RANGE_TABS.map(t => (
              <button key={t.key} className="vip-tab-btn" onClick={() => setRange(t.key)} style={tabBtnStyle(C, range === t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {range === "session" && liveActive && displayEntries.length > 0 && (
            <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
              👀 Who to Work Right Now
            </div>
          )}

          {/* Filters row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} style={selectStyle(C)}>
              <option value="all">All Platforms</option>
              {VIP_PLATFORMS.map(p => (
                <option key={p} value={p} disabled={!availablePlatforms.has(p)}>
                  {p}{!availablePlatforms.has(p) ? " (no data)" : ""}
                </option>
              ))}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle(C)}>
              {SORT_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          {/* Leaderboard body */}
          {displayEntries.length === 0 ? (
            <EmptyState C={C} range={range} hasAnyHistory={hasAnyHistory} fallbackSuggestion={fallbackSuggestion} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {displayEntries.map((entry, i) => (
                <LeaderRow
                  key={entry.key}
                  entry={entry}
                  index={i}
                  C={C}
                  settings={effectiveSettings}
                  isOverlay={isOverlay}
                  expanded={expandedKey === entry.key}
                  onToggle={() => setExpandedKey(k => k === entry.key ? null : entry.key)}
                  onNotesChanged={bumpNotesVersion}
                />
              ))}
            </div>
          )}

          {/* Contest mode (UI-only for now) */}
          <ContestModePanel C={C} settings={settings} setSetting={setSetting} />
        </>
      )}
    </div>
  )
}

function glassCardStyle(C) {
  return {
    background: "rgba(15,20,32,0.75)",
    border: `1px solid ${C.border}`,
    backdropFilter: "blur(20px)",
    boxShadow: `0 0 40px rgba(34,211,238,0.10), 0 0 70px rgba(236,72,153,0.06)`,
  }
}

function ghostBtnStyle(C) {
  return {
    background: C.card2, border: `1px solid ${C.border2}`, color: C.text, fontSize: 11, fontWeight: 700,
    borderRadius: 8, padding: "6px 10px", cursor: "pointer",
  }
}

function tabBtnStyle(C, active) {
  return {
    background: active ? `linear-gradient(90deg, ${C.cyan}22, ${C.pink}22)` : "transparent",
    border: `1px solid ${active ? C.cyan : C.border2}`,
    color: active ? C.white : C.text,
    fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "6px 12px", cursor: "pointer",
  }
}

function selectStyle(C) {
  return {
    background: C.card2, border: `1px solid ${C.border2}`, color: C.white, fontSize: 12, fontWeight: 600,
    borderRadius: 8, padding: "6px 10px",
  }
}

function StatusBadge({ status, C }) {
  const t = FAN_STATUS_META[status] || FAN_STATUS_META.Regular
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: t.color, background: `${t.color}1a`,
      border: `1px solid ${t.color}55`, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap",
    }}>{t.icon} {t.label}</span>
  )
}

function PlatformBadge({ platform, C }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, color: C.text, background: C.card2, border: `1px solid ${C.border2}`,
      borderRadius: 6, padding: "1px 6px", textTransform: "uppercase", letterSpacing: 0.3,
    }}>{platform}</span>
  )
}

function CopyLineButton({ C, text, label = "📋 Copy Chat Line" }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 1800) }}
      style={{ ...ghostBtnStyle(C), fontSize: 10.5, padding: "5px 9px" }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  )
}

function LeaderRow({ entry, index, C, settings, isOverlay, expanded, onToggle, onNotesChanged }) {
  const displayName = maskUsername(entry.username, settings.hideFullUsernames)
  const rankColor = entry.rank === 1 ? C.gold : entry.rank === 2 ? "#C0C0C0" : entry.rank === 3 ? "#CD7F32" : C.text
  const nextBest = getNextBestAction(entry, entry.status, { hideFullUsernames: settings.hideFullUsernames })

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.card2, overflow: "hidden", animation: `vip-row-in 0.2s ease-out ${index * 0.02}s both` }}>
      <div className="vip-row" onClick={onToggle} style={{
        display: "grid", gridTemplateColumns: "28px 1fr auto auto auto", gap: 10, alignItems: "center",
        padding: "10px 12px", cursor: "pointer",
      }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: rankColor }}>#{entry.rank}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.white, overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</span>
            <PlatformBadge platform={entry.platform} C={C} />
            <StatusBadge status={entry.status} C={C} />
          </div>
          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
            {entry.tipCount} tip{entry.tipCount === 1 ? "" : "s"} · biggest {fmtMoney(entry.biggestTipUsd, entry.biggestTipTokens, settings)} · {timeAgo(entry.lastTipAt)}
          </div>
          {!isOverlay && (
            <div style={{ fontSize: 10.5, color: C.cyan, marginTop: 3, fontWeight: 600 }}>→ {nextBest.action}</div>
          )}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 900, color: C.cyan, textAlign: "right" }}>{fmtMoney(entry.totalUsd, entry.totalTokens, settings)}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: entry.rankChange > 0 ? C.green : entry.rankChange < 0 ? C.red : C.muted, textAlign: "right", minWidth: 34 }}>
          {fmtRankChange(entry)}
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {expanded && (
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 10 }}>
            <Detail label="Platform" value={entry.platform} C={C} />
            <Detail label="This range total" value={fmtMoney(entry.totalUsd, entry.totalTokens, settings)} C={C} />
            <Detail label="All-time total" value={fmtMoney(entry.allTimeTotalUsd, 0, settings)} C={C} />
            <Detail label="Tip count" value={entry.tipCount} C={C} />
            <Detail label="Biggest tip" value={fmtMoney(entry.biggestTipUsd, entry.biggestTipTokens, settings)} C={C} />
            <Detail label="First tip" value={new Date(entry.firstTipAt).toLocaleDateString()} C={C} />
            <Detail label="Last tip" value={new Date(entry.lastTipAt).toLocaleDateString()} C={C} />
            <Detail label="Sessions tipped" value={entry.sessionsTipped} C={C} />
          </div>

          {!isOverlay && (
            <>
              <div style={{
                fontSize: 12, color: C.white, background: `${C.cyan}12`, border: `1px solid ${C.cyan}33`,
                borderRadius: 8, padding: "8px 10px", fontWeight: 600, marginBottom: 10,
              }}>
                <div style={{ fontSize: 9, color: C.cyan, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Next Best Action</div>
                💡 {nextBest.action}
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <CopyLineButton C={C} text={nextBest.chatLines[0]} />
                  <button
                    onClick={(e) => { e.stopPropagation(); markFanThanked(entry.key); onNotesChanged() }}
                    style={{ ...ghostBtnStyle(C), fontSize: 10.5, padding: "5px 9px" }}
                  >
                    🙏 Mark Thanked
                  </button>
                </div>
              </div>

              <FanNotesEditor C={C} entry={entry} onNotesChanged={onNotesChanged} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function FanNotesEditor({ C, entry, onNotesChanged }) {
  const stored = getFanNote(entry.key)
  const [likes, setLikes] = useState(stored.likes)
  const [respondsTo, setRespondsTo] = useState(stored.respondsTo)
  const [avoid, setAvoid] = useState(stored.avoid)
  const [customNote, setCustomNote] = useState(stored.customNote)

  useEffect(() => {
    const s = getFanNote(entry.key)
    setLikes(s.likes); setRespondsTo(s.respondsTo); setAvoid(s.avoid); setCustomNote(s.customNote)
  }, [entry.key])

  const commit = (patch) => { saveFanNote(entry.key, patch); onNotesChanged() }

  const fieldStyle = {
    width: "100%", background: C.card, border: `1px solid ${C.border2}`, color: C.white,
    fontSize: 11.5, borderRadius: 6, padding: "5px 8px", marginTop: 3,
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: 700 }}>
        📝 Relationship Notes <span style={{ color: C.orange, textTransform: "none", fontWeight: 400 }}>(private — never shown on overlay)</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 8 }}>
        <label style={{ fontSize: 10, color: C.text }}>
          Likes
          <input style={fieldStyle} value={likes} placeholder="bratty attention, shoutouts…"
            onChange={e => setLikes(e.target.value)} onBlur={() => commit({ likes })} />
        </label>
        <label style={{ fontSize: 10, color: C.text }}>
          Responds to
          <input style={fieldStyle} value={respondsTo} placeholder="leaderboard competition…"
            onChange={e => setRespondsTo(e.target.value)} onBlur={() => commit({ respondsTo })} />
        </label>
        <label style={{ fontSize: 10, color: C.text }}>
          Avoid
          <input style={fieldStyle} value={avoid} placeholder="long free DMs…"
            onChange={e => setAvoid(e.target.value)} onBlur={() => commit({ avoid })} />
        </label>
      </div>
      <label style={{ fontSize: 10, color: C.text, display: "block", marginBottom: 8 }}>
        Custom note
        <textarea style={{ ...fieldStyle, minHeight: 44, resize: "vertical" }} value={customNote}
          placeholder="Next message: invite before next stream…"
          onChange={e => setCustomNote(e.target.value)} onBlur={() => commit({ customNote })} />
      </label>
      <div style={{ fontSize: 10, color: C.muted }}>
        Last thanked: {stored.lastThankedAt ? new Date(stored.lastThankedAt).toLocaleString() : "never"}
      </div>
    </div>
  )
}

function Detail({ label, value, C }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.white }}>{value}</div>
    </div>
  )
}

function EmptyState({ C, range, hasAnyHistory, fallbackSuggestion }) {
  if (fallbackSuggestion && fallbackSuggestion.length) {
    return (
      <div style={{ padding: "16px 4px" }}>
        <div style={{ fontSize: 12.5, color: C.text, marginBottom: 10 }}>No live tips yet, but here are your top fans this week:</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {fallbackSuggestion.slice(0, 3).map(e => (
            <div key={e.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.white, background: C.card2, borderRadius: 8, padding: "8px 10px" }}>
              <span>{maskUsername(e.username, true)}</span>
              <span style={{ color: C.cyan, fontWeight: 800 }}>${e.totalUsd.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div style={{ textAlign: "center", padding: "28px 12px" }}>
      <div style={{ fontSize: 26, marginBottom: 8 }}>👑</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 4 }}>No VIPs on the board yet</div>
      <div style={{ fontSize: 12, color: C.muted, maxWidth: 320, margin: "0 auto 10px" }}>
        Once tips come in, your top supporters will appear here by session, week, month, and all time.
      </div>
      <div style={{ fontSize: 11, color: C.muted }}>
        {hasAnyHistory ? "Switch ranges above to see historical VIPs." : "Start streaming or import tip data to activate your Live VIP Board."}
      </div>
    </div>
  )
}

function PrivacyModeSelector({ C, mode, onSetMode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.white, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Privacy Mode</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(PRIVACY_MODES).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => onSetMode(key)}
            style={{
              flex: "1 1 200px", textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
              background: mode === key ? `linear-gradient(135deg, ${C.cyan}22, ${C.pink}22)` : C.card,
              border: `1px solid ${mode === key ? C.cyan : C.border2}`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: mode === key ? C.white : C.text }}>
              {key === "private" ? "🔒" : "📺"} {cfg.label}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>{cfg.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function SettingsPanel({ C, settings, setSetting, setPrivacyMode, onResetDisplay, liveActive, entries, onToggleExclude }) {
  const isOverlay = settings.privacyMode === "overlay"
  return (
    <div style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.white, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Stream Controls</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button onClick={onResetDisplay} style={ghostBtnStyle(C)}>Reset Live Board</button>
          <button onClick={onResetDisplay} style={ghostBtnStyle(C)}>Start New Session</button>
          <button onClick={onResetDisplay} style={ghostBtnStyle(C)}>Clear Display Only</button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text }}>
            <input type="checkbox" checked={settings.autoResetAfterInactivity} onChange={e => setSetting("autoResetAfterInactivity", e.target.checked)} />
            Auto-reset after stream inactivity
          </label>
        </div>
        <div style={{ fontSize: 10.5, color: C.muted, fontStyle: "italic" }}>
          Resetting the board only clears the live display. It does not delete tip history.
        </div>
      </div>

      <PrivacyModeSelector C={C} mode={settings.privacyMode} onSetMode={setPrivacyMode} />

      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.white, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Fine-Tune Display</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          <ToggleRow C={C} label="Hide full usernames" checked={settings.hideFullUsernames} disabled={isOverlay} onChange={v => setSetting("hideFullUsernames", v)} />
          <ToggleRow C={C} label="Show tokens instead of USD" checked={settings.showTokensInsteadOfUsd} onChange={v => setSetting("showTokensInsteadOfUsd", v)} />
          <ToggleRow C={C} label="Hide dollar amounts" checked={settings.hideDollarAmounts} disabled={isOverlay} onChange={v => setSetting("hideDollarAmounts", v)} />
        </div>
        {isOverlay && (
          <div style={{ marginTop: 8, fontSize: 10.5, color: C.muted }}>
            🔒 Safe Overlay Mode forces masked usernames and hidden dollar amounts — this can't be turned off while overlay mode is active.
          </div>
        )}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: C.text }}>Minimum tip to appear</span>
          <input
            type="number" min="0" step="1" value={settings.minimumTipUsd}
            onChange={e => setSetting("minimumTipUsd", parseFloat(e.target.value) || 0)}
            style={{ ...selectStyle(C), width: 70 }}
          />
        </div>
      </div>

      {entries.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.white, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Exclude Fans</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {entries.slice(0, 12).map(e => {
              const isExcluded = settings.excludedFans.some(u => u.toLowerCase() === e.username.toLowerCase())
              return (
                <button key={e.key} className="vip-chip" onClick={() => onToggleExclude(e.username)} style={{
                  fontSize: 10.5, borderRadius: 999, padding: "4px 9px", cursor: "pointer",
                  background: isExcluded ? `${C.red}22` : C.card, border: `1px solid ${isExcluded ? C.red : C.border2}`,
                  color: isExcluded ? C.red : C.text,
                }}>
                  {e.username} {isExcluded ? "(excluded)" : ""}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleRow({ C, label, checked, onChange, disabled = false }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: disabled ? C.muted : C.text, cursor: disabled ? "not-allowed" : "pointer" }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function ContestModePanel({ C, settings, setSetting }) {
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.white, textTransform: "uppercase", letterSpacing: 0.4 }}>🏆 Contest Mode</div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text, cursor: "pointer" }}>
          <input type="checkbox" checked={settings.contestMode} onChange={e => setSetting("contestMode", e.target.checked)} />
          {settings.contestMode ? "On" : "Off"}
        </label>
      </div>
      {settings.contestMode && (
        <div style={{ marginTop: 8 }}>
          <select value={settings.contestType} onChange={e => setSetting("contestType", e.target.value)} style={selectStyle(C)}>
            {CONTEST_TYPES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 6 }}>
            Contest tracking is coming soon — this sets your preferred format for when it goes live.
          </div>
        </div>
      )}
    </div>
  )
}
