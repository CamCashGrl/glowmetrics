'use client'
import { C, glassCard } from './theme'

function MetricCard({ label, value, accent, sub }) {
  return (
    <div style={{ ...glassCard, padding: '16px 18px', flex: '1 1 180px', minWidth: 160 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || C.white, letterSpacing: -0.4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const fmtUsd = n => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function SummaryCards({ totals, dataAvailability }) {
  if (!totals) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 14 }}>
        <MetricCard label="Tips & imported earnings" value={fmtUsd(totals.tipsAndImportedUSD)} accent={C.cyan} />
        <MetricCard
          label="Paid/private session earnings"
          value={fmtUsd(totals.paidSessionUSD)}
          accent={C.purple}
          sub={!totals.hasPaidSessionData ? 'No paid/private session records in this period' : undefined}
        />
        <MetricCard label="Total recorded gross earnings" value={fmtUsd(totals.totalGrossUSD)} accent={C.green} />
      </div>

      {totals.hasPaidSessionData && (
        <div style={{ ...glassCard, padding: '10px 16px', marginBottom: 14, borderColor: 'rgba(168,85,247,0.35)' }}>
          <span style={{ fontSize: 12, color: C.muted }}>
            Your Tax Organizer includes recorded paid/private session earnings that may not currently appear in your Command Center total.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 14 }}>
        <MetricCard label="Records included" value={totals.recordCount.toLocaleString('en-US')} />
        <MetricCard label="Platforms included" value={totals.platformCount} />
        <MetricCard label="Earliest record" value={totals.earliestDate || '—'} />
        <MetricCard label="Latest record" value={totals.latestDate || '—'} />
      </div>

      <div style={{ ...glassCard, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 10 }}>Data Availability</div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          <li style={{ fontSize: 12, color: C.muted }}>
            {dataAvailability?.platformFeesRecorded ? 'Platform fees recorded' : 'Platform fees are not currently recorded.'}
          </li>
          <li style={{ fontSize: 12, color: C.muted }}>
            {dataAvailability?.processingFeesRecorded ? 'Processing fees recorded' : 'Processing fees are not currently recorded.'}
          </li>
          <li style={{ fontSize: 12, color: C.muted }}>
            {dataAvailability?.refundsAndChargebacksRecorded ? 'Refunds/chargebacks recorded' : 'Refunds and chargebacks are not currently recorded.'}
          </li>
          <li style={{ fontSize: 12, color: C.muted }}>
            {dataAvailability?.confirmedPayoutsRecorded ? 'Confirmed payouts recorded' : 'Confirmed payouts are not currently recorded.'}
          </li>
        </ul>
      </div>
    </div>
  )
}
