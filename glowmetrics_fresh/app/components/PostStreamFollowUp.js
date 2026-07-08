"use client"
import React, { useState, useMemo } from "react"
import {
  normalizeLiveTip, buildFanIndex, buildLeaderboard, attachFanStatus,
  buildPostStreamFollowUp, getFollowUpMessage, maskUsername, getEffectiveBoardSettings,
} from "../../lib/analytics/vipBoard"

const DEFAULT_C = {
  card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", text: "#94A3B8", muted: "#475569",
}

function copyToClipboard(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
}

function CopyBtn({ C, text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 1800) }}
      style={{ background: C.card2, border: `1px solid ${C.border2}`, color: C.text, fontSize: 10.5, fontWeight: 700, borderRadius: 8, padding: "5px 9px", cursor: "pointer" }}
    >
      {copied ? "✓ Copied" : "📋 Copy Message"}
    </button>
  )
}

function FollowUpGroup({ title, icon, entries, category, settings, C }) {
  if (!entries.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>{icon} {title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map(e => (
          <div key={e.key} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.white }}>{maskUsername(e.username, settings.hideFullUsernames)}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.cyan }}>{settings.hideDollarAmounts ? "•••" : `$${e.totalUsd.toFixed(2)}`}</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.text, fontStyle: "italic", marginBottom: 8, lineHeight: 1.5 }}>
              “{getFollowUpMessage(e, category, settings.hideFullUsernames)}”
            </div>
            <CopyBtn C={C} text={getFollowUpMessage(e, category, settings.hideFullUsernames)} />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * After-stream follow-up — appears once a stream ends with tips still in
 * `liveEvents` (the host page doesn't clear liveEvents/liveStartTime until
 * the next stream starts, so this reads that same ended-session data).
 * Purely additive and read-only: never writes to tips/session data.
 */
export default function PostStreamFollowUp({ liveEvents = [], liveActive, liveStartTime, colors }) {
  const C = { ...DEFAULT_C, ...(colors || {}) }
  const settings = getEffectiveBoardSettings()

  const sessionTips = useMemo(() => (liveEvents || []).filter(e => !e._isHistory), [liveEvents])

  const followUp = useMemo(() => {
    if (liveActive || !liveStartTime || !sessionTips.length) return null
    const records = sessionTips.map(normalizeLiveTip).filter(r => r.timestamp >= liveStartTime)
    if (!records.length) return null
    const fanIndex = buildFanIndex(records, new Date())
    const entries = buildLeaderboard({ records, fanIndex, platformFilter: "all", sortBy: "total", excludedFans: [], minTipUsd: 0, sessionStart: liveStartTime, now: new Date() })
    const statused = attachFanStatus(entries, fanIndex, { now: new Date(), liveActive: true, sessionStart: liveStartTime })
    return buildPostStreamFollowUp(statused, new Date())
  }, [liveActive, liveStartTime, sessionTips])

  if (!followUp) return null
  if (!followUp.toThank.length && !followUp.toInvite.length && !followUp.coolingRisk.length) return null

  return (
    <div style={{
      borderRadius: 16, padding: "18px 20px", marginBottom: 20,
      background: "rgba(15,20,32,0.75)", border: `1px solid ${C.border}`, backdropFilter: "blur(20px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 17 }}>💌</span>
        <span style={{ fontSize: 15, fontWeight: 900, color: C.white }}>After-Stream Follow-Up</span>
        <span style={{ fontSize: 10, color: C.muted }}>Top tipper maintenance doesn't stop when you go offline</span>
      </div>
      <FollowUpGroup title="Top Fans to Thank" icon="🙏" entries={followUp.toThank} category="thank" settings={settings} C={C} />
      <FollowUpGroup title="Invite Back Next Stream" icon="🔁" entries={followUp.toInvite} category="invite" settings={settings} C={C} />
      <FollowUpGroup title="At Risk of Cooling Off" icon="❄️" entries={followUp.coolingRisk} category="risk" settings={settings} C={C} />
    </div>
  )
}
