"use client"

// Sessions tab: today's numbers (creator-local day), today by platform, and one
// chronological Session History. All figures come from lib/sessions/normalize.js;
// this component only renders them. Live shows render with the existing
// ShowCard so the NEW / acknowledgement flow is unchanged.

import React, { useMemo, useState } from "react"
import { platformColor, platformDisplayName } from "../../lib/constants"
import {
  SUPPORTED_PLATFORMS, buildSessionHistory, filterSessionHistory, dailySessionStats,
} from "../../lib/sessions/normalize"
import { ShowCard, fmtUsd } from "./LatestShows"

const C = {
  card: "#121826", border: "#1e2d45", cyan: "#22D3EE", green: "#10B981", gold: "#F59E0B",
  purple: "#a855f7", white: "#F1F5F9", text: "#94A3B8", muted: "#475569",
}

const TYPE_BADGE = {
  live: { label: "LIVE MODE", color: C.green },
  free_chat: { label: "FREE CHAT", color: C.cyan },
  private: { label: "PRIVATE", color: C.purple },
  imported: { label: "IMPORTED", color: C.text },
}

const TYPE_FILTERS = [
  ["all", "All"], ["live", "Live Mode"], ["free_chat", "Free chat"], ["private", "Private"], ["imported", "Imported"],
]

function fmtMinutes(mins, estimated) {
  const m = Math.max(0, Math.round(Number(mins) || 0))
  const h = Math.floor(m / 60)
  const txt = h ? `${h}h ${m % 60}m` : `${m}m`
  return estimated ? `~${txt}` : txt
}

const PAGE_SIZE = 50

const pName = (p) => platformDisplayName(p) || p

function Kpi({ label, value, sub, color, testId }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
      <div data-testid={testId} style={{ fontSize: 20, fontWeight: 800, color: color || C.white, overflowWrap: "anywhere" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.text }}>{sub}</div>}
    </div>
  )
}

function Badge({ text, color, testId }) {
  return (
    <span data-testid={testId} style={{
      border: `1px solid ${color}`, color, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
      padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
    }}>{text}</span>
  )
}

function Chip({ active, onClick, children, testId }) {
  return (
    <button onClick={onClick} data-testid={testId} aria-pressed={active} style={{
      background: active ? "rgba(34,211,238,0.12)" : "transparent",
      border: `1px solid ${active ? C.cyan : C.border}`, color: active ? C.cyan : C.text,
      borderRadius: 999, padding: "4px 12px", fontSize: 12, cursor: "pointer",
    }}>{children}</button>
  )
}

function HistoryRow({ entry, tz }) {
  if (entry.type === "live") {
    return (
      <div data-testid={`history-${entry.id}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6 }}><Badge text="LIVE MODE" color={C.green} testId="type-badge-live" /></div>
        <ShowCard show={entry.show} />
      </div>
    )
  }
  const badge = TYPE_BADGE[entry.type]
  const start = new Date(entry.startTime)
  const when = start.toLocaleString([], { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  return (
    <div data-testid={`history-${entry.id}`} style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14,
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Badge text={entry.type === "private" && entry.sessionType ? `PRIVATE · ${String(entry.sessionType).toUpperCase()}` : badge.label} color={badge.color} testId={`type-badge-${entry.type}`} />
          {entry.platforms.map((p) => <Badge key={p} text={pName(p)} color={platformColor(p) || C.text} testId={`platform-badge-${p}`} />)}
        </div>
        <div style={{ fontSize: 13, color: C.white }}>{when}</div>
        <div style={{ fontSize: 12, color: C.text }}>
          {entry.type === "private"
            ? `${entry.fan ? `${entry.fan} · ` : ""}duration not in import`
            : `${entry.durationUnknown ? "Duration unknown" : `${fmtMinutes(entry.durationMinutes, true)} estimated`} · ${entry.tipCount} tip${entry.tipCount === 1 ? "" : "s"} · ${entry.uniqueTippers} tipper${entry.uniqueTippers === 1 ? "" : "s"}${entry.topTipper ? ` · Top: ${entry.topTipper.username} (${fmtUsd(entry.topTipper.usd)})` : ""}`}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div data-testid="history-total" style={{ fontSize: 20, fontWeight: 900, color: C.white }}>{fmtUsd(entry.totalUSD)}</div>
        {entry.type !== "private" && !entry.isValid && <div style={{ fontSize: 11, color: C.muted }}>Short session</div>}
      </div>
    </div>
  )
}

export default function SessionsOverview({ tips, shows, paidSessions, tz, showsLoading, showsError, now }) {
  const [typeFilter, setTypeFilter] = useState("all")
  const [platformFilter, setPlatformFilter] = useState("all")
  const [limit, setLimit] = useState(PAGE_SIZE)

  const history = useMemo(
    () => buildSessionHistory({ tips: tips || [], shows: shows || [], paidSessions: paidSessions || [] }),
    [tips, shows, paidSessions]
  )
  const today = useMemo(
    () => dailySessionStats({ tips: tips || [], history, paidSessions: paidSessions || [], tz, now: now || new Date() }),
    [tips, history, paidSessions, tz, now]
  )
  const visible = useMemo(
    () => filterSessionHistory(history, { type: typeFilter, platform: platformFilter }),
    [history, typeFilter, platformFilter]
  )
  const hasRevenueToday = today.totalUSD > 0 || today.tipCount > 0

  return (
    <div data-testid="sessions-overview" style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 32 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 4 }}>🎥 Sessions</h1>
        <p style={{ fontSize: 13, color: C.text }}>Today ({today.day}, {tz})</p>
      </div>

      <div data-testid="today-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <Kpi label="Total today" value={fmtUsd(today.totalUSD)} color={C.cyan} testId="today-total" />
        <Kpi label="Public tips" value={fmtUsd(today.publicUSD)} testId="today-public" />
        <Kpi label="Private" value={fmtUsd(today.privateUSD)} color={C.purple} testId="today-private" />
        <Kpi label="Tips" value={today.tipCount} testId="today-tips" />
        <Kpi label="Unique tippers" value={today.uniqueTippers} sub="per platform" testId="today-unique" />
        <Kpi label="Streamed" value={fmtMinutes(today.streamedMinutes, today.streamedEstimated)} sub={today.streamedEstimated ? "includes estimated" : null} testId="today-streamed" />
        <Kpi label="Private time" value={fmtMinutes(today.privateMinutes)} sub="Live Mode only" testId="today-private-time" />
        <Kpi label="Completed sessions" value={today.completedSessions} color={C.gold} testId="today-completed" />
        <Kpi label="Best platform" value={today.bestPlatform ? pName(today.bestPlatform) : "Not enough data yet"} testId="today-best-platform" />
      </div>

      <div data-testid="today-by-platform">
        <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 8 }}>Today by Platform</div>
        {!hasRevenueToday && <div style={{ fontSize: 12, color: C.text }}>Not enough data yet</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {today.platforms.map((p) => (
            <div key={p.platform} data-testid={`today-platform-${p.platform}`} style={{
              background: C.card, border: `1px solid ${platformColor(p.platform) || C.border}`, borderRadius: 12, padding: 14,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: C.white, fontWeight: 700 }}>{pName(p.platform)}</span>
                <span style={{ color: C.white, fontWeight: 900 }}>{fmtUsd(p.totalUSD)}</span>
              </div>
              <div style={{ fontSize: 12, color: C.text, marginTop: 4 }}>
                {fmtUsd(p.publicUSD)} public · {fmtUsd(p.privateUSD)} private · {p.tipCount} tips · {p.uniqueTippers} tippers
              </div>
            </div>
          ))}
        </div>
      </div>

      <div data-testid="session-history" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Session History</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TYPE_FILTERS.map(([k, label]) => (
            <Chip key={k} active={typeFilter === k} onClick={() => { setTypeFilter(k); setLimit(PAGE_SIZE) }} testId={`filter-type-${k}`}>{label}</Chip>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip active={platformFilter === "all"} onClick={() => { setPlatformFilter("all"); setLimit(PAGE_SIZE) }} testId="filter-platform-all">All platforms</Chip>
          {SUPPORTED_PLATFORMS.map((p) => (
            <Chip key={p} active={platformFilter === p} onClick={() => { setPlatformFilter(p); setLimit(PAGE_SIZE) }} testId={`filter-platform-${p}`}>{pName(p)}</Chip>
          ))}
        </div>
        {showsError && <div style={{ color: C.text, fontSize: 12 }}>Couldn&apos;t load your Live Mode shows. They&apos;ll appear on the next refresh.</div>}
        {showsLoading && !history.length && <div style={{ color: C.text, fontSize: 12 }}>Loading…</div>}
        {!showsLoading && !history.length && (
          <div data-testid="history-empty" style={{ color: C.text, fontSize: 13 }}>No sessions yet. Start a Live Mode show or import your tip history.</div>
        )}
        {history.length > 0 && !visible.length && (
          <div data-testid="history-filter-empty" style={{ color: C.text, fontSize: 13 }}>No sessions match these filters.</div>
        )}
        {visible.slice(0, limit).map((e) => <HistoryRow key={e.id} entry={e} tz={tz} />)}
        {visible.length > limit && (
          <Chip active={false} onClick={() => setLimit((n) => n + PAGE_SIZE)} testId="history-more">
            Show more ({visible.length - limit} older)
          </Chip>
        )}
      </div>
    </div>
  )
}
