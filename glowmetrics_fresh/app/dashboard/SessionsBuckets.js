"use client"
// Sessions — secondary "Earning activity" chart and the selected bucket's
// detail. Presentation only: every number comes from sessionBuckets() in
// lib/sessions/normalize.js (passed in as `d`); nothing here recomputes
// earnings, shares or counts. Times use the creator timezone (`tz`) prop.
// Styling: SessionsLuxury.module.css.

import React, { useRef } from "react"
import { platformDisplayName, platformColor } from "../../lib/constants"
import { fanKey } from "../../lib/sessions/normalize"
import { fmtUsd } from "./LatestShows"
import s from "./SessionsLuxury.module.css"

const cx = (...a) => a.filter(Boolean).join(" ")
const pName = (p) => platformDisplayName(p) || p
const clock = (iso, tz) => new Date(iso).toLocaleTimeString([], { timeZone: tz, hour: "numeric", minute: "2-digit" })
export const bucketRange = (d, b) => {
  const st = Date.parse(b.start) - Date.parse(d.start)
  const en = Date.parse(b.end) - Date.parse(d.start)
  if (d.single && en < 60000) return "under 1m"
  // minutes from the start, e.g. "0–20m", "75–90m"
  return `${Math.round(st / 60000)}–${Math.round(en / 60000)}m`
}
const unit = (type, n) => type === "private" ? (n === 1 ? "charge" : "charges") : (n === 1 ? "tip" : "tips")

// Initials tile tinted with the platform's existing colour (CB / BC / MFC …).
const INITIALS = { chaturbate: "CB", bongacams: "BC", myfreecams: "MFC", stripchat: "SC", camsoda: "CS" }
export function PlatformTile({ platform, size = 37 }) {
  const color = platformColor(platform)
  const key = String(platform || "").toLowerCase()
  const label = INITIALS[key] || (pName(platform) || "?").slice(0, 2).toUpperCase()
  return (
    <span aria-hidden="true" className={s.platformIcon}
      style={{ width: size, height: size, background: `${color}26`, borderColor: `${color}55`, fontSize: label.length > 2 ? 10 : 11 }}>
      {label}
    </span>
  )
}

// ── Chart ────────────────────────────────────────────────────────────────────
// mode: "usd" (bucket total, public + private stacked) | "count" (tips/charges)
export function BucketChart({ d, tz, type, selected, onSelect, mode, onMode, highlightKey = null, testId = "bucket-chart" }) {
  const refs = useRef([])
  const values = d.buckets.map((b) => (mode === "count" ? b.count : b.totalUSD))
  const max = Math.max(...values, 0) || 1
  const has = (b) => !highlightKey || (b.fans || []).some((f) => fanKey(f.platform, f.username) === highlightKey)
  const move = (i) => {
    const n = Math.max(0, Math.min(d.buckets.length - 1, i))
    onSelect(n)
    refs.current[n]?.focus()
  }
  const imported = !d.exact
  return (
    <div data-testid={testId}>
      <div className={s.chartHeader}>
        <div>
          <h3 className={s.sectionTitle}>Earning activity</h3>
          <p className={s.sectionHint}>
            {d.single ? "Too short to split into intervals" : `${d.bucketMinutes}-minute intervals · ${clock(d.start, tz)}–${clock(d.end, tz)}`}
            {imported ? " · recorded transactions, not time online" : ""}
          </p>
        </div>
        <div role="group" aria-label="Chart measure" data-testid="bucket-mode" className={s.segmented}>
          {[["usd", "Earnings"], ["count", type === "private" ? "Charges" : "Tips"]].map(([k, l]) => (
            <button key={k} data-testid={`bucket-mode-${k}`} aria-pressed={mode === k} onClick={() => onMode(k)} className={cx(s.segment, mode === k && s.segmentActive)}>{l}</button>
          ))}
        </div>
      </div>
      <div className={s.barScroll}>
        <div className={s.chartArea} style={{ minWidth: d.buckets.length * 34 }}>
          <div role="group" aria-label="Earning activity by interval. Use left and right arrow keys to move between intervals." className={s.barRow}>
            {d.buckets.map((b, i) => {
              const v = values[i]
              const sel = i === selected
              const lit = has(b)
              const pct = v > 0 ? Math.max(3, (v / max) * 100) : 0
              const privShare = mode === "usd" && b.totalUSD > 0 ? b.privateUSD / b.totalUSD : 0
              const shown = mode === "count" ? String(b.count) : fmtUsd(b.totalUSD)
              return (
                <button
                  key={b.start} ref={(el) => { refs.current[i] = el }} data-testid="bucket-bar" data-selected={sel ? "true" : "false"}
                  data-highlighted={highlightKey && lit ? "true" : "false"} data-zero={b.totalUSD === 0 ? "true" : "false"} data-value={v}
                  aria-pressed={sel} tabIndex={sel ? 0 : -1}
                  aria-label={`Interval ${i + 1}, ${clock(b.start, tz)} to ${clock(b.end, tz)}, ${fmtUsd(b.totalUSD)}, ${b.count} ${unit(type, b.count)}`}
                  title={b.totalUSD === 0 ? (b.zeroBasis === "show_span" ? "No earnings recorded during this part of the show" : "No recorded transactions in this interval") : `${clock(b.start, tz)}–${clock(b.end, tz)} · ${fmtUsd(b.totalUSD)}`}
                  onClick={() => onSelect(i)}
                  onKeyDown={(ev) => {
                    if (ev.key === "ArrowRight") { ev.preventDefault(); move(i + 1) }
                    else if (ev.key === "ArrowLeft") { ev.preventDefault(); move(i - 1) }
                    else if (ev.key === "Home") { ev.preventDefault(); move(0) }
                    else if (ev.key === "End") { ev.preventDefault(); move(d.buckets.length - 1) }
                  }}
                  className={cx(s.barButton, sel && s.barSelected, highlightKey && !lit && s.barDim, highlightKey && lit && s.barHighlight, b.totalUSD === 0 && s.barZero)}
                  style={{ opacity: highlightKey && !lit ? 0.35 : 1 }}
                >
                  {sel && v > 0 && <span aria-hidden="true" className={s.barValue} style={{ bottom: `calc(${pct}% + 4px)`, top: "auto" }}>{shown}</span>}
                  <span className={s.barFill} style={{ height: v > 0 ? `${pct}%` : "3px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {privShare > 0 && <span className={s.barFillPrivate} style={{ flex: privShare, opacity: b.privateEstimated ? 0.8 : 1 }} />}
                    <span style={{ flex: 1 - privShare }} />
                  </span>
                  <span className={s.barLabel}>B{i + 1}<span className={s.srOnly}>{bucketRange(d, b)}</span><span className={s.srOnly}>{shown}</span></span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className={s.chartFoot}>
        <span className={s.legend}><span className={s.legendDot} />Public</span>
        {d.buckets.some((b) => b.privateUSD > 0) && <span className={s.legend}><span className={cx(s.legendDot, s.legendDotPrivate)} />Private{d.buckets.some((b) => b.privateEstimated && b.privateUSD > 0) ? " (~ estimated from the private rate)" : ""}</span>}
        <span>Intervals are minutes from {d.exact ? "the show start" : "the first recorded transaction"}.</span>
      </div>
    </div>
  )
}

// ── Selected interval: who contributed ───────────────────────────────────────
export function BucketPanel({ d, index, onIndex, tz, type, highlightKey, onHighlight }) {
  const b = d.buckets[index]
  if (!b) return null
  const n = d.buckets.length
  const fans = b.fans || []
  return (
    <div data-testid="bucket-panel">
      <div className={s.bucketTop}>
        <div style={{ minWidth: 0 }}>
          <div data-testid="bucket-panel-title" className={s.bucketTitle}>Interval {index + 1} · {bucketRange(d, b)}</div>
          <div className={s.contributorMeta}>{clock(b.start, tz)}–{clock(b.end, tz)}</div>
        </div>
        <div className={s.bucketNav}>
          <button aria-label="Previous interval" disabled={index === 0} onClick={() => onIndex(index - 1)} className={s.iconButton}>‹</button>
          <button aria-label="Next interval" disabled={index >= n - 1} onClick={() => onIndex(index + 1)} className={s.iconButton}>›</button>
        </div>
      </div>
      <div className={s.bucketAmount}><span data-testid="bucket-panel-total">{b.privateEstimated && b.privateUSD > 0 ? "~" : ""}{fmtUsd(b.totalUSD)}</span> <span className={s.muted} style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0 }}>· {b.count} {unit(type, b.count)}</span></div>
      <div className={s.contributorMeta}>This interval only — not the whole session.</div>
      {b.totalUSD === 0 ? (
        <p data-testid="bucket-panel-empty" className={s.quietNote} style={{ marginTop: 12 }}>
          {b.zeroBasis === "show_span" ? "No earnings recorded in this part of the show." : "No recorded transactions in this interval (the import does not show whether you were online)."}
        </p>
      ) : (
        <div className={s.contributorList}>
          {fans.map((f) => {
            const k = fanKey(f.platform, f.username)
            const on = highlightKey === k
            return (
              <button key={k} data-testid="bucket-contributor" aria-pressed={on} onClick={() => onHighlight(on ? null : k)}
                title="Highlight every interval this fan contributed to"
                className={cx(s.contributorRow, s.contributorButton, on && s.contributorActive)}>
                <span style={{ minWidth: 0 }}>
                  <span className={s.contributorName} style={{ display: "block" }}>{f.username}</span>
                  <span className={s.contributorMeta} style={{ display: "block" }}>{f.count} {unit(type === "private" || (f.privateUSD > 0 && f.publicUSD === 0) ? "private" : "tips", f.count)} · {pName(f.platform)}</span>
                </span>
                <span className={s.contributorAmount}>{fmtUsd(f.usd)}</span>
              </button>
            )
          })}
          {b.unattributedPrivateUSD > 0.005 && (
            <div data-testid="bucket-private-unattributed" className={cx(s.contributorRow, s.unattributed)}>
              <span className={s.contributorName} style={{ fontWeight: 600 }}>Private (no tipper detail){b.privateEstimated ? " · estimated" : ""}</span>
              <span className={s.contributorAmount}>{b.privateEstimated ? "~" : ""}{fmtUsd(b.unattributedPrivateUSD)}</span>
            </div>
          )}
          {b.unattributedPublicUSD > 0.005 && (
            <div data-testid="bucket-public-unattributed" className={cx(s.contributorRow, s.unattributed)}>
              <span className={s.contributorName} style={{ fontWeight: 600 }}>Tips without a username</span>
              <span className={s.contributorAmount}>{fmtUsd(b.unattributedPublicUSD)}</span>
            </div>
          )}
          {highlightKey && <button onClick={() => onHighlight(null)} className={s.linkButton} style={{ justifySelf: "start" }}>Clear highlight</button>}
        </div>
      )}
    </div>
  )
}
