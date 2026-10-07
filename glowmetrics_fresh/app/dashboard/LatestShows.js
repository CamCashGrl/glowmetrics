"use client"

// Completed live shows, newest first, straight from /api/live/sessions/recent
// (finalized, persisted data). A show the account hasn't acknowledged yet is
// marked NEW; acknowledging is stored server-side so it clears on every device.

import React from "react"
import { platformColor, platformDisplayName } from "../../lib/constants"

const C = {
  card: "#121826", card2: "#161e2e", border: "#1e2d45", indigo: "#7C5CFF", cyan: "#22D3EE",
  green: "#10B981", gold: "#F59E0B", pink: "#EC4899", white: "#F1F5F9", text: "#94A3B8", muted: "#475569",
}

export const fmtUsd = (v) => `$${(Number(v) || 0).toFixed(2)}`

export function fmtDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m`
  return `${s}s`
}

function Stat({ label, value, testId }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
      <div data-testid={testId} style={{ fontSize: 14, color: C.white, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

export function ShowCard({ show }) {
  const ended = show.endedAt ? new Date(show.endedAt) : null
  return (
    <div
      data-testid={`show-${show.id}`}
      style={{
        background: C.card, border: `1px solid ${show.isNew ? C.green : C.border}`, borderRadius: 12,
        padding: 16, display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {show.isNew && (
            <span data-testid="new-badge" style={{
              background: C.green, color: "#052e1c", fontSize: 10, fontWeight: 800,
              padding: "2px 8px", borderRadius: 999, letterSpacing: 0.6,
            }}>NEW · JUST ENDED</span>
          )}
          <span style={{ color: C.text, fontSize: 12 }}>
            {ended ? `Ended ${ended.toLocaleString()}` : "Ended"}
          </span>
        </div>
        <div data-testid="show-total" style={{ fontSize: 22, fontWeight: 900, color: C.white }}>{fmtUsd(show.totalUsd)}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
        <Stat label="Public tips" value={fmtUsd(show.publicUsd)} testId="show-public" />
        <Stat label="Private" value={fmtUsd(show.privateUsd)} testId="show-private" />
        <Stat label="Tips" value={show.tipCount} testId="show-tips" />
        <Stat label="Unique tippers" value={show.uniqueTippers} testId="show-unique" />
        <Stat label="Top tipper" value={show.topTipper ? `${show.topTipper.username} (${fmtUsd(show.topTipper.usd)})` : "—"} testId="show-top" />
        <Stat label="Largest tip" value={fmtUsd(show.largestTipUsd)} testId="show-largest" />
        <Stat label="Duration" value={fmtDuration(show.durationSeconds)} testId="show-duration" />
        <Stat label="Private time" value={fmtDuration(show.privateSeconds)} testId="show-private-time" />
      </div>

      {show.platformRevenue.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-testid="show-platforms">
          {show.platformRevenue.map((p) => (
            <span key={p.platform} data-testid={`platform-${p.platform}`} style={{
              border: `1px solid ${platformColor(p.platform) || C.border}`, borderRadius: 999,
              padding: "2px 10px", fontSize: 12, color: C.white,
            }}>
              {platformDisplayName(p.platform) || p.platform}: {fmtUsd(p.usd)} · {p.tips} tip{p.tips === 1 ? "" : "s"}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function LatestShowDelta({ delta, onDismiss }) {
  if (!delta) return null
  return (
    <div data-testid="latest-show-delta" style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      background: "rgba(16,185,129,0.12)", border: `1px solid ${C.green}`, borderRadius: 12, padding: "12px 16px",
    }}>
      <div>
        <div data-testid="latest-show-delta-label" style={{ color: C.green, fontWeight: 900, fontSize: 16 }}>{delta.label}</div>
        <div style={{ color: C.text, fontSize: 12 }}>
          {fmtUsd(delta.publicUsd)} public tips · {fmtUsd(delta.privateUsd)} private · {delta.tipCount} tips
        </div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} data-testid="latest-show-ack" style={{
          background: "transparent", border: `1px solid ${C.green}`, color: C.green, borderRadius: 8,
          padding: "6px 12px", fontWeight: 700, cursor: "pointer",
        }}>Got it</button>
      )}
    </div>
  )
}

export default function LatestShows({ shows, loading, error }) {
  return (
    <div data-testid="latest-shows" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Latest live shows</div>
      {error && <div style={{ color: C.text, fontSize: 12 }}>Couldn&apos;t load your latest shows. They&apos;ll appear on the next refresh.</div>}
      {!error && loading && !shows.length && <div style={{ color: C.text, fontSize: 12 }}>Loading…</div>}
      {!error && !loading && !shows.length && <div style={{ color: C.text, fontSize: 12 }}>No finished live shows yet.</div>}
      {shows.map((s) => <ShowCard key={s.id} show={s} />)}
    </div>
  )
}
