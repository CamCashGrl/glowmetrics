'use client'
// ============================================================
// CAMCASH — POST-IMPORT RESULT
//
// The screen a creator sees after a successful CSV upload. It exists to
// answer three questions in order:
//
//   1. What did you just take from me?      -> the WHOLE file
//   2. What can Free actually tell me?      -> the 31-day window, labelled
//   3. What else did you find in there?     -> real locked previews
//
// Before this, the panel headlined the inserted row count and put the Free
// window's figures directly beneath it. On a multi-year file that read
// "1,912 tips imported" followed immediately by "13 tips", which looks like
// a failed import even though both numbers are correct.
//
// EVERY value rendered here is measured server-side by app/api/upload/route.js
// from the real uploaded file, via one aggregateRows() run. This component
// computes nothing except date spans and bar heights. If the engine could not
// support a claim, the corresponding card renders its own "needs more data"
// state rather than inventing one — see the best-windows card.
// ============================================================

import Button from '../../components/ui/Button'
import { PRO_PRICE_MONTHLY_LABEL, PRO_PRICE_NOTE } from '../../lib/constants'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21]

const fmtUsd = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtInt = (n) => Number(n || 0).toLocaleString()
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'AM' : 'PM'}`

function daySpan(from, to) {
  const a = new Date(from), b = new Date(to)
  if (isNaN(a) || isNaN(b)) return null
  return Math.max(1, Math.round((b - a) / 86400000))
}

// Shared shell for a locked card: real content underneath, blur + a centred
// lock over it. Deliberately NOT a full-screen paywall — the Free half of the
// page stays completely readable.
function LockedCard({ C, n, title, overlay, onUnlock, children, footer }) {
  return (
    <div style={{
      background: 'rgba(10,14,32,0.72)', border: '1px solid rgba(124,92,255,0.20)',
      borderRadius: 14, padding: 16, minWidth: 0, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.white, marginBottom: 12 }}>
        {n}. {title}
      </div>
      <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ filter: 'blur(4px)', opacity: 0.75, userSelect: 'none', pointerEvents: 'none' }} aria-hidden="true">
          {children}
        </div>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', padding: 8,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: 'rgba(10,14,32,0.92)',
            border: '1px solid rgba(124,92,255,0.45)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16, boxShadow: '0 0 22px rgba(124,92,255,0.35)',
          }}>🔒</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.white, maxWidth: 220, lineHeight: 1.4, textShadow: '0 2px 10px rgba(5,7,19,0.95)' }}>
            {overlay}
          </div>
        </div>
      </div>
      {footer && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10, lineHeight: 1.45 }}>{footer}</div>}
      {onUnlock && (
        <button onClick={onUnlock} style={{
          marginTop: 10, padding: '7px 12px', borderRadius: 9, fontSize: 11.5, fontWeight: 800,
          background: 'rgba(124,92,255,0.14)', border: '1px solid rgba(124,92,255,0.35)',
          color: C.white, cursor: 'pointer', alignSelf: 'flex-start',
        }}>Unlock Full History →</button>
      )}
    </div>
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

  // Sparse is about ABSOLUTE recent activity, not the file's size. A creator
  // with hundreds of recent tips inside a huge file is long-tenured, not
  // sparse, and must not be told their activity is light.
  const sparse = Boolean(
    !isPro && free && full && full.tips > free.tips && (free.tips < 30 || free.sessions < 3)
  )
  const atPlatformCap = !isPro && (result.platformsTracked || []).length >= freeMaxPlatforms
  const hasLocked = Boolean(excluded || lockedPlatforms.length || atPlatformCap ||
    (li && (li.trend?.length >= 2 || li.topFans?.length || li.session || li.heatmap?.length)))

  const card = {
    background: 'rgba(10,14,32,0.72)', border: '1px solid rgba(124,92,255,0.16)',
    borderRadius: 16, padding: 18,
  }

  return (
    <div style={{ textAlign: 'left', maxWidth: 980, margin: '0 auto' }}>
      {/* ── SUCCESS HEADER ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <div style={{
          flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%',
          border: `2px solid ${C.green}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: C.green, fontSize: 17, fontWeight: 900,
        }}>✓</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: C.green }}>Import successful!</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: C.white, margin: '2px 0 4px', letterSpacing: '-0.02em' }}>
            We analyzed your CSV
          </h2>
          <div style={{ fontSize: 13, color: C.muted }}>Here&apos;s what we found in your data.</div>
        </div>
      </div>

      {/* ── FULL FILE + STORAGE EXPLANATION ──────────────────────────── */}
      <div className="ir-summary" style={{ ...card, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: C.white, marginBottom: 8, overflowWrap: 'anywhere' }}>
            CSV analyzed: {fmtInt(full?.tips ?? result.inserted)} tips ·{' '}
            <span style={{ color: C.green }}>{fmtUsd(full?.totalUsd)}</span> total
          </div>
          <div style={{ fontSize: 13, color: C.pink, fontWeight: 700, marginBottom: 6 }}>{result.platform}</div>
          {full?.dateFrom && full?.dateTo && (
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 4 }}>
              📅 {formatDate(full.dateFrom)} – {formatDate(full.dateTo)}{span ? ` (${fmtInt(span)} days)` : ''}
            </div>
          )}
          <div style={{ fontSize: 12.5, color: C.muted }}>
            ✓ {fmtInt(result.skipped || 0)} duplicate{(result.skipped || 0) === 1 ? '' : 's'} removed
          </div>
        </div>
        {/* Storage vs analysis, stated before the Free numbers appear — so a
            thin window can never read as data having been discarded. */}
        <div style={{
          minWidth: 0, borderRadius: 12, padding: 14,
          background: 'linear-gradient(135deg,rgba(34,211,238,0.09),rgba(124,92,255,0.09))',
          border: '1px solid rgba(34,211,238,0.22)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 6 }}>🔒 We store all of your data</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>
            Everything you upload is saved. Free analytics show the most recent {freeHistoryDays} days per platform.
          </div>
        </div>
      </div>

      {/* ── A. YOUR FREE RESULTS ─────────────────────────────────────── */}
      {!isPro && free && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: C.cyan, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              A. Your Free Results
            </div>
            <div style={{ fontSize: 12, color: C.muted, flex: '1 1 auto', minWidth: 0 }}>
              Based on your most recent {freeHistoryDays} days for this platform
            </div>
            <div style={{ flex: '0 0 auto', fontSize: 11, fontWeight: 800, color: C.muted, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)' }}>
              Free Plan
            </div>
          </div>
          {/* A metric with no qualifying data renders as a THRESHOLD STATE, not
              as 0 or a dash. "Sessions: 0" next to 13 imported tips reads as a
              bug; "Needs more data — requires 15+ min or $10+" reads as a bar
              not yet cleared. The thresholds quoted are the canonical ones
              (lib/analytics/sessions.js classifySession, lib/analytics.js
              isHourlyRateEligible) — nothing new is defined here, and the
              analytics themselves are untouched. */}
          <div className="ir-free-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 10 }}>
            {[
              { icon: '🪙', label: 'Tips', value: fmtInt(free.tips), color: C.cyan },
              { icon: '💵', label: 'Earnings', value: fmtUsd(free.totalUsd), color: C.green },
              {
                icon: '📅', label: 'Sessions', color: C.gold,
                value: free.sessions > 0 ? fmtInt(free.sessions) : null,
                need: 'Needs a session of 15+ min or $10+',
              },
              { icon: '👥', label: 'Fans', value: fmtInt(free.fans), color: C.pink },
              {
                icon: '⏱️', label: 'Avg $/hour', color: C.indigo,
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
                  <span aria-hidden="true">{s.icon}</span> {s.label}
                </div>
                {s.value != null ? (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 900, color: s.color, overflowWrap: 'anywhere' }}>{s.value}</div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>in last {freeHistoryDays} days</div>
                  </>
                ) : (
                  <>
                    <div style={{
                      display: 'inline-block', fontSize: 11, fontWeight: 800, color: C.muted,
                      padding: '3px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.09)',
                    }}>Needs more data</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 5, lineHeight: 1.35 }}>{s.need}</div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Sparse data is still valid data. Say that the rows are real and
              stored, and separately that some insights need more evidence —
              never that anything is missing or failed. */}
          {sparse && (
            <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(124,92,255,0.08)', border: '1px solid rgba(124,92,255,0.22)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 4 }}>✨ Your recent activity is light</div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>
                Your latest {freeHistoryDays} days contain limited activity, so some recommendations need more data to be reliable.
                We found much more activity in your older history — {fmtInt(full.tips - free.tips)} more tips, all saved.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── B. WHAT CAMCASH FOUND IN YOUR HISTORY ────────────────────── */}
      {hasLocked && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: C.pink, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
            B. What CamCash found in your history
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
            These insights use{span ? ` your full ${fmtInt(span)} days of` : ' the broader history in your'} data. Upgrade to Pro to unlock the full analysis.
          </div>

          {/* The single most persuasive number on the page is the creator's own
              locked earnings total. It used to sit in a supporting card below
              four locked previews, where it read as a footnote. It leads the
              section now, with its breakdown directly beneath — the previews
              become evidence FOR this figure rather than competing with it.
              Every value is measured from the real file. */}
          {excluded && (
            <div style={{
              padding: '16px 18px', borderRadius: 14, marginBottom: 14,
              background: 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(34,211,238,0.08))',
              border: '1px solid rgba(16,185,129,0.30)',
            }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 5, overflowWrap: 'anywhere' }}>
                We found <span style={{ color: C.green }}>{fmtUsd(excluded.totalUsd)}</span> more in your history
              </div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55, marginBottom: 12 }}>
                That&apos;s additional earnings in your uploaded data that Free can&apos;t fully analyze yet.
                It&apos;s already saved — upgrading unlocks it instantly, with no re-upload.
              </div>
              <div className="ir-extra" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
                {[
                  { v: fmtInt(excluded.tips), l: 'additional tips', c: C.cyan },
                  { v: fmtUsd(excluded.totalUsd), l: 'additional earnings', c: C.green },
                  { v: fmtInt(excluded.sessions), l: 'additional sessions', c: C.gold },
                  {
                    v: excluded.dateFrom && excluded.dateTo
                      ? `${formatDate(excluded.dateFrom)} – ${formatDate(excluded.dateTo)}`
                      : '—',
                    l: 'historical range', c: C.pink, small: true,
                  },
                ].map(s => (
                  <div key={s.l} style={{ minWidth: 0, padding: '9px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: s.small ? 11.5 : 18, fontWeight: 900, color: s.c, overflowWrap: 'anywhere', lineHeight: 1.25 }}>{s.v}</div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="ir-locked-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
            {/* 1 — LONG-TERM EARNINGS TREND (real monthly totals) */}
            {li?.trend?.length >= 2 && (() => {
              const t = li.trend
              const peak = Math.max(...t.map(m => m.usd), 0) || 1
              const pts = t.map((m, i) => `${(i / Math.max(t.length - 1, 1)) * 100},${40 - (m.usd / peak) * 36}`).join(' ')
              return (
                <LockedCard C={C} n={1} title="Long-term earnings trend"
                  overlay="Unlock to see the full historical trend" onUnlock={onUpgrade}
                  footer={`${t.length} months of real earnings history found in this file.`}>
                  <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
                    <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 8.5, color: C.muted, height: 96 }}>
                      <span>{fmtUsd(peak)}</span><span>{fmtUsd(peak / 2)}</span><span>$0</span>
                    </div>
                    <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ flex: '1 1 auto', height: 96, minWidth: 0 }}>
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
                </LockedCard>
              )
            })()}

            {/* 2 — STRONGEST EARNING WINDOWS.
                Gated on the canonical supported/high tier rule. When nothing
                clears it — common, and true of the file this was built against
                — the card keeps its place in the grid but states the absence
                instead of ranking noise behind a blur. */}
            {li && (li.bestWindows?.length > 0 ? (
              <LockedCard C={C} n={2} title="Your strongest earning windows"
                overlay="Unlock to see your top earning windows" onUnlock={onUpgrade}
                footer={`${li.bestWindows.length} window${li.bestWindows.length === 1 ? '' : 's'} with enough repeat sessions to stand up as a recommendation.`}>
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: '8px 10px', alignItems: 'center' }}>
                  {li.bestWindows.map((w, i) => (
                    <div key={`${w.day}-${w.hour}`} style={{ display: 'contents' }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: C.gold }}>#{i + 1}</div>
                      <div style={{ fontSize: 11.5, color: C.text, minWidth: 0, overflowWrap: 'anywhere' }}>{w.day} {hourLabel(w.hour)}</div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: C.gold }}>{fmtUsd(w.usdPerHour)}/hr</div>
                    </div>
                  ))}
                </div>
              </LockedCard>
            ) : (
              <div style={{ background: 'rgba(10,14,32,0.72)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: 16, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.white, marginBottom: 10 }}>
                  2. Your strongest earning windows
                </div>
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>
                  Your history doesn&apos;t yet have enough repeat sessions in any single day-and-hour slot to name a reliable one.
                  This fills in as you stream more — we won&apos;t guess a best time from a single session.
                </div>
              </div>
            ))}

            {/* 3 — TOP SUPPORTERS, ALL TIME (real ranks and amounts) */}
            {li?.topFans?.length > 0 && (
              <LockedCard C={C} n={3} title="Top supporters (all time)"
                overlay="Unlock to see your top historical supporters" onUnlock={onUpgrade}
                footer={`${fmtInt(li.totals.fans)} supporters found across your full history.`}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '7px 10px', alignItems: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>Fan</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>Tips</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>Spent</div>
                  {li.topFans.map(f => (
                    <div key={f.rank} style={{ display: 'contents' }}>
                      <div style={{ fontSize: 11.5, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.username}</div>
                      <div style={{ fontSize: 11.5, color: C.muted }}>{fmtInt(f.tips)}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 900, color: C.green }}>{fmtUsd(f.usd)}</div>
                    </div>
                  ))}
                </div>
              </LockedCard>
            )}

            {/* 4 — SESSION & PERFORMANCE PATTERNS (real day x hour grid) */}
            {li?.heatmap?.length > 0 && (() => {
              const peak = Math.max(...li.heatmap.map(c => c.usdPerHour), 0) || 1
              const byKey = new Map(li.heatmap.map(c => [`${c.day}-${c.hour}`, c.usdPerHour]))
              return (
                <LockedCard C={C} n={4} title="Session & performance patterns"
                  overlay="Unlock to see your full performance patterns" onUnlock={onUpgrade}
                  footer={li.session
                    ? `${fmtInt(li.session.sessions)} measured streams across your history.`
                    : `${li.heatmap.length} active time slots found.`}>
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
                </LockedCard>
              )
            })()}
          </div>

          {/* The old supporting card that lived here has moved to the TOP of
              this section — it is the strongest number on the page and was
              being buried. Not duplicated here. */}

          {/* Fourth platform — its rows were NOT stored, so it gets the
              re-import sentence rather than the instant-unlock one. */}
          {lockedPlatforms.map(p => (
            <div key={p.platform} style={{ marginTop: 12, padding: '14px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.24)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                We found another platform: {p.platform}
              </div>
              <div className="ir-extra" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginBottom: 10 }}>
                {[{ v: fmtInt(p.tips), l: 'Tips' }, { v: fmtUsd(p.totalUsd), l: 'Earnings' }, { v: fmtInt(p.sessions), l: 'Sessions' }].map(s => (
                  <div key={s.l} style={{ padding: '9px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: 4 }}>{s.l}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: C.white, filter: 'blur(3px)', userSelect: 'none', overflowWrap: 'anywhere' }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>
                Detected in this file. Free is already using all {freeMaxPlatforms} platform slots, so these rows weren&apos;t stored — unlike your history, which is already saved and unlocks the moment you upgrade. Bringing {p.platform} in takes one more import of this same file after upgrading.
              </div>
              <Button onClick={onUpgrade} style={{ marginTop: 10, padding: '8px 14px', fontSize: 12 }}>Unlock Pro to analyze {p.platform} →</Button>
            </div>
          ))}
          {/* At the cap with no NEW platform in this file — there is nothing
              locked to preview, but the ceiling is still worth naming. This
              card existed before the rewrite and is easy to lose, because it
              only appears when lockedPlatforms is empty. */}
          {atPlatformCap && lockedPlatforms.length === 0 && (
            <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 12, background: 'linear-gradient(135deg,rgba(34,211,238,0.08),rgba(124,92,255,0.08))', border: '1px solid rgba(34,211,238,0.20)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                You&apos;ve used all {freeMaxPlatforms} Free platform slots
              </div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>
                Upgrade to Pro to add more platforms and compare your earnings, best windows, and platform ROI side by side.
              </div>
              <Button onClick={onUpgradePlatforms || onUpgrade} style={{ marginTop: 10, padding: '8px 14px', fontSize: 12 }}>Compare More Platforms →</Button>
            </div>
          )}
        </div>
      )}

      {/* ── PRIMARY CTA ──────────────────────────────────────────────── */}
      {!isPro && hasLocked && (
        <div className="ir-cta" style={{
          ...card, display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center',
          background: 'linear-gradient(135deg,rgba(124,92,255,0.14),rgba(236,72,153,0.10))',
          border: '1px solid rgba(236,72,153,0.28)', marginBottom: 16,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.white, marginBottom: 5 }}>👑 Unlock your full history</div>
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55, marginBottom: 10 }}>
              Pro unlocks the deeper trends, longer time ranges, and advanced insights already found in your uploaded data.
            </div>
            <div className="ir-cta-feats" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '5px 14px' }}>
              {['Full historical insights', 'Advanced reports', 'Longer date ranges', 'Priority support'].map(f => (
                <div key={f} style={{ fontSize: 11.5, color: C.muted, minWidth: 0 }}>
                  <span style={{ color: C.green }}>✓</span> {f}
                </div>
              ))}
            </div>
          </div>
          {/* Price sits WITH the button, not behind it. Making someone click
              to discover the cost is a bigger drop-off than the cost itself.
              Display only — Stripe still decides what is actually charged and
              this opens the existing checkout, no new path. */}
          <div style={{ minWidth: 0, textAlign: 'center' }}>
            <Button onClick={onUpgrade} style={{ padding: '14px 26px', fontSize: 15, whiteSpace: 'nowrap' }}>
              Unlock Full History →
            </Button>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 7, whiteSpace: 'nowrap' }}>
              {PRO_PRICE_MONTHLY_LABEL} · {PRO_PRICE_NOTE}
            </div>
          </div>
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
