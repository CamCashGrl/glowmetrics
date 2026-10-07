"use client"

// Sessions tab, freshest first:
//   1. LIVE NOW (running Live Mode show) or Latest Performance (most recently
//      finished show / session)
//   2. Today so far (creator-local day)
//   3. Today by Platform
//   4. Session History
// Every figure comes from lib/sessions/normalize.js; this file only renders,
// using CamCash's existing primitives (Command Center Stat/Chip/card/hero
// gradient, Platforms MetricStrip/PlatformCell, Stream Planner Pill/PlatChip,
// LatestShows ShowCard). No new visual system.

import React, { useMemo, useState } from "react"
import { platformDisplayName } from "../../lib/constants"
import {
  SUPPORTED_PLATFORMS, buildSessionHistory, filterSessionHistory, dailySessionStats,
  liveSessionSnapshot, latestPerformance, withTodayDerived, todaySignal, typicalSameWeekdayByNow,
} from "../../lib/sessions/normalize"
import { ShowCard, fmtUsd, fmtDuration } from "./LatestShows"
import { Stat, Chip, card, HERO_GRADIENT } from "./CommandCenter"
import { MetricStrip, PlatformCell } from "./PlatformsIntelligence"
import { Pill, PlatChip } from "./StreamPlanner"

const C = {
  cyan: "#22D3EE", green: "#10B981", gold: "#F59E0B", pink: "#EC4899", indigo: "#7C5CFF",
  white: "#F1F5F9", text: "#94A3B8", muted: "#64748B",
}

const label = { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }

const TYPE_LABEL = { live: "LIVE MODE", free_chat: "FREE CHAT", private: "PRIVATE", imported: "IMPORTED" }
const TYPE_FILTERS = [["all", "All"], ["live", "Live Mode"], ["free_chat", "Free chat"], ["private", "Private"], ["imported", "Imported"]]
const PAGE_SIZE = 50

const pName = (p) => platformDisplayName(p) || p
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function fmtMinutes(mins, estimated) {
  const m = Number(mins) || 0
  if (m > 0 && m < 1) return estimated ? "~<1m" : "<1m"
  const r = Math.round(m)
  const h = Math.floor(r / 60)
  const txt = h ? `${h}h ${r % 60}m` : `${r}m`
  return estimated ? `~${txt}` : txt
}

const fmtTime = (iso, tz) => (iso ? new Date(iso).toLocaleTimeString([], { timeZone: tz, hour: "2-digit", minute: "2-digit" }) : null)

function SectionHead({ title, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.white }}>{title}</div>
      {right && <div style={{ fontSize: 12, color: C.text }}>{right}</div>}
    </div>
  )
}

// Stat with a stable test id (Stat itself takes no extra props).
function KStat({ testId, ...props }) {
  return <div data-testid={testId} style={{ minWidth: 0 }}><Stat {...props} /></div>
}

function PlatformMix({ split }) {
  if (!split?.length) return null
  return (
    <div data-testid="hero-platforms" style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: C.white }}>
      {split.map((p) => (
        <span key={p.platform} data-testid={`hero-platform-${p.platform}`}>
          <PlatformCell platform={pName(p.platform)} /> <span style={{ color: C.text }}>{fmtUsd(p.usd)} · {p.share}%</span>
        </span>
      ))}
    </div>
  )
}

function HeroShell({ testId, eyebrow, eyebrowColor, badge, value, valueSub, children }) {
  return (
    <div data-testid={testId} style={card({ background: HERO_GRADIENT, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...label, color: eyebrowColor || C.muted }}>{eyebrow}</span>
        {badge}
      </div>
      <div>
        <div data-testid={`${testId}-total`} className="hero-revenue-shimmer" style={{ fontSize: "clamp(32px, 5vw, 44px)", fontWeight: 900, color: C.white, letterSpacing: "-0.02em", lineHeight: 1.05 }}>{value}</div>
        <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>{valueSub}</div>
      </div>
      {children}
    </div>
  )
}

function LiveHero({ snap, tz }) {
  const eyebrow = `● LIVE NOW · ${fmtDuration(snap.durationSeconds)}${snap.paused ? " · PAUSED" : ""}`
  return (
    <HeroShell testId="hero-live" eyebrow={eyebrow} eyebrowColor={C.green} value={fmtUsd(snap.publicUSD)}
      valueSub={`public tips this session · updated ${fmtTime(snap.lastUpdated, tz) || "—"}`}>
      <div className="sx-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <KStat testId="live-tips" value={snap.tipCount} label="Tips" />
        <KStat testId="live-unique" value={snap.uniqueTippers} label="Unique tippers" />
        <KStat testId="live-duration" value={fmtDuration(snap.durationSeconds)} label="Duration" />
        <KStat testId="live-largest" value={fmtUsd(snap.largestTipUSD)} label="Largest tip" />
      </div>
      <div className="sx-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
        <Chip icon="🏆" title="Top tipper" accent={C.gold}
          value={snap.topTipper ? `${snap.topTipper.username} (${fmtUsd(snap.topTipper.usd)})` : "No tips yet"}
          sub={snap.topTipper ? pName(snap.topTipper.platform) : null} />
        <Chip icon="🔒" title="Private" accent={C.indigo}
          value={snap.privateNow ? `In private · ${fmtMinutes(snap.privateNow.minutes)}` : "Not in private"}
          sub="Private earnings are added when the show is stopped" />
      </div>
      <PlatformMix split={snap.platformSplit} />
    </HeroShell>
  )
}

function LatestHero({ entry, tz }) {
  const isLive = entry.type === "live"
  const ended = entry.endTime ? new Date(entry.endTime).toLocaleString([], { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"
  const total = entry.totalUSD || 0
  const split = (entry.platformBreakdown || []).filter((p) => p.usd > 0).map((p) => ({
    ...p, share: entry.publicUSD > 0 ? Math.round((p.usd / entry.publicUSD) * 100) : 0,
  }))
  const badge = entry.isNew
    ? <span data-testid="hero-new-badge" style={{ background: C.green, color: "#052e1c", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, letterSpacing: 0.6 }}>NEW · JUST ENDED</span>
    : <PlatChip name={TYPE_LABEL[entry.type]} i={0} />
  return (
    <HeroShell testId="hero-latest" eyebrow="Latest Performance" badge={badge} value={fmtUsd(total)}
      valueSub={`${isLive ? "Live Mode show" : "Tip session (estimated length)"} · ended ${ended}`}>
      <div className="sx-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12 }}>
        <KStat testId="latest-public" value={fmtUsd(entry.publicUSD)} label="Public tips" />
        <KStat testId="latest-private" value={fmtUsd(entry.privateUSD)} label="Private" accent={C.indigo} />
        <KStat testId="latest-tips" value={entry.tipCount} label="Tips" />
        <KStat testId="latest-unique" value={entry.uniqueTippers} label="Unique tippers" />
        <KStat testId="latest-duration" value={isLive ? fmtDuration(entry.durationMinutes * 60) : fmtMinutes(entry.durationMinutes, true)} label="Duration" />
      </div>
      <div className="sx-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
        <Chip icon="🏆" title="Top tipper" accent={C.gold}
          value={entry.topTipper ? `${entry.topTipper.username} (${fmtUsd(entry.topTipper.usd)})` : "—"} />
        <Chip icon="⏱" title="Ended" accent={C.cyan} value={ended} />
      </div>
      <PlatformMix split={split} />
    </HeroShell>
  )
}

function HistoryRow({ entry, tz }) {
  if (entry.type === "live") {
    return <div data-testid={`history-${entry.id}`}><ShowCard show={entry.show} /></div>
  }
  const when = new Date(entry.startTime).toLocaleString([], { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  const items = entry.type === "private"
    ? [
        { label: "Private", value: fmtUsd(entry.privateUSD), color: C.indigo },
        { label: "Fan", value: entry.fan || "—" },
        { label: "Length", value: "Not in import", color: C.muted },
      ]
    : [
        { label: "Earned", value: fmtUsd(entry.totalUSD), color: C.white },
        { label: "Length", value: entry.durationUnknown ? "Unknown" : fmtMinutes(entry.durationMinutes, true), sub: "estimated" },
        { label: "Tips", value: entry.tipCount },
        { label: "Tippers", value: entry.uniqueTippers },
        { label: "Top tipper", value: entry.topTipper ? `${entry.topTipper.username}` : "—", sub: entry.topTipper ? fmtUsd(entry.topTipper.usd) : null },
      ]
  return (
    <div data-testid={`history-${entry.id}`} style={card({ padding: 16, display: "flex", flexDirection: "column", gap: 10 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span data-testid={`type-badge-${entry.type}`} style={{ ...label, color: entry.type === "private" ? C.indigo : C.cyan }}>
          {entry.type === "private" && entry.sessionType ? `PRIVATE · ${String(entry.sessionType).toUpperCase()}` : TYPE_LABEL[entry.type]}
        </span>
        {entry.platforms.map((p, i) => <span key={p} data-testid={`platform-badge-${p}`}><PlatChip name={pName(p)} i={i} /></span>)}
        <span style={{ fontSize: 12, color: C.text }}>{when}</span>
        {entry.type !== "private" && !entry.isValid && <span style={{ fontSize: 11, color: C.muted }}>· short session</span>}
      </div>
      <MetricStrip items={items} />
    </div>
  )
}

export default function SessionsOverview({ tips, shows, paidSessions, tz, showsLoading, showsError, now, live }) {
  const [typeFilter, setTypeFilter] = useState("all")
  const [platformFilter, setPlatformFilter] = useState("all")
  const [limit, setLimit] = useState(PAGE_SIZE)
  const at = now || new Date()

  const history = useMemo(
    () => buildSessionHistory({ tips: tips || [], shows: shows || [], paidSessions: paidSessions || [] }),
    [tips, shows, paidSessions]
  )
  const today = useMemo(
    () => withTodayDerived(dailySessionStats({ tips: tips || [], history, paidSessions: paidSessions || [], tz, now: at })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tips, history, paidSessions, tz, now]
  )
  const comparison = useMemo(
    () => typicalSameWeekdayByNow({ tips: tips || [], tz, now: at }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tips, tz, now]
  )
  const snap = useMemo(
    () => (live?.session ? liveSessionSnapshot({ session: live.session, tips: tips || [], privateInterval: live.privateInterval, now: at }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, tips, now]
  )
  const latest = useMemo(() => latestPerformance(history), [history])
  const visible = useMemo(
    () => filterSessionHistory(history, { type: typeFilter, platform: platformFilter }),
    [history, typeFilter, platformFilter]
  )
  const signal = todaySignal(today, pName)
  const hasToday = today.totalUSD > 0 || today.tipCount > 0
  const updated = fmtTime(at.toISOString(), tz)
  const pick = (setter, v) => { setter(v); setLimit(PAGE_SIZE) }

  return (
    <div data-testid="sessions-overview" className="sx-root" style={{ display: "flex", flexDirection: "column", gap: 28, marginBottom: 32 }}>
      <style>{`
        @media (max-width: 900px) { .sx-root .sx-grid { grid-template-columns: repeat(3, minmax(0,1fr)) !important; } .sx-root .pi-strip { grid-template-columns: repeat(3, minmax(0,1fr)) !important; } }
        @media (max-width: 560px) { .sx-root .sx-grid, .sx-root .sx-grid-2 { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } .sx-root .pi-strip { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } }
      `}</style>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, margin: 0 }}>🎥 Sessions</h1>

      {/* 1. Freshest performance */}
      {snap ? <LiveHero snap={snap} tz={tz} /> : latest ? <LatestHero entry={latest} tz={tz} /> : null}

      {/* 2. Today so far */}
      <div data-testid="today-stats">
        <SectionHead title="Today so far" right={`${today.day} · ${tz} · Updated ${updated}`} />
        <div className="sx-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12 }}>
          <KStat testId="today-total" value={fmtUsd(today.totalUSD)} label="Total today" accent={C.cyan}
            delta={comparison && comparison.deltaPct !== null ? comparison.deltaPct : null} />
          <KStat testId="today-public" value={fmtUsd(today.publicUSD)} label="Public / free chat" />
          <KStat testId="today-private" value={fmtUsd(today.privateUSD)} label="Private" accent={C.indigo} />
          <KStat testId="today-tips" value={today.tipCount} label="Tips" />
          <KStat testId="today-unique" value={today.uniqueTippers} label="Unique tippers" />
          <KStat testId="today-streamed" value={fmtMinutes(today.streamedMinutes, today.streamedEstimated)} label={today.streamedEstimated ? "Streamed (incl. estimated)" : "Streamed"} />
          <KStat testId="today-private-time" value={fmtMinutes(today.privateMinutes)} label="Private time (Live)" />
          <KStat testId="today-completed" value={today.completedSessions} label="Sessions completed" accent={C.gold} />
          <KStat testId="today-best-platform" value={today.bestPlatform ? pName(today.bestPlatform) : "—"} label={today.bestPlatform ? "Best platform" : "Best platform · Not enough data yet"} accent={C.green} />
          {today.usdPerHour !== null && <KStat testId="today-rate" value={`${fmtUsd(today.usdPerHour)}/hr`} label="Today $/hr (Live time)" />}
        </div>
        {(signal || comparison) && (
          <div className="sx-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, marginTop: 12 }}>
            {signal && <div data-testid="today-signal"><Chip icon="📈" title="Today's strongest signal" value={signal} accent={C.cyan} /></div>}
            {comparison && (
              <div data-testid="today-comparison">
                <Chip icon="📅" title={`vs your typical ${comparison.weekday} by this time`} accent={comparison.deltaPct >= 0 ? C.green : "#F87171"}
                  value={`${fmtUsd(comparison.todayUSD)} vs ${fmtUsd(comparison.typicalUSD)} public tips`}
                  sub={`Median of your last ${comparison.days} ${comparison.weekday}s with earnings`} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Today by Platform */}
      <div data-testid="today-by-platform">
        <SectionHead title="Today by Platform" />
        {!hasToday && <div style={{ fontSize: 13, color: C.text }}>Not enough data yet</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {today.platforms.map((p) => {
            const best = p.platform === today.bestPlatform
            return (
              <div key={p.platform} data-testid={`today-platform-${p.platform}`} className={best ? "card-glow-cyan" : undefined}
                style={card({ padding: 16, display: "flex", flexDirection: "column", gap: 10, ...(best ? { border: `1px solid ${C.cyan}66` } : {}) })}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.white, display: "flex", alignItems: "center", gap: 10 }}>
                    <PlatformCell platform={pName(p.platform)} />
                    {best && <span data-testid="best-platform-badge" style={{ ...label, color: C.cyan }}>Best today</span>}
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 900, color: C.white }}>{fmtUsd(p.totalUSD)}</span>
                </div>
                <MetricStrip items={[
                  { label: "Public", value: fmtUsd(p.publicUSD) },
                  { label: "Private", value: fmtUsd(p.privateUSD), color: C.indigo },
                  { label: "Tips", value: p.tipCount },
                  { label: "Tippers", value: p.uniqueTippers },
                  { label: "Share of today", value: `${p.share}%`, color: best ? C.cyan : undefined },
                ]} />
              </div>
            )
          })}
        </div>
      </div>

      {/* 4. Session History */}
      <div data-testid="session-history" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionHead title="Session History" />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TYPE_FILTERS.map(([k, l]) => (
            <span key={k} data-testid={`filter-type-${k}`}><Pill active={typeFilter === k} onClick={() => pick(setTypeFilter, k)}>{l}</Pill></span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span data-testid="filter-platform-all"><Pill active={platformFilter === "all"} onClick={() => pick(setPlatformFilter, "all")}>All platforms</Pill></span>
          {SUPPORTED_PLATFORMS.map((p) => (
            <span key={p} data-testid={`filter-platform-${p}`}><Pill active={platformFilter === p} onClick={() => pick(setPlatformFilter, p)}>{pName(p)}</Pill></span>
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
          <span data-testid="history-more"><Pill active={false} onClick={() => setLimit((n) => n + PAGE_SIZE)}>Show more ({visible.length - limit} older)</Pill></span>
        )}
      </div>
    </div>
  )
}
