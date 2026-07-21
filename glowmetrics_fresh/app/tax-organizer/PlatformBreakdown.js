'use client'
import { C, glassCard, sectionTitle } from './theme'

const fmtUsd = v => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Badge({ children, tone = 'warning' }) {
  const tones = {
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', color: C.gold },
    danger: { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.4)', color: C.red },
  }
  const t = tones[tone] || tones.warning
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
      background: t.bg, border: `1px solid ${t.border}`, color: t.color, marginLeft: 6,
    }}>
      {children}
    </span>
  )
}

export default function PlatformBreakdown({ platforms }) {
  return (
    <div style={{ ...glassCard, padding: 20, marginBottom: 20 }}>
      <div style={sectionTitle}>Platform Breakdown</div>

      {(!platforms || platforms.length === 0) ? (
        <div style={{ fontSize: 13, color: C.muted }}>No earnings recorded for this period.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {platforms.map(p => {
            const isUnknown = p.platform === 'Unknown platform'
            return (
              <div key={p.platform} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>
                    {p.platform}
                    {isUnknown && <Badge tone="danger">Unknown platform</Badge>}
                    {p.multipleRatesObserved && <Badge tone="warning">Multiple rates used</Badge>}
                    {p.currentDefaultRate == null && !isUnknown && <Badge tone="warning">No default rate on file</Badge>}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{fmtUsd(p.totalUSD)}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 10, fontSize: 12, color: C.text }}>
                  <div><span style={{ color: C.muted }}>Tips & imported: </span>{fmtUsd(p.tipsUSD)}</div>
                  <div><span style={{ color: C.muted }}>Paid sessions: </span>{fmtUsd(p.paidSessionUSD)}</div>
                  <div><span style={{ color: C.muted }}>% of period: </span>{p.pctOfPeriod}%</div>
                  <div><span style={{ color: C.muted }}>Records: </span>{p.recordCount}</div>
                  <div><span style={{ color: C.muted }}>Tokens: </span>{p.tokens.toLocaleString('en-US')}</div>
                  <div>
                    <span style={{ color: C.muted }}>Rate(s) observed: </span>
                    {p.ratesObservedInPeriod.length ? p.ratesObservedInPeriod.map(r => `$${r}`).join(', ') : '—'}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
                  {p.currentDefaultRate != null
                    ? `Current platform default rate: $${p.currentDefaultRate}/token. Historical stored USD amounts are not recalculated using this rate — shown for reference only.`
                    : 'This platform has no known default token rate on file.'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
