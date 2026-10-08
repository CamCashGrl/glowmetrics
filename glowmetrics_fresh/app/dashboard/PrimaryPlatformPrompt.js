"use client"

// One-time, dismissible "Choose your primary platform" prompt for Free users
// with no primary on file, plus a compact control to choose it later if the
// prompt was dismissed (there is no settings page). The choice is permanent:
// once set, the control only displays it (the API also refuses changes). Saves through /api/profile/primary-platform, which writes
// only the platform fields. Until a choice is made every platform stays on the
// 31-day window — nothing is promoted silently.

import React, { useEffect, useState } from "react"
import { platformColor } from "../../lib/constants"
import { card } from "./CommandCenter"
import { Pill } from "./StreamPlanner"

const OPTIONS = [["chaturbate", "Chaturbate"], ["bongacams", "BongaCams"], ["myfreecams", "MyFreeCams"]]
const DISMISS_KEY = "cc_primary_platform_prompt_dismissed"
const EXPLAIN = "Your primary platform keeps full available history. Other platforms use a rolling 31-day window on Free."

async function savePrimary(platform) {
  const res = await fetch("/api/profile/primary-platform", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || "Could not save")
  return data
}

function Picker({ current, onSaved, testId }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const choose = async (p) => {
    setBusy(p); setError(null)
    try { onSaved(await savePrimary(p)) } catch (e) { setError(e.message) } finally { setBusy(null) }
  }
  return (
    <div data-testid={testId} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {OPTIONS.map(([id, label]) => (
        <span key={id} data-testid={`${testId}-${id}`}>
          <Pill active={String(current || "").toLowerCase() === id} onClick={() => choose(id)}>
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4, background: platformColor(id), marginRight: 6 }} />
            {busy === id ? "Saving…" : label}
          </Pill>
        </span>
      ))}
      {error && <span role="alert" style={{ color: "#F87171", fontSize: 12 }}>{error}</span>}
    </div>
  )
}

export function PrimaryPlatformBanner({ isPro, primary, onSaved }) {
  const [dismissed, setDismissed] = useState(true)
  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1") } catch (_) { setDismissed(false) }
  }, [])
  if (isPro || primary || dismissed) return null
  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, "1") } catch (_) {} setDismissed(true) }
  return (
    <div data-testid="primary-platform-banner" style={card({ padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", border: "1px solid rgba(34,211,238,0.35)" })}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, color: "#F1F5F9", fontSize: 15 }}>Choose your primary platform</div>
        <div style={{ color: "#94A3B8", fontSize: 12.5, marginTop: 2 }}>{EXPLAIN} <strong style={{ color: "#F59E0B" }}>This choice is permanent.</strong></div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Picker current={primary} onSaved={onSaved} testId="primary-platform-choice" />
        <button data-testid="primary-platform-dismiss" onClick={dismiss} style={{ background: "transparent", border: "none", color: "#64748B", fontSize: 12, cursor: "pointer" }}>Not now</button>
      </div>
    </div>
  )
}

// Free only. Not set → lets the creator choose (once). Set → read-only label.
export function PrimaryPlatformControl({ isPro, primary, onSaved }) {
  const [open, setOpen] = useState(false)
  if (isPro) return null
  const label = OPTIONS.find(([id]) => id === String(primary || "").toLowerCase())?.[1]
  if (label) {
    return (
      <span data-testid="primary-platform-control" title={EXPLAIN} style={{ fontSize: 12, color: "#94A3B8", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "5px 10px" }}>
        Primary: <span style={{ color: "#F1F5F9", fontWeight: 700 }}>{label}</span>
      </span>
    )
  }
  return (
    <span data-testid="primary-platform-control" style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button onClick={() => setOpen((v) => !v)} title={EXPLAIN} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#94A3B8", fontSize: 12, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
        Primary: <span style={{ color: label ? "#F1F5F9" : "#F59E0B", fontWeight: 700 }}>{label || "not set"}</span>
      </button>
      {open && (
        <>
          <span style={{ fontSize: 11.5, color: "#F59E0B" }}>This choice is permanent.</span>
          <Picker current={primary} onSaved={(d) => { onSaved(d); setOpen(false) }} testId="primary-platform-change" />
        </>
      )}
    </span>
  )
}
