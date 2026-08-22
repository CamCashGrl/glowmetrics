'use client'
// ============================================================
// CAMCASH — HISTORY TIMELINE
//
// The primary conversion moment for a creator who uploaded more history than
// Free analyzes. It replaces four blurred cards with one honest picture:
//
//     Jun 2024 ───────────────────────────────── Jan 2026
//     ████████████████████████████████████  ▓▓▓▓
//     └─────────── ALREADY SAVED ────────┘  └ FREE ┘
//                                            31 days
//
// Two things have to land in one glance, and the second is the one the old
// UI kept failing:
//
//   1. how much history exists, and
//   2. that NONE of it was thrown away.
//
// The saved segment is therefore drawn SOLID and full-colour — it is real,
// stored data, not a locked void — and the Free window is drawn as a bright
// bracket sitting at the end of it. The lock is on the ANALYSIS, not on the
// data, and the drawing has to say that, because "we only analyze 31 days" is
// otherwise indistinguishable from "we deleted the rest".
//
// Geometry only. Every date and total is measured upstream by the canonical
// engine and passed in; this component computes proportions and nothing else.
// ============================================================

import { UnlockButton } from './LockedModule'

const MS_DAY = 86400000
const fmtUsd = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtInt = (n) => Number(n || 0).toLocaleString()

export default function HistoryTimeline({
  C, dateFrom, dateTo, freeHistoryDays, lockedUsd, lockedTips,
  stats, priceLabel, formatDate, onUpgrade, surface = 'csv_locked_history',
}) {
  const a = new Date(dateFrom), b = new Date(dateTo)
  if (isNaN(a) || isNaN(b)) return null
  const totalDays = Math.max(1, Math.round((b - a) / MS_DAY))
  // The Free window can legitimately be the whole file (a short upload). Then
  // there is nothing locked and this component should not be on screen at all
  // — the caller gates on lockedTips, but clamp anyway so the bar can never
  // render a negative saved segment.
  const freeDays = Math.min(freeHistoryDays, totalDays)
  const freePct = Math.max(6, Math.min(100, (freeDays / totalDays) * 100))
  const savedPct = 100 - freePct

  // Year ticks across the span, so the bar reads as a real timeline rather
  // than a decorative progress meter.
  const years = []
  for (let y = a.getUTCFullYear(); y <= b.getUTCFullYear(); y++) {
    const start = Date.UTC(y, 0, 1)
    const pos = ((Math.max(start, a.getTime()) - a.getTime()) / (b - a)) * 100
    if (pos >= 0 && pos <= 98) years.push({ y, pos })
  }

  return (
    <section
      className="cc-timeline"
      data-cc-surface={surface}
      aria-label="Your imported history and the Free analysis window"
    >
      <header className="cc-timeline-head">
        <div>
          <div className="cc-timeline-label" style={{ color: C.green }}>Your saved history</div>
          <h3 className="cc-timeline-title" style={{ color: C.white }}>
            You have more earning history than Free can analyze
          </h3>
          <div className="cc-timeline-range" style={{ color: C.muted }}>
            {formatDate(dateFrom)} — {formatDate(dateTo)}
          </div>
        </div>
        <div className="cc-timeline-span" style={{ color: C.muted }}>
          {fmtInt(totalDays)} days imported
        </div>
      </header>

      {/* THE BAR. Saved is solid; the Free window is the bright cap at the
          right-hand (most recent) end. Colour alone never carries the
          meaning — both segments are labelled underneath. */}
      <div className="cc-timeline-track" role="img"
        aria-label={`${fmtInt(totalDays)} days imported and saved; Free analyzes the most recent ${freeDays} days per platform`}>
        <div className="cc-timeline-saved" style={{ width: `${savedPct}%` }} />
        <div className="cc-timeline-free" style={{ width: `${freePct}%` }} />
        {years.map(({ y, pos }) => (
          <div key={y} className="cc-timeline-tick" style={{ left: `${pos}%` }}>
            <span style={{ color: C.muted }}>{y}</span>
          </div>
        ))}
      </div>

      <div className="cc-timeline-legend">
        <div className="cc-timeline-leg">
          <span className="cc-timeline-swatch cc-timeline-swatch--saved" aria-hidden="true" />
          <span style={{ color: C.text }}>
            <strong style={{ color: C.white }}>Already saved</strong> — your full imported history,
            analyzed with Pro
          </span>
        </div>
        <div className="cc-timeline-leg">
          <span className="cc-timeline-swatch cc-timeline-swatch--free" aria-hidden="true" />
          <span style={{ color: C.text }}>
            <strong style={{ color: C.cyan }}>Free analytics window</strong> — most recent{' '}
            {freeHistoryDays} days, per platform
          </span>
        </div>
      </div>

      {/* The value, stated once, at the weight it deserves. */}
      {/* Large -> medium -> small. The creator's own figure is the argument,
          so nothing on this card is allowed to compete with it. */}
      {lockedUsd > 0 && (
        <div className="cc-timeline-value">
          <div className="cc-timeline-amount" style={{ color: C.green }}>{fmtUsd(lockedUsd)}</div>
          <div className="cc-timeline-amount-label" style={{ color: C.white }}>
            already saved in your imported history
          </div>
        </div>
      )}

      {stats?.length > 0 && (
        <div className="cc-timeline-stats">
          {stats.map(st => (
            <div key={st.l} className="cc-timeline-stat">
              <div className="cc-timeline-stat-v" style={{ color: C.white }}>{st.v}</div>
              <div className="cc-timeline-stat-l" style={{ color: C.muted }}>{st.l}</div>
            </div>
          ))}
        </div>
      )}

      <p className="cc-timeline-explain" style={{ color: C.text }}>
        Your older imported history is already saved. Pro analyzes it instantly — no re-upload required.
      </p>

      {/* ONE dominant CTA for the page. Labelled "Unlock Pro" rather than with
          the dollar figure: the number is already the headline two lines up,
          and repeating it in the button made the page read as if the amount
          were a product being sold rather than their own data. */}
      <div className="cc-timeline-cta">
        <UnlockButton surface={surface} size="lg" onClick={() => onUpgrade?.(surface)}>
          Unlock Pro
        </UnlockButton>
        <div className="cc-timeline-price" style={{ color: C.muted }}>{priceLabel}</div>
      </div>

      <p className="cc-timeline-reassure" style={{ color: C.muted }}>
        Your existing uploads stay saved. Upgrading unlocks the analysis — no re-upload needed.
      </p>
    </section>
  )
}
