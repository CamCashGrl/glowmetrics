'use client'
// ============================================================
// CAMCASH — POST-IMPORT RESULT
//
// The screen a creator sees after a successful CSV upload, and the highest-
// value conversion surface in the product. Four sections, in this order:
//
//   IMPORT COMPLETE      what we took from you — the WHOLE file
//   YOUR FREE ANALYSIS   what Free actually tells you, clearly labelled
//   YOUR SAVED HISTORY   your own money, already stored, one tier away
//   WHAT PRO CAN REVEAL  real previews of the real product
//
// The order matters. Headlining the Free window's figures on a multi-year
// file read "1,912 tips imported" followed by "13 tips", which looks like a
// failed import even though both numbers are correct. Success first, then the
// labelled Free slice, then the value — never the value before the proof.
//
// LOCKED STATES ARE NOT DECORATION
// Locked cards render through app/dashboard/components/LockedModule.js, whose
// rule is "preview the product, don't hide it". The previous treatment blurred
// each card 4px behind a centred lock, which taught the creator nothing about
// what they were buying. Four genuinely different states exist here and are
// never collapsed into one component:
//
//   A. saved     — rows ALREADY stored. Pro analyses them, no re-upload.
//   B. pro       — a Pro-only insight, previewed with real structure.
//   C. no-data   — NOT a paywall. No lock, no CTA: upgrading would not
//                  produce the number, so offering it would be a lie.
//   D. platform  — rows NOT stored (Free platform cap). Needs a re-import
//                  after upgrading, so "no re-upload" must never appear.
//
// EVERY value rendered here is measured server-side by app/api/upload/route.js
// from the real uploaded file, via one aggregateRows() run. This component
// computes nothing except date spans and bar heights.
// ============================================================

import Button from '../../components/ui/Button'
import { PRO_PRICE_MONTHLY_LABEL, PRO_PRICE_NOTE } from '../../lib/constants'
import { resolveUpgradeContext } from '../../lib/upgradeContext'
import LockedModule, { UnlockButton, InsufficientData } from './components/LockedModule'
import LockedValue, { LockedBar } from './components/LockedValue'
import HistoryTimeline from './components/HistoryTimeline'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }
const HOUR_TICKS = [0, 6, 12, 18]

const fmtUsd = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtInt = (n) => Number(n || 0).toLocaleString()
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'AM' : 'PM'}`

function daySpan(from, to) {
  const a = new Date(from), b = new Date(to)
  if (isNaN(a) || isNaN(b)) return null
  return Math.max(1, Math.round((b - a) / 86400000))
}

// Months, for "19 months of history". Rendered only from real endpoints.
function monthSpan(from, to) {
  const d = daySpan(from, to)
  return d ? Math.max(1, Math.round(d / 30.44)) : null
}

function SectionLabel({ C, children, tone }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 900, letterSpacing: '0.10em', textTransform: 'uppercase',
      color: tone || C.muted, marginBottom: 10,
    }}>{children}</div>
  )
}

export default function ImportResult({
  C, result, isPro, freeHistoryDays, freeMaxPlatforms,
  formatDate, onUpgrade, onUpgradePlatforms, onViewDashboard, onImportAnother,
}) {
  if (!result?.success) return null

  const full = result.fullFileSummary
  const free = result.freeResults
  const li = !isPro ? result.lockedInsights : null
  const excluded = !isPro && result.excludedHistory?.tips > 0 ? result.excludedHistory : null
  const lockedPlatforms = !isPro ? (result.lockedPlatformPreview || []) : []
  const span = full ? daySpan(full.dateFrom, full.dateTo) : null
  const histMonths = excluded ? monthSpan(excluded.dateFrom, excluded.dateTo) : null

  // Sparse is about ABSOLUTE recent activity, not the file's size. A creator
  // with hundreds of recent tips inside a huge file is long-tenured, not
  // sparse, and must not be told their activity is light.
  const sparse = Boolean(
    !isPro && free && full && full.tips > free.tips && (free.tips < 30 || free.sessions < 3)
  )
  const atPlatformCap = !isPro && (result.platformsTracked || []).length >= freeMaxPlatforms
  // One source of truth for "what is this creator missing" — the CTA label,
  // the modal headline and the benefit list all come from here, so a click on
  // "Compare More Platforms" cannot open a pitch about history.
  const upgradeCtx = isPro ? null : resolveUpgradeContext({
    lockedTips: excluded?.tips || 0,
    lockedUsd: excluded?.totalUsd || 0,
    platformCount: (result.platformsTracked || []).length,
    hasBlockedPlatform: lockedPlatforms.length > 0,
    hasDeeperInsights: Boolean(li && (li.trend?.length >= 2 || li.topFans?.length || li.session)),
  })
  const fireUpgrade = () => onUpgrade?.(upgradeCtx?.source)
  const hasProPreviews = Boolean(li && (li.trend?.length >= 2 || li.topFans?.length || li.session || li.heatmap?.length))
  const hasLocked = Boolean(excluded || lockedPlatforms.length || atPlatformCap || hasProPreviews)

  const card = {
    background: 'rgba(10,14,32,0.72)', border: '1px solid rgba(124,92,255,0.16)',
    borderRadius: 16, padding: 18,
  }

  return (
    <div style={{ textAlign: 'left', maxWidth: 980, margin: '0 auto' }}>

      {/* ══ IMPORT COMPLETE ══════════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div style={{
          flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%',
          border: `2px solid ${C.green}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: C.green, fontSize: 17, fontWeight: 900,
        }} aria-hidden="true">✓</div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: C.white, margin: 0, letterSpacing: '-0.02em' }}>
            CSV imported successfully
          </h2>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>Your data is saved and ready to analyze.</div>
        </div>
      </div>

      {/* Whole-file headline metrics. The creator's first question is "did you
          take all of it?" — answer that before any plan boundary appears. */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div className="ir-headline" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, marginBottom: 12 }}>
          {[
            { v: fmtInt(full?.tips ?? result.inserted), l: 'tips', c: C.cyan },
            { v: fmtUsd(full?.totalUsd), l: 'earnings', c: C.green },
            { v: fmtInt(full?.fans), l: 'supporters', c: C.pink },
          ].map(s => (
            <div key={s.l} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'clamp(20px,5vw,28px)', fontWeight: 900, color: s.c, letterSpacing: '-0.025em', overflowWrap: 'anywhere', lineHeight: 1.1 }}>{s.v}</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px 16px', flexWrap: 'wrap', fontSize: 12.5, color: C.muted, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {full?.dateFrom && full?.dateTo && (
            <span>{formatDate(full.dateFrom)} — {formatDate(full.dateTo)}{span ? ` · ${fmtInt(span)} days` : ''}</span>
          )}
          <span style={{ color: C.cyan, fontWeight: 700 }}>
            {(result.platformsTracked || []).length > 1
              ? (result.platformsTracked || []).join(', ')
              : result.platform}
          </span>
          <span>{fmtInt(result.skipped || 0)} duplicate{(result.skipped || 0) === 1 ? '' : 's'} removed</span>
        </div>
      </div>

      {/* ══ YOUR FREE ANALYSIS ═══════════════════════════════════════════ */}
      {!isPro && free && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <SectionLabel C={C} tone={C.cyan}>Your Free snapshot</SectionLabel>
            <div style={{ flex: '1 1 auto' }} />
            <div style={{ fontSize: 10.5, fontWeight: 800, color: C.muted, padding: '3px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)' }}>
              Free plan
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>
            Free analyzes the most recent {freeHistoryDays} days of activity for each platform.
          </div>

          {/* A metric with no qualifying data renders as a THRESHOLD STATE, not
              as 0 or a dash. "Sessions: 0" next to 13 imported tips reads as a
              bug; "Needs more data" reads as a bar not yet cleared. The
              thresholds quoted are the canonical ones (classifySession,
              isHourlyRateEligible) — nothing new is defined here. */}
          <div className="ir-free-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 10 }}>
            {[
              { label: 'Tips', value: fmtInt(free.tips), color: C.cyan },
              { label: 'Earnings', value: fmtUsd(free.totalUsd), color: C.green },
              {
                label: 'Sessions', color: C.gold,
                value: free.sessions > 0 ? fmtInt(free.sessions) : null,
                need: 'Needs a session of 15+ min or $10+',
              },
              { label: 'Fans', value: fmtInt(free.fans), color: C.pink },
              {
                label: 'Avg $/hour', color: C.indigo,
                value: free.avgUsdPerHour != null ? fmtUsd(free.avgUsdPerHour) : null,
                need: 'Needs a session with 2+ tips and 15+ min',
              },
            ].map(s => (
              <div key={s.label} style={{
                padding: '11px 12px', borderRadius: 12, minWidth: 0,
                background: s.value == null ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${s.value == null ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.07)'}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: 6 }}>
                  {s.label}
                </div>
                {s.value != null ? (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 900, color: s.color, overflowWrap: 'anywhere' }}>{s.value}</div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>recent activity analyzed</div>
                  </>
                ) : (
                  <>
                    <div style={{
                      display: 'inline-block', fontSize: 11, fontWeight: 800, color: C.muted,
                      padding: '3px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.09)',
                    }}>Not enough qualifying activity yet</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 5, lineHeight: 1.35 }}>{s.need}</div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Sparse data is still valid data. Say the rows are real and stored,
              and separately that some insights need more evidence — never that
              anything is missing or failed. */}
          {sparse && (
            <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(124,92,255,0.08)', border: '1px solid rgba(124,92,255,0.22)' }}>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>
                Your latest {freeHistoryDays} days contain limited activity, so some recommendations need more data to be reliable.
                We found much more in your older history — {fmtInt(full.tips - free.tips)} more tips, all saved.
              </div>
            </div>
          )}
        </div>
      )}

      {/* The first "they actually read my data" moment, BEFORE anything locked
          is mentioned. Server-side and evidence-gated: a best day needs 3+
          days, a top supporter needs 2+ tips. When nothing clears the bar this
          renders nothing rather than dressing up a single tip as an insight. */}
      {!isPro && result.freeHighlight && (
        <div style={{
          ...card, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14,
          background: 'linear-gradient(135deg,rgba(34,211,238,0.10),rgba(16,185,129,0.07))',
          border: '1px solid rgba(34,211,238,0.26)',
        }}>
          <div style={{ flex: '0 0 auto', fontSize: 22 }} aria-hidden="true">💡</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.cyan, marginBottom: 4 }}>
              {result.freeHighlight.label}
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: C.white, marginBottom: 3, overflowWrap: 'anywhere' }}>
              {result.freeHighlight.value}
            </div>
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{result.freeHighlight.detail}</div>
          </div>
        </div>
      )}

      {/* ══ YOUR SAVED HISTORY — STATE A ═════════════════════════════════
          The strongest conversion moment in the product: money the creator
          already earned, already handed us, already stored. It carries the
          page's ONE primary CTA and the price, so nobody has to click to
          discover the cost. */}
      {excluded && full?.dateFrom && full?.dateTo && (
        <div style={{ marginBottom: 14 }}>
          <HistoryTimeline
            C={C}
            dateFrom={full.dateFrom}
            dateTo={full.dateTo}
            freeHistoryDays={freeHistoryDays}
            lockedUsd={excluded.totalUsd}
            lockedTips={excluded.tips}
            priceLabel={`${PRO_PRICE_MONTHLY_LABEL} · ${PRO_PRICE_NOTE}`}
            stats={[
              { v: fmtInt(excluded.tips), l: 'older tips' },
              ...(histMonths ? [{ v: `${histMonths} months`, l: 'of history' }] : []),
              { v: fmtInt(excluded.sessions), l: 'sessions' },
              ...(excluded.dateFrom && excluded.dateTo
                ? [{ v: `${formatDate(excluded.dateFrom)} – ${formatDate(excluded.dateTo)}`, l: 'older range' }]
                : []),
            ]}
            formatDate={formatDate}
            onUpgrade={() => fireUpgrade()}
          />
        </div>
      )}

      {/* ══ WHAT PRO CAN REVEAL — STATE B (and C where evidence is thin) ══
          Real visualisations with real numbers, faded rather than blurred out.
          Quiet secondary CTAs: these are evidence for the primary action
          above, not four more competing primaries. */}
      {hasProPreviews && (
        <div style={{ marginBottom: 14 }}>
          <SectionLabel C={C} tone={C.indigo}>See what your full history can tell you</SectionLabel>
          <div className="ir-locked-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>

            {/* 1 — LONG-TERM EARNINGS TREND (real monthly totals) */}
            {li?.trend?.length >= 2 && (() => {
              const t = li.trend
              const peak = Math.max(...t.map(m => m.usd), 0) || 1
              const pts = t.map((m, i) => `${(i / Math.max(t.length - 1, 1)) * 100},${40 - (m.usd / peak) * 36}`).join(' ')
              return (
                <LockedModule C={C} variant="pro" surface="csv_locked_trend" icon="📈"
                  title="Long-term earnings trend"
                  description={`Pro charts every one of the ${t.length} months in this file, so you can see whether you are actually growing.`}
                  lockedReason={`${t.length} months of real earnings history found in this file.`}
                  ctaLabel="View with Pro" onUpgrade={onUpgrade}
                  preview={
                    <>
                      <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
                        {/* The curve's SHAPE is the creator's real trajectory and
                            stays fully visible; only the scale is withheld, so the
                            chart reads as "your growth, magnitude locked". */}
                        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 92 }}>
                          <LockedValue C={C} seed="peak" size={9} prefix="$" blocks={3} />
                          <LockedValue C={C} seed="mid" size={9} prefix="$" blocks={3} />
                          <span style={{ fontSize: 8.5, color: C.muted }}>$0</span>
                        </div>
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ flex: '1 1 auto', height: 92, minWidth: 0 }}>
                          <defs>
                            <linearGradient id="irTrendFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.55" />
                              <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0.02" />
                            </linearGradient>
                          </defs>
                          <polygon points={`0,40 ${pts} 100,40`} fill="url(#irTrendFill)" />
                          <polyline points={pts} fill="none" stroke="#A78BFA" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: C.muted, marginTop: 4 }}>
                        <span>{t[0].month}</span><span>{t[Math.floor(t.length / 2)].month}</span><span>{t[t.length - 1].month}</span>
                      </div>
                    </>
                  }
                />
              )
            })()}

            {/* 2 — STRONGEST EARNING WINDOWS.
                Gated on the canonical supported/high tier rule. When nothing
                clears it — common, and true of the file this was built against
                — this becomes STATE C, not a lock: no badge, no CTA, because
                upgrading would not manufacture the evidence. */}
            {li && (li.bestWindows?.length > 0 ? (
              <LockedModule C={C} variant="pro" surface="csv_locked_windows" icon="⏰"
                title="Your strongest earning windows"
                description="Pro analyzes your historical sessions to identify your highest-value days and hours."
                lockedReason={`${li.bestWindows.length} window${li.bestWindows.length === 1 ? '' : 's'} with enough repeat sessions to stand up as a recommendation.`}
                ctaLabel="See my earning windows" onUpgrade={onUpgrade}
                preview={
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: '8px 10px', alignItems: 'center' }}>
                    {/* Their real day and hour, perfectly legible. Only the rate is
                        withheld. This is the whole design in one row. */}
                    {li.bestWindows.map((w, i) => (
                      <div key={`${w.day}-${w.hour}`} style={{ display: 'contents' }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: C.gold }}>#{i + 1}</div>
                        <div style={{ fontSize: 12, color: C.white, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{w.day} {hourLabel(w.hour)}</div>
                        <LockedValue C={C} seed={`${w.day}${w.hour}`} size={12} prefix="$" suffix="/hr" accent={C.gold} />
                      </div>
                    ))}
                  </div>
                }
              />
            ) : (
              <InsufficientData C={C}
                title="Your strongest earning windows"
                message="No single day-and-hour slot in your history has enough repeat sessions yet for us to name it reliably. This fills in as you stream more."
                threshold="Requires repeat sessions in the same weekly slot."
              />
            ))}

            {/* 3 — TOP SUPPORTERS, ALL TIME (real ranks and amounts) */}
            {li?.topFans?.length > 0 && (
              <LockedModule C={C} variant="pro" surface="csv_locked_fans" icon="🐳"
                title="Deeper supporter intelligence"
                description="Pro ranks every supporter across your full history by lifetime value, not just the handful in your recent window."
                lockedReason={`${fmtInt(li.totals.fans)} supporters found across your full history.`}
                ctaLabel="See supporter insights" onUpgrade={onUpgrade}
                preview={
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '7px 10px', alignItems: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>Fan</div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>Tips</div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>Spent</div>
                    {li.topFans.map(f => (
                      <div key={f.rank} style={{ display: 'contents' }}>
                        <div style={{ fontSize: 11.5, color: C.white, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.username}</div>
                        <div style={{ fontSize: 11.5, color: C.text }}>{fmtInt(f.tips)}</div>
                        <LockedValue C={C} seed={f.username} size={11.5} prefix="$" accent={C.green} />
                      </div>
                    ))}
                  </div>
                }
              />
            )}

            {/* 4 — SESSION & PERFORMANCE PATTERNS (real day x hour grid) */}
            {li?.heatmap?.length > 0 && (() => {
              const peak = Math.max(...li.heatmap.map(c => c.usdPerHour), 0) || 1
              const byKey = new Map(li.heatmap.map(c => [`${c.day}-${c.hour}`, c.usdPerHour]))
              return (
                <LockedModule C={C} variant="pro" surface="csv_locked_patterns" icon="🗂️"
                  title="Session & performance patterns"
                  description="Pro reads every measured stream in your history and shows which hours actually paid."
                  ctaLabel="See my performance patterns"
                  lockedReason={li.session
                    ? `${fmtInt(li.session.sessions)} measured streams across your history.`
                    : `${li.heatmap.length} active time slots found.`}
                  onUpgrade={onUpgrade}
                  preview={
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr', gap: 4, minWidth: 0 }}>
                        {DAYS.map(d => (
                          <div key={d} style={{ display: 'contents' }}>
                            <div style={{ fontSize: 8.5, color: C.muted, lineHeight: '11px' }}>{d}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,minmax(0,1fr))', gap: 1.5, minWidth: 0 }}>
                              {Array.from({ length: 24 }, (_, h) => {
                                const v = byKey.get(`${DAY_FULL[d]}-${h}`) || 0
                                return <div key={h} style={{
                                  height: 11, borderRadius: 2,
                                  background: v > 0
                                    ? `rgba(${Math.round(124 + (236 - 124) * (v / peak))},${Math.round(92 - 20 * (v / peak))},${Math.round(255 - 100 * (v / peak))},${0.25 + 0.7 * (v / peak)})`
                                    : 'rgba(255,255,255,0.04)',
                                }} />
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: C.muted, marginTop: 5, paddingLeft: 30 }}>
                        {HOUR_TICKS.map(h => <span key={h}>{hourLabel(h)}</span>)}
                      </div>
                    </>
                  }
                />
              )
            })()}
          </div>
        </div>
      )}

      {/* ══ STATE D — FOURTH PLATFORM ════════════════════════════════════
          NOT historical data. These rows were never stored, because the Free
          platform cap was already reached. The distinction is the entire point
          of this card: the "no re-upload" promise is TRUE of saved history and
          FALSE here, so this copy says the opposite, explicitly. Figures are
          shown plainly — a creator cannot want what they cannot read. */}
      {lockedPlatforms.map(p => (
        <div key={p.platform} style={{ marginBottom: 14 }}>
          <LockedModule C={C} variant="platform" surface="csv_locked_platform" icon="🧩"
            title="Another platform found"
            value={p.platform}
            stats={[
              { v: fmtInt(p.tips), l: 'tips', c: C.white },
              { v: fmtUsd(p.totalUsd), l: 'earnings', c: C.green },
              { v: fmtInt(p.sessions), l: 'sessions', c: C.gold },
            ]}
            description={`Your Free plan currently analyzes up to ${freeMaxPlatforms} supported platforms. These rows weren't saved because this platform is beyond your Free limit.`}
            footnote={`After upgrading, import this file again to analyze ${p.platform}.`}
            ctaLabel="Upgrade to Pro"
            onUpgrade={() => onUpgrade?.('csv_platform_limit')}
          />
        </div>
      ))}

      {/* At the cap with no NEW platform in this file — nothing locked to
          preview, but the ceiling is still worth naming. Only appears when
          lockedPlatforms is empty, which makes it easy to lose in a rewrite. */}
      {atPlatformCap && lockedPlatforms.length === 0 && (
        <div style={{ marginBottom: 14 }}>
          <LockedModule C={C} variant="pro" surface="csv_platform_cap" icon="🔀"
            title={`You've used all ${freeMaxPlatforms} Free platform slots`}
            description="Pro adds more platforms and compares them side by side, so you can see which one is actually worth your hours."
            ctaLabel="Compare More Platforms"
            onUpgrade={() => (onUpgradePlatforms || onUpgrade)?.('csv_platform_limit')}
          />
        </div>
      )}

      {/* The page's primary CTA lives in YOUR SAVED HISTORY. This block is the
          fallback for a creator who has locked value but NO saved history —
          without it, such a page would end with only quiet secondary CTAs. */}
      {!isPro && hasLocked && !excluded && (
        <div className="ir-cta" style={{
          ...card, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap',
          background: 'linear-gradient(135deg,rgba(124,92,255,0.14),rgba(236,72,153,0.10))',
          border: '1px solid rgba(236,72,153,0.28)', marginBottom: 14,
        }}>
          <div style={{ minWidth: 240, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: C.white, marginBottom: 5 }}>Unlock your full CamCash analysis</div>
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>
              {upgradeCtx?.subhead
                || 'Pro unlocks the deeper historical trends, additional platforms, and advanced insights already found in your data.'}
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <UnlockButton surface="csv_primary" size="lg" onClick={fireUpgrade}>
              {(upgradeCtx?.cta || 'Unlock Pro →').replace(/\s*→\s*$/, '')}
            </UnlockButton>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 7, whiteSpace: 'nowrap' }}>
              {PRO_PRICE_MONTHLY_LABEL} · {PRO_PRICE_NOTE}
            </div>
          </div>
        </div>
      )}

      {/* The last thing read before deciding. Every line is a promise the
          product actually keeps and that this branch verified. */}
      {!isPro && hasLocked && (
        <div className="ir-reassure" style={{
          display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '6px 18px',
          padding: '13px 16px', borderRadius: 12, marginBottom: 16,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          {[
            'History you already uploaded unlocks without re-uploading',
            'Delete and re-import as often as you like — no upload quota',
            `Pro adds more platforms beyond your ${freeMaxPlatforms} Free slots`,
            'Your imported data stays on your account either way',
          ].map(t => (
            <div key={t} style={{ fontSize: 11.5, color: C.muted, minWidth: 0, lineHeight: 1.45 }}>
              <span style={{ color: C.green }} aria-hidden="true">✓</span> {t}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={onViewDashboard} style={{ padding: '12px 24px', fontSize: 13.5 }}>
          View Dashboard{!isPro ? ' (Free Results)' : ''}
        </Button>
        <Button variant="secondary" onClick={onImportAnother} style={{ padding: '12px 24px', fontSize: 13.5 }}>
          Import another CSV
        </Button>
      </div>
    </div>
  )
}
