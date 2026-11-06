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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l3-7 4 14 3-7h6" /></svg>
  </span>
)

// Source badge: says where the numbers come from (never a performance claim).
const sourceBadge = (kind, e) => kind === "live_now" ? "Live now"
  : e.type === "live" ? "Live Mode"
  : e.type === "private" ? "Imported charges"
  : "Imported history"

const typeLabel = (e) => e.type === "live" ? "Live show" : e.type === "free_chat" ? "Free chat" : e.type === "private" ? "Private" : "Imported"
const fansText = (n) => `${n} ${n === 1 ? "fan" : "fans"}`

// Presentation only: every value below is an engine output passed in as a prop
// (session entry, sessionVsTypical, sessionFanDrivers[0], liveVerifiedHourly).
export default function SessionsPulse({ pick, tz, topFan = null, hourly = null, onOpen, onImport = null }) {
  if (!pick) return null
  const { kind, e } = pick
  const platform = pName(e.platforms[0])
  const count = e.type === "private" ? e.chargeCount : e.tipCount
  const countFacts = `${count} ${unit(e, count)} from ${fansText(e.uniqueTippers)}`
  let title, evidence, value, valueLabel, facts = [], action
  if (kind === "live_now") {
    title = `You're live on ${platform}`
    evidence = "Live Mode · linked tips so far, updates as they arrive"
    valueLabel = "Earned so far"; value = fmtUsd(e.totalUSD)
    facts = [`${fmtDuration((e.durationMinutes || 0) * 60)} so far`, countFacts]
    action = { label: "View show", onClick: () => onOpen(e.id) }
  } else if (kind === "new_show") {
    title = "Your show just ended"
    evidence = topFan ? `${topFan.username} was your top contributor · recorded by Live Mode` : "Recorded by Live Mode"
    if (hourly != null) { valueLabel = "Verified $/hr"; value = `${fmtUsd(hourly)}/hr`; facts = [`${fmtUsd(e.totalUSD)} earned`, `${fmtDuration((e.durationMinutes || 0) * 60)} streamed`] }
    else { valueLabel = "Earned"; value = fmtUsd(e.totalUSD); facts = [`${fmtDuration((e.durationMinutes || 0) * 60)} streamed`, countFacts] }
    action = { label: "Review show", onClick: () => onOpen(e.id) }
  } else if (kind === "comparison") {
    const { vs } = pick
    title = vs.outcome === "above" ? "Your latest session beat your usual" : vs.outcome === "below" ? "Your latest session came in under your usual" : "Your latest session matched your usual"
    evidence = `${fmtUsd(e.totalUSD)} vs your median ${fmtUsd(vs.medianUSD)} across ${vs.sessions} ${platform} ${typeWord(e)}s · same platform and type`
    valueLabel = "vs typical"; value = vs.outcome === "par" ? "On par" : `${vs.deltaPct > 0 ? "+" : ""}${vs.deltaPct}%`
    facts = [`${fmtUsd(e.totalUSD)} earned`, countFacts]
    action = { label: "View session", onClick: () => onOpen(e.id) }
  } else {
    title = pick.first ? "Your first recorded session" : "Your latest session"
    const span = e.type === "live" ? `${fmtDuration((e.durationMinutes || 0) * 60)} streamed`
      : e.type === "private" ? null
      : e.durationUnknown ? null : `~${Math.round(e.durationMinutes || 0)}-minute activity span`
    evidence = e.type === "live" ? "Recorded by Live Mode"
      : e.type === "private" ? "From imported private charges · billed per charge"
      : "Reconstructed from imported transactions · not a measured stream length"
    // Lead with what was earned and recorded (no session count as an "insight").
    valueLabel = "Earned"; value = fmtUsd(e.totalUSD)
    facts = [countFacts, span].filter(Boolean)
    // Live Mode creators review the show; a first imported session invites more history.
    action = e.type !== "live" && pick.first && onImport ? { label: "Import more history", onClick: onImport, secondary: true }
      : { label: e.type === "live" ? "Review show" : "View session", onClick: () => onOpen(e.id) }
  }
  const live = kind === "live_now"
  return (
    <section data-testid="session-pulse" data-kind={kind} className={cx(L.glassFeature, L.pulse)} aria-label="Session Pulse">
      <div className={L.pulseLead}>
        <div className={L.pulseTop}>
          <PulseIcon />
          <span className={L.eyebrow}>Session Pulse</span>
          <span data-testid="pulse-source" className={cx(L.pulseBadge, live && L.pulseBadgeLive)}>{live && <span className={L.pulseLiveDot} aria-hidden="true" />}{sourceBadge(kind, e)}</span>
        </div>
        <h2 className={L.pulseTitle}>{title}</h2>
        <p className={L.pulseEvidence}>{evidence}</p>
        <div className={L.pulseAction}>
          <button data-testid="pulse-action" onClick={action.onClick} className={action.secondary ? L.secondaryAction : L.primaryAction}>{action.label} <span aria-hidden="true">→</span></button>
        </div>
      </div>
      <div data-testid="pulse-signal-area" className={cx(L.glassInset, L.pulseSignal)}>
        <div data-testid="pulse-context" className={L.pulseContext}>{platform} · {typeLabel(e)} · {day(e.startTime, tz)}</div>
        <div className={L.pulseValueRow}>
          <div data-testid="pulse-signal" className={cx(L.signalValue, L.money, kind === "comparison" && (pick.vs.outcome === "above" ? L.signalUp : pick.vs.outcome === "below" ? L.signalDown : null))}>{value}</div>
          <div className={L.microLabel}>{valueLabel}</div>
        </div>
        {facts.length > 0 && (
          <ul className={L.pulseFacts}>
            {facts.slice(0, 2).map((f) => <li key={f}>{f}</li>)}
          </ul>
        )}
      </div>
    </section>
  )
}
