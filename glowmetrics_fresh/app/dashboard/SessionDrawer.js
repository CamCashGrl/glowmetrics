"use client"
import { useEffect, useState } from "react"
import { getSessionBreakdown, SESSION_PERF_BADGE } from "../../lib/analytics/session-insights"

const C = {
  cyan: "#22D3EE", indigo: "#7C5CFF", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", red: "#F87171", white: "#F1F5F9", text: "#94A3B8",
  muted: "#475569", border: "#1e2d45", panel: "#0b0f1a",
}

const fmtUsd = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "—"
const fmtTime = (d, tz) => d ? new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...(tz ? { timeZone: tz } : {}) }) : "—"
const fmtDuration = (mins) => {
  if (mins == null) return "—"
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const RESOLUTION_LABEL = {
  normal_stop: "Ended manually",
  end_at_last_heartbeat: "Auto-ended (inactivity)",
  chosen_end_time: "End time corrected",
  marked_invalid: "Marked invalid",
}

const TYPE_LABEL = { free: "Free Chat", live: "Live Mode", paid: "Paid / Private" }
const TYPE_COLOR = { free: C.cyan, live: "#FB923C", paid: C.indigo }

function SectionLabel({ children }) {
  return <div className="drawer-section-label">{children}</div>
}

function StatChip({ label, value, color = C.white }) {
  return (
    <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

// row: { type: 'free'|'live'|'paid', session, comparablePopulation, coachingEvents, coachingLoading, onLoadCoaching }
export default function SessionDrawer({ row, onClose, coachingEvents, coachingLoading, onLoadCoaching, timezone = "UTC" }) {
  const [notes, setNotes] = useState("")
  useEffect(() => {
    if (!row) return undefined
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [row, onClose])

  useEffect(() => {
    if (row?.type === "live" && row.session?.id && onLoadCoaching) onLoadCoaching(row.session.id)
  }, [row, onLoadCoaching])

  if (!row) return null
  const { type, session: s } = row
  const typeColor = TYPE_COLOR[type]

  // ── Normalize header fields per type ──────────────────────
  let platform, startTime, endTime, durationMinutes, revenue, usdPerHr
  if (type === "free") {
    platform = s.platform
    startTime = s.startTime; endTime = s.endTime
    durationMinutes = s.durationUnknown ? null : s.durationMinutes
    revenue = s.totalUSD
    usdPerHr = s.usdPerHour
  } else if (type === "live") {
    platform = s.stream_platform || "Chaturbate"
    startTime = s.started_at; endTime = s.ended_at
    const activeSecs = s.ended_at ? (new Date(s.ended_at) - new Date(s.started_at)) / 1000 - (s.total_paused_seconds || 0) : null
    durationMinutes = activeSecs != null ? activeSecs / 60 : null
    revenue = s.session_earnings_usd || 0
    usdPerHr = durationMinutes && durationMinutes > 0 ? parseFloat((revenue / (durationMinutes / 60)).toFixed(2)) : null
  } else {
    platform = s.platform
    startTime = s.date_time; endTime = s.date_time
    durationMinutes = null
    revenue = parseFloat(s.usd) || 0
    usdPerHr = null
  }

  const bd = type === "free" ? getSessionBreakdown(s, row.comparablePopulation || [], timezone) : null
  const perf = bd ? SESSION_PERF_BADGE[bd.performance] : null

  return (
    <div className="session-drawer-overlay">
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />
      <div className="session-drawer">
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="drawer-close">✕</button>
        </div>

        {/* ── HEADER — the important stuff, no scroll needed to see it ── */}
        <div style={{ marginBottom: 4 }}>
          <span style={{
            display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 10.5, fontWeight: 800,
            color: typeColor, background: `${typeColor}1a`, border: `1px solid ${typeColor}45`, marginBottom: 10,
          }}>{TYPE_LABEL[type]}</span>
          {perf && (
            <span style={{ display: "inline-block", marginLeft: 8, padding: "3px 10px", borderRadius: 20, background: perf.bg, border: `1px solid ${perf.border}`, fontSize: 10.5, fontWeight: 800, color: perf.color }}>
              {perf.label}
            </span>
          )}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 2 }}>{platform}</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>
          {fmtDate(startTime)} · {fmtTime(startTime, timezone)}{endTime && endTime !== startTime ? ` → ${fmtTime(endTime, timezone)}` : ""}
        </div>

        <div className="drawer-overview-grid">
          <StatChip label="Duration" value={fmtDuration(durationMinutes)} />
          <StatChip label="Revenue" value={fmtUsd(revenue)} color={C.green} />
          <StatChip label="$/hr" value={usdPerHr != null ? `$${usdPerHr}` : "—"} color={C.cyan} />
          <StatChip label="Tips" value={type === "free" ? (s.tipCount ?? (s.tips || []).length) : type === "live" ? (s.tip_count ?? "—") : 1} color={C.pink} />
        </div>

        {/* ── WHAT WORKED / COULD IMPROVE ── */}
        {type === "free" && bd && (
          <>
            <SectionLabel>💡 What worked</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {bd.insights.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>Not enough signal in this session yet.</div>}
              {bd.insights.map((ins, i) => (
                <div key={i} style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, display: "flex", gap: 6 }}>
                  <span style={{ color: C.cyan, flexShrink: 0 }}>→</span><span>{ins}</span>
                </div>
              ))}
            </div>

            <SectionLabel>🚀 What could improve</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {bd.recommendations.map((rec, i) => (
                <div key={i} style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, display: "flex", gap: 6 }}>
                  <span style={{ color: C.pink, flexShrink: 0 }}>•</span><span>{rec}</span>
                </div>
              ))}
            </div>

            <SectionLabel>🏆 Who held the show</SectionLabel>
            {bd.topTippers.length === 0 ? (
              <div style={{ fontSize: 12, color: C.muted }}>No tip data for this session.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {bd.topTippers.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13 }}>{["🥇", "🥈", "🥉"][i]}</span>
                    <span style={{ fontSize: 12.5, color: C.white, fontWeight: 700, flex: 1 }}>{t.username}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{t.count} tip{t.count === 1 ? "" : "s"}</span>
                    <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{fmtUsd(t.usd)}</span>
                    <span style={{ fontSize: 11, color: C.muted, width: 34, textAlign: "right" }}>{t.pct}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── CORE METRICS — the per-session numbers the old Session
                   Breakdown card carried, which the drawer's four overview
                   chips alone do not cover. ── */}
            {/* Tips and $/hr already appear in the overview grid above, so only
                the metrics the old card added are repeated here. */}
            <SectionLabel>📊 Session metrics</SectionLabel>
            <div className="drawer-overview-grid">
              <StatChip label="Unique Fans" value={s.uniqueFans ?? "—"} color={C.pink} />
              <StatChip label="Avg Tip" value={s.avgTipSize != null ? fmtUsd(s.avgTipSize) : "—"} color={C.gold} />
              {/* null on durationUnknown sessions — shown as "—" rather than a
                  confident rate for a duration we do not actually know. */}
              <StatChip label="$/Min" value={s.usdPerMinute != null ? fmtUsd(s.usdPerMinute) : "—"} color={C.cyan} />
            </div>

            {/* ── VELOCITY + CONCENTRATION ── */}
            {(s.velocityTrend !== "unknown" || s.topContributorPct >= 40) && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {s.velocityTrend !== "unknown" && (() => {
                  const V = {
                    growing: { icon: "📈", label: "Momentum building", color: C.green, bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)" },
                    dying:   { icon: "📉", label: "Earnings slowing",  color: C.red,   bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)" },
                    steady:  { icon: "➡️", label: "Steady pace",       color: C.text,  bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" },
                  }[s.velocityTrend]
                  const pctChange = s.firstHalfUPM && s.secondHalfUPM
                    ? Math.round(Math.abs((s.secondHalfUPM - s.firstHalfUPM) / s.firstHalfUPM) * 100)
                    : null
                  return (
                    <div style={{ flex: 1, minWidth: 160, padding: "9px 12px", borderRadius: 10, background: V.bg, border: `1px solid ${V.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15 }}>{V.icon}</span>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: V.color }}>{V.label}</div>
                        {pctChange !== null && (
                          <div style={{ fontSize: 10.5, color: C.muted }}>
                            {s.velocityTrend === "growing" ? `+${pctChange}%` : s.velocityTrend === "dying" ? `-${pctChange}%` : "~0%"} vs first half
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
                {s.topContributorPct >= 40 && (
                  <div style={{ flex: 1, minWidth: 180, padding: "9px 12px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15 }}>⚠️</span>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.gold }}>{s.topContributorPct}% from one fan</div>
                      <div style={{ fontSize: 10.5, color: C.muted }}>{s.topContributor} drove most of this session</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {bd.buckets.length > 1 && (
              <>
                <SectionLabel>⏱ Earnings timeline (5-min buckets)</SectionLabel>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 56 }}>
                  {(() => {
                    const maxUsd = Math.max(...bd.buckets.map(x => x.usd), 0.01)
                    return bd.buckets.map((b, bi) => {
                      const heightPct = maxUsd > 0 ? (b.usd / maxUsd) * 100 : 0
                      const isPeak = b === bd.peakBucket && b.usd > 0
                      return (
                        <div key={bi} title={`${b.label}: ${fmtUsd(b.usd)}`} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}>
                          <div style={{ width: "100%", height: `${Math.max(heightPct, b.usd > 0 ? 6 : 2)}%`, background: isPeak ? C.gold : b.usd > 0 ? C.cyan : "rgba(255,255,255,0.06)", borderRadius: "2px 2px 0 0", minHeight: 2 }} />
                        </div>
                      )
                    })
                  })()}
                </div>
                {/* Start / peak / end captions. The peak label reads the peak
                    bucket's own time, so it always names the gold bar. */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                  <span style={{ fontSize: 9.5, color: C.muted }}>{fmtTime(startTime, timezone)}</span>
                  {bd.peakBucket?.usd > 0 && (
                    <span style={{ fontSize: 9.5, color: C.gold }}>🔥 Peak at {fmtTime(bd.peakTime, timezone)}</span>
                  )}
                  <span style={{ fontSize: 9.5, color: C.muted }}>{fmtTime(endTime, timezone)}</span>
                </div>
              </>
            )}

            {/* ── SESSION PACING — first vs second half, from the canonical
                   timestamp-midpoint split (finalizeSession's firstHalfPct). ── */}
            <SectionLabel>📊 Session pacing</SectionLabel>
            <div style={{ display: "flex", height: 26, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ width: `${bd.firstHalfPct}%`, background: "linear-gradient(90deg, #22D3EE, #60A5FA)", display: "flex", alignItems: "center", justifyContent: "center", transition: "width 0.4s" }}>
                {bd.firstHalfPct >= 20 && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff" }}>First half {bd.firstHalfPct}%</span>}
              </div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {100 - bd.firstHalfPct >= 20 && <span style={{ fontSize: 10, color: C.text }}>Second half {100 - bd.firstHalfPct}%</span>}
              </div>
            </div>
          </>
        )}

        {type === "live" && (
          <>
            <SectionLabel>💡 What happened</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12.5, color: C.text }}>
                {RESOLUTION_LABEL[s.session_resolution_type] || "Session ended"}{s.is_inaccurate ? " — excluded from stats due to a data inconsistency" : ""}
              </div>
              <div style={{ fontSize: 12.5, color: C.text }}>
                {s.tip_count || 0} tip{(s.tip_count || 0) === 1 ? "" : "s"} from {s.unique_tipper_count || 0} supporter{(s.unique_tipper_count || 0) === 1 ? "" : "s"}
                {s.largest_tip_usd ? ` — largest tip ${fmtUsd(s.largest_tip_usd)}` : ""}
              </div>
            </div>

            <SectionLabel>🏆 Who held the show</SectionLabel>
            <div style={{ fontSize: 12, color: C.muted }}>
              Per-fan revenue breakdown isn't tracked for Live Mode sessions yet — only aggregate tip counts are.
            </div>

            <SectionLabel>🎯 Coaching</SectionLabel>
            {coachingLoading === s.id && <div style={{ fontSize: 12, color: C.muted }}>Loading coaching timeline…</div>}
            {coachingLoading !== s.id && coachingEvents && coachingEvents.length === 0 && (
              <div style={{ fontSize: 12, color: C.muted }}>No coaching prompts fired during this session.</div>
            )}
            {coachingLoading !== s.id && coachingEvents && coachingEvents.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {coachingEvents.map((e) => (
                  <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12 }}>
                    <span style={{ color: C.muted, minWidth: 58, fontVariantNumeric: "tabular-nums" }}>{fmtTime(e.shown_at)}</span>
                    <span style={{
                      padding: "1px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700, flexShrink: 0,
                      background: e.action_status === "performed" ? "rgba(16,185,129,0.15)" : e.action_status === "skipped" ? "rgba(148,163,184,0.15)" : "rgba(245,158,11,0.15)",
                      color: e.action_status === "performed" ? C.green : e.action_status === "skipped" ? C.muted : C.gold,
                    }}>
                      {e.action_status === "performed" ? "✓ Performed" : e.action_status === "skipped" ? "↩ Skipped" : "— Unmarked"}
                    </span>
                    <span style={{ color: C.white }}>{e.title || e.message}</span>
                  </div>
                ))}
              </div>
            )}

            <SectionLabel>⏱ Session timeline</SectionLabel>
            <div style={{ fontSize: 12, color: C.muted }}>
              {fmtTime(s.started_at)} start → {s.ended_at ? fmtTime(s.ended_at) : "still running"}
              {s.total_paused_seconds ? ` (${Math.round(s.total_paused_seconds / 60)}m paused, excluded from active time)` : ""}
            </div>
          </>
        )}

        {type === "paid" && (
          <>
            <SectionLabel>💡 What happened</SectionLabel>
            <div style={{ fontSize: 12.5, color: C.text }}>
              {s.session_type || "Paid session"} — {fmtUsd(s.usd)} for {s.tokens || 0} tokens
              {s.tokens > 0 ? ` (${fmtUsd((parseFloat(s.usd) || 0) / s.tokens)}/token)` : ""}
            </div>

            <SectionLabel>🏆 Who held the show</SectionLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13 }}>🥇</span>
              <span style={{ fontSize: 12.5, color: C.white, fontWeight: 700, flex: 1 }}>{s.username || "unknown"}</span>
              <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{fmtUsd(s.usd)}</span>
              <span style={{ fontSize: 11, color: C.muted }}>100%</span>
            </div>

            <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginTop: 14 }}>
              Duration and $/hr aren't tracked for paid sessions — only tokens, revenue, and client are recorded.
            </div>
          </>
        )}

        <SectionLabel>📝 Session notes</SectionLabel>
        <textarea
          className="drawer-notes"
          placeholder="Write a note about this session (visible only to you, not saved)…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </div>
  )
}
