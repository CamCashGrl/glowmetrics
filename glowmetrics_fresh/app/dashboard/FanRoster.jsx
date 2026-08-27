'use client'
// ═══════════════════════════════════════════════════════════════════════════
// FAN ROSTER — every supporter, searchable, grouped, with a teaser instead of
// a wall.
//
// THE CONVERSION MODEL, restated because it is the point of this file:
// locking the roster down to three fans did not create desire, it created a
// dead end — a creator who cannot see her own supporters has nothing to be
// curious about. So the roster is COMPLETE for everyone. What is sampled is
// the DEPTH:
//
//   sampled fans (SAMPLE_COUNT)  full insight — timing, cadence, churn read
//   every other fan             the basics she can always see: first seen,
//                               platform, tier, tips, lifetime value
//   locked + free               a teaser stating what CamCash NOTICED about
//                               that specific fan, and what is behind it
//
// The teaser is the part that must not become marketing. It is assembled from
// canonical per-fan fields (tier, churnRisk, expectedNextTip — all from
// identifyWhales()) and only ever says something those fields actually
// support. A fan with no such signal gets no teaser at all rather than an
// invented one. It never states a probability, a projected amount, or when
// the fan will next tip.
//
// COMPUTES NOTHING. Ordering and grouping only.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { C } from './theme'
import { EnvelopeHeartIcon } from './icons'

// How many fans carry full insight on the free plan. A sample, deliberately
// generous enough to be useful on its own.
const SAMPLE_COUNT = 3
const PAGE_SIZE = 25

// Canonical tier names from lib/analytics.js (percentile-based: top 5% / top
// 20% / lapsed / everyone else). One map, so the vocabulary is one edit.
const TIER = {
  Whale:   { label: 'Whale',   color: C.gold,  bg: 'rgba(245,158,11,0.12)', bd: 'rgba(245,158,11,0.38)' },
  Shark:   { label: 'Shark',   color: C.blue,  bg: 'rgba(96,165,250,0.12)', bd: 'rgba(96,165,250,0.38)' },
  Dormant: { label: 'Dormant', color: C.orange,bg: 'rgba(251,146,60,0.12)', bd: 'rgba(251,146,60,0.38)' },
  Regular: { label: 'Regular', color: C.text,  bg: 'rgba(148,163,184,0.10)',bd: 'rgba(148,163,184,0.28)' },
}

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDays = (d) => (d == null ? '—' : d === 0 ? 'today' : d === 1 ? '1 day ago' : d < 30 ? `${d} days ago` : d < 365 ? `${Math.round(d / 30)} mo ago` : `${(d / 365).toFixed(1)} yr ago`)
const fmtHour = (h) => { const H = ((h % 24) + 24) % 24; return H === 0 ? '12 AM' : H < 12 ? `${H} AM` : H === 12 ? '12 PM' : `${H - 12} PM` }
const fmtDate = (iso) => { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }

// Magnifying glass — the original "view this fan's profile" glyph.
function MagnifierIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.4 15.4L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The teaser sentence, built ONLY from fields that carry a real signal.
 * Returns null when this fan has nothing observable worth teasing — an
 * invented hook on a quiet fan is exactly the kind of claim this product
 * does not make.
 */
function teaserFor(fan) {
  const parts = []
  const ranked = fan.tier === 'Whale' || fan.tier === 'Shark' || fan.isTopSupporter
  if (ranked) parts.push('one of your top supporters')

  const quiet = fan.tier === 'Dormant' ||
    fan.churnRisk?.level === 'High' || fan.churnRisk?.level === 'Medium'
  if (quiet && fan.tipCount >= 3) parts.push(`has gone quiet — last seen ${fmtDays(fan.daysSinceLastTip)}`)

  const overdue = fan.tipCount >= 3 && fan.expectedNextTip === 'Overdue'
  if (overdue) parts.push('and is past their usual return window')

  if (!parts.length) return null
  const sentence = parts.join(', ').replace(/^./, ch => ch.toUpperCase())
  return `${sentence}. CamCash can see the timing behind this — unlock their pattern and the best moment to reach them.`
}

export default function FanRoster({
  fans = [],
  isPro = false,
  onMessage,
  onUpgrade,
}) {
  const [query, setQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [openFan, setOpenFan] = useState(null)

  const platforms = useMemo(
    () => [...new Set(fans.map(f => f.platform).filter(Boolean))].sort(),
    [fans]
  )

  // The free sample: the highest-value fans, taken from the roster's own
  // ordering so the same faces stay unlocked between visits.
  const sampled = useMemo(
    () => new Set(
      [...fans].sort((a, b) => (b.totalUSD || 0) - (a.totalUSD || 0))
        .slice(0, SAMPLE_COUNT)
        .map(f => `${f.platform}:${f.username}`)
    ),
    [fans]
  )
  const keyOf = (f) => `${f.platform}:${f.username}`
  const unlocked = (f) => isPro || sampled.has(keyOf(f))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return fans.filter(f =>
      (!q || f.username.toLowerCase().includes(q)) &&
      (platformFilter === 'all' || f.platform === platformFilter) &&
      (tierFilter === 'all' || f.tier === tierFilter)
    )
  }, [fans, query, platformFilter, tierFilter])

  if (!fans.length) return null
  const visible = filtered.slice(0, page * PAGE_SIZE)

  return (
    <div>
      {/* The pulse is scoped to an opened locked card, never the whole list —
          a continuously animating glow on every row pegs the compositor. */}
      <style>{`
        @keyframes fan-teaser-pulse {
          0%,100% { box-shadow: 0 0 0 1px rgba(124,92,255,0.30), 0 0 18px rgba(124,92,255,0.14); }
          50%     { box-shadow: 0 0 0 1px rgba(124,92,255,0.60), 0 0 30px rgba(124,92,255,0.30); }
        }
        .fan-teaser-card { animation: fan-teaser-pulse 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .fan-teaser-card { animation: none; } }
      `}</style>

      {/* ── SEARCH + FILTERS ─────────────────────────────────────── */}
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPage(1) }}
        placeholder="Search supporters by name…"
        aria-label="Search supporters by name"
        style={{
          width: '100%', padding: '10px 13px', marginBottom: 10,
          background: 'rgba(5,9,24,0.72)', border: `1px solid ${C.border}`,
          borderRadius: 10, color: C.white, fontSize: 13, outline: 'none',
        }}
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <FilterPill on={platformFilter === 'all'} onClick={() => { setPlatformFilter('all'); setPage(1) }}>All platforms</FilterPill>
        {platforms.map(p => (
          <FilterPill key={p} on={platformFilter === p} onClick={() => { setPlatformFilter(p); setPage(1) }}>{p}</FilterPill>
        ))}
        <span style={{ width: 1, background: C.border, margin: '0 4px' }} />
        <FilterPill on={tierFilter === 'all'} onClick={() => { setTierFilter('all'); setPage(1) }}>All tiers</FilterPill>
        {Object.keys(TIER).map(t => (
          <FilterPill key={t} on={tierFilter === t} color={TIER[t].color} onClick={() => { setTierFilter(t); setPage(1) }}>{TIER[t].label}</FilterPill>
        ))}
      </div>

      {/* ── ROWS ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(f => {
          const k = keyOf(f)
          const t = TIER[f.tier] || TIER.Regular
          const isOpen = openFan === k
          const open = unlocked(f)
          return (
            <div key={k}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px',
                borderRadius: isOpen ? '10px 10px 0 0' : 10,
                background: C.card2, border: `1px solid ${C.border}`, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.white, flex: '1 1 130px', minWidth: 0, overflowWrap: 'anywhere' }}>
                  {f.username}
                </span>

                <span style={{
                  fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '3px 8px', borderRadius: 99, whiteSpace: 'nowrap',
                  color: t.color, background: t.bg, border: `1px solid ${t.bd}`,
                }}>{t.label}</span>

                {f.platform && <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{f.platform}</span>}
                <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: 'nowrap' }}>{f.tipCount} tips</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.green, whiteSpace: 'nowrap' }}>{fmtUsd(f.totalUSD)}</span>

                {/* The two original actions: view the profile, message the fan. */}
                <button
                  onClick={() => setOpenFan(isOpen ? null : k)}
                  aria-label={`View ${f.username}'s profile`}
                  aria-expanded={isOpen}
                  style={iconBtn(C.cyan)}
                ><MagnifierIcon /></button>
                <button
                  onClick={() => onMessage?.(f.username)}
                  className="heart-envelope-btn"
                  aria-label={`Message ${f.username}`}
                  style={iconBtn(C.pink)}
                ><EnvelopeHeartIcon size={15} /></button>
              </div>

              {isOpen && (
                <FanProfile fan={f} unlocked={open} isPro={isPro} onMessage={onMessage} onUpgrade={onUpgrade} />
              )}
            </div>
          )
        })}

        {!filtered.length && (
          <div style={{ fontSize: 12.5, color: C.muted, padding: '12px 2px' }}>
            No supporter matches that search.
          </div>
        )}
      </div>

      {filtered.length > visible.length && (
        <button onClick={() => setPage(n => n + 1)} style={{
          marginTop: 12, width: '100%', padding: 10, borderRadius: 10,
          background: C.card2, border: `1px solid ${C.border}`,
          color: C.text, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        }}>
          Show {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
        </button>
      )}
    </div>
  )
}

// ── THE PROFILE CARD ────────────────────────────────────────────────────
// Basics for everyone. Depth for the sample and for Pro. A teaser — only
// where the fan's own fields support one — for the rest.
function FanProfile({ fan, unlocked, isPro, onMessage, onUpgrade }) {
  const teaser = unlocked ? null : teaserFor(fan)
  return (
    <div
      className={teaser ? 'fan-teaser-card' : undefined}
      style={{
        padding: '15px 16px', borderRadius: '0 0 10px 10px',
        background: C.card, border: `1px solid ${C.border}`, borderTop: 'none',
      }}>

      {/* BASICS — always visible. These are recorded events, not inferences. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: teaser || unlocked ? 14 : 0 }}>
        <Field label="First seen" value={fmtDate(fan.firstTipDate) || '—'} />
        <Field label="Platform" value={fan.platform || '—'} />
        <Field label="Tier" value={(TIER[fan.tier] || TIER.Regular).label} />
        <Field label="Lifetime" value={fmtUsd(fan.totalUSD)} />
        <Field label="Last seen" value={fmtDays(fan.daysSinceLastTip)} />
      </div>

      {unlocked ? (
        // FULL INSIGHT — canonical fields only. Every one of these is an
        // observation about what already happened, never a prediction.
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 13 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.cyan, marginBottom: 10 }}>
            {isPro ? 'Full insight' : 'Full insight — sample'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            {fan.tipCount >= 3 && fan.avgDaysBetweenTips != null && (
              <Field label="Tips roughly every" value={`${Math.round(fan.avgDaysBetweenTips)} days`} accent={C.cyan} />
            )}
            {fan.peakLocalHour != null && (
              <Field label="Most often tips around" value={fmtHour(fan.peakLocalHour)} accent={C.cyan} />
            )}
            {fan.tipCount >= 3 && fan.churnRisk?.risk && (
              <Field label="Churn read" value={fan.churnRisk.risk} accent={C.orange} />
            )}
            {fan.biggestTip != null && <Field label="Biggest single tip" value={fmtUsd(fan.biggestTip)} accent={C.gold} />}
          </div>
          {!isPro && (
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 12, lineHeight: 1.6 }}>
              This depth is shown free for your top {SAMPLE_COUNT} supporters. Pro shows it for every fan.
            </div>
          )}
          <button onClick={() => onMessage?.(fan.username)} style={{
            marginTop: 13, display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 16px', borderRadius: 100, cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
            background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.4)', color: C.pink,
          }}><EnvelopeHeartIcon size={15} />Re-engage {fan.username}</button>
        </div>
      ) : teaser ? (
        <div style={{
          borderTop: `1px solid ${C.border}`, paddingTop: 13,
        }}>
          <div style={{ fontSize: 13.5, color: C.white, lineHeight: 1.65, marginBottom: 12 }}>{teaser}</div>
          <button onClick={() => onUpgrade?.('fan_profile')} style={{
            padding: '10px 18px', borderRadius: 100, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)', color: '#06101A',
            fontSize: 12.5, fontWeight: 850,
          }}>Unlock this fan&apos;s pattern →</button>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: accent || C.white }}>{value}</div>
    </div>
  )
}

function FilterPill({ on, color, children, onClick }) {
  return (
    <button onClick={onClick} aria-pressed={on} style={{
      padding: '5px 12px', borderRadius: 100, cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
      background: on ? 'rgba(34,211,238,0.12)' : C.card2,
      border: `1px solid ${on ? 'rgba(34,211,238,0.45)' : C.border}`,
      color: on ? (color || C.cyan) : C.muted, whiteSpace: 'nowrap',
    }}>{children}</button>
  )
}

const iconBtn = (color) => ({
  width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, cursor: 'pointer', color,
  background: `${color}1a`, border: `1px solid ${color}40`,
})
