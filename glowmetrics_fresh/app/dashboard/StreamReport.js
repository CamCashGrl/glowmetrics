'use client'
// ════════════════════════════════════════════════════════════════════
// POST-STREAM REPORT
//
// Renders a report already built by buildStreamReport() (lib/liveSession/
// streamReport.js). This component computes NOTHING — same rule as the
// Command Center, Performance and Fans. Every figure below is a persisted
// live_sessions / live_tips / coaching_events value or a derivation the
// canonical module made.
//
// There is no viewer count and no viewer-conversion figure here, because no
// viewer data exists anywhere in the product to derive one from.
// ════════════════════════════════════════════════════════════════════

import Button from '../../components/ui/Button'

const C = {
  white: '#f1f5f9', text: '#cbd5e1', muted: '#94a3b8', dim: '#64748b',
  cyan: '#22d3ee', green: '#10b981', gold: '#f59e0b', indigo: '#7c5cff',
  border: 'rgba(255,255,255,0.08)',
}

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtInt = (n) => Number(n || 0).toLocaleString('en-US')

export function fmtActive(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

export function fmtWhen(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return null
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const yest = new Date(today); yest.setDate(today.getDate() - 1)
  if (sameDay) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const card = (extra = {}) => ({
  background: 'rgba(15,20,32,0.75)',
  border: `1px solid ${C.border}`,
  backdropFilter: 'blur(20px)',
  borderRadius: 16,
  ...extra,
})

// ── COMPACT COMMAND CENTER SURFACE ──────────────────────────────────
// The banner the Command Center shows when a stream has just ended. One
// line of identity, one line of result, one action. It expands into the
// full report rather than duplicating it.
export function StreamReportBanner({ report, isNew = false, onOpen }) {
  if (!report) return null
  const { metrics, platform } = report
  const when = fmtWhen(report.endedAt || report.startedAt)
  const bits = [platform, when, fmtActive(metrics.activeSeconds)].filter(Boolean)

  return (
    <div
      className="cc-streamreport-banner"
      data-cc-surface="stream_report_banner"
      style={card({
        padding: '18px 22px',
        borderColor: isNew ? 'rgba(34,211,238,0.34)' : C.border,
        boxShadow: isNew ? '0 0 34px rgba(34,211,238,0.10)' : 'none',
      })}
    >
      <div className="cc-streamreport-row" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 6 }}>
            {isNew && (
              /* Restrained: a cyan hairline pill in the existing accent, not
                 a red dot. It disappears once the report is opened. */
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.10em', color: C.cyan,
                background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.34)',
                padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase',
              }}>New</span>
            )}
            <span style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Your stream report is ready</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 7 }}>{bits.join(' · ')}</div>
          <div style={{ fontSize: 14, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <strong style={{ color: C.green, fontWeight: 800 }}>{fmtUsd(metrics.earningsUsd)}</strong> earned
            {metrics.usdPerHour !== null && (
              <> · <strong style={{ color: C.cyan, fontWeight: 800 }}>{fmtUsd(metrics.usdPerHour)}/hr</strong></>
            )}
          </div>
        </div>
        <Button onClick={onOpen} style={{ padding: '12px 22px', fontSize: 13, whiteSpace: 'nowrap' }}>
          View Stream Report
        </Button>
      </div>
    </div>
  )
}

function Metric({ label, value, sub, accent = C.white }) {
  return (
    <div style={{ padding: '14px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>{label}</div>
      {/* nowrap + a tight clamp. A four-figure hourly rate ("$6,240.28/hr")
          at 23px overflowed its ~160px column at 1280 and was clipped — the
          same truncation the Command Center's money story hit. Wrapping is
          not the fix: it breaks currency mid-number. */}
      <div style={{ fontSize: 'clamp(15px, 1.2vw, 20px)', fontWeight: 800, color: accent, whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

// ── FULL REPORT ─────────────────────────────────────────────────────
export default function StreamReport({ report, onClose, onViewFan }) {
  if (!report) return null
  const { metrics, goal, coaching, fans, insights } = report
  const when = fmtWhen(report.endedAt || report.startedAt)

  return (
    <div data-cc-surface="stream_report" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>Stream report</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 5 }}>
            {[report.platform, when, fmtActive(metrics.activeSeconds) + ' active'].filter(Boolean).join(' · ')}
          </div>
        </div>
        {/* 11px vertical keeps Back at ~39px, matching the tap target the rest
            of the dashboard uses (Command Center CTAs 39px, Close Profile
            42px). 9px rendered 35px — smaller than anything else in the app. */}
        {onClose && (
          <Button variant="secondary" onClick={onClose} style={{ padding: '11px 20px', fontSize: 13, whiteSpace: 'nowrap' }}>
            Back
          </Button>
        )}
      </div>

      {/* The engine already flags a session whose timing could not be
          trusted. Say so rather than presenting its figures as clean. */}
      {report.isInaccurate && (
        <div style={{ ...card({ padding: '12px 16px', borderColor: 'rgba(245,158,11,0.32)' }), fontSize: 12.5, color: C.gold }}>
          This session's timing was corrected after the fact, so its duration and hourly rate are approximate.
        </div>
      )}

      <div className="cc-streamreport-metrics" style={card({ padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))' })}>
        <Metric label="Earned" value={fmtUsd(metrics.earningsUsd)} accent={C.green} />
        <Metric label="Tokens" value={fmtInt(metrics.tokens)} accent={C.indigo} />
        <Metric label="Active time" value={fmtActive(metrics.activeSeconds)} />
        {metrics.usdPerHour !== null && <Metric label="Per hour" value={`${fmtUsd(metrics.usdPerHour)}/hr`} accent={C.cyan} />}
        <Metric label="Tips" value={fmtInt(metrics.tipCount)} sub={metrics.avgTipUsd > 0 ? `${fmtUsd(metrics.avgTipUsd)} average` : null} />
        <Metric label="Tippers" value={fmtInt(metrics.uniqueTippers)} />
        <Metric label="Largest tip" value={fmtUsd(metrics.largestTipUsd)} accent={C.gold} />
      </div>

      {goal && (
        <Section title="Goal">
          <div style={card({ padding: '16px 18px' })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 9 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: goal.reached ? C.green : C.text }}>
                {goal.reached ? 'Goal reached' : `${fmtInt(goal.remaining)} tokens short`}
              </span>
              <span style={{ fontSize: 13, color: C.muted, whiteSpace: 'nowrap' }}>
                {fmtInt(goal.earned)} / {fmtInt(goal.target)}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${goal.pct}%`, borderRadius: 3, background: goal.reached ? `linear-gradient(90deg, ${C.green}, ${C.cyan})` : `linear-gradient(90deg, ${C.gold}, ${C.cyan})` }} />
            </div>
          </div>
        </Section>
      )}

      {insights.length > 0 && (
        <Section title="What happened">
          <div style={card({ padding: '6px 0' })}>
            {insights.map((ins, i) => (
              <div key={`${ins.kind}-${i}`} style={{ display: 'flex', gap: 11, padding: '11px 18px', alignItems: 'flex-start' }}>
                <span style={{ color: C.cyan, fontSize: 13, lineHeight: 1.55, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55, minWidth: 0 }}>{ins.text}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(fans.returning.length > 0 || fans.highValue.length > 0) && (
        <Section title="Supporters in this stream">
          <div style={card({ padding: '6px 0' })}>
            {[...fans.highValue, ...fans.returning.filter(f => !fans.highValue.some(h => h.username === f.username))]
              .slice(0, 5)
              .map((f) => (
                <div
                  key={f.username}
                  onClick={onViewFan ? () => onViewFan(f.username) : undefined}
                  role={onViewFan ? 'button' : undefined}
                  tabIndex={onViewFan ? 0 : undefined}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                    padding: '11px 18px', cursor: onViewFan ? 'pointer' : 'default' }}
                >
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: C.white, wordBreak: 'break-word', minWidth: 0 }}>{f.username}</span>
                    {f.tier && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.cyan, background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{f.tier}</span>
                    )}
                    {f.returning && (
                      <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>returning</span>
                    )}
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: C.green, whiteSpace: 'nowrap' }}>{fmtUsd(f.usdThisStream)}</span>
                </div>
              ))}
          </div>
        </Section>
      )}

      {coaching.delivered > 0 && (
        <Section title="Coaching">
          <div style={card({ padding: '14px 18px' })}>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>
              <strong style={{ color: C.white }}>{coaching.delivered}</strong> prompt{coaching.delivered === 1 ? '' : 's'} fired ·{' '}
              <strong style={{ color: C.green }}>{coaching.performed}</strong> acted on ·{' '}
              <strong style={{ color: C.muted }}>{coaching.skipped}</strong> skipped
            </div>
            {/* Rates only against prompts that actually resolved — a prompt
                still pending at the end of a stream is neither. */}
            {coaching.performedRate !== null && (
              <div style={{ fontSize: 12, color: C.dim, marginBottom: coaching.moments.length ? 12 : 0 }}>
                {coaching.performedRate}% acted on · {coaching.skippedRate}% skipped, of {coaching.resolved} resolved
              </div>
            )}
            {coaching.moments.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderTop: i === 0 ? `1px solid ${C.border}` : `1px solid ${C.border}` }}>
                <span style={{ fontSize: 11, color: m.status === 'performed' ? C.green : C.dim, flexShrink: 0, marginTop: 2 }}>
                  {m.status === 'performed' ? '✓' : m.status === 'skipped' ? '—' : '·'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.white }}>{m.title}</div>
                  {m.message && <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>{m.message}</div>}
                  {/* What the room did next — an observation window, never an
                      attribution. There is no counterfactual in the data, so
                      no "this prompt increased revenue by X%" is possible. */}
                  <div style={{ fontSize: 11.5, color: C.dim, marginTop: 4 }}>
                    {m.outcome
                      ? `Next ${m.outcome.windowMinutes} min: ${m.outcome.tokens.toLocaleString()} tokens from ${m.outcome.tips} tip${m.outcome.tips === 1 ? '' : 's'}`
                      : 'Outcome measurement not available yet'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* D5. The schema has no marker separating streams run before CamCash
          from streams run after — imported CSV history spans both — so the
          surface exists and says so instead of printing an invented figure. */}
      {!report.impact.available && (
        <div style={{ ...card({ padding: '12px 16px' }), fontSize: 12, color: C.dim }}>
          CamCash impact: not enough history yet to measure. This needs a
          before/after baseline the data does not carry today.
        </div>
      )}
    </div>
  )
}
