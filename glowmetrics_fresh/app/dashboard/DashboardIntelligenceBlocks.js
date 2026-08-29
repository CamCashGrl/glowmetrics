"use client"

import { useEffect, useMemo, useState } from "react"

const C = {
  cyan: "#22D3EE",
  indigo: "#7C5CFF",
  pink: "#EC4899",
  gold: "#F59E0B",
  green: "#10B981",
  white: "#F1F5F9",
  text: "#94A3B8",
  muted: "#64748B",
  border: "rgba(255,255,255,0.08)",
}

const glass = {
  background: "rgba(15,20,32,0.75)",
  border: `1px solid ${C.border}`,
  backdropFilter: "blur(20px)",
  boxShadow: "0 0 34px rgba(59,130,246,0.12), 0 0 60px rgba(236,72,153,0.06)",
}

function fmtUsd(value) {
  const n = Number(value || 0)
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtHour(hour) {
  const n = ((Number(hour) % 24) + 24) % 24
  if (n === 0) return "12 AM"
  if (n < 12) return `${n} AM`
  if (n === 12) return "12 PM"
  return `${n - 12} PM`
}

function fmtWindow(hour) {
  return `${fmtHour(hour)}–${fmtHour(Number(hour) + 2)}`
}

function getBestWindow(analytics, dailyBrief) {
  const canonical = analytics?.canonicalBestTimes?.bestWindow
  if (canonical && Number.isFinite(Number(canonical.localHour))) return canonical

  const brief = dailyBrief
  if (brief?.bh != null && Number.isFinite(Number(brief.bh))) {
    return {
      localHour: Number(brief.bh),
      localDay: brief.todayName || null,
      medianUsdPerHour: Number(brief.displayAvg || 0),
      sessionCount: Number(brief.sessionsAtPeakCount || 0),
      tier: null,
    }
  }
  return null
}

export default function DashboardIntelligenceBlocks({
  analytics,
  dailyBrief,
  whales = [],
  onPlanStream,
}) {
  const [noticeIndex, setNoticeIndex] = useState(0)

  const bestWindow = getBestWindow(analytics, dailyBrief)
  const topPlatform = analytics?.bestPlatformByRate || null
  const platformEntries = Array.isArray(analytics?.platforms) ? analytics.platforms : []
  const topPlatformFallback = useMemo(
    () => [...platformEntries].sort((a, b) => Number(b?.usdPerHour || 0) - Number(a?.usdPerHour || 0))[0] || null,
    [platformEntries]
  )
  const chosenPlatform = topPlatform?.platform ? topPlatform : topPlatformFallback
  const momentum = analytics?.momentum
  const topWhale = whales?.[0] || null

  const pctAbove = bestWindow && Number(bestWindow.medianUsdPerHour) > 0 && Number(analytics?.estimatedHourlyRate) > 0
    ? Math.round(((Number(bestWindow.medianUsdPerHour) - Number(analytics.estimatedHourlyRate)) / Number(analytics.estimatedHourlyRate)) * 100)
    : null

  const notices = useMemo(() => {
    const list = []

    if (bestWindow) {
      list.push({
        icon: "🕐",
        title: "Your strongest stream window",
        body: `${bestWindow.localDay ? `${bestWindow.localDay}s ` : ""}${fmtWindow(bestWindow.localHour)} is the clearest earning pattern in your data${bestWindow.sessionCount ? `, backed by ${bestWindow.sessionCount} qualifying session${bestWindow.sessionCount === 1 ? "" : "s"}` : ""}.`,
        accent: C.cyan,
      })
    }

    if (chosenPlatform) {
      const rate = Number(chosenPlatform.usdPerHour ?? chosenPlatform.rate ?? 0)
      list.push({
        icon: "📈",
        title: "Your highest-return platform",
        body: `${chosenPlatform.platform} is currently your strongest measured platform${rate > 0 ? ` at ${fmtUsd(rate)}/hr` : ""}.`,
        accent: C.indigo,
      })
    }

    if (momentum?.label) {
      const pct = Number(momentum.pct)
      const pctText = Number.isFinite(pct) && pct !== 0 ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""
      list.push({
        icon: pct >= 0 ? "⚡" : "📉",
        title: "Your recent momentum",
        body: `${momentum.label}${pctText}. This is based on your recent-vs-prior revenue trend, not a guess about future earnings.`,
        accent: pct >= 0 ? C.green : C.gold,
      })
    }

    if (topWhale?.username && Number(topWhale.totalUSD) > 0) {
      list.push({
        icon: "🐳",
        title: "A high-value fan to watch",
        body: `${topWhale.username} has contributed ${fmtUsd(topWhale.totalUSD)} lifetime. Keep an eye on their recent activity when planning outreach.`,
        accent: C.pink,
      })
    }

    return list.slice(0, 4)
  }, [bestWindow, chosenPlatform, momentum, topWhale])

  useEffect(() => {
    if (notices.length <= 1) return undefined
    const id = window.setInterval(() => {
      setNoticeIndex((current) => (current + 1) % notices.length)
    }, 6000)
    return () => window.clearInterval(id)
  }, [notices.length])

  useEffect(() => {
    if (noticeIndex >= notices.length) setNoticeIndex(0)
  }, [noticeIndex, notices.length])

  const activeNotice = notices[noticeIndex] || null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
      {/* YOUR NEXT BEST MOVE */}
      <section style={{
        ...glass,
        position: "relative",
        overflow: "hidden",
        borderRadius: 20,
        padding: "28px 30px",
        background: bestWindow
          ? "linear-gradient(115deg, rgba(34,211,238,0.11), rgba(124,92,255,0.10) 48%, rgba(236,72,153,0.08))"
          : glass.background,
        borderColor: bestWindow ? "rgba(34,211,238,0.24)" : C.border,
      }}>
        {bestWindow && (
          <div style={{ position: "absolute", right: -70, top: -90, width: 260, height: 260, borderRadius: "50%", background: "rgba(34,211,238,0.12)", filter: "blur(70px)", pointerEvents: "none" }} />
        )}
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: bestWindow ? C.cyan : C.muted, marginBottom: 10 }}>
            Your next best move
          </div>

          {bestWindow ? (
            <>
              <div style={{ fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.12, fontWeight: 850, letterSpacing: "-0.035em", color: C.white }}>
                Go live {fmtWindow(bestWindow.localHour)}{bestWindow.topPlatform ? ` on ${bestWindow.topPlatform}` : chosenPlatform?.platform ? ` on ${chosenPlatform.platform}` : ""}
              </div>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", color: C.gold, fontSize: 11, fontWeight: 750 }}>
                  {bestWindow.tier === "high" ? "Strong pattern" : bestWindow.tier === "supported" ? "Supported pattern" : "Data-backed window"}
                </span>
                {bestWindow.sessionCount > 0 && <span style={{ color: C.text, fontSize: 12 }}>based on {bestWindow.sessionCount} qualifying sessions</span>}
              </div>
              <div style={{ marginTop: 13, color: C.text, fontSize: 14, lineHeight: 1.6, maxWidth: 640 }}>
                {bestWindow.localDay ? `${bestWindow.localDay}s are` : "This is"} your clearest measured earning window.
                {Number(bestWindow.medianUsdPerHour) > 0 && <> You average <strong style={{ color: C.cyan }}>{fmtUsd(bestWindow.medianUsdPerHour)}/hr</strong> there.</>}
                {pctAbove != null && pctAbove > 0 && <> That is <strong style={{ color: C.cyan }}>{pctAbove}% above</strong> your current overall hourly rate.</>}
              </div>
              {onPlanStream && (
                <button onClick={onPlanStream} style={{ marginTop: 18, padding: "12px 20px", borderRadius: 11, border: 0, cursor: "pointer", color: C.white, fontWeight: 800, fontSize: 13, background: "linear-gradient(90deg,#22D3EE 0%,#7C5CFF 48%,#EC4899 100%)", boxShadow: "0 5px 20px rgba(124,92,255,0.25)" }}>
                  Plan My Stream →
                </button>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 24, lineHeight: 1.2, fontWeight: 800, color: C.white }}>Keep building your sample</div>
              <div style={{ marginTop: 10, maxWidth: 630, color: C.text, fontSize: 13.5, lineHeight: 1.6 }}>
                Import more session history and CamCash will turn it into a stronger, more reliable recommendation.
              </div>
            </>
          )}
        </div>
      </section>

      {/* CAMCASH NOTICED */}
      {activeNotice && (
        <section style={{
          ...glass,
          borderRadius: 16,
          padding: "16px 18px",
          borderColor: `${activeNotice.accent}45`,
          background: "rgba(11,15,26,0.72)",
          animation: "fadeUp 220ms ease both",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: `${activeNotice.accent}18`, border: `1px solid ${activeNotice.accent}30`, fontSize: 15 }}>{activeNotice.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: activeNotice.accent }}>CamCash Noticed</div>
            </div>
            {notices.length > 1 && <div aria-label="Insight position" style={{ display: "flex", gap: 5 }}>{notices.map((_, i) => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: i === noticeIndex ? activeNotice.accent : "rgba(255,255,255,0.16)" }} />)}</div>}
          </div>
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, color: C.white }}>{activeNotice.title}</div>
          <div style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.55, color: C.text }}>{activeNotice.body}</div>
        </section>
      )}
    </div>
  )
}
