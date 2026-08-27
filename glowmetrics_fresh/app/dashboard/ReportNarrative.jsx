'use client'
// ═══════════════════════════════════════════════════════════════════════════
// CREATOR REPORT — the generated narrative
//
// The report used to be the dashboard's cards restacked under a report title.
// This is the document half: a header that names the creator's own data range,
// her discoveries ordered strongest-first, and for each one the same three
// beats — evidence, what it means, what to do with it — then one action list
// and ONE Pro section rather than a sales pitch per card.
//
// Typographic, not a card grid. That difference is the point: opening the
// report should not feel like opening another tab of the dashboard.
//
// It computes nothing. buildReportDiscoveries() (lib/reportDiscoveries.js)
// reads the canonical analytics and intelligence objects and gates every claim
// on the existing ladder; below the floor a discovery states what evidence is
// still missing instead of claiming anything.
// ═══════════════════════════════════════════════════════════════════════════

import ConfidenceBadge from './ConfidenceBadge'

const C = {
  white: '#F1F5F9', text: '#94A3B8', muted: '#64748B', dim: '#475569',
  cyan: '#22D3EE', indigo: '#7C5CFF',
  border: 'rgba(255,255,255,0.09)',
  rule: 'rgba(255,255,255,0.07)',
}
const GRADIENT = 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)'

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : null
const fmtNum = (v) => (Number(v) || 0).toLocaleString('en-US')
const fmtUsd = (v) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Header — names the report, its source and its real date range. */
export function ReportHeader({ facts, calibration, firstName }) {
  const from = fmtDate(facts?.from)
  const to = fmtDate(facts?.to)
  const pct = calibration?.pct ?? 0
  return (
    <header style={{ marginBottom: 34 }}>
      <div style={{ height: 3, width: 84, background: GRADIENT, borderRadius: 2, marginBottom: 20 }} />
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.cyan, marginBottom: 12 }}>
        CamCash Creator Report
      </div>
      <h1 style={{ fontSize: 34, fontWeight: 850, color: C.white, letterSpacing: '-0.035em', lineHeight: 1.12, margin: 0, maxWidth: 640 }}>
        {firstName ? `What CamCash has learned about ${firstName}'s business` : 'What CamCash has learned about your business'}
      </h1>
      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, maxWidth: 620, margin: '14px 0 0' }}>
        Built entirely from the data you have imported — no benchmarks, no averages from other
        creators, nothing estimated on your behalf.
      </p>

      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.rule}` }}>
        {from && to && <Meta label="Covering" value={`${from} — ${to}`} />}
        <Meta label="Tips read" value={fmtNum(facts?.tips)} />
        <Meta label="Sessions" value={fmtNum(facts?.sessions)} />
        <Meta label="Fans" value={fmtNum(facts?.fans)} />
        <Meta label="Earnings" value={fmtUsd(facts?.earnings)} />
        <Meta label="Calibration" value={`${pct}%`} />
      </div>
    </header>
  )
}

function Meta({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase', color: C.dim, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.white }}>{value}</div>
    </div>
  )
}

/** One discovery, told as discovery → evidence → meaning → what to do. */
export function ReportDiscovery({ discovery, index, intelligence }) {
  const d = discovery
  return (
    <article style={{ paddingTop: 26, marginTop: 26, borderTop: `1px solid ${C.rule}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dim, letterSpacing: '0.1em' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{d.eyebrow}</span>
        <span style={{ marginLeft: 'auto' }}>
          <ConfidenceBadge intelligence={intelligence} insight={d.insightId} />
        </span>
      </div>

      <div style={{ fontSize: 27, fontWeight: 850, color: C.white, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 14 }}>
        {d.title}
      </div>

      {/* Evidence — the counts, before the interpretation. */}
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 16 }}>
        {(d.evidence || []).map(e => (
          <div key={e.label}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.cyan, letterSpacing: '-0.01em' }}>{e.value}</div>
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{e.label}</div>
          </div>
        ))}
      </div>

      {/* What this means — plain language, past tense, no forecast. */}
      <div style={{ fontSize: 14.5, color: C.text, lineHeight: 1.75, maxWidth: 640, marginBottom: d.claimable ? 12 : 10 }}>
        {d.meaning}
      </div>

      {d.claimable ? (
        d.action && (
          <div style={{ fontSize: 13, color: C.white, lineHeight: 1.6 }}>
            <span style={{ color: C.indigo, fontWeight: 800 }}>What to do with it · </span>
            {d.action.label}.
          </div>
        )
      ) : (
        d.nextMilestone && (
          <div style={{ fontSize: 13, color: C.cyan, lineHeight: 1.6 }}>
            To state this as a finding: {d.nextMilestone}.
          </div>
        )
      )}
    </article>
  )
}

/** The action list — claimable discoveries only, one primary. */
export function ReportActions({ actions, isPro, onAction, onUpgrade }) {
  if (!actions?.length) return null
  const [primary, ...rest] = actions
  return (
    <section style={{ marginTop: 40, paddingTop: 26, borderTop: `1px solid ${C.rule}` }}>
      <SectionTitle>What to do next</SectionTitle>
      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7, maxWidth: 620, marginBottom: 18 }}>
        Each of these follows from a finding above that has enough evidence behind it to act on.
      </div>
      <button
        onClick={() => (isPro ? onAction?.(primary) : onUpgrade?.(primary.source))}
        style={{
          padding: '13px 24px', borderRadius: 100, border: 'none', cursor: 'pointer',
          background: GRADIENT, color: '#06101A', fontSize: 14, fontWeight: 850,
        }}
      >{primary.label} →</button>
      {rest.length > 0 && (
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 12 }}>
          {rest.map(a => (
            <button key={a.source} onClick={() => (isPro ? onAction?.(a) : onUpgrade?.(a.source))} style={{
              padding: '10px 17px', borderRadius: 100, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
              color: C.white, fontSize: 12.5, fontWeight: 700,
            }}>{a.label}</button>
          ))}
        </div>
      )}
    </section>
  )
}

/** ONE Pro section for the whole report. */
export function ReportPro({ actions, onUpgrade }) {
  if (!actions?.length) return null
  return (
    <section style={{
      marginTop: 34, borderRadius: 18, padding: '24px 24px',
      border: '1px solid rgba(124,92,255,0.22)',
      background: 'linear-gradient(140deg, rgba(124,92,255,0.09), rgba(34,211,238,0.04))',
    }}>
      <SectionTitle>What Pro helps you do with these</SectionTitle>
      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7, maxWidth: 620, marginBottom: 16 }}>
        Everything above is yours to read for free. Pro is where each finding becomes something you
        can act on — the schedule built around your strongest windows, the fans behind a pattern and
        their recorded activity, and the deeper platform comparison.
      </div>
      <button onClick={() => onUpgrade?.(actions[0].source)} style={{
        padding: '12px 22px', borderRadius: 100, border: 'none', cursor: 'pointer',
        background: GRADIENT, color: '#06101A', fontSize: 13.5, fontWeight: 850,
      }}>{actions[0].label} with Pro →</button>
    </section>
  )
}

export function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.cyan, marginBottom: 12 }}>
      {children}
    </div>
  )
}

/** Low-data report: honest about having found nothing yet. */
export function ReportEmpty({ facts, nextEvidence, onImport }) {
  return (
    <section style={{ paddingTop: 26, marginTop: 26, borderTop: `1px solid ${C.rule}` }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.white, letterSpacing: '-0.02em', marginBottom: 12 }}>
        No pattern has enough evidence behind it yet
      </div>
      <div style={{ fontSize: 14.5, color: C.text, lineHeight: 1.75, maxWidth: 620 }}>
        CamCash has read {fmtNum(facts?.tips)} tip{facts?.tips === 1 ? '' : 's'} across{' '}
        {fmtNum(facts?.sessions)} session{facts?.sessions === 1 ? '' : 's'}. That is real data, but
        not yet enough of it in any one place to tell you something you can rely on. Rather than
        guess, this report will stay honest and fill in as your history grows.
      </div>
      {nextEvidence?.label && (
        <div style={{ fontSize: 13.5, color: C.cyan, marginTop: 14 }}>
          Closest to a finding: {nextEvidence.insightLabel} — {nextEvidence.label}.
        </div>
      )}
      {onImport && (
        <button onClick={onImport} style={{
          marginTop: 18, padding: '12px 22px', borderRadius: 100, border: 'none', cursor: 'pointer',
          background: GRADIENT, color: '#06101A', fontSize: 13.5, fontWeight: 850,
        }}>Import more history →</button>
      )}
    </section>
  )
}
