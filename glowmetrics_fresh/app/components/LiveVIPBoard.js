"use client"
import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  VIP_PLATFORMS, RANGE_TABS, SORT_OPTIONS, FAN_TIERS, CONTEST_TYPES,
  getRangeStart, buildFanIndex, buildLeaderboard, applyClimberSort, withRankChange,
  snapshotRanks, getSuggestedAction, maskUsername, detectLeaderboardAlerts,
  normalizeHistoricalTip, normalizeLiveTip,
} from "../../lib/analytics/vipBoard"

const DEFAULT_C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9", text: "#94A3B8", muted: "#475569",
}

const STORAGE_KEY = "camcash_vip_board_settings_v1"

function loadSettings() {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveSettings(settings) {
  if (typeof window === "undefined") return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch {}
}

const DEFAULT_SETTINGS = {
  privateDashboardOnly: true,
  showOnOverlay: false,
  hideFullUsernames: true,
  showTokensInsteadOfUsd: false,
  hideDollarAmounts: false,
  minimumTipUsd: 1,
  excludedFans: [],
  autoResetAfterInactivity: false,
  contestMode: false,
  contestType: "top_tipper",
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

/**
 * Live VIP Board — top-tippers leaderboard for Live Mode.
 * Purely additive: renders as its own card, does not touch any existing
 * Live Mode state, cards, or coaching logic.
 *
 * @param {Array} liveEvents - the host page's in-memory live tip list (already normalized)
 * @param {Array} historicalTips - raw rows from the `tips` table (may be empty/null if not loaded)
 * @param {boolean} liveActive
 * @param {Date|null} liveStartTime
 * @param {object} [colors] - optional brand color overrides (defaults match the dashboard's C tokens)
 */
export default function LiveVIPBoard({ liveEvents = [], historicalTips = [], liveActive = false, liveStartTime = null, colors }) {
  const C = { ...DEFAULT_C, ...(colors || {}) }
  const [range, setRange] = useState("session")
  const [platformFilter, setPlatformFilter] = useState("all")
  const [sortBy, setSortBy] = useState("total")
  const [expandedKey, setExpandedKey] = useState(null)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [sessionDisplayResetAt, setSessionDisplayResetAt] = useState(null)
  const [vipAlerts, setVipAlerts] = useState([])
  const [now, setNow] = useState(new Date())

  const prevRanksRef = useRef({}) // per range+platform+ -> {key: rank}, canonical "total" ordering
  const prevSessionTopRef = useRef(null)
  const prevPlatformLeaderRef = useRef(null)
  const lastLiveTsRef = useRef(null)

  useEffect(() => {
    const saved = loadSettings()
    if (saved) setSettings(s => ({ ...s, ...saved }))
  }, [])

  useEffect(() => { saveSettings(settings) }, [settings])

  // A new stream start clears the display's session boundary automatically.
  useEffect(() => { setSessionDisplayResetAt(null) }, [liveStartTime])

  // 1s ticker so "time ago" / auto-reset checks stay fresh, same cadence as the rest of Live Mode.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

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

  const displayEntries = useMemo(() => {
    if (sortBy === "climber") return applyClimberSort(entriesWithRank, prevRanksRef.current[rankSnapKey])
    const copy = [...entriesWithRank]
    if (sortBy === "count") copy.sort((a, b) => b.tipCount - a.tipCount)
    else if (sortBy === "biggest") copy.sort((a, b) => b.biggestTipUsd - a.biggestTipUsd)
    else if (sortBy === "recent") copy.sort((a, b) => b.lastTipAt - a.lastTipAt)
    return copy
  }, [entriesWithRank, sortBy, rankSnapKey])

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
      hideFullUsernames: settings.hideFullUsernames,
      previousPlatformLeader: prevPlatformLeaderRef.current,
    })
    if (alerts.length) {
      setVipAlerts(prev => [...alerts.map(text => ({ id: `${Date.now()}-${Math.random()}`, text })), ...prev].slice(0, 6))
    }
    prevSessionTopRef.current = top5
    prevPlatformLeaderRef.current = platformLeader
  }, [baseEntries, range, liveActive, settings.hideFullUsernames])

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

  const toggleExclude = (username) => {
    setSettings(s => {
      const lower = username.trim().toLowerCase()
      const exists = s.excludedFans.some(u => u.toLowerCase() === lower)
      return { ...s, excludedFans: exists ? s.excludedFans.filter(u => u.toLowerCase() !== lower) : [...s.excludedFans, username] }
    })
  }

  const resetDisplay = () => { setSessionDisplayResetAt(new Date()); setVipAlerts([]) }

  return (
    <div style={{ ...glassCardStyle(C), borderRadius: 16, padding: "18px 20px" }}>
      <style>{`
        @keyframes vip-slide-in { from{opacity:0;transform:translateY(-6px);} to{opacity:1;transform:translateY(0);} }
        @keyframes vip-row-in { from{opacity:0;transform:translateX(-6px);} to{opacity:1;transform:translateX(0);} }
        .vip-row:hover { background: rgba(255,255,255,0.04) !important; }
        .vip-tab-btn:hover, .vip-chip:hover { filter: brightness(1.15); }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 17 }}>👑</span>
          <span style={{
            fontSize: 15, fontWeight: 900, letterSpacing: 0.2,
            background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>Live VIP Board</span>
          <span style={{ fontSize: 10, color: C.muted }}>Top Fans</span>
        </div>
        <button onClick={() => setShowSettings(v => !v)} style={ghostBtnStyle(C)}>
          {showSettings ? "Close Settings" : "⚙ Display & Privacy"}
        </button>
      </div>

      {/* Live alerts */}
      {vipAlerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {vipAlerts.map(a => (
            <div key={a.id} style={{
              animation: "vip-slide-in 0.25s ease-out", fontSize: 12, fontWeight: 700, color: C.white,
              background: "rgba(236,72,153,0.10)", border: `1px solid ${C.pink}55`, borderRadius: 10, padding: "8px 12px",
            }}>🔔 {a.text}</div>
          ))}
        </div>
      )}

      {showSettings && (
        <SettingsPanel C={C} settings={settings} setSetting={setSetting} onResetDisplay={resetDisplay} liveActive={liveActive} entries={displayEntries} onToggleExclude={toggleExclude} />
      )}

      {/* Range tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {RANGE_TABS.map(t => (
          <button key={t.key} className="vip-tab-btn" onClick={() => setRange(t.key)} style={tabBtnStyle(C, range === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

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
              settings={settings}
              expanded={expandedKey === entry.key}
              onToggle={() => setExpandedKey(k => k === entry.key ? null : entry.key)}
            />
          ))}
        </div>
      )}

      {/* Contest mode (UI-only for now) */}
      <ContestModePanel C={C} settings={settings} setSetting={setSetting} />
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

function TierBadge({ tier, C }) {
  const t = FAN_TIERS[tier] || FAN_TIERS.Regular
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

function LeaderRow({ entry, index, C, settings, expanded, onToggle }) {
  const displayName = maskUsername(entry.username, settings.hideFullUsernames)
  const rankColor = entry.rank === 1 ? C.gold : entry.rank === 2 ? "#C0C0C0" : entry.rank === 3 ? "#CD7F32" : C.text
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
            <TierBadge tier={entry.tier} C={C} />
          </div>
          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
            {entry.tipCount} tip{entry.tipCount === 1 ? "" : "s"} · biggest {fmtMoney(entry.biggestTipUsd, entry.biggestTipTokens, settings)} · {timeAgo(entry.lastTipAt)}
          </div>
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
          <div style={{
            fontSize: 12, color: C.white, background: `${C.cyan}12`, border: `1px solid ${C.cyan}33`,
            borderRadius: 8, padding: "8px 10px", fontWeight: 600,
          }}>💡 {getSuggestedAction(entry)}</div>
        </div>
      )}
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

function SettingsPanel({ C, settings, setSetting, onResetDisplay, liveActive, entries, onToggleExclude }) {
  return (
    <div style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.white, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Reset Display</div>
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

      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.white, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Privacy & Display</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          <ToggleRow C={C} label="Private dashboard only" checked={settings.privateDashboardOnly} onChange={v => setSetting("privateDashboardOnly", v)} />
          <ToggleRow C={C} label="Show on overlay" checked={settings.showOnOverlay} onChange={v => setSetting("showOnOverlay", v)} />
          <ToggleRow C={C} label="Hide full usernames" checked={settings.hideFullUsernames} onChange={v => setSetting("hideFullUsernames", v)} />
          <ToggleRow C={C} label="Show tokens instead of USD" checked={settings.showTokensInsteadOfUsd} onChange={v => setSetting("showTokensInsteadOfUsd", v)} />
          <ToggleRow C={C} label="Hide dollar amounts" checked={settings.hideDollarAmounts} onChange={v => setSetting("hideDollarAmounts", v)} />
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: C.text }}>Minimum tip to appear</span>
          <input
            type="number" min="0" step="1" value={settings.minimumTipUsd}
            onChange={e => setSetting("minimumTipUsd", parseFloat(e.target.value) || 0)}
            style={{ ...selectStyle(C), width: 70 }}
          />
        </div>
        {!settings.showOnOverlay ? null : settings.hideFullUsernames ? null : (
          <div style={{ marginTop: 8, fontSize: 10.5, color: C.orange }}>
            ⚠ Overlay is on and usernames are not masked — viewers will see full names.
          </div>
        )}
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

function ToggleRow({ C, label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: C.text, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
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
