"use client"
// Sessions — interactive "Earnings by Bucket" chart and the selected bucket's
// contributor panel. Presentation only: every number comes from
// sessionBuckets() in lib/sessions/normalize.js (passed in as `d`); nothing
// here recomputes earnings, shares or counts. Times use the creator timezone
// (`tz`) passed down as a prop.

import React, { useRef } from "react"
import { platformDisplayName, platformColor } from "../../lib/constants"
import { fanKey } from "../../lib/sessions/normalize"
import { fmtUsd } from "./LatestShows"

// Same tokens as SessionsOverview / the dashboard (no new palette).
export const SX = {
  cyan: "#22D3EE", indigo: "#7C5CFF", pink: "#EC4899", violet: "#a855f7", green: "#10B981",
  white: "#F1F5F9", text: "#94A3B8", muted: "#64748B", line: "rgba(255,255,255,0.08)",
  glass: "rgba(13,17,38,0.72)", inset: "rgba(8,11,22,0.72)",
}

const pName = (p) => platformDisplayName(p) || p
const clock = (iso, tz) => new Date(iso).toLocaleTimeString([], { timeZone: tz, hour: "numeric", minute: "2-digit" })
export const bucketRange = (d, b) => {
  const s = Date.parse(b.start) - Date.parse(d.start)
  const e = Date.parse(b.end) - Date.parse(d.start)
  if (d.single && e < 60000) return "under 1m"
  // minutes from the start, e.g. "0–20m", "75–90m" (always short enough to fit under a bar)
  return `${Math.round(s / 60000)}–${Math.round(e / 60000)}m`
}
const unit = (type, n) => type === "private" ? (n === 1 ? "charge" : "charges") : (n === 1 ? "tip" : "tips")

// Initials tile in the platform's existing colour (CB / BC / MFC …).
const INITIALS = { chaturbate: "CB", bongacams: "BC", myfreecams: "MFC", stripchat: "SC", camsoda: "CS" }
export function PlatformTile({ platform, size = 40 }) {
  const color = platformColor(platform)
  const key = String(platform || "").toLowerCase()
  const label = INITIALS[key] || (pName(platform) || "?").slice(0, 2).toUpperCase()
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0, display: "grid", placeItems: "center",
      background: `linear-gradient(145deg, ${color}38, ${color}14)`, border: `1px solid ${color}66`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 14px ${color}22`,
      color: "#fff", fontWeight: 900, fontSize: label.length > 2 ? size * 0.28 : size * 0.34, letterSpacing: "0.02em",
    }}>{label}</span>
  )
}

const Crown = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7z" fill="#F59E0B" opacity="0.9" />
  </svg>
)

const niceMax = (v) => {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10) * p
}

// ── Chart ────────────────────────────────────────────────────────────────────
// mode: "usd" (bucket total, public + private stacked) | "count" (tips/charges)
export function BucketChart({ d, tz, type, selected, onSelect, mode, onMode, highlightKey = null, testId = "bucket-chart" }) {
  const refs = useRef([])
  const values = d.buckets.map((b) => (mode === "count" ? b.count : b.totalUSD))
  const max = niceMax(Math.max(...values, 0))
  const ticks = [max, (max * 3) / 4, max / 2, max / 4, 0]
  const fmtTick = (v) => (mode === "count" ? String(Math.round(v * 100) / 100) : `$${v >= 100 ? Math.round(v) : Math.round(v * 100) / 100}`)
  const has = (b) => !highlightKey || (b.fans || []).some((f) => fanKey(f.platform, f.username) === highlightKey)
  const H = 168
  const move = (i) => {
    const n = Math.max(0, Math.min(d.buckets.length - 1, i))
    onSelect(n)
    refs.current[n]?.focus()
  }
  return (
    <div data-testid={testId} style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: SX.white, letterSpacing: "-0.01em" }}>
          Earnings by Bucket
          <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: SX.text, marginTop: 2 }}>
            {d.single ? "Too short to split into time buckets" : `${d.bucketMinutes}-minute buckets · ${clock(d.start, tz)}–${clock(d.end, tz)}`}
          </span>
        </span>
        <div role="group" aria-label="Chart measure" data-testid="bucket-mode" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 10, border: `1px solid ${SX.line}`, background: SX.inset }}>
          {[["usd", "Earnings"], ["count", type === "private" ? "Charges" : "Tips"]].map(([k, l]) => (
            <button key={k} data-testid={`bucket-mode-${k}`} aria-pressed={mode === k} onClick={() => onMode(k)} style={{
              padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: mode === k ? 800 : 500, cursor: "pointer",
              border: `1px solid ${mode === k ? `${SX.pink}aa` : "transparent"}`, color: mode === k ? SX.white : SX.text,
              background: mode === k ? "rgba(236,72,153,0.16)" : "transparent",
            }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr)", gap: 6 }}>
        <div aria-hidden="true" style={{ height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 10.5, color: SX.muted, textAlign: "right", paddingRight: 4 }}>
          {ticks.map((t, i) => <span key={i} style={{ lineHeight: 1 }}>{fmtTick(t)}</span>)}
        </div>
        <div className="sx-bucket-scroll" style={{ overflowX: "auto", overflowY: "visible", minWidth: 0 }}>
          <div role="group" aria-label="Earnings by bucket. Use left and right arrow keys to move between buckets." style={{ position: "relative", minWidth: d.buckets.length * 46 }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: `0 0 auto 0`, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
              {ticks.map((_, i) => <span key={i} style={{ borderTop: `1px ${i === ticks.length - 1 ? "solid" : "dashed"} ${SX.line}` }} />)}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "stretch", justifyContent: "center" }}>
              {d.buckets.map((b, i) => {
                const v = values[i]
                const sel = i === selected
                const isPeak = d.peak && d.peak.sharePct != null && b.start === d.peak.start
                const lit = has(b)
                const pct = v > 0 ? Math.max(3, (v / max) * 100) : 0
                const privShare = mode === "usd" && b.totalUSD > 0 ? b.privateUSD / b.totalUSD : 0
                const shown = mode === "count" ? String(b.count) : fmtUsd(b.totalUSD)
                return (
                  <button
                    key={b.start} ref={(el) => { refs.current[i] = el }} data-testid="bucket-bar" data-selected={sel ? "true" : "false"}
                    data-highlighted={highlightKey && lit ? "true" : "false"} data-zero={b.totalUSD === 0 ? "true" : "false"} data-value={v}
                    aria-pressed={sel} tabIndex={sel ? 0 : -1}
                    aria-label={`Bucket ${i + 1}, ${clock(b.start, tz)} to ${clock(b.end, tz)}, ${fmtUsd(b.totalUSD)}, ${b.count} ${unit(type, b.count)}`}
                    onClick={() => onSelect(i)}
                    onKeyDown={(ev) => {
                      if (ev.key === "ArrowRight") { ev.preventDefault(); move(i + 1) }
                      else if (ev.key === "ArrowLeft") { ev.preventDefault(); move(i - 1) }
                      else if (ev.key === "Home") { ev.preventDefault(); move(0) }
                      else if (ev.key === "End") { ev.preventDefault(); move(d.buckets.length - 1) }
                    }}
                    className="sx-bar"
                    style={{ flex: 1, minWidth: 40, maxWidth: 112, background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "stretch", color: SX.text, opacity: highlightKey && !lit ? 0.35 : 1 }}
                  >
                    <span style={{ height: H, display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "relative" }}>
                      {sel && v > 0 && (
                        <span style={{ position: "absolute", bottom: pct > 82 ? `calc(${pct}% - 30px)` : `calc(${pct}% + 6px)`, zIndex: 1, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 11, fontWeight: 800, color: SX.white, padding: "2px 7px", borderRadius: 7, background: "rgba(30,14,40,0.92)", border: `1px solid ${SX.pink}aa`, boxShadow: `0 0 12px ${SX.pink}55` }}>{shown}</span>
                      )}
                      {v > 0 ? (
                        <span style={{
                          height: `${pct}%`, borderRadius: "7px 7px 2px 2px", display: "flex", flexDirection: "column", overflow: "hidden",
                          border: sel ? `1px solid ${SX.pink}` : highlightKey && lit ? `1px solid ${SX.cyan}` : "1px solid rgba(255,255,255,0.06)",
                          boxShadow: sel ? `0 0 22px ${SX.pink}66` : highlightKey && lit ? `0 0 16px ${SX.cyan}66` : isPeak ? `0 -2px 0 ${SX.pink}` : "none",
                        }}>
                          {privShare > 0 && <span style={{ flex: privShare, background: `linear-gradient(180deg, ${SX.pink}, ${SX.violet})`, opacity: b.privateEstimated ? 0.75 : 1 }} />}
                          <span style={{ flex: 1 - privShare, background: highlightKey && lit ? `linear-gradient(180deg, ${SX.cyan}, ${SX.indigo})` : sel ? `linear-gradient(180deg, rgba(167,139,250,0.95), rgba(124,92,255,0.55))` : `linear-gradient(180deg, rgba(124,92,255,0.55), rgba(34,211,238,0.22))` }} />
                        </span>
                      ) : (
                        <span title={b.zeroBasis === "show_span" ? "No earnings recorded in this part of the show" : "No earnings in this part of the activity span"}
                          style={{ height: 4, borderRadius: 2, background: sel ? `${SX.pink}aa` : "rgba(148,163,184,0.28)" }} />
                      )}
                    </span>
                    <span style={{ marginTop: 6, padding: "4px 2px", borderRadius: 8, textAlign: "center", border: `1px solid ${sel ? `${SX.pink}88` : "transparent"}`, background: sel ? "rgba(236,72,153,0.10)" : "transparent", lineHeight: 1.25 }}>
                      <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: sel ? SX.white : SX.text }}>B{i + 1}</span>
                      <span style={{ display: "block", fontSize: 10, color: SX.muted, whiteSpace: "nowrap" }}>{bucketRange(d, b)}</span>
                      <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: sel ? SX.white : SX.text, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{shown}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: SX.text }}>
        <span><span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: SX.indigo, marginRight: 5 }} />Public</span>
        {d.buckets.some((b) => b.privateUSD > 0) && <span><span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: SX.pink, marginRight: 5 }} />Private{d.buckets.some((b) => b.privateEstimated && b.privateUSD > 0) ? " (~ estimated)" : ""}</span>}
        <span style={{ color: SX.muted }}>Bucket ranges are minutes from {d.exact ? "the show start" : "the first earning"}.</span>
      </div>
    </div>
  )
}

// ── Selected bucket: who contributed ─────────────────────────────────────────
export function BucketPanel({ d, index, onIndex, tz, type, highlightKey, onHighlight }) {
  const b = d.buckets[index]
  if (!b) return null
  const n = d.buckets.length
  const fans = b.fans || []
  const navBtn = (dir, label, disabled) => (
    <button aria-label={label} disabled={disabled} onClick={() => onIndex(index + dir)} style={{
      width: 28, height: 28, borderRadius: 14, display: "grid", placeItems: "center", cursor: disabled ? "default" : "pointer",
      border: `1px solid ${SX.line}`, background: "rgba(255,255,255,0.03)", color: disabled ? SX.muted : SX.white, opacity: disabled ? 0.4 : 1, fontSize: 14,
    }}>{dir < 0 ? "‹" : "›"}</button>
  )
  return (
    <div data-testid="bucket-panel" style={{ background: SX.glass, border: `1px solid ${SX.line}`, borderRadius: 16, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {navBtn(-1, "Previous bucket", index === 0)}
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div data-testid="bucket-panel-title" style={{ fontWeight: 800, fontSize: 14, color: SX.white }}>Bucket {index + 1} · {bucketRange(d, b)}</div>
          <div style={{ fontSize: 11, color: SX.text }}>{clock(b.start, tz)}–{clock(b.end, tz)}</div>
        </div>
        {navBtn(1, "Next bucket", index >= n - 1)}
      </div>
      <div style={{ borderTop: `1px solid ${SX.line}` }} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span data-testid="bucket-panel-total" style={{ fontSize: 24, fontWeight: 900, color: SX.white, fontVariantNumeric: "tabular-nums" }}>{b.privateEstimated && b.privateUSD > 0 ? "~" : ""}{fmtUsd(b.totalUSD)}</span>
        <span style={{ fontSize: 12.5, color: SX.text }}>· {b.count} {unit(type, b.count)}</span>
      </div>
      {b.totalUSD === 0 ? (
        <div data-testid="bucket-panel-empty" style={{ fontSize: 12.5, color: SX.text }}>
          {b.zeroBasis === "show_span" ? "No earnings recorded in this part of the show." : "No earnings in this part of the activity span."}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, color: SX.white, letterSpacing: "0.02em" }}>Top Contributors</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {fans.map((f, i) => {
              const k = fanKey(f.platform, f.username)
              const on = highlightKey === k
              return (
                <button key={k} data-testid="bucket-contributor" aria-pressed={on} onClick={() => onHighlight(on ? null : k)}
                  title="Highlight every bucket this fan tipped in"
                  style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr) auto", gap: 8, alignItems: "center", textAlign: "left", cursor: "pointer", padding: "8px 10px", borderRadius: 12, color: SX.white, border: `1px solid ${on ? SX.cyan : SX.line}`, background: on ? "rgba(34,211,238,0.08)" : SX.inset, boxShadow: on ? `0 0 14px ${SX.cyan}33` : "none" }}>
                  <span style={{ display: "grid", placeItems: "center", color: SX.muted, fontSize: 11, fontWeight: 800 }}>{i === 0 ? <Crown /> : i + 1}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.username}</span>
                    <span style={{ display: "block", fontSize: 11, color: SX.text }}>{f.count} {unit(type === "private" || (f.privateUSD > 0 && f.publicUSD === 0) ? "private" : "tips", f.count)} · {pName(f.platform)}</span>
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{fmtUsd(f.usd)}</span>
                </button>
              )
            })}
            {b.unattributedPrivateUSD > 0.005 && (
              <div data-testid="bucket-private-unattributed" style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr) auto", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 12, border: `1px dashed ${SX.line}`, color: SX.text }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: SX.pink, justifySelf: "center" }} />
                <span style={{ fontSize: 12.5 }}>Private (no tipper detail){b.privateEstimated ? " · estimated" : ""}</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: SX.white, fontVariantNumeric: "tabular-nums" }}>{b.privateEstimated ? "~" : ""}{fmtUsd(b.unattributedPrivateUSD)}</span>
              </div>
            )}
            {b.unattributedPublicUSD > 0.005 && (
              <div data-testid="bucket-public-unattributed" style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr) auto", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 12, border: `1px dashed ${SX.line}`, color: SX.text }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: SX.indigo, justifySelf: "center" }} />
                <span style={{ fontSize: 12.5 }}>Tips without a username</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: SX.white, fontVariantNumeric: "tabular-nums" }}>{fmtUsd(b.unattributedPublicUSD)}</span>
              </div>
            )}
          </div>
          {highlightKey && <button onClick={() => onHighlight(null)} style={{ alignSelf: "flex-start", background: "transparent", border: "none", padding: 0, color: SX.cyan, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Clear highlight</button>}
        </>
      )}
    </div>
  )
}
