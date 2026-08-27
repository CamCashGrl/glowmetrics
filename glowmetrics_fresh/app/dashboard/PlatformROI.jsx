'use client'
// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM ROI + PLATFORM BY DAY OF WEEK
//
// Restores the "What's Working" treatment the dashboard carried through
// mid-August: a colour-coded card per platform with the TOP ROI badge and its
// best-day / today chips, above the day-of-week heatmap. Both were lost when
// the block moved into Performance.js and came back as plain rows.
//
// The DESIGN is restored; the ARITHMETIC is not. The original computed its
// hours from `new Date().getTimezoneOffset()`, which is the browser's offset
// today, not the creator's timezone on the day she streamed — the exact defect
// the canonical timezone work removed. Every figure here is read instead from
// fields aggregateRows() already produces:
//
//   $/hr        p.medianUsdPerHour  (falls back to usdPerHour when unranked)
//   totals      p.totalUSD, p.hours
//   best day    platformBestTimes[p].bestDay      { day, avg, activeDays }
//   heatmap     platformBestTimes[p].allDays      the same day entries
//
// Nothing is computed here beyond picking a colour and scaling a cell's
// opacity against the row's own maximum.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { C, panel } from './theme'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// The platform colours the dashboard has always used for these cards.
const PLATFORM_COLOR = { Chaturbate: C.cyan, BongaCams: C.pink, MyFreeCams: C.gold }
const shortName = (p) => String(p || '')
  .replace('BongaCams', 'Bonga')
  .replace('MyFreeCams', 'MFC')

const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`
const fmtUsd2 = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtHour = (h) => {
  if (h == null || Number.isNaN(h)) return null
  const H = ((h % 24) + 24) % 24
  return H === 0 ? '12 AM' : H < 12 ? `${H} AM` : H === 12 ? '12 PM' : `${H - 12} PM`
}

export default function PlatformROI({ analytics }) {
  const [openCell, setOpenCell] = useState(null)

  const all = (analytics?.platforms || [])
    .filter(p => p.platform && p.platform.toLowerCase() !== 'unknown')
  if (!all.length) return null

  const bestTimes = analytics?.platformBestTimes || {}
  // Ordered by earnings, as the original was — the TOP ROI badge marks the
  // leader on rate, which is a separate question, so it is read from the
  // canonical bestPlatformByRate rather than assumed to be first.
  const ordered = [...all].sort((a, b) => (b.totalUSD || 0) - (a.totalUSD || 0))
  const topByRate = analytics?.bestPlatformByRate?.platform || null
  const todayShort = DAYS[new Date().getDay()]

  return (
    <div style={{ ...panel, padding: 22 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 3 }}>What&apos;s Working</div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>Platform, time &amp; session strategy from your data.</div>

      {/* ── PLATFORM ROI CARDS ─────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
        Platform ROI ($/hr streamed)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 22 }}>
        {ordered.map(p => {
          const col = PLATFORM_COLOR[p.platform] || C.blue
          const isTop = p.platform === topByRate
          const rate = p.medianUsdPerHour || p.usdPerHour || 0
          const best = bestTimes[p.platform]?.bestDay || null
          const todayHour = bestTimes[p.platform]?.bestHourByDay?.[FULL_DAYS[new Date().getDay()]] || null
          return (
            <div key={p.platform} style={{
              position: 'relative', padding: '14px 16px', borderRadius: 12,
              background: isTop ? `${col}18` : `${col}0d`,
              border: `1px solid ${isTop ? col + '55' : col + '2a'}`,
            }}>
              {isTop && (
                <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, padding: '2px 6px', borderRadius: 10, background: `${col}30`, color: col, fontWeight: 800, letterSpacing: '0.04em' }}>
                  TOP ROI
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: 800, color: col, marginBottom: 6 }}>{shortName(p.platform)}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.white, marginBottom: 2, fontVariantNumeric: 'tabular-nums' }}>
                {rate > 0 ? `${fmtUsd2(rate)}/hr` : '—'}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {fmtUsd0(p.totalUSD)} total · {Number(p.hours || 0).toFixed(0)}h streamed
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {best && (
                  <div style={{ padding: '5px 8px', borderRadius: 8, background: `${col}14`, border: `1px solid ${col}2e`, fontSize: 11, color: col }}>
                    Best day: <strong>{best.day}s</strong> {fmtUsd0(best.avg)} avg
                  </div>
                )}
                {todayHour && (
                  <div style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.28)', fontSize: 11, color: C.green }}>
                    Today: <strong>{fmtHour(todayHour.hour)}</strong> {fmtUsd0(todayHour.avg)} avg
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── PLATFORM BY DAY OF WEEK ────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>Platform by Day of Week</span>
        <span style={{ fontSize: 11, color: C.muted, padding: '2px 8px', borderRadius: 20, background: C.card2, border: `1px solid ${C.border}` }}>
          avg $/active day (median)
        </span>
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7,1fr)', gap: 3, minWidth: 480 }}>
          <div />
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: d === todayShort ? C.cyan : C.muted, paddingBottom: 4 }}>{d}</div>
          ))}

          {ordered.map(p => {
            // allDays already excludes any day with fewer than 3 active days,
            // so a blank cell means "not enough data", never "earned zero".
            const byDay = {}
            for (const e of bestTimes[p.platform]?.allDays || []) byDay[e.day.slice(0, 3)] = e
            const max = Math.max(...DAYS.map(d => byDay[d]?.avg || 0), 0.01)
            return [
              <div key={`${p.platform}-label`} style={{ fontSize: 10, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', paddingRight: 4, lineHeight: 1.3 }}>
                {shortName(p.platform)}
              </div>,
              ...DAYS.map(d => {
                const e = byDay[d]
                const val = e?.avg || 0
                const intensity = e ? val / max : 0
                const isToday = d === todayShort
                const isOpen = openCell?.plat === p.platform && openCell?.day === d
                const bg = !e ? C.card2
                  : intensity < 0.25 ? 'rgba(34,211,238,0.14)'
                  : intensity < 0.5  ? 'rgba(34,211,238,0.34)'
                  : intensity < 0.75 ? 'rgba(34,211,238,0.62)'
                  : 'rgba(34,211,238,0.92)'
                return (
                  <div key={`${p.platform}-${d}`}
                    title={e ? `${p.platform} ${d}: ${fmtUsd2(val)} median per active day, over ${e.activeDays} active days` : `${p.platform} ${d}: not enough data yet`}
                    onClick={() => { if (e) setOpenCell(isOpen ? null : { plat: p.platform, day: d }) }}
                    style={{
                      height: 32, borderRadius: 5, background: bg,
                      border: isOpen ? '2px solid #fff' : isToday ? '2px solid rgba(34,211,238,0.7)' : `1px solid ${C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: e ? 'pointer' : 'default', transition: 'transform 0.15s',
                    }}>
                    {e && <span style={{ fontSize: 9, fontWeight: 800, color: intensity > 0.45 ? '#04101b' : C.text }}>{fmtUsd0(val)}</span>}
                  </div>
                )
              }),
            ]
          })}
        </div>
      </div>

      {/* Cell detail — canonical figures only, no day-specific recomputation. */}
      {openCell && (() => {
        const e = (bestTimes[openCell.plat]?.allDays || []).find(x => x.day.slice(0, 3) === openCell.day)
        if (!e) return null
        const col = PLATFORM_COLOR[openCell.plat] || C.blue
        const bestHour = bestTimes[openCell.plat]?.bestHourByDay?.[e.day] || null
        return (
          <div style={{ marginTop: 10, padding: '14px 16px', borderRadius: 12, background: `${col}12`, border: `1px solid ${col}38` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.white }}>{shortName(openCell.plat)} — {e.day}s</span>
              <button onClick={() => setOpenCell(null)} aria-label="Close" style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
              <Cell label="Avg / active day" value={fmtUsd2(e.avg)} />
              <Cell label="Active days" value={String(e.activeDays)} />
              <Cell label="Total earned" value={fmtUsd0(e.total)} />
              {bestHour && <Cell label="Strongest hour" value={fmtHour(bestHour.hour)} sub={`${fmtUsd0(bestHour.avg)} avg`} />}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function Cell({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
