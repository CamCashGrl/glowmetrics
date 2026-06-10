"use client"
import React, { useMemo } from "react"

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG     = "#0a0e1a"
const CARD   = "rgba(255,255,255,0.03)"
const BORDER = "rgba(255,255,255,0.08)"
const TEXT   = "#94A3B8"
const WHITE  = "#F1F5F9"
const MUTED  = "#475569"
const CYAN   = "#22d3ee"
const GOLD   = "#F59E0B"
const GREEN  = "#10B981"
const RED    = "#F87171"

const PLATFORM_COLORS = {
  Chaturbate: "#22d3ee",
  BongaCams:  "#e879f9",
  MyFreeCams: "#a855f7",
}

// ─── Styling helpers ──────────────────────────────────────────────────────────
const cardStyle = (extra = {}) => ({
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: "20px 24px",
  ...extra,
})

const fmt$ = (v) => `$${Number(v).toFixed(2)}`

// ─── UTC→local display helpers ────────────────────────────────────────────────
// Reference epoch: 2024-01-07 is a Sunday (UTC day 0), so +utcDay gives correct weekday
function utcSlotToLocal(utcDay, utcHourStart) {
  const tz     = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"
  const base   = new Date(Date.UTC(2024, 0, 7 + utcDay, utcHourStart, 0, 0))
  const endRef = new Date(base.getTime() + 2 * 3_600_000)

  const timeOpts    = { timeZone: tz, hour: "numeric", hour12: true }
  const weekdayOpts = { timeZone: tz, weekday: "long" }

  const startStr = new Intl.DateTimeFormat("en-US", timeOpts).format(base)
  const endStr   = new Intl.DateTimeFormat("en-US", timeOpts).format(endRef)
  const weekday  = new Intl.DateTimeFormat("en-US", weekdayOpts).format(base)

  return { startStr, endStr, weekday, range: `${startStr}–${endStr}`, full: `${weekday}, ${startStr}–${endStr}` }
}

function todayLocalInfo() {
  const now = new Date()
  const tz  = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"

  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(now)

  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false })
    .formatToParts(now)
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0") % 24

  return { weekday, hour }
}

// ─── Session builder (4-hour gap = new session) ───────────────────────────────
function buildSessions(tips) {
  const sorted = [...tips].sort((a, b) => new Date(a.date_time) - new Date(b.date_time))
  const sessions = []
  let cur = null

  sorted.forEach((t) => {
    const dt = new Date(t.date_time)
    if (!cur || dt - cur.end > 4 * 3_600_000) {
      cur = { start: dt, end: dt, tips: [t] }
      sessions.push(cur)
    } else {
      cur.end = dt
      cur.tips.push(t)
    }
  })

  return sessions.map((s) => {
    const durationHrs = Math.max(0.5, (s.end - s.start) / 3_600_000)
    const totalUSD    = s.tips.reduce((sum, t) => sum + (parseFloat(t.usd) || 0), 0)

    // Dominant platform by tip count
    const platCount = {}
    s.tips.forEach((t) => { if (t.platform) platCount[t.platform] = (platCount[t.platform] || 0) + 1 })
    const platform = Object.entries(platCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    return {
      start: s.start,
      end:   s.end,
      durationHrs,
      totalUSD,
      usdHr:    totalUSD / durationHrs,
      utcDay:   s.start.getUTCDay(),
      utcHour:  s.start.getUTCHours(),
      hourSlot: Math.floor(s.start.getUTCHours() / 2) * 2, // 2-hr buckets
      platform,
      tips: s.tips,
    }
  })
}

// ─── Slot analyser ────────────────────────────────────────────────────────────
function analyzeSlots(sessions) {
  const overallAvgUSDhr = sessions.length
    ? sessions.reduce((s, x) => s + x.usdHr, 0) / sessions.length
    : 0

  const map = {}
  sessions.forEach((s) => {
    const key = `${s.utcDay}-${s.hourSlot}`
    if (!map[key]) map[key] = { utcDay: s.utcDay, hourSlot: s.hourSlot, sessions: [], platUSD: {}, platHrs: {} }
    const sl = map[key]
    sl.sessions.push(s)
    if (s.platform) {
      sl.platUSD[s.platform] = (sl.platUSD[s.platform] || 0) + s.totalUSD
      sl.platHrs[s.platform] = (sl.platHrs[s.platform] || 0) + s.durationHrs
    }
  })

  return Object.values(map).map((sl) => {
    const avgUSDhr     = sl.sessions.reduce((s, x) => s + x.usdHr, 0) / sl.sessions.length
    const confidence   = Math.round(
      (sl.sessions.filter((s) => s.usdHr > overallAvgUSDhr).length / sl.sessions.length) * 100
    )
    const bestPlatform = Object.entries(sl.platUSD).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const bestPlatAvgUSDhr =
      bestPlatform && sl.platHrs[bestPlatform]
        ? sl.platUSD[bestPlatform] / sl.platHrs[bestPlatform]
        : null

    // Median USD per session in this slot
    const vals = sl.sessions.map((s) => s.totalUSD).sort((a, b) => a - b)
    const mid  = Math.floor(vals.length / 2)
    const medianUSD = vals.length % 2 ? vals[mid] : ((vals[mid - 1] ?? 0) + (vals[mid] ?? 0)) / 2

    return {
      utcDay: sl.utcDay,
      hourSlot: sl.hourSlot,
      sessionCount: sl.sessions.length,
      avgUSDhr,
      confidence,
      bestPlatform,
      bestPlatAvgUSDhr,
      estEarnings: avgUSDhr * 2,  // 2hr session estimate
      medianUSD,
    }
  })
}

// ─── Small sub-components ─────────────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: WHITE, fontWeight: 600, fontSize: 15 }}>{title}</div>
      {sub && <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function PlatChip({ name }) {
  if (!name) return null
  const color = PLATFORM_COLORS[name] || TEXT
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px",
      background: `${color}18`, border: `1px solid ${color}40`,
      borderRadius: 5, color, fontSize: 11, fontWeight: 500,
    }}>
      {name}
    </span>
  )
}

function ConfidenceBadge({ score }) {
  const color = score >= 70 ? GREEN : score >= 40 ? GOLD : TEXT
  const bg    = score >= 70 ? "rgba(16,185,129,0.10)"  : score >= 40 ? "rgba(245,158,11,0.10)"  : "rgba(148,163,184,0.08)"
  const bdr   = score >= 70 ? "rgba(16,185,129,0.25)"  : score >= 40 ? "rgba(245,158,11,0.25)"  : "rgba(148,163,184,0.15)"
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px",
      background: bg, border: `1px solid ${bdr}`,
      borderRadius: 5, color, fontSize: 11, fontWeight: 600,
    }}>
      {score}% confidence
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT — all hooks live here, so outer component can return early cleanly
// ═══════════════════════════════════════════════════════════════════════════════
const MEDALS = ["🥇", "🥈", "🥉"]

function StreamPlannerContent({ tips }) {
  const { top3, sparseSlots } = useMemo(() => {
    const sessions  = buildSessions(tips)
    const all       = analyzeSlots(sessions).sort((a, b) => b.avgUSDhr - a.avgUSDhr)
    const top3      = all.slice(0, 3)
    const sparse    = all.filter((s) => s.sessionCount > 0 && s.sessionCount < 3).slice(0, 5)
    return { top3, sparseSlots: sparse }
  }, [tips])

  const { weekday: todayWeekday, hour: todayHour } = todayLocalInfo()

  const todayMatch = useMemo(() => {
    return (
      top3.find((slot) => {
        const { weekday } = utcSlotToLocal(slot.utcDay, slot.hourSlot)
        return weekday === todayWeekday
      }) ?? null
    )
  }, [top3, todayWeekday])

  return (
    <div style={{ background: BG, minHeight: "100%", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── TODAY'S BRIEF ─────────────────────────────────────────────────────── */}
      {todayMatch && (() => {
        const loc    = utcSlotToLocal(todayMatch.utcDay, todayMatch.hourSlot)
        const ahead  = todayMatch.hourSlot > todayHour  // slot still coming up today
        return (
          <div style={{
            background: "rgba(34,211,238,0.06)",
            border: "1px solid rgba(34,211,238,0.28)",
            borderRadius: 12, padding: "18px 24px",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: "rgba(34,211,238,0.14)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>
              {ahead ? "⚡" : "✅"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: CYAN, fontWeight: 700, fontSize: 14, marginBottom: 5 }}>
                {ahead ? `Stream tonight ${loc.range}` : `Your best ${todayWeekday} slot is ${loc.range}`}
              </div>
              <div style={{ color: TEXT, fontSize: 13, lineHeight: 1.5 }}>
                Your best {todayWeekday} slot.{" "}
                Est.{" "}
                <span style={{ color: WHITE, fontWeight: 600 }}>{fmt$(todayMatch.medianUSD)}</span>{" "}
                based on {todayMatch.sessionCount} session{todayMatch.sessionCount !== 1 ? "s" : ""}.
                {todayMatch.bestPlatform && (
                  <>
                    {" "}Best on{" "}
                    <span style={{ color: PLATFORM_COLORS[todayMatch.bestPlatform] || CYAN, fontWeight: 600 }}>
                      {todayMatch.bestPlatform}
                    </span>.
                  </>
                )}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ color: CYAN, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                {fmt$(todayMatch.estEarnings)}
              </div>
              <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>est. 2 hr session</div>
            </div>
          </div>
        )
      })()}

      {/* ── TOP 3 TIME SLOTS ──────────────────────────────────────────────────── */}
      <div style={cardStyle()}>
        <SectionHeader
          title="Your Top 3 Streaming Slots"
          sub="Ranked by average USD/hr — displayed in your local timezone"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {top3.map((slot, i) => {
            const loc        = utcSlotToLocal(slot.utcDay, slot.hourSlot)
            const isTopSlot  = i === 0
            return (
              <div
                key={`top-${slot.utcDay}-${slot.hourSlot}`}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: isTopSlot ? "rgba(34,211,238,0.04)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isTopSlot ? "rgba(34,211,238,0.18)" : BORDER}`,
                  borderRadius: 10, padding: "14px 16px",
                }}
              >
                <div style={{ fontSize: 22, width: 30, textAlign: "center", flexShrink: 0 }}>
                  {MEDALS[i]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: WHITE, fontWeight: 600, fontSize: 14, marginBottom: 5 }}>
                    {loc.full}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <PlatChip name={slot.bestPlatform} />
                    <ConfidenceBadge score={slot.confidence} />
                    <span style={{ color: MUTED, fontSize: 11 }}>
                      {slot.sessionCount} session{slot.sessionCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ color: WHITE, fontWeight: 700, fontSize: 19, lineHeight: 1 }}>
                    {fmt$(slot.avgUSDhr)}
                    <span style={{ color: MUTED, fontSize: 12, fontWeight: 400 }}>/hr</span>
                  </div>
                  <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
                    ~{fmt$(slot.estEarnings)} / 2 hr
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── PLATFORM PRIORITY ─────────────────────────────────────────────────── */}
      <div style={cardStyle()}>
        <SectionHeader
          title="Platform Priority"
          sub="Which platform earns most in each of your top slots"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {top3.map((slot, i) => {
            const loc        = utcSlotToLocal(slot.utcDay, slot.hourSlot)
            const platColor  = slot.bestPlatform ? (PLATFORM_COLORS[slot.bestPlatform] || CYAN) : MUTED
            return (
              <div
                key={`plat-${slot.utcDay}-${slot.hourSlot}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 14px",
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: MUTED, fontSize: 13 }}>{MEDALS[i]}</span>
                  <span style={{ color: TEXT, fontSize: 13 }}>{loc.range}</span>
                  <span style={{ color: MUTED, fontSize: 12 }}>({loc.weekday})</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {slot.bestPlatform ? (
                    <>
                      <span style={{ color: platColor, fontWeight: 600, fontSize: 13 }}>
                        {slot.bestPlatform}
                      </span>
                      {slot.bestPlatAvgUSDhr != null && (
                        <span style={{ color: WHITE, fontSize: 13 }}>
                          {fmt$(slot.bestPlatAvgUSDhr)}
                          <span style={{ color: MUTED, fontWeight: 400 }}>/hr avg</span>
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ color: MUTED, fontSize: 13 }}>Mixed platforms</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── REVENUE PROJECTION ────────────────────────────────────────────────── */}
      <div style={cardStyle()}>
        <SectionHeader
          title="Revenue Projection"
          sub="Estimated earnings if you follow the plan — based on median session earnings"
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {top3.map((slot, i) => {
            const loc        = utcSlotToLocal(slot.utcDay, slot.hourSlot)
            const isToday    = todayMatch?.utcDay === slot.utcDay && todayMatch?.hourSlot === slot.hourSlot
            const accentBdr  = isToday ? "rgba(34,211,238,0.28)" : BORDER
            const accentBg   = isToday ? "rgba(34,211,238,0.05)" : "rgba(255,255,255,0.02)"
            return (
              <div
                key={`proj-${slot.utcDay}-${slot.hourSlot}`}
                style={{
                  background: accentBg, border: `1px solid ${accentBdr}`,
                  borderRadius: 10, padding: "16px", textAlign: "center",
                }}
              >
                {isToday && (
                  <div style={{ color: CYAN, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                    Today
                  </div>
                )}
                <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Slot {i + 1}</div>
                <div style={{ color: TEXT, fontSize: 12, marginBottom: 10 }}>{loc.full}</div>
                <div style={{ color: WHITE, fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
                  {fmt$(slot.medianUSD)}
                </div>
                <div style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>median / session</div>
                <div style={{ color: TEXT, fontSize: 12, marginTop: 8 }}>
                  Up to{" "}
                  <span style={{ color: isToday ? CYAN : TEXT, fontWeight: 600 }}>
                    {fmt$(slot.avgUSDhr * 4)}
                  </span>{" "}
                  over 4 hrs
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── WHAT'S NEXT — UNTESTED SLOTS ──────────────────────────────────────── */}
      {sparseSlots.length > 0 && (
        <div style={cardStyle()}>
          <SectionHeader
            title="What's Next"
            sub="Slots with limited history — more sessions here will improve your plan"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sparseSlots.map((slot) => {
              const loc = utcSlotToLocal(slot.utcDay, slot.hourSlot)
              return (
                <div
                  key={`sparse-${slot.utcDay}-${slot.hourSlot}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 14px",
                    background: "rgba(245,158,11,0.04)",
                    border: "1px solid rgba(245,158,11,0.20)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: GOLD, fontSize: 13 }}>◆</span>
                    <div>
                      <div style={{ color: TEXT, fontSize: 13 }}>{loc.full}</div>
                      <div style={{ color: GOLD, fontSize: 11, marginTop: 2 }}>
                        Worth exploring — not enough data yet ({slot.sessionCount} session{slot.sessionCount !== 1 ? "s" : ""})
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: TEXT, fontSize: 13 }}>
                      {fmt$(slot.avgUSDhr)}
                      <span style={{ color: MUTED, fontSize: 11 }}>/hr so far</span>
                    </div>
                    <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                      ~{fmt$(slot.estEarnings)} / 2 hr
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT — early return before any hooks
// ═══════════════════════════════════════════════════════════════════════════════
export default function StreamPlanner({ tips = [] }) {
  if (!tips || tips.length < 10) {
    return (
      <div style={{
        background: BG, minHeight: "100%", padding: 24,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ ...cardStyle(), textAlign: "center", padding: "48px 32px", maxWidth: 420 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
            background: "rgba(245,158,11,0.10)",
            border: "1px solid rgba(245,158,11,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26,
          }}>
            📊
          </div>
          <div style={{ color: WHITE, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Upload more data to unlock your personalized plan
          </div>
          <div style={{ color: TEXT, fontSize: 13, lineHeight: 1.6 }}>
            We need at least 10 tips to detect your streaming patterns and
            build accurate time-slot recommendations.
          </div>
        </div>
      </div>
    )
  }

  return <StreamPlannerContent tips={tips} />
}
