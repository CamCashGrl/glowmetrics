"use client"
// Session Pulse — ONE grounded observation, chosen by a fixed priority over
// existing engine outputs (approved order, no new formulas):
//   1. a Live show running now (live engine state)
//   2. a finished Live show not yet viewed (isNew from /api/live/sessions/recent)
//   3. the latest session, when sessionVsTypical has a verified comparison
//   4. a recap of the latest session (low data)
// Zero sessions render the existing activation state instead (not here).
// Every value is passed in as a prop; this file only selects and formats.

import React from "react"
import { platformDisplayName } from "../../lib/constants"
import { fmtUsd, fmtDuration } from "./LatestShows"
import L from "./SessionsLuxury.module.css"

const cx = (...a) => a.filter(Boolean).join(" ")
const pName = (p) => platformDisplayName(p) || p
const day = (iso, tz) => new Date(iso).toLocaleString([], { timeZone: tz, weekday: "short", month: "short", day: "numeric" })
const unit = (e, n) => e.type === "private" ? (n === 1 ? "charge" : "charges") : (n === 1 ? "tip" : "tips")
const typeWord = (e) => e.type === "live" ? "Live show" : e.type === "free_chat" ? "free chat" : e.type === "private" ? "private session" : "imported session"

// Pure: pick the observation (exported for tests).
export function pickPulse({ running = null, history = [], vsById = new Map() }) {
  if (running) return { kind: "live_now", e: running }
  const fresh = history.find((e) => e.type === "live" && e.isNew)
  if (fresh) return { kind: "new_show", e: fresh }
  const latest = history[0]
  if (!latest) return null
  const vs = vsById.get(latest.id)
  if (vs) return { kind: "comparison", e: latest, vs }
  return { kind: "recap", e: latest, first: history.length === 1 }
}

const PulseIcon = () => (
  <span className={L.pulseIcon} aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l3-7 4 14 3-7h6" /></svg>
  </span>
)

export default function SessionsPulse({ pick, tz, topFan = null, hourly = null, onOpen, onImport = null }) {
  if (!pick) return null
  const { kind, e } = pick
  let title, message, evidence, signalLabel, signalValue, action
  if (kind === "live_now") {
    title = "You're live"
    message = `${pName(e.platforms[0])} · ${fmtDuration((e.durationMinutes || 0) * 60)} so far · ${e.tipCount} ${unit(e, e.tipCount)} from ${e.uniqueTippers} ${e.uniqueTippers === 1 ? "fan" : "fans"}.`
    evidence = "Live Mode · linked tips so far, updates as they arrive"
    signalLabel = "Earned so far"; signalValue = fmtUsd(e.totalUSD)
    action = { label: "View show", onClick: () => onOpen(e.id) }
  } else if (kind === "new_show") {
    title = "Your show just ended"
    message = `${pName(e.platforms[0])} Live show · ${fmtDuration((e.durationMinutes || 0) * 60)}${topFan ? ` · ${topFan.username} was your top contributor` : ""}.`
    evidence = "Recorded by Live Mode"
    if (hourly != null) { signalLabel = "Verified $/hr"; signalValue = `${fmtUsd(hourly)}/hr` } else { signalLabel = "Earned"; signalValue = fmtUsd(e.totalUSD) }
    action = { label: "Review show", onClick: () => onOpen(e.id) }
  } else if (kind === "comparison") {
    const { vs } = pick
    title = vs.outcome === "above" ? "Your latest session beat your usual" : vs.outcome === "below" ? "Your latest session came in under your usual" : "Your latest session matched your usual"
    message = `${pName(e.platforms[0])} ${typeWord(e)} on ${day(e.startTime, tz)}: ${fmtUsd(e.totalUSD)} vs your median ${fmtUsd(vs.medianUSD)}.`
    evidence = `Compared with ${vs.sessions} ${pName(e.platforms[0])} ${typeWord(e)}s · same platform and type`
    signalLabel = "vs typical"; signalValue = vs.outcome === "par" ? "On par" : `${vs.deltaPct > 0 ? "+" : ""}${vs.deltaPct}%`
    action = { label: "Open session", onClick: () => onOpen(e.id) }
  } else {
    const n = e.type === "private" ? e.chargeCount : e.tipCount
    title = pick.first ? "Your first recorded session" : "Your latest session"
    const span = e.type === "live" ? ` over ${fmtDuration((e.durationMinutes || 0) * 60)}`
      : e.type === "private" ? ""
      : e.durationUnknown ? "" : ` across a ~${Math.round(e.durationMinutes || 0)}-minute activity span`
    message = `${pName(e.platforms[0])} ${typeWord(e)} on ${day(e.startTime, tz)}: ${n} ${unit(e, n)} from ${e.uniqueTippers} ${e.uniqueTippers === 1 ? "fan" : "fans"}${span}.`
    evidence = e.type === "live" ? "Recorded by Live Mode" : e.type === "private" ? "From imported private charges" : "Reconstructed from imported transactions"
    // Lead with what was earned and recorded (no session count as an "insight").
    signalLabel = "Earned"; signalValue = fmtUsd(e.totalUSD)
    // Live Mode creators review the show; imported history invites more history.
    action = e.type !== "live" && onImport ? { label: "Import more history", onClick: onImport, secondary: true } : { label: e.type === "live" ? "Review show" : "Open session", onClick: () => onOpen(e.id), secondary: true }
  }
  return (
    <section data-testid="session-pulse" data-kind={kind} className={cx(L.glassFeature, L.pulse)} aria-label="Session Pulse">
      <div className={L.pulseLead}>
        <PulseIcon />
        <div style={{ minWidth: 0 }}>
          <div className={L.eyebrow} style={{ marginBottom: 4 }}>Session Pulse</div>
          <h2 className={L.pulseTitle}>{title}</h2>
          <p className={L.pulseMessage}>{message}</p>
          {evidence && <p className={L.pulseEvidence}>{evidence}</p>}
        </div>
      </div>
      <div className={L.pulseSignal}>
        <div className={L.microLabel}>{signalLabel}</div>
        <div data-testid="pulse-signal" className={cx(L.signalValue, L.money)}>{signalValue}</div>
      </div>
      <div className={L.pulseAction}>
        <button data-testid="pulse-action" onClick={action.onClick} className={action.secondary ? L.secondaryAction : L.primaryAction}>{action.label} <span aria-hidden="true">→</span></button>
      </div>
    </section>
  )
}
