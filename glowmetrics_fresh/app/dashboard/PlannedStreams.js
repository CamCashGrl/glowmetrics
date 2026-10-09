"use client"

// Saved, dated stream plans ("Plan a stream"). These are the only source the
// Sessions Schedule tab matches against — never recommendation windows.
// The database only lets a creator add, change or delete a plan while its
// start is still in the future; past plans are read-only here too.

import React, { useState } from "react"
import { supabase } from "../../lib/supabase"
import { canonicalPlatform } from "../../lib/constants"

const PLATFORMS = ["Chaturbate", "BongaCams", "MyFreeCams"]
// The database only accepts these exact names; the default can arrive as an
// onboarding key ('bongacams'), so resolve it before it reaches the form.
const toPlanPlatform = (p) => { const c = canonicalPlatform(p); return PLATFORMS.includes(c) ? c : PLATFORMS[0] }
const C = { cyan: "#22D3EE", white: "#F1F5F9", text: "#94A3B8", muted: "#64748B", line: "rgba(255,255,255,0.10)", red: "#F87171" }
const box = { background: "rgba(8,11,22,0.72)", border: `1px solid ${C.line}`, borderRadius: 12 }
const input = { background: "rgba(255,255,255,0.04)", border: `1px solid ${C.line}`, borderRadius: 8, color: C.white, padding: "7px 10px", fontSize: 13 }

const fmt = (iso) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const fmtT = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

// Local date + times → ISO; an end time earlier than the start runs past midnight.
export function planWindow(date, startTime, endTime) {
  const start = new Date(`${date}T${startTime}`)
  let end = new Date(`${date}T${endTime}`)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null
  if (end <= start) end = new Date(end.getTime() + 86400000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export default function PlannedStreams({ userId, plans = [], onChanged = () => {}, defaultPlatform = "Chaturbate" }) {
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("20:00")
  const [endTime, setEndTime] = useState("22:00")
  const [platform, setPlatform] = useState(() => toPlanPlatform(defaultPlatform))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const now = Date.now()
  const upcoming = plans.filter((p) => new Date(p.start_at).getTime() > now).sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
  const past = plans.filter((p) => new Date(p.start_at).getTime() <= now).sort((a, b) => new Date(b.start_at) - new Date(a.start_at)).slice(0, 5)

  const add = async (ev) => {
    ev.preventDefault()
    setError("")
    const w = planWindow(date, startTime, endTime)
    if (!w) { setError("Choose a date, start and end time."); return }
    if (new Date(w.start).getTime() <= Date.now()) { setError("Plans can only be added for a future time."); return }
    if (new Date(w.end) - new Date(w.start) > 12 * 3600000) { setError("A plan can be at most 12 hours long."); return }
    setBusy(true)
    const { error: e } = await supabase.from("planned_streams").insert({ user_id: userId, platform, start_at: w.start, end_at: w.end, source: "stream_planner" })
    setBusy(false)
    if (e) { setError("Could not save this plan. Please try again."); return }
    setDate("")
    onChanged()
  }
  const remove = async (id) => {
    setError("")
    const { error: e } = await supabase.from("planned_streams").delete().eq("id", id)
    if (e) { setError("Could not delete this plan."); return }
    onChanged()
  }

  return (
    <div data-testid="planned-streams" style={{ ...box, padding: 16, marginBottom: 20 }}>
      <div style={{ color: C.white, fontWeight: 800, fontSize: 15 }}>Plan a stream</div>
      <div style={{ color: C.text, fontSize: 12.5, marginTop: 2 }}>Save when you intend to go live. Sessions shows whether each session started on schedule. Plans lock once their start time passes.</div>
      <form onSubmit={add} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <input data-testid="plan-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} aria-label="Date" />
        <input data-testid="plan-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={input} aria-label="Start time" />
        <span style={{ color: C.muted }}>to</span>
        <input data-testid="plan-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={input} aria-label="End time" />
        <select data-testid="plan-platform" value={platform} onChange={(e) => setPlatform(e.target.value)} style={input} aria-label="Platform">
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button data-testid="plan-add" type="submit" disabled={busy} style={{ border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 800, cursor: "pointer", background: C.cyan, color: "#0b0e1a" }}>{busy ? "Saving…" : "Save plan"}</button>
      </form>
      {error && <div role="alert" data-testid="plan-error" style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{error}</div>}
      {upcoming.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>UPCOMING</div>
          {upcoming.map((p) => (
            <div key={p.id} data-testid="plan-upcoming" style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.line}`, fontSize: 13, color: C.white }}>
              <span>{fmt(p.start_at)}–{fmtT(p.end_at)} · {p.platform}</span>
              <button onClick={() => remove(p.id)} style={{ background: "none", border: "none", color: C.text, cursor: "pointer", fontSize: 12 }}>Delete</button>
            </div>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>PAST (LOCKED)</div>
          {past.map((p) => (
            <div key={p.id} data-testid="plan-past" style={{ padding: "6px 0", borderTop: `1px solid ${C.line}`, fontSize: 13, color: C.text }}>{fmt(p.start_at)}–{fmtT(p.end_at)} · {p.platform}</div>
          ))}
        </div>
      )}
    </div>
  )
}
